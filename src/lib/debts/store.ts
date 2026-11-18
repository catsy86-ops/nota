import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { localDayKey } from "@/lib/dayDone";
import { cleanDebt, DEBT_NOTE_MAX, DEBT_PERSON_MAX, normalizeName, parseAmount, personKey, type DebtEntry, type DebtKind } from "./model";
import { createYDebts } from "./yDebts";
import { cleanPlan, planState, PLAN_MAX_RATES, PLAN_MIN_RATES, rateAmounts, rateDue, rateEntryId, syncPlanNote, type DebtPlan, type PlanState } from "./plans";

/**
 * Długi żyją w dokumencie Yjs notatek (`yDebts.ts`). Komponenty czytają przez
 * `useDebts()` i zmieniają wyłącznie akcjami poniżej.
 */
const yDebts = createYDebts(yjsStore.doc);

export function useDebts(): DebtEntry[] {
  return useSyncExternalStore(yDebts.subscribe, yDebts.get);
}

const getPlansSnapshot = () => yDebts.plans();

/** Plany rat (L2.1) — tylko z istniejącą pożyczką. */
export function useDebtPlans(): DebtPlan[] {
  return useSyncExternalStore(yDebts.subscribe, getPlansSnapshot);
}

export function getDebtPlans(): DebtPlan[] {
  return yDebts.plans();
}

/**
 * Skutek w notatkach planów: termin następnej raty (tylko do przodu) albo zdjęty po ostatniej. Woła się w transakcji
 * zmiany wpisów (§2.1, zasada 6), więc czyta stan świeży, nie z pamięci podręcznej. Notatki prywatnej nie czyta
 * (`readPlainNote` → `null`) — wtedy skutek jest pomijany.
 */
function syncPlanNotes(): void {
  const entries = yDebts.get(true);
  for (const plan of yDebts.plans(true)) {
    const loan = entries.find((e) => e.id === plan.entryId);
    if (!loan?.dueNoteId) continue;
    const state = planState(plan, entries);
    if (!state) continue;
    const patch = syncPlanNote(plan, state, yjsStore.readPlainNote(loan.dueNoteId));
    if (patch) yjsStore.patchNote(loan.dueNoteId, patch);
  }
}

/** Zmiana wpisów i skutek w notatkach planów jedną transakcją. */
function withPlans<T>(fn: () => T): T {
  let out!: T;
  yDebts.transact(() => {
    out = fn();
    if (yDebts.plans(true).length > 0) syncPlanNotes();
  });
  return out;
}

export interface NewPlanInput {
  entryId: string;
  count: number;
  day: number;
  first: string;
}

/** Plan rat dla pożyczki. `null` — zła liczba rat, rata 0 gr albo wpisu nie ma. */
export function addDebtPlan(input: NewPlanInput): DebtPlan | null {
  const loan = yDebts.get(true).find((e) => e.id === input.entryId);
  if (!loan || (loan.kind !== "lent" && loan.kind !== "borrowed")) return null;
  if (!Number.isInteger(input.count) || input.count < PLAN_MIN_RATES || input.count > PLAN_MAX_RATES) return null;
  if (rateAmounts(loan.amount, input.count)[0] <= 0) return null;
  const plan = cleanPlan({ id: `p-${crypto.randomUUID()}`, entryId: input.entryId, count: input.count, day: input.day, first: input.first, created: Date.now() });
  if (!plan) return null;
  return yDebts.addPlan(plan) ? plan : null;
}

/**
 * Notatka planu: seria miesięczna z **jawnym** dniem planu (plan na 31. zaczęty w lutym nie przyklei się do 28.)
 * i końcem w dniu ostatniej raty.
 */
export function attachPlanNote(noteId: string, plan: DebtPlan): void {
  const last = rateDue(plan, plan.count);
  const end = new Date(Number(last.slice(0, 4)), Number(last.slice(5, 7)) - 1, Number(last.slice(8, 10)), 23, 59, 59, 999).getTime();
  yjsStore.patchNote(noteId, { reminderRepeat: "monthly", reminderDay: plan.day, reminderRepeatUntil: end });
}

/** Stan planu (rata k z n, wpłacone, zaległe). */
export function debtPlanState(plan: DebtPlan): PlanState | null {
  return planState(plan, yDebts.get());
}

/**
 * „Rata wpłacona”: zwykły wpis spłaty na brakującą część następnej raty. Id wyliczone z planu i numeru raty —
 * dwa telefony naraz zapisują ten sam klucz (jeden wpis). Zajęty klucz (wcześniejszą spłatę usunięto) → id losowe.
 */
export function payDebtRate(planId: string): { entry: DebtEntry; k: number; count: number; undo: () => void } | null {
  const plan = yDebts.plans(true).find((p) => p.id === planId);
  if (!plan) return null;
  const entries = yDebts.get(true);
  const loan = entries.find((e) => e.id === plan.entryId);
  const state = planState(plan, entries);
  if (!loan || !state?.next || state.next.toPay <= 0) return null;
  const derived = rateEntryId(plan.id, state.next.k);
  const entry: DebtEntry = {
    id: yDebts.has(derived) ? `d-${crypto.randomUUID()}` : derived,
    person: loan.person,
    kind: loan.kind === "lent" ? "repaid" : "returned",
    amount: state.next.toPay,
    at: localDayKey(),
    note: `Rata ${state.next.k} z ${plan.count}`,
    created: Date.now(),
  };
  const noteId = loan.dueNoteId;
  const before = noteId ? yjsStore.readPlainNote(noteId) : null;
  const ok = withPlans(() => yDebts.add(entry));
  if (!ok) return null;
  const after = noteId ? yjsStore.readPlainNote(noteId) : null;
  // „Cofnij” tej akcji oddaje dokładnie to, co przesunęła: termin notatki — tylko jeśli od tej chwili nikt go nie zmienił.
  const undo = () => yDebts.transact(() => {
    yDebts.remove(entry.id);
    const now = noteId ? yjsStore.readPlainNote(noteId) : null;
    if (noteId && before && after && now && now.reminder === after.reminder && after.reminder !== before.reminder) {
      yjsStore.patchNote(noteId, { reminder: before.reminder, reminderDay: before.reminderDay, reminderBase: before.reminderBase });
    }
  });
  return { entry, k: state.next.k, count: plan.count, undo };
}

/** Wpisy bez subskrypcji — dla akcji spoza widoku (2.3: „Gotowe” w Terminach). */
export function getDebts(): DebtEntry[] {
  return yDebts.get();
}

export interface NewDebtInput {
  person: string;
  kind: DebtKind;
  /** Kwota w groszach — już sprawdzona przez `parseAmount`. */
  amount: number;
  /** Dzień `YYYY-MM-DD`; domyślnie dziś. */
  at?: string;
  note?: string;
  /** Wpis z „Oddał całość” (1.6). */
  settle?: true;
}

/** `null` = niepoprawne dane (pusta osoba, za długa nazwa, zły dzień, pełna lista). */
export function addDebt(input: NewDebtInput): DebtEntry | null {
  const person = normalizeName(input.person).slice(0, DEBT_PERSON_MAX);
  const at = input.at ?? localDayKey();
  if (!person || !personKey(person)) return null;
  const entry: DebtEntry = {
    id: `d-${crypto.randomUUID()}`,
    person,
    kind: input.kind,
    amount: input.amount,
    at,
    note: (input.note ?? "").trim().slice(0, DEBT_NOTE_MAX),
    created: Date.now(),
    ...(input.settle ? { settle: true as const } : {}),
  };
  return withPlans(() => yDebts.add(entry)) ? entry : null;
}

/** Wygodne wejście z pola tekstowego: `null` = kwota nie przeszła walidacji. */
export function addDebtFromText(person: string, kind: DebtKind, amountText: string, note = "", at?: string): DebtEntry | null {
  const amount = parseAmount(amountText);
  if (amount === null) return null;
  return addDebt({ person, kind, amount, note, at });
}

export function removeDebt(id: string): DebtEntry | null {
  return withPlans(() => yDebts.remove(id));
}

export function restoreDebt(entry: DebtEntry): void {
  withPlans(() => yDebts.restore(entry));
}

/**
 * Poprawka istniejącego wpisu. Dane przechodzą przez to samo czyszczenie co przy zapisie;
 * `null` = niepoprawne dane albo wpisu już nie ma (np. usunięty na drugim telefonie).
 */
export function updateDebt(entry: DebtEntry): DebtEntry | null {
  const clean = cleanDebt(entry);
  if (!clean) return null;
  return withPlans(() => yDebts.replace(clean)) ? clean : null;
}

/**
 * 3.1 Zmiana nazwy i łączenie: wszystkie wpisy osób o kluczach `fromKeys` dostają nazwę `name` — jedną
 * transakcją. Zwraca poprzednie wpisy (do „Cofnij” przez `restoreDebts`) albo `null`, gdy nie ma czego zmieniać.
 */
export function renamePeople(fromKeys: readonly string[], name: string): DebtEntry[] | null {
  const clean = normalizeName(name).slice(0, DEBT_PERSON_MAX);
  if (!clean) return null;
  const keys = new Set(fromKeys);
  const prev = yDebts.get().filter((e) => keys.has(personKey(e.person)));
  if (prev.length === 0) return null;
  withPlans(() => yDebts.replaceMany(prev.map((e) => ({ ...e, person: clean }))));
  return prev;
}

/**
 * „Cofnij” po zmianie nazwy albo łączeniu: wraca **tylko** pole `person`, i tylko we wpisach, które nadal noszą nową
 * nazwę (R-18). Kwota zmieniona w tym czasie na drugim telefonie zostaje; wpis przemianowany dalej — też.
 */
export function restoreDebts(prev: readonly DebtEntry[], renamedTo: string): void {
  const key = personKey(renamedTo);
  const now = new Map(yDebts.get().map((e) => [e.id, e]));
  const back: DebtEntry[] = [];
  for (const p of prev) {
    const cur = now.get(p.id);
    if (cur && personKey(cur.person) === key) back.push({ ...cur, person: p.person });
  }
  withPlans(() => yDebts.replaceMany(back));
}

/** Zrzut Długów do kopii zapasowej. */
export function debtsDump(): DebtEntry[] {
  return yDebts.dump();
}

/** Scalenie Długów z kopii — bez kasowania tego, co już jest na telefonie. */
export function mergeDebtsDump(raw: unknown): void {
  withPlans(() => yDebts.mergeDump(raw));
}

/** Plany rat do kopii (pole `debtPlans`). */
export function debtPlansDump(): DebtPlan[] {
  return yDebts.dumpPlans();
}

/** Plany z kopii — po scaleniu wpisów (plan bez pożyczki jest pomijany). */
export function mergeDebtPlansDump(raw: unknown): void {
  withPlans(() => yDebts.mergePlans(raw));
}

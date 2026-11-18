import { extraOf, keepV, tooNew } from "@/lib/extraFields";
import { localDayKey } from "@/lib/dayDone";
import { ruleOf } from "@/lib/reminderRepeat";
import type { ReminderRepeat, RepeatRule } from "@/lib/reminderRepeat";
import { KIND_SIGN, personKey, type DebtEntry } from "./model";

/**
 * Raty (L2.1, DL-1: jedna seria; `docs/plan-zgodnosc-i-obieg.md` §2.2). Plan wisi na wpisie pożyczki i nie trzyma
 * ani kwoty, ani notatki: kwota to `amount` wpisu, notatka — `dueNoteId` wpisu. Stan rat jest wyprowadzany ze spłat
 * (`allocate`), nie liczony licznikiem — spłata ręczna, częściowa, nadpłata i usunięcie spłaty działają same.
 */

export interface DebtPlan {
  id: string;
  entryId: string;
  /** Liczba rat, 2–60. */
  count: number;
  /** Dzień miesiąca raty, 1–31 (krótszy miesiąc → ostatni dzień). */
  day: number;
  /** Termin 1. raty, `YYYY-MM-DD`. */
  first: string;
  created: number;
  v?: number;
  extra?: Record<string, unknown>;
}

export const DEBT_PLAN_V = 1;
export const PLAN_MIN_RATES = 2;
export const PLAN_MAX_RATES = 60;
const PLAN_KNOWN = ["id", "entryId", "count", "day", "first", "created"] as const;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_MAX = 64;

export function cleanPlan(raw: unknown): DebtPlan | null {
  const p = raw as Partial<DebtPlan> | null;
  if (!p || typeof p !== "object" || tooNew(p, DEBT_PLAN_V)) return null;
  if (typeof p.id !== "string" || !p.id || p.id.length > ID_MAX) return null;
  if (typeof p.entryId !== "string" || !p.entryId || p.entryId.length > ID_MAX) return null;
  if (!Number.isInteger(p.count) || p.count! < PLAN_MIN_RATES || p.count! > PLAN_MAX_RATES) return null;
  if (!Number.isInteger(p.day) || p.day! < 1 || p.day! > 31) return null;
  if (typeof p.first !== "string" || !DAY_RE.test(p.first) || Number.isNaN(Date.parse(p.first))) return null;
  const created = typeof p.created === "number" && Number.isFinite(p.created) ? p.created : 0;
  const extra = extraOf(p, PLAN_KNOWN);
  return { id: p.id, entryId: p.entryId, count: p.count!, day: p.day!, first: p.first, created, ...keepV(p), ...(extra ? { extra } : {}) };
}

const pad = (n: number) => String(n).padStart(2, "0");
const daysIn = (y: number, m0: number) => new Date(y, m0 + 1, 0).getDate();

/** Termin raty `k` (1…count): miesiąc `first` + (k − 1), dzień `min(day, dni w miesiącu)` — jak seria `monthly` z `anchorDay`. */
export function rateDue(plan: Pick<DebtPlan, "first" | "day">, k: number): string {
  const y0 = Number(plan.first.slice(0, 4));
  const m0 = Number(plan.first.slice(5, 7)) - 1 + (k - 1);
  const y = y0 + Math.floor(m0 / 12);
  const m = ((m0 % 12) + 12) % 12;
  return `${y}-${pad(m + 1)}-${pad(Math.min(plan.day, daysIn(y, m)))}`;
}

/** Kwoty rat w groszach: równe `floor(total / count)`, ostatnia dopełnia do `total`. `base = 0` — formularz odrzuca. */
export function rateAmounts(total: number, count: number): number[] {
  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? total - base * (count - 1) : base));
}

const byOldest = (a: DebtEntry, b: DebtEntry) => (a.at !== b.at ? (a.at < b.at ? -1 : 1) : a.created !== b.created ? a.created - b.created : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Zaliczenie spłat „najstarszy dług pierwszy” (art. 451 § 3 KC) w obrębie jednej osoby. `sign` = strona długu:
 * 1 — dług osoby wobec nas (pożyczki `KIND_SIGN > 0`, spłacane wpisami `< 0`), −1 — lustrzanie. Spłata bez
 * otwartego długu staje się nadpłatą (`credit`) i pokrywa następny dług. Zwraca pokrycie każdego długu.
 */
export function allocate(entries: readonly DebtEntry[], sign: 1 | -1): { covered: Map<string, number>; credit: number } {
  const covered = new Map<string, number>();
  const open: { id: string; left: number }[] = [];
  let credit = 0;
  for (const e of [...entries].sort(byOldest)) {
    if (KIND_SIGN[e.kind] === sign) {
      const c = Math.min(credit, e.amount);
      credit -= c;
      covered.set(e.id, c);
      if (e.amount > c) open.push({ id: e.id, left: e.amount - c });
    } else {
      let pay = e.amount;
      while (pay > 0 && open.length > 0) {
        const d = open[0];
        const c = Math.min(pay, d.left);
        d.left -= c;
        pay -= c;
        covered.set(d.id, (covered.get(d.id) ?? 0) + c);
        if (d.left === 0) open.shift();
      }
      credit += pay;
    }
  }
  return { covered, credit };
}

export interface PlanState {
  total: number;
  amounts: number[];
  /** Ile z kwoty pożyczki zostało pokryte spłatami. */
  paid: number;
  /** Liczba w pełni zapłaconych rat. */
  done: number;
  /** Wpłacone ponad raty 1…done (na poczet następnej). */
  partial: number;
  /** Następna rata albo `null`, gdy plan zakończony. */
  next: { k: number; due: string; toPay: number; amount: number } | null;
  overdue: number;
  finished: boolean;
}

/** Stan planu ze spłat osoby. `null` — wpisu pożyczki już nie ma (plan sierota). */
export function planState(plan: DebtPlan, entries: readonly DebtEntry[], today = localDayKey()): PlanState | null {
  const loan = entries.find((e) => e.id === plan.entryId);
  if (!loan) return null;
  const key = personKey(loan.person);
  const { covered } = allocate(entries.filter((e) => personKey(e.person) === key), KIND_SIGN[loan.kind]);
  const total = loan.amount;
  const amounts = rateAmounts(total, plan.count);
  const paid = Math.min(total, covered.get(loan.id) ?? 0);
  let done = 0;
  let sum = 0;
  while (done < plan.count && sum + amounts[done] <= paid) sum += amounts[done++];
  const partial = paid - sum;
  const finished = done === plan.count;
  let overdue = 0;
  for (let k = done + 1; k <= plan.count; k++) if (rateDue(plan, k) < today) overdue++;
  const next = finished ? null : { k: done + 1, due: rateDue(plan, done + 1), toPay: amounts[done] - partial, amount: amounts[done] };
  return { total, amounts, paid, done, partial, next, overdue, finished };
}

export interface OverdueRate { planId: string; person: string; k: number; count: number; toPay: number; daysLate: number }

/** L2.4: najstarsza zaległa rata każdego planu (termin < dziś), od najdłużej zaległej. */
export function overdueRates(plans: readonly DebtPlan[], entries: readonly DebtEntry[], today = localDayKey()): OverdueRate[] {
  const out: OverdueRate[] = [];
  const dayMs = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
  for (const plan of plans) {
    const st = planState(plan, entries, today);
    const loan = entries.find((e) => e.id === plan.entryId);
    if (!st?.next || st.overdue === 0 || !loan) continue;
    out.push({ planId: plan.id, person: loan.person, k: st.next.k, count: plan.count, toPay: st.next.toPay, daysLate: Math.round((dayMs(today) - dayMs(st.next.due)) / 86_400_000) });
  }
  return out.sort((a, b) => b.daysLate - a.daysLate);
}

/** Identyfikator spłaty raty `k` — wyliczony, więc dwa telefony stukające naraz zapisują jeden wpis. */
export const rateEntryId = (planId: string, k: number) => `dr-${planId}-${k}`;

export interface PlanNote {
  reminder: number | null;
  reminderBase?: number;
  reminderRepeat?: ReminderRepeat;
  reminderRule?: RepeatRule;
  trashed?: boolean;
}

export type PlanNotePatch = { reminder: null } | { reminder: number; reminderDay: number; reminderBase: undefined };

/**
 * Łatka terminu notatki planu albo `null`. Tylko notatka istniejąca, poza koszem i nadal miesięczna (starszy telefon
 * mógł podmienić ją na jednorazową). Zakończony plan zdejmuje termin; inaczej termin idzie **tylko do przodu** —
 * na termin następnej raty, o godzinie serii.
 */
export function syncPlanNote(plan: DebtPlan, state: PlanState, note: PlanNote | null): PlanNotePatch | null {
  if (!note || note.trashed || ruleOf(note).kind !== "monthly") return null;
  if (state.finished || !state.next) return note.reminder === null ? null : { reminder: null };
  const cur = note.reminderBase ?? note.reminder;
  if (cur === null) return null;
  const target = state.next.due;
  if (localDayKey(new Date(cur)) >= target) return null;
  const at = new Date(cur);
  const t = new Date(Number(target.slice(0, 4)), Number(target.slice(5, 7)) - 1, Number(target.slice(8, 10)), at.getHours(), at.getMinutes(), 0, 0);
  return { reminder: t.getTime(), reminderDay: plan.day, reminderBase: undefined };
}

import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { localDayKey } from "@/lib/dayDone";
import { cleanDebt, DEBT_NOTE_MAX, DEBT_PERSON_MAX, normalizeName, parseAmount, personKey, type DebtEntry, type DebtKind } from "./model";
import { createYDebts } from "./yDebts";

/**
 * Długi żyją w dokumencie Yjs notatek (`yDebts.ts`). Komponenty czytają przez
 * `useDebts()` i zmieniają wyłącznie akcjami poniżej.
 */
const yDebts = createYDebts(yjsStore.doc);

export function useDebts(): DebtEntry[] {
  return useSyncExternalStore(yDebts.subscribe, yDebts.get);
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
  return yDebts.add(entry) ? entry : null;
}

/** Wygodne wejście z pola tekstowego: `null` = kwota nie przeszła walidacji. */
export function addDebtFromText(person: string, kind: DebtKind, amountText: string, note = "", at?: string): DebtEntry | null {
  const amount = parseAmount(amountText);
  if (amount === null) return null;
  return addDebt({ person, kind, amount, note, at });
}

export function removeDebt(id: string): DebtEntry | null {
  return yDebts.remove(id);
}

export function restoreDebt(entry: DebtEntry): void {
  yDebts.restore(entry);
}

/**
 * Poprawka istniejącego wpisu. Dane przechodzą przez to samo czyszczenie co przy zapisie;
 * `null` = niepoprawne dane albo wpisu już nie ma (np. usunięty na drugim telefonie).
 */
export function updateDebt(entry: DebtEntry): DebtEntry | null {
  const clean = cleanDebt(entry);
  if (!clean) return null;
  return yDebts.replace(clean) ? clean : null;
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
  yDebts.replaceMany(prev.map((e) => ({ ...e, person: clean })));
  return prev;
}

/** Przywraca wpisy sprzed zmiany nazwy albo łączenia (ten sam id). */
export function restoreDebts(entries: readonly DebtEntry[]): void {
  yDebts.replaceMany(entries);
}

/** Zrzut Długów do kopii zapasowej. */
export function debtsDump(): DebtEntry[] {
  return yDebts.dump();
}

/** Scalenie Długów z kopii — bez kasowania tego, co już jest na telefonie. */
export function mergeDebtsDump(raw: unknown): void {
  yDebts.mergeDump(raw);
}

import { useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { localDayKey } from "@/lib/dayDone";
import { DEBT_NOTE_MAX, DEBT_PERSON_MAX, normalizeName, parseAmount, personKey, type DebtEntry, type DebtKind } from "./model";
import { createYDebts } from "./yDebts";

/**
 * Długi żyją w dokumencie Yjs notatek (`yDebts.ts`). Komponenty czytają przez
 * `useDebts()` i zmieniają wyłącznie akcjami poniżej.
 */
const yDebts = createYDebts(yjsStore.doc);

export function useDebts(): DebtEntry[] {
  return useSyncExternalStore(yDebts.subscribe, yDebts.get);
}

export interface NewDebtInput {
  person: string;
  kind: DebtKind;
  /** Kwota w groszach — już sprawdzona przez `parseAmount`. */
  amount: number;
  /** Dzień `YYYY-MM-DD`; domyślnie dziś. */
  at?: string;
  note?: string;
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

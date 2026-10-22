import type { DayEntry } from "./model";

function parseKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Dayk `n` dni po `dayKey` (n może być ujemne). Składowe daty, nie +24 h — zmiana czasu nie przesuwa dni. */
export function addDaysKey(dayKey: string, n: number): string {
  const d = parseKey(dayKey);
  return toKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Liczba dni od `fromKey` do `toKey_` (dodatnia, gdy `toKey_` jest później). */
export function dayDiff(fromKey: string, toKey_: string): number {
  const a = parseKey(fromKey);
  const b = parseKey(toKey_);
  return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86_400_000);
}

/**
 * Nakłada cykl na `length` kolejnych dni od `startKey`. Krok `null` czyści
 * dzień. Zwraca nowy rekord — wejście zostaje nietknięte, więc poprzednią
 * wersję można trzymać do cofnięcia. Notatki dni, które dostają tę samą
 * zmianę co miały, zostają.
 *
 * `anchorKey` (kotwica) to dzień pierwszego kroku: krok dnia `k` to `steps[(k − kotwica) mod długość]`,
 * więc nakładanie od dowolnej daty trzyma się tej samej fazy. Domyślnie kotwica = `startKey`.
 */
export function applyPattern(
  days: Record<string, DayEntry>,
  steps: (string | null)[],
  startKey: string,
  length: number,
  anchorKey: string = startKey,
): Record<string, DayEntry> {
  if (steps.length === 0 || length <= 0) return days;
  const next = { ...days };
  for (let i = 0; i < length; i++) {
    const k = addDaysKey(startKey, i);
    const offset = dayDiff(anchorKey, k);
    const step = steps[((offset % steps.length) + steps.length) % steps.length];
    if (step === null) delete next[k];
    else if (next[k]?.type !== step) next[k] = { type: step };
  }
  return next;
}

/** Liczba dni od `startKey` do końca miesiąca `monthsAhead` miesięcy dalej (włącznie). */
export function daysUntilMonthEnd(startKey: string, monthsAhead = 0): number {
  const start = parseKey(startKey);
  const end = new Date(start.getFullYear(), start.getMonth() + 1 + monthsAhead, 0);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

import type { DayEntry } from "./model";

function parseKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Nakłada cykl na `length` kolejnych dni od `startKey`. Krok `null` czyści
 * dzień. Zwraca nowy rekord — wejście zostaje nietknięte, więc poprzednią
 * wersję można trzymać do cofnięcia. Notatki dni, które dostają tę samą
 * zmianę co miały, zostają.
 */
export function applyPattern(
  days: Record<string, DayEntry>,
  steps: (string | null)[],
  startKey: string,
  length: number,
): Record<string, DayEntry> {
  if (steps.length === 0 || length <= 0) return days;
  const next = { ...days };
  const start = parseKey(startKey);
  for (let i = 0; i < length; i++) {
    // Data budowana od składowych, nie przez +24 h — zmiana czasu nie przesunie dni.
    const k = toKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    const step = steps[i % steps.length];
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

import { format } from "date-fns";
import { pl } from "date-fns/locale";

/**
 * Tydzień od poniedziałku na kluczach dni („2026-10-09”). Klucze budowane od
 * składowych daty, nie przez +24 h — zmiana czasu nie przesunie dnia.
 * Wspólne dla widoku tygodnia w Grafiku i paska tygodnia w Kalendarzu.
 */

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Dzień o `n` dni dalej (może być ujemne); przechodzi przez granicę miesiąca i roku. */
export function addDaysToKey(key: string, n: number): string {
  const d = parseDayKey(key);
  return formatDayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Poniedziałek tygodnia, w którym leży dzień. */
export function startOfWeekKey(key: string): string {
  const d = parseDayKey(key);
  const sinceMonday = (d.getDay() + 6) % 7;
  return addDaysToKey(key, -sinceMonday);
}

/** Siedem kluczy dni, pn–nd, tygodnia z podanym dniem. */
export function weekKeys(key: string): string[] {
  const start = startOfWeekKey(key);
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(start, i));
}

/** „5–11 października 2026” albo „28 września – 4 października 2026” (tydzień od poniedziałku `startKey`). */
export function weekRangeLabel(startKey: string): string {
  const first = parseDayKey(startKey);
  const last = parseDayKey(addDaysToKey(startKey, 6));
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()}–${format(last, "d MMMM yyyy", { locale: pl })}`;
  }
  const from = first.getFullYear() === last.getFullYear() ? format(first, "d MMMM", { locale: pl }) : format(first, "d MMMM yyyy", { locale: pl });
  return `${from} – ${format(last, "d MMMM yyyy", { locale: pl })}`;
}

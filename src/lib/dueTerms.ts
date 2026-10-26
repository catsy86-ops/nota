import { endOfDay } from "./reminderRepeat";
/**
 * Jedna definicja tego, gdzie leży termin względem „teraz”. Licznik zaległych,
 * widok Terminy i „Dziś” liczą przez tę funkcję, więc nie rozjeżdżają się.
 * Czas lokalny (dzień kończy się o północy czasu lokalnego).
 */

export type TermStatus = "overdue" | "today" | "week" | "later";

/** Początek dnia lokalnego, w którym leży `t`. */
export function startOfDayOf(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Koniec dnia lokalnego dla `t`, opcjonalnie przesunięty o `plusDays` dni. */
export function endOfDayOffset(t: number, plusDays = 0): number {
  const d = new Date(t);
  d.setDate(d.getDate() + plusDays);
  return endOfDay(d);
}

/**
 * Zaległy: termin minął. Dziś: do końca dzisiejszego dnia. Najbliższe 7 dni. Później.
 * `allDay` (D-1, plan Dziś 1.1): termin „cały dzień” jest „Dziś” przez cały dzień, a zaległy dopiero od jutra.
 */
export function termStatus(at: number, now: number, allDay = false): TermStatus {
  if (allDay && at >= startOfDayOf(now) && at <= endOfDayOffset(now)) return "today";
  if (at < now) return "overdue";
  if (at <= endOfDayOffset(now)) return "today";
  if (at <= endOfDayOffset(now, 7)) return "week";
  return "later";
}

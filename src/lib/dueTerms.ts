/**
 * Jedna definicja tego, gdzie leży termin względem „teraz”. Licznik zaległych,
 * widok Terminy i „Dziś” liczą przez tę funkcję, więc nie rozjeżdżają się.
 * Czas lokalny (dzień kończy się o północy czasu lokalnego).
 */

export type TermStatus = "overdue" | "today" | "week" | "later";

/** Koniec dnia lokalnego dla `t`, opcjonalnie przesunięty o `plusDays` dni. */
export function endOfDay(t: number, plusDays = 0): number {
  const d = new Date(t);
  d.setDate(d.getDate() + plusDays);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** Zaległy: termin minął. Dziś: do końca dzisiejszego dnia. Najbliższe 7 dni. Później. */
export function termStatus(at: number, now: number): TermStatus {
  if (at < now) return "overdue";
  if (at <= endOfDay(now)) return "today";
  if (at <= endOfDay(now, 7)) return "week";
  return "later";
}

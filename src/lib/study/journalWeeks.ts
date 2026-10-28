import { isoWeek } from "@/lib/periodNote";
import { parseDayKey, startOfWeekKey, weekRangeLabel } from "@/lib/week";

/**
 * P5.3: separatory tygodni na osi dziennika. Dla każdego dnia osi — czy zaczyna nowy tydzień
 * (oś idzie od najnowszego) i etykieta tygodnia z sumą godzin na budowach z tego tygodnia.
 */
export interface WeekSeparator {
  /** Poniedziałek tygodnia (`YYYY-MM-DD`). */
  start: string;
  label: string;
  minutes: number;
}

/** Dzień osi → separator, gdy od tego dnia zaczyna się (od góry) kolejny tydzień. */
export function weekSeparators(dayKeys: readonly string[], minutesOf: (day: string) => number): Map<string, WeekSeparator> {
  const sums = new Map<string, number>();
  for (const d of dayKeys) { const w = startOfWeekKey(d); sums.set(w, (sums.get(w) ?? 0) + minutesOf(d)); }
  const out = new Map<string, WeekSeparator>();
  let prev: string | null = null;
  for (const d of dayKeys) {
    const w = startOfWeekKey(d);
    if (w !== prev) out.set(d, { start: w, label: `Tydz. ${isoWeek(parseDayKey(w).getTime()).week} · ${weekRangeLabel(w)}`, minutes: sums.get(w) ?? 0 });
    prev = w;
  }
  return out;
}

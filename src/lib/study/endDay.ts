import { dayKeyOf } from "./report";
import { entrySiteId } from "./sites";
import type { JournalEntry } from "./journalEntry";

/** Po ilu dniach bez kopii arkusz „Zakończ dzień” o niej przypomina. */
export const END_DAY_BACKUP_DAYS = 3;

export interface DaySummary {
  /** Dzień „2026-10-14”. */
  dayKey: string;
  entries: number;
  sites: number;
  /** Czas pierwszego i ostatniego wpisu dnia; `null` = brak wpisów. */
  firstAt: number | null;
  lastAt: number | null;
  /** Minuty od pierwszego do ostatniego wpisu — podpowiedź do godzin, nie zapis. */
  spanMinutes: number;
}

/** Podsumowanie dnia z dziennika budowy (krok 1 i 2 arkusza „Zakończ dzień”). */
export function daySummary(journal: readonly JournalEntry[], now: number = Date.now()): DaySummary {
  const dayKey = dayKeyOf(now);
  const today = journal.filter((e) => dayKeyOf(e.at) === dayKey);
  if (today.length === 0) return { dayKey, entries: 0, sites: 0, firstAt: null, lastAt: null, spanMinutes: 0 };
  const times = today.map((e) => e.at);
  const firstAt = Math.min(...times);
  const lastAt = Math.max(...times);
  return {
    dayKey,
    entries: today.length,
    sites: new Set(today.map((e) => entrySiteId(e))).size,
    firstAt,
    lastAt,
    spanMinutes: Math.round((lastAt - firstAt) / 60_000),
  };
}

/** Czy kopia jest starsza niż `days` dni; brak kopii w ogóle też liczy się jako zaległość. */
export function backupStale(lastBackupAt: number, now: number = Date.now(), days: number = END_DAY_BACKUP_DAYS): boolean {
  if (!lastBackupAt) return true;
  return now - lastBackupAt > days * 24 * 60 * 60 * 1000;
}

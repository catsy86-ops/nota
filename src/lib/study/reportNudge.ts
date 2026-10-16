import { dayType, isAbsence, type ShiftData } from "@/lib/shifts/model";
import { dayKeyOf } from "./report";
import { entrySiteId } from "./sites";
import type { JournalEntry } from "./yStudy";

/**
 * Przypomnienie „Raport dnia gotowy”: raz dziennie, po końcu dzisiejszej zmiany z Grafiku
 * (bez zmiany — o `REPORT_NUDGE_FALLBACK`), jeśli dziś są wpisy w dzienniku budowy.
 * Czysta funkcja: hook w `DailyReportNudge.tsx` woła ją co minutę.
 */

/** Dzień ostatniego przypomnienia („2026-10-14”) — drugi raz tego dnia nie przypominamy. */
export const REPORT_NUDGE_KEY = "kaczy.study.reportNudged.v1";
/** Godzina przypomnienia, gdy Grafik nie ma dziś zmiany (albo zmiana przechodzi przez północ). */
export const REPORT_NUDGE_FALLBACK = "17:00";

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/**
 * Minuta dnia, od której przypominamy. Koniec zmiany z Grafiku (z własnymi godzinami dnia),
 * ale tylko zmiany kończącej się tego samego dnia — nocna kończy się jutro, więc godzina stała.
 */
export function reportDueMinute(shifts: ShiftData | null | undefined, key: string): number {
  const entry = shifts?.days[key];
  const base = entry && shifts.types.find((t) => t.id === entry.type);
  if (base) {
    const t = dayType(base, entry);
    if (!isAbsence(t)) {
      const start = toMinutes(t.start);
      const end = toMinutes(t.end);
      if (end > start) return end;
    }
  }
  return toMinutes(REPORT_NUDGE_FALLBACK);
}

export interface ReportNudge {
  /** Dzień raportu („2026-10-14”). */
  dayKey: string;
  /** Wpisy z dzisiaj. */
  entries: number;
  /** Budowy z dzisiejszych wpisów. */
  sites: number;
}

export function dailyReportNudge(
  journal: readonly JournalEntry[],
  shifts: ShiftData | null | undefined,
  now: Date,
  lastNudged: string | null,
): ReportNudge | null {
  const key = dayKeyOf(now.getTime());
  if (lastNudged === key) return null;
  const today = journal.filter((e) => dayKeyOf(e.at) === key);
  if (today.length === 0) return null;
  if (now.getHours() * 60 + now.getMinutes() < reportDueMinute(shifts, key)) return null;
  return { dayKey: key, entries: today.length, sites: new Set(today.map((e) => entrySiteId(e))).size };
}

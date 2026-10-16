import { dayType, isAbsence, type ShiftData } from "@/lib/shifts/model";
import { dayKeyOf, shiftKey } from "./report";
import { entrySiteId } from "./sites";
import type { JournalEntry } from "./yStudy";

/**
 * Przypomnienie „Raport dnia gotowy”: raz dziennie, po końcu dzisiejszej zmiany z Grafiku
 * (bez zmiany — o `REPORT_NUDGE_FALLBACK`), jeśli dziś są wpisy w dzienniku budowy.
 * Czysta funkcja: hook w `DailyReportNudge.tsx` woła ją co minutę.
 */

/** Dzień ostatniego przypomnienia („2026-10-14”) — drugi raz tego dnia nie przypominamy. */
export const REPORT_NUDGE_KEY = "kaczy.study.reportNudged.v1";
/** Tydzień ostatniego przypomnienia o raporcie tygodnia (poniedziałek: „2026-10-12”). */
export const WEEK_REPORT_NUDGE_KEY = "kaczy.study.weekReportNudged.v1";
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

/** Poniedziałek tygodnia, w którym jest `now` („2026-10-12”) — klucz tygodnia. */
export function weekKeyOf(now: Date): string {
  const back = (now.getDay() + 6) % 7;
  return dayKeyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back).getTime());
}

export interface WeekReportNudge {
  weekKey: string;
  /** Dzisiaj — dzienne przypomnienie tego dnia już niepotrzebne. */
  dayKey: string;
  /** Wpisy z ostatnich 7 dni (jak „7 dni” w raporcie). */
  entries: number;
  sites: number;
}

/**
 * Raport tygodnia: w piątek po końcu dnia pracy (albo w weekend, jeśli w piątek nie było okazji),
 * raz na tydzień, gdy w ostatnich 7 dniach są wpisy. Ma pierwszeństwo przed raportem dnia —
 * obejmuje też dzisiejsze wpisy.
 */
export function weeklyReportNudge(
  journal: readonly JournalEntry[],
  shifts: ShiftData | null | undefined,
  now: Date,
  lastWeek: string | null,
): WeekReportNudge | null {
  const weekday = now.getDay();
  if (weekday !== 5 && weekday !== 6 && weekday !== 0) return null;
  const weekKey = weekKeyOf(now);
  if (lastWeek === weekKey) return null;
  const key = dayKeyOf(now.getTime());
  if (weekday === 5 && now.getHours() * 60 + now.getMinutes() < reportDueMinute(shifts, key)) return null;
  const from = shiftKey(key, -6);
  const week = journal.filter((e) => { const k = dayKeyOf(e.at); return k >= from && k <= key; });
  if (week.length === 0) return null;
  return { weekKey, dayKey: key, entries: week.length, sites: new Set(week.map((e) => entrySiteId(e))).size };
}

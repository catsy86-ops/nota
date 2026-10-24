import type { Note } from "@/hooks/useNotes";

/**
 * Notatki okresowe: jedna notatka na tydzień (ISO) i jedna na miesiąc.
 * Jak notatka dnia (`lib/dailyNote.ts`) rozpoznawane po osobnym polu
 * `periodKey`, nie po tytule. Format klucza: `2026-W43` albo `2026-10`.
 */

export type PeriodKind = "week" | "month";

export const PERIOD_LABEL: Record<PeriodKind, string> = { week: "tydzień", month: "miesiąc" };

export const PERIOD_TEMPLATE: Record<PeriodKind, string> = {
  week: "**Cele na ten tydzień:**\n1. \n2. \n3. \n\n**Co wyszło:**\n\n**Wnioski:**",
  month: "**Cele na ten miesiąc:**\n1. \n2. \n3. \n\n**Co wyszło:**\n\n**Wnioski:**",
};

const pad = (n: number) => String(n).padStart(2, "0");
const DAY_MS = 24 * 60 * 60 * 1000;

/** Numer tygodnia ISO 8601 dla lokalnej daty (tydzień zaczyna się w poniedziałek). */
export function isoWeek(now: number = Date.now()): { year: number; week: number } {
  const local = new Date(now);
  // Liczymy na dacie UTC z lokalnymi składowymi, żeby strefa nie przesuwała dnia.
  const d = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

/** Klucz okresu dla daty: `YYYY-Www` dla tygodnia, `YYYY-MM` dla miesiąca. */
export function periodKey(kind: PeriodKind, now: number = Date.now()): string {
  if (kind === "week") {
    const { year, week } = isoWeek(now);
    return `${year}-W${pad(week)}`;
  }
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Tytuł notatki okresowej, np. „Tydzień 43 · 2026” albo „Październik 2026”. */
export function periodTitle(kind: PeriodKind, now: number = Date.now()): string {
  if (kind === "week") {
    const { year, week } = isoWeek(now);
    return `Tydzień ${week} · ${year}`;
  }
  const text = new Date(now).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Notatka okresu. Kosz się nie liczy, Archiwum tak. Przy dwóch niezależnych
 * utworzeniach (offline) wygrywa starsza — jak przy notatce dnia.
 */
export function findPeriodNote(notes: Note[], key: string): Note | undefined {
  let best: Note | undefined;
  for (const n of notes) {
    if (n.periodKey !== key || n.trashed) continue;
    if (!best || n.createdAt < best.createdAt || (n.createdAt === best.createdAt && n.id < best.id)) best = n;
  }
  return best;
}

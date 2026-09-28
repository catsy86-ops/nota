import type { Note } from "@/hooks/useNotes";

export type AgendaGroupKey = "overdue" | "today" | "week" | "later";

export interface AgendaGroup {
  key: AgendaGroupKey;
  label: string;
  notes: Note[];
}

const LABELS: Record<AgendaGroupKey, string> = {
  overdue: "Zaległe",
  today: "Dziś",
  week: "Najbliższe 7 dni",
  later: "Później",
};

function endOfDay(t: number, plusDays = 0): number {
  const d = new Date(t);
  d.setDate(d.getDate() + plusDays);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Widok „Przypomnienia” jako agenda: po terminie rosnąco, w grupach.
 * Kolejność sortowania z ustawień nie ma tu sensu — lista terminów
 * uporządkowana po dacie edycji chowa jutrzejszy termin pod zeszłomiesięcznym.
 * Puste grupy są pomijane.
 */
export function groupReminders(notes: Note[], now: number = Date.now()): AgendaGroup[] {
  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(now, 7);
  const byKey: Record<AgendaGroupKey, Note[]> = { overdue: [], today: [], week: [], later: [] };
  const sorted = notes.filter((n) => n.reminder !== null).sort((a, b) => (a.reminder as number) - (b.reminder as number));
  for (const n of sorted) {
    const t = n.reminder as number;
    const key: AgendaGroupKey = t < now ? "overdue" : t <= todayEnd ? "today" : t <= weekEnd ? "week" : "later";
    byKey[key].push(n);
  }
  return (Object.keys(byKey) as AgendaGroupKey[])
    .filter((k) => byKey[k].length)
    .map((k) => ({ key: k, label: LABELS[k], notes: byKey[k] }));
}

/** Terminy drzemki z toastu przypomnienia. */
export function snoozeTimes(now: number = Date.now()): { in10min: number; tomorrow9: number } {
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  t.setHours(9, 0, 0, 0);
  return { in10min: now + 10 * 60 * 1000, tomorrow9: t.getTime() };
}

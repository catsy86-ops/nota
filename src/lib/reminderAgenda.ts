import type { Note } from "@/hooks/useNotes";
import { endOfDay, termStatus } from "@/lib/dueTerms";

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

/**
 * Widok „Przypomnienia” jako agenda: po terminie rosnąco, w grupach.
 * Kolejność sortowania z ustawień nie ma tu sensu — lista terminów
 * uporządkowana po dacie edycji chowa jutrzejszy termin pod zeszłomiesięcznym.
 * Puste grupy są pomijane.
 */
export function groupReminders(notes: Note[], now: number = Date.now()): AgendaGroup[] {
  const byKey: Record<AgendaGroupKey, Note[]> = { overdue: [], today: [], week: [], later: [] };
  const sorted = notes.filter((n) => n.reminder !== null).sort((a, b) => (a.reminder as number) - (b.reminder as number));
  for (const n of sorted) byKey[termStatus(n.reminder as number, now)].push(n);
  return (Object.keys(byKey) as AgendaGroupKey[])
    .filter((k) => byKey[k].length)
    .map((k) => ({ key: k, label: LABELS[k], notes: byKey[k] }));
}

/**
 * Liczba zaległych przypomnień (termin minął, przypomnienie nadal czeka).
 * Jedno źródło dla licznika w pasku bocznym, znaczka aplikacji i tytułu karty.
 * Przyjmuje notatki bez kosza. Archiwum jest liczone: jego przypomnienia nadal dzwonią.
 */
export function countOverdue(notes: Pick<Note, "reminder">[], now: number = Date.now()): number {
  let n = 0;
  for (const note of notes) if (note.reminder !== null && termStatus(note.reminder, now) === "overdue") n++;
  return n;
}

/** Terminy drzemki z toastu przypomnienia. */
export function snoozeTimes(now: number = Date.now()): { in10min: number; tomorrow9: number } {
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  t.setHours(9, 0, 0, 0);
  return { in10min: now + 10 * 60 * 1000, tomorrow9: t.getTime() };
}

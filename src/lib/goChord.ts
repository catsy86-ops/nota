import type { View } from "@/hooks/useFilteredNotes";

/** Okno (ms) na wciśnięcie drugiego klawisza po „g”. */
export const GO_CHORD_WINDOW_MS = 1200;

export const GO_CHORDS: { key: string; view: View }[] = [
  { key: "n", view: "notes" },
  { key: "d", view: "today" },
  { key: "w", view: "week" },
  { key: "p", view: "reminders" },
  { key: "c", view: "calendar" },
  { key: "a", view: "archive" },
  { key: "k", view: "trash" },
  { key: "i", view: "inbox" },
  { key: "z", view: "shifts" },
  { key: "s", view: "study" },
  { key: "l", view: "debts" },
  { key: "t", view: "cwiczenia" },
];

/** Widok dla drugiego klawisza sekwencji „g, <litera>” (null = brak). */
export function viewForChord(key: string): View | null {
  if (key.length !== 1) return null;
  return GO_CHORDS.find((c) => c.key === key.toLowerCase())?.view ?? null;
}

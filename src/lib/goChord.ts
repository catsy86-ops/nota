import type { View } from "@/hooks/useFilteredNotes";

/** Okno (ms) na wciśnięcie drugiego klawisza po „g”. */
export const GO_CHORD_WINDOW_MS = 1200;

export const GO_CHORDS: { key: string; view: View; label: string }[] = [
  { key: "n", view: "notes", label: "Notatki" },
  { key: "d", view: "today", label: "Dziś" },
  { key: "w", view: "week", label: "Ten tydzień" },
  { key: "p", view: "reminders", label: "Przypomnienia" },
  { key: "c", view: "calendar", label: "Kalendarz" },
  { key: "a", view: "archive", label: "Archiwum" },
  { key: "k", view: "trash", label: "Kosz" },
];

/** Widok dla drugiego klawisza sekwencji „g, <litera>” (null = brak). */
export function viewForChord(key: string): View | null {
  if (key.length !== 1) return null;
  return GO_CHORDS.find((c) => c.key === key.toLowerCase())?.view ?? null;
}

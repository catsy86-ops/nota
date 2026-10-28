import type { View } from "@/hooks/useFilteredNotes";

/** Widoki bez pola szukania notatek: tam lupa otwiera paletę poleceń (nagłówek i dolny pasek). */
const VIEWS_WITHOUT_SEARCH: ReadonlySet<View> = new Set<View>(["shifts", "calendar", "study", "debts", "cwiczenia"]);

/** Czy widok ma własne pole szukania notatek (Notatki, Dziś, Archiwum itd.). */
export function viewHasSearch(view: View): boolean {
  return !VIEWS_WITHOUT_SEARCH.has(view);
}

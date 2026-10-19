import type { Note } from "@/hooks/useNotes";
import { endOfDay } from "@/lib/dueTerms";
import { expandOccurrences } from "@/lib/reminderOccurrences";

export interface SeriesForecast {
  noteId: string;
  title: string;
  /** Ile kolejnych wystąpień serii wypada w tych 7 dniach poza zapisanym terminem. */
  count: number;
}

/**
 * Prognoza serii do „Najbliższe 7 dni”: zapisany jest tylko najbliższy termin, więc kolejne
 * wystąpienia liczy się w locie i pokazuje jako jeden wiersz z licznikiem na serię (bez edycji).
 * Okno to ten sam przedział co grupa `week`: od końca dziś +1 ms do końca dnia +7. Kosz pomijany.
 * Osobny moduł (nie `reminderAgenda`), żeby rozwijanie wystąpień nie wchodziło do paczki startowej.
 */
export function weekSeriesForecasts(notes: Note[], now: number = Date.now()): SeriesForecast[] {
  const from = endOfDay(now) + 1;
  const to = endOfDay(now, 7);
  const counts = new Map<string, number>();
  for (const occ of expandOccurrences(notes, from, to)) {
    if (!occ.isSeries || occ.isNext) continue;
    counts.set(occ.noteId, (counts.get(occ.noteId) ?? 0) + 1);
  }
  const byId = new Map(notes.map((n) => [n.id, n]));
  return [...counts].map(([noteId, count]) => ({ noteId, title: byId.get(noteId)?.title ?? "", count }));
}

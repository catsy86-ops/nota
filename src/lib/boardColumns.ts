import type { Note } from "@/hooks/useNotes";
import type { GroupBy } from "@/lib/groupNotes";

/** Klucz kolumny przypiętych na tablicy (nie jest grupą `groupNotes`). */
export const PINNED_COLUMN = "pinned";
/** Klucz grupy „bez etykiety / bez folderu” — ten sam, którego używa `groupNotes`. */
export const NONE_COLUMN = "none";

/** Prefiks identyfikatora strefy upuszczania kolumny (obok id notatek w tym samym DndContext). */
export const COLUMN_DROP_PREFIX = "board-col-";

export function columnDropId(key: string): string {
  return COLUMN_DROP_PREFIX + key;
}

export function columnKeyFromDropId(id: string): string | null {
  return id.startsWith(COLUMN_DROP_PREFIX) ? id.slice(COLUMN_DROP_PREFIX.length) : null;
}

/** Do jakiej kolumny tablicy należy notatka przy danym podziale (zgodnie z `groupNotes`). */
export function columnOfNote(note: Pick<Note, "pinned" | "labels" | "folderId">, groupBy: GroupBy): string | undefined {
  if (note.pinned) return PINNED_COLUMN;
  if (groupBy === "label") return note.labels[0] ?? NONE_COLUMN;
  if (groupBy === "folder") return note.folderId ?? NONE_COLUMN;
  return undefined;
}

/**
 * Etykiety po przeniesieniu notatki do kolumny etykiety: docelowa wskakuje na początek
 * (to ona wyznacza kolumnę), pozostałe zostają. „Bez etykiety” czyści wszystkie.
 */
export function labelsForColumn(labels: string[], target: string): string[] {
  if (target === NONE_COLUMN) return [];
  return [target, ...labels.filter((l) => l !== target)];
}

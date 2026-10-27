import type { Note } from "@/hooks/useNotes";

/** Ile znaków treści pokazuje podgląd terminu po najechaniu (K3.5). */
export const PREVIEW_CHARS = 160;

/**
 * Tekst podglądu notatki z terminu: tytuł i początek treści. Notatka prywatna pokazuje tylko tytuł
 * zastępczy — treść nie wychodzi poza zaszyfrowany widok (jak w `icsExport`).
 */
export function notePreview(note: Note): string {
  if (note.locked) return "Notatka prywatna";
  const title = note.title.trim() || "Bez tytułu";
  const body = note.content.trim().replace(/\s+/g, " ");
  if (!body) return title;
  const clipped = body.length > PREVIEW_CHARS ? `${body.slice(0, PREVIEW_CHARS).trimEnd()}…` : body;
  return `${title}\n${clipped}`;
}

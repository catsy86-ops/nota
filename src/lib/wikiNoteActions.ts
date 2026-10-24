import type { Note } from "@/hooks/useNotes";
import { yjsStore } from "@/lib/yjsStore";
import { resolveWikiTarget } from "@/lib/wikiLinks";
import { titleFromSelection, uniqueNoteTitle } from "@/lib/extractNote";

/**
 * Podgląd i tworzenie notatek docelowych wikilinków. Sięgamy do magazynu na
 * żądanie (hover/fokus), zamiast przekazywać listę notatek do każdego kafla.
 */

/** Notatka o tym tytule (poza koszem), jeśli istnieje. */
export function lookupWikiTarget(title: string): Note | undefined {
  const live = yjsStore.projectNotes().filter((n) => !n.trashed);
  return resolveWikiTarget(title, live);
}

/** Pierwsze niepuste linie do podglądu (listę zadań pokazuje, gdy treści brak). */
export function previewLines(note: Pick<Note, "content" | "checklist">, max = 6): string[] {
  const lines = (note.content || "").split("\n").filter((l) => l.trim());
  if (lines.length) return lines.slice(0, max);
  return (note.checklist ?? []).slice(0, max).map((c) => `${c.checked ? "☑" : "☐"} ${c.text}`);
}

/** Notatka o danym tytule — cel wikilinka, który dotąd nie istniał (albo wyodrębniony fragment z treścią). */
export function createNoteWithTitle(title: string, content = ""): string {
  const now = Date.now();
  const note: Note = {
    id: crypto.randomUUID(), title: title.trim(), content, color: "default",
    pinned: false, archived: false, trashed: false, trashedAt: null,
    labels: [], reminder: null, priority: "none", images: [], checklist: [],
    folderId: null, order: 0, createdAt: now, updatedAt: now,
  };
  yjsStore.upsertNote(note);
  return note.id;
}

/**
 * Nowa notatka z zaznaczenia (Faza 3, „wyodrębnij”): tytuł z pierwszej linii, unikalny wśród
 * żywych notatek, treść to zaznaczenie bez białych znaków na brzegach.
 */
export function createNoteFromSelection(selected: string): { id: string; title: string } {
  const liveTitles = yjsStore.projectNotes().filter((n) => !n.trashed).map((n) => n.title);
  const title = uniqueNoteTitle(titleFromSelection(selected), liveTitles);
  return { id: createNoteWithTitle(title, selected.trim()), title };
}

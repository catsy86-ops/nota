import type { Note } from "@/hooks/useNotes";
import { yjsStore } from "@/lib/yjsStore";
import { canSetParent } from "@/lib/subpages";

/**
 * Operacje na drzewie podstron sięgające do magazynu na żądanie — dzięki temu
 * kafel, czytnik i hook `useNotes` używają jednego kodu bez przekazywania
 * wywołań przez propsy.
 */

/** Ustawia rodzica (`null` = poziom główny); odmawia cyklu i nieistniejącego rodzica. */
export function setParent(id: string, parentId: string | null): boolean {
  if (!canSetParent(id, parentId, yjsStore.projectNotes())) return false;
  yjsStore.patchNote(id, { parentId: parentId ?? undefined });
  return true;
}

/** Pusta notatka pod `parentId` (w folderze i kolorze rodzica); zwraca jej id albo `null`, gdy rodzica nie ma. */
export function addSubpage(parentId: string): string | null {
  const parent = yjsStore.projectNotes().find((n) => n.id === parentId);
  if (!parent) return null;
  const now = Date.now();
  const note: Note = {
    id: crypto.randomUUID(), title: "", content: "", color: parent.color, pinned: false, archived: false, trashed: false, trashedAt: null,
    labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: parent.folderId, parentId,
    order: 0, createdAt: now, updatedAt: now,
  };
  yjsStore.upsertNote(note);
  return note.id;
}

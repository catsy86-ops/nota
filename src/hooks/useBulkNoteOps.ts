import type { MutableRefObject } from "react";
import { toast } from "sonner";
import type { Folder, Note } from "@/hooks/useNotes";
import type { View } from "@/hooks/useFilteredNotes";
import type { GroupBy } from "@/lib/groupNotes";
import { labelsForColumn, NONE_COLUMN, PINNED_COLUMN } from "@/lib/boardColumns";
import { toastWithUndo } from "@/lib/undoToast";

export interface BulkNoteOpsDeps {
  view: View;
  groupBy: GroupBy;
  folders: Folder[];
  notesRef: MutableRefObject<Note[]>;
  selectedIds: Set<string>;
  clearSelection: () => void;
  togglePin: (id: string) => void;
  updateNote: (id: string, patch: Partial<Note>) => void;
  addLabel: (name: string) => void;
  unarchiveNote: (id: string) => void;
  bulkRestore: (ids: string[]) => void;
  bulkTrash: (ids: string[]) => void;
  bulkArchive: (ids: string[]) => void;
  /** Przeniesienie do folderu z poświatą (`handleMoveToFolderGlow` w `Index`). */
  moveToFolder: (id: string, folderId: string | null) => void;
}

/**
 * Operacje zbiorcze paska zaznaczenia (przypnij, folder, etykieta, przywróć) i przeniesienie kart
 * do kolumny tablicy — każda z „Cofnij”. Kosz/archiwum/kolor są w `useNoteActions`.
 */
export function useBulkNoteOps({
  view, groupBy, folders, notesRef, selectedIds, clearSelection, togglePin, updateNote, addLabel,
  unarchiveNote, bulkRestore, bulkTrash, bulkArchive, moveToFolder,
}: BulkNoteOpsDeps) {
  /** Zaznaczone w Koszu wracają do notatek, w Archiwum — z archiwum; oba z „Cofnij”. */
  function restoreSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (view === "trash") {
      bulkRestore(ids);
      clearSelection();
      toastWithUndo(`Przywrócono ${ids.length} z kosza`, () => bulkTrash(ids));
    } else {
      ids.forEach(unarchiveNote);
      clearSelection();
      toastWithUndo(`Przywrócono ${ids.length} z archiwum`, () => bulkArchive(ids));
    }
  }

  /** Przypnij / odepnij zaznaczone (jeśli któraś jest nieprzypięta — przypina wszystkie). */
  function pinSelected() {
    const chosen = notesRef.current.filter((n) => selectedIds.has(n.id));
    if (chosen.length === 0) return;
    const pin = chosen.some((n) => !n.pinned);
    const changed = chosen.filter((n) => n.pinned !== pin).map((n) => n.id);
    changed.forEach((id) => togglePin(id));
    clearSelection();
    toastWithUndo(`${pin ? "Przypięto" : "Odpięto"} ${changed.length}`, () => changed.forEach((id) => togglePin(id)), { icon: "📌" });
  }

  /** Przenieś zaznaczone do folderu (`null` = bez folderu), z „Cofnij”. */
  function moveSelectedToFolder(folderId: string | null) {
    const prev = notesRef.current.filter((n) => selectedIds.has(n.id) && n.folderId !== folderId).map((n) => [n.id, n.folderId] as const);
    if (prev.length === 0) { clearSelection(); return; }
    prev.forEach(([id]) => moveToFolder(id, folderId));
    clearSelection();
    const name = folderId ? folders.find((f) => f.id === folderId)?.name ?? "folder" : "Bez folderu";
    toastWithUndo(`Przeniesiono ${prev.length} do „${name}”`, () => prev.forEach(([id, from]) => moveToFolder(id, from)), { icon: "📁" });
  }

  /** Dodaj etykietę do zaznaczonych (istniejące zostają), z „Cofnij”. */
  function labelSelected(label: string) {
    const name = label.trim().replace(/^#/, "");
    if (!name) return;
    const prev = notesRef.current.filter((n) => selectedIds.has(n.id) && !n.labels.includes(name)).map((n) => [n.id, n.labels] as const);
    if (prev.length === 0) { clearSelection(); return; }
    addLabel(name);
    prev.forEach(([id, labels]) => updateNote(id, { labels: [...labels, name] }));
    clearSelection();
    toastWithUndo(`Dodano #${name} do ${prev.length}`, () => prev.forEach(([id, labels]) => updateNote(id, { labels })), { icon: "🏷️" });
  }

  /** Przeniesienie kart do kolumny tablicy: przypięcie, etykieta albo folder — z „Cofnij”. */
  function moveToColumn(ids: string[], key: string) {
    if (groupBy === "date") {
      toast.message("Kolumny wg daty wynikają z czasu edycji", { description: "Wybierz podział wg etykiety lub folderu, by przenosić karty." });
      return;
    }
    const prev = ids
      .map((id) => notesRef.current.find((n) => n.id === id))
      .filter((n): n is NonNullable<typeof n> => !!n)
      .map((n) => ({ id: n.id, pinned: n.pinned, labels: n.labels, folderId: n.folderId }));
    const apply = (id: string, target: { pinned: boolean; labels: string[]; folderId: string | null }) => {
      const cur = notesRef.current.find((n) => n.id === id);
      if (!cur) return;
      if (cur.pinned !== target.pinned) togglePin(id);
      if (groupBy === "label" && cur.labels.join("\n") !== target.labels.join("\n")) updateNote(id, { labels: target.labels });
      if (groupBy === "folder" && cur.folderId !== target.folderId) moveToFolder(id, target.folderId);
    };
    prev.forEach((n) => {
      if (key === PINNED_COLUMN) apply(n.id, { ...n, pinned: true });
      else if (groupBy === "label") apply(n.id, { ...n, pinned: false, labels: labelsForColumn(n.labels, key) });
      else apply(n.id, { ...n, pinned: false, folderId: key === NONE_COLUMN ? null : key });
    });
    const label = key === PINNED_COLUMN ? "Przypięte" : key === NONE_COLUMN ? (groupBy === "label" ? "Bez etykiety" : "Bez folderu") : groupBy === "label" ? `#${key}` : folders.find((f) => f.id === key)?.name ?? "folder";
    toastWithUndo(prev.length > 1 ? `Przeniesiono do „${label}” (${prev.length})` : `Przeniesiono do „${label}”`, () => prev.forEach((n) => apply(n.id, n)), { icon: "🗂️" });
  }

  return { restoreSelected, pinSelected, moveSelectedToFolder, labelSelected, moveToColumn };
}

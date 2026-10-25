import type { MutableRefObject } from "react";
import { toast } from "sonner";
import type { Folder, Note } from "@/hooks/useNotes";
import type { View } from "@/hooks/useFilteredNotes";
import { isNoteTextEditOpen } from "@/hooks/useNotes";
import type { GroupBy } from "@/lib/groupNotes";
import { labelsForColumn, NONE_COLUMN, PINNED_COLUMN } from "@/lib/boardColumns";
import { toastWithUndo } from "@/lib/undoToast";
import { pushAction } from "@/lib/actionHistory";
import type { NotePriority } from "@/lib/notePriority";
import { planMerge } from "@/lib/mergeNotes";

/** Toast „Cofnij” plus wpis w historii akcji, żeby Ctrl+Z cofał także zbiorcze zmiany (QoL). */
function undoToast(message: string, undo: () => void, opts?: Parameters<typeof toastWithUndo>[2]) {
  toastWithUndo(message, undo, opts);
  pushAction({ kind: "bulk", label: message, count: 1, noteIds: [], undo });
}

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
      undoToast(`Przywrócono ${ids.length} z kosza`, () => bulkTrash(ids));
    } else {
      ids.forEach(unarchiveNote);
      clearSelection();
      undoToast(`Przywrócono ${ids.length} z archiwum`, () => bulkArchive(ids));
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
    undoToast(`${pin ? "Przypięto" : "Odpięto"} ${changed.length}`, () => changed.forEach((id) => togglePin(id)), { icon: "📌" });
  }

  /**
   * Scala zaznaczone notatki w pierwszą (`lib/mergeNotes.ts`): pozostałe idą do kosza.
   * Cofnięcie przywraca poprzednie pola pierwszej i odtwarza pozostałe z kosza.
   */
  function mergeSelected() {
    const all = notesRef.current;
    const chosen = all.filter((n) => selectedIds.has(n.id));
    const res = planMerge(chosen, (id) => all.some((n) => n.parentId === id));
    if (!res.ok) { toast.info("Nie scalono", { description: res.reason }); return; }
    const { targetId, patch, sourceIds } = res.plan;
    const target = chosen.find((n) => n.id === targetId);
    if (!target) return;
    if (isNoteTextEditOpen(targetId)) {
      toast.info("Nie scalono", { description: "Zamknij edycję pierwszej notatki, zanim ją scalisz." });
      return;
    }
    // Poprzednie wartości tylko dla pól, które scalenie zmienia (brak załączników = pusta lista).
    const keys = Object.keys(patch) as (keyof typeof patch)[];
    const prev = Object.fromEntries(
      keys.map((k) => [k, k === "attachments" ? (target.attachments ?? []) : target[k]]),
    ) as typeof patch;
    updateNote(targetId, patch);
    bulkTrash(sourceIds);
    clearSelection();
    undoToast(`Scalono ${chosen.length} notatek`, () => {
      updateNote(targetId, prev);
      bulkRestore(sourceIds);
    }, { icon: "🧩", description: `Pozostałe ${sourceIds.length} są w koszu. Cofnij je przywraca.` });
  }

  /** Przenieś zaznaczone do folderu (`null` = bez folderu), z „Cofnij”. */
  function moveSelectedToFolder(folderId: string | null) {
    const prev = notesRef.current.filter((n) => selectedIds.has(n.id) && n.folderId !== folderId).map((n) => [n.id, n.folderId] as const);
    if (prev.length === 0) { clearSelection(); return; }
    prev.forEach(([id]) => moveToFolder(id, folderId));
    clearSelection();
    const name = folderId ? folders.find((f) => f.id === folderId)?.name ?? "folder" : "Bez folderu";
    undoToast(`Przeniesiono ${prev.length} do „${name}”`, () => prev.forEach(([id, from]) => moveToFolder(id, from)), { icon: "📁" });
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
    undoToast(`Dodano #${name} do ${prev.length}`, () => prev.forEach(([id, labels]) => updateNote(id, { labels })), { icon: "🏷️" });
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
    undoToast(prev.length > 1 ? `Przeniesiono do „${label}” (${prev.length})` : `Przeniesiono do „${label}”`, () => prev.forEach((n) => apply(n.id, n)), { icon: "🗂️" });
  }

  /** Ulubione zaznaczonych: jeśli któraś nie jest ulubiona, wszystkie zostają ulubione; inaczej zdejmuje z nich. */
  function favoriteSelected() {
    const chosen = notesRef.current.filter((n) => selectedIds.has(n.id));
    if (chosen.length === 0) return;
    const on = chosen.some((n) => !n.favorite);
    const changed = chosen.filter((n) => !!n.favorite !== on).map((n) => n.id);
    changed.forEach((id) => updateNote(id, { favorite: on }));
    clearSelection();
    undoToast(`${on ? "Dodano do ulubionych" : "Usunięto z ulubionych"} ${changed.length}`, () => changed.forEach((id) => updateNote(id, { favorite: !on })), { icon: "⭐" });
  }

  /** Priorytet zaznaczonych, z „Cofnij” przywracającym poprzednie wartości. */
  function prioritySelected(priority: NotePriority) {
    const prev = notesRef.current.filter((n) => selectedIds.has(n.id) && (n.priority ?? "none") !== priority).map((n) => [n.id, n.priority ?? "none"] as const);
    if (prev.length === 0) { clearSelection(); return; }
    prev.forEach(([id]) => updateNote(id, { priority }));
    clearSelection();
    undoToast(`Zmieniono priorytet (${prev.length})`, () => prev.forEach(([id, from]) => updateNote(id, { priority: from })), { icon: "🚩" });
  }

  return { restoreSelected, pinSelected, moveSelectedToFolder, labelSelected, moveToColumn, mergeSelected, favoriteSelected, prioritySelected };
}

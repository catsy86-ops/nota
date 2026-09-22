import { useCallback } from "react";
import { toast } from "sonner";
import type { Note, NoteColor } from "@/hooks/useNotes";
import { pushAction } from "@/lib/actionHistory";
import { toastWithUndo } from "@/lib/undoToast";
import { glowAtNote, glowPulse, pointOfNote } from "@/lib/glowTrail";
import type { useConfirmAction } from "@/components/ConfirmActionDialog";

export interface NoteActionsDeps {
  notes: Note[];
  archivedNotes: Note[];
  selectedIds: Set<string>;
  confirmAction: ReturnType<typeof useConfirmAction>["confirmAction"];
  clearSelection: () => void;
  trashNote: (id: string) => void;
  restoreFromTrash: (id: string) => void;
  archiveNote: (id: string) => void;
  unarchiveNote: (id: string) => void;
  bulkTrash: (ids: string[]) => void;
  bulkArchive: (ids: string[]) => void;
  bulkSetColor: (ids: string[], color: NoteColor) => void;
  bulkRestore: (ids: string[]) => void;
  setSelectedIds: (ids: Set<string>) => void;
  displayNotes: Note[];
}

/** Bulk & single trash/archive/color actions, each wired to undo + a confirmation prompt. */
export function useNoteActions({
  notes, archivedNotes, selectedIds, confirmAction, clearSelection,
  trashNote, restoreFromTrash, archiveNote, unarchiveNote,
  bulkTrash, bulkArchive, bulkSetColor, bulkRestore, setSelectedIds, displayNotes,
}: NoteActionsDeps) {
  const bulkPreview = useCallback((ids: string[]) => {
    const all = [...notes, ...archivedNotes];
    return ids
      .map((i) => {
        const n = all.find((x) => x.id === i);
        return (n?.title?.trim() || n?.content?.trim() || "").replace(/\s+/g, " ").slice(0, 40);
      })
      .filter(Boolean)
      .slice(0, 4)
      .join(" • ");
  }, [notes, archivedNotes]);

  const handleTrashSingle = useCallback((id: string) => {
    const note = notes.find((n) => n.id === id) || archivedNotes.find((n) => n.id === id);
    const title = note?.title?.trim() || note?.content?.trim().slice(0, 60) || "Bez tytułu";
    const preview = note?.content?.trim().replace(/\s+/g, " ").slice(0, 140) || "";
    confirmAction({
      kind: "trash",
      title,
      description: `„${title}” trafi do kosza i zostanie automatycznie usunięta po 30 dniach.`,
      run: () => {
        glowAtNote(id, "trash");
        trashNote(id);
        const undo = () => restoreFromTrash(id);
        pushAction({ kind: "trash", label: title, count: 1, noteIds: [id], preview, undo });
        toastWithUndo("Przeniesiono do kosza", undo, {
          description: title,
          icon: "🗑️",
        });
      },
    });
  }, [trashNote, restoreFromTrash, notes, archivedNotes, confirmAction]);

  const handleArchiveSingle = useCallback((id: string) => {
    const note = notes.find((n) => n.id === id);
    const title = note?.title?.trim() || note?.content?.trim().slice(0, 60) || "Bez tytułu";
    const preview = note?.content?.trim().replace(/\s+/g, " ").slice(0, 140) || "";
    confirmAction({
      kind: "archive",
      title,
      description: `„${title}” zniknie z listy notatek i znajdziesz ją w Archiwum.`,
      run: () => {
        glowAtNote(id, "archive");
        archiveNote(id);
        const undo = () => unarchiveNote(id);
        pushAction({ kind: "archive", label: title, count: 1, noteIds: [id], preview, undo });
        toastWithUndo("Zarchiwizowano", undo, {
          description: title,
          icon: "📦",
        });
      },
    });
  }, [archiveNote, unarchiveNote, notes, confirmAction]);

  const handleBulkTrash = useCallback(() => {
    const ids = Array.from(selectedIds);
    const preview = bulkPreview(ids);
    confirmAction({
      kind: "trash",
      title: `${ids.length} notatek`,
      description: `Przeniesiesz ${ids.length} notatek do kosza.`,
      run: () => {
        ids.slice(0, 6).map((nid) => pointOfNote(nid))
          .forEach((p, i) => { if (p) window.setTimeout(() => glowPulse(p, "trash"), i * 55); });
        bulkTrash(ids);
        clearSelection();
        const undo = () => bulkRestore(ids);
        pushAction({ kind: "trash", label: `${ids.length} notatek`, count: ids.length, noteIds: ids, preview, undo });
        toastWithUndo(`Przeniesiono ${ids.length} do kosza`, undo, {
          description: "Kliknij Cofnij, aby przywrócić",
          icon: "🗑️",
        });
      },
    });
  }, [selectedIds, bulkTrash, bulkRestore, clearSelection, confirmAction, bulkPreview]);

  const handleBulkArchive = useCallback(() => {
    const ids = Array.from(selectedIds);
    const preview = bulkPreview(ids);
    confirmAction({
      kind: "archive",
      title: `${ids.length} notatek`,
      description: `Zarchiwizujesz ${ids.length} notatek.`,
      run: () => {
        ids.slice(0, 6).map((nid) => pointOfNote(nid))
          .forEach((p, i) => { if (p) window.setTimeout(() => glowPulse(p, "archive"), i * 55); });
        bulkArchive(ids);
        clearSelection();
        const undo = () => { ids.forEach(unarchiveNote); };
        pushAction({ kind: "archive", label: `${ids.length} notatek`, count: ids.length, noteIds: ids, preview, undo });
        toastWithUndo(`Zarchiwizowano ${ids.length}`, undo, {
          description: "Kliknij Cofnij, aby przywrócić",
          icon: "📦",
        });
      },
    });
  }, [selectedIds, bulkArchive, unarchiveNote, clearSelection, confirmAction, bulkPreview]);

  const handleBulkColor = useCallback((c: NoteColor) => {
    const ids = Array.from(selectedIds);
    bulkSetColor(ids, c);
    clearSelection();
    toast.success(`Zmieniono kolor ${ids.length} notatek`);
  }, [selectedIds, bulkSetColor, clearSelection]);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(displayNotes.map((n) => n.id)));
  }, [displayNotes, setSelectedIds]);

  return { handleTrashSingle, handleArchiveSingle, handleBulkTrash, handleBulkArchive, handleBulkColor, handleSelectAll, bulkPreview };
}

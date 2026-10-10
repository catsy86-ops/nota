import { useState } from "react";
import { toast } from "sonner";
import { PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { Folder } from "@/hooks/useNotes";
import { glowStreak, glowPulse, pointOfNote } from "@/lib/glowTrail";
import { getViewPrefs, setViewPref } from "@/lib/viewPrefs";
import { toastWithUndo } from "@/lib/undoToast";

export interface NoteDndDeps {
  displayNoteIds: string[];
  folders: Folder[];
  moveNoteToFolder: (noteId: string, folderId: string | null) => void;
  reorderNotes: (activeIds: string[]) => void;
  /** Zaznaczone notatki: przeciągnięcie jednej z nich na folder przenosi wszystkie. */
  selectedIds?: Set<string>;
  clearSelection?: () => void;
  /** Bieżący folder notatki — potrzebny do „Cofnij”. */
  folderOf?: (noteId: string) => string | null;
}

// Stałe modułu: nowy literał opcji w każdym renderze daje nowe `sensors`,
// a to przerysowuje każdą kartę mimo `memo`.
const POINTER_OPTIONS = { activationConstraint: { distance: 8 } };
const TOUCH_OPTIONS = { activationConstraint: { delay: 200, tolerance: 5 } };

/** @dnd-kit sensors + drop handling: reorder within the grid, or drop onto a folder/root. */
export function useNoteDnd({ displayNoteIds, folders, moveNoteToFolder, reorderNotes, selectedIds, clearSelection, folderOf }: NoteDndDeps) {
  const sensors = useSensors(
    useSensor(PointerSensor, POINTER_OPTIONS),
    useSensor(TouchSensor, TOUCH_OPTIONS)
  );

  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);

  function handleDragEnd(event: DragEndEvent) {
    setDraggingNoteId(null);
    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;

    const dragFrom = active.rect.current.translated
      ? {
          x: active.rect.current.translated.left + active.rect.current.translated.width / 2,
          y: active.rect.current.translated.top + active.rect.current.translated.height / 2,
        }
      : pointOfNote(active.id as string);
    const dropTo = { x: over.rect.left + over.rect.width / 2, y: over.rect.top + over.rect.height / 2 };
    const trail = () => { if (dragFrom) glowStreak(dragFrom, dropTo, "move"); else glowPulse(dropTo, "move"); };

    // Przeciągnięta karta jest zaznaczona (a zaznaczonych jest więcej niż jedna) — rusza cała grupa.
    const activeId = active.id as string;
    const ids = selectedIds && selectedIds.size > 1 && selectedIds.has(activeId) ? [...selectedIds] : [activeId];
    const moveTo = (folderId: string | null, message: string) => {
      trail();
      const prev = ids.map((id) => [id, folderOf?.(id) ?? null] as const);
      ids.forEach((id) => moveNoteToFolder(id, folderId));
      if (ids.length > 1) clearSelection?.();
      const undo = () => prev.forEach(([id, from]) => moveNoteToFolder(id, from));
      toastWithUndo(ids.length > 1 ? `${message} (${ids.length})` : message, undo, { icon: "📁" });
    };

    if (overId === "notes-drop-root") {
      moveTo(null, "Usunięto z folderu");
      return;
    }

    if (overId.startsWith("folder-drop-")) {
      const folderId = overId.replace("folder-drop-", "");
      const folder = folders.find((f) => f.id === folderId);
      moveTo(folderId, `Przeniesiono do „${folder?.name || "folder"}"`);
      return;
    }

    if (active.id !== over.id) {
      const ids = displayNoteIds;
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newIds = [...ids];
        newIds.splice(oldIndex, 1);
        newIds.splice(newIndex, 0, active.id as string);
        reorderNotes(newIds);
        if (getViewPrefs().sortKey !== "manual") {
          setViewPref("sortKey", "manual");
          toast.message("Przełączono na sortowanie ręczne", { description: "Kolejność notatek ustalasz teraz przeciąganiem." });
        }
      }
    }
  }

  return { sensors, draggingNoteId, setDraggingNoteId, handleDragEnd };
}

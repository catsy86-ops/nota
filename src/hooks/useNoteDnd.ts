import { useState } from "react";
import { toast } from "sonner";
import { PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { Folder } from "@/hooks/useNotes";
import { glowStreak, glowPulse, pointOfNote } from "@/lib/glowTrail";

export interface NoteDndDeps {
  displayNoteIds: string[];
  folders: Folder[];
  moveNoteToFolder: (noteId: string, folderId: string | null) => void;
  reorderNotes: (activeIds: string[]) => void;
}

/** @dnd-kit sensors + drop handling: reorder within the grid, or drop onto a folder/root. */
export function useNoteDnd({ displayNoteIds, folders, moveNoteToFolder, reorderNotes }: NoteDndDeps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
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

    if (overId === "notes-drop-root") {
      trail();
      moveNoteToFolder(active.id as string, null);
      toast.success("Usunięto z folderu");
      return;
    }

    if (overId.startsWith("folder-drop-")) {
      const folderId = overId.replace("folder-drop-", "");
      trail();
      moveNoteToFolder(active.id as string, folderId);
      const folder = folders.find((f) => f.id === folderId);
      toast.success(`Przeniesiono do „${folder?.name || "folder"}"`);
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
      }
    }
  }

  return { sensors, draggingNoteId, setDraggingNoteId, handleDragEnd };
}

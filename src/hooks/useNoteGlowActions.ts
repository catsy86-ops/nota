import type { Note, useNotes } from "@/hooks/useNotes";
import type { View } from "@/hooks/useFilteredNotes";
import { useCallback, useMemo } from "react";
import { type ComposerExtras } from "@/components/AddNoteBar";
import { toastWithUndo } from "@/lib/undoToast";
import { formatReminderShort } from "@/lib/reminderTime";
import { glowPulse, glowStreak, centerOf, pointOfNote } from "@/lib/glowTrail";
type Notes = ReturnType<typeof useNotes>;

interface Args {
  notes: Note[];
  view: View;
  activeLabel: string | null;
  activeFolder: string | null;
  addNote: Notes["addNote"];
  updateNote: Notes["updateNote"];
  deleteNote: Notes["deleteNote"];
  moveNoteToFolder: Notes["moveNoteToFolder"];
}

/**
 * Dodawanie i przenoszenie notatek z błyskiem: nowa notatka dziedziczy kontekst widoku (folder, etykieta), pasek
 * dodawania potwierdza dymkiem z „Cofnij”, a przeniesienie do folderu rysuje smugę. Wyciągnięte z `Index.tsx`
 * bez zmiany zachowania.
 */
export function useNoteGlowActions({ notes, view, activeLabel, activeFolder, addNote, updateNote, deleteNote, moveNoteToFolder }: Args) {
  const handleAddNoteGlow = useCallback((...args: Parameters<typeof addNote>) => {
    const p = centerOf(document.querySelector("[data-add-note-bar], [data-inbox-capture]"));
    if (p) glowPulse(p, "create", 260);
    const [title, content, color, labels = [], reminder, images, checklist, priority, folderId, attachments] = args;
    const withLabel = activeLabel && !labels.includes(activeLabel) ? [...labels, activeLabel] : labels;
    const inFolder = folderId ?? (view === "folder" ? activeFolder : null);
    return addNote(title, content, color, withLabel, reminder, images, checklist, priority, inFolder, attachments);
  }, [addNote, activeLabel, activeFolder, view]);

  /** Dodanie z paska: potwierdzenie z „Cofnij” (tylko tu — szablony i udostępnianie mają swoje komunikaty). */
  const handleComposerAdd = useCallback((...args: [...Parameters<typeof addNote>, extras?: ComposerExtras]) => {
    const extras = args.length > 10 ? (args[10] as ComposerExtras | undefined) : undefined;
    const id = handleAddNoteGlow(...(args.slice(0, 10) as Parameters<typeof addNote>));
    // Seria przypomnienia i rodzic nie mieszczą się w `addNote` — dopisujemy je zaraz po utworzeniu.
    if (extras?.reminderRepeat || extras?.parentId || extras?.reminderAllDay || extras?.reminderLead) {
      updateNote(id, {
        ...(extras.reminderRepeat ? { reminderRepeat: extras.reminderRepeat } : {}),
        ...(extras.reminderRule ? { reminderRule: extras.reminderRule } : {}),
        ...(extras.reminderRepeatUntil !== undefined ? { reminderRepeatUntil: extras.reminderRepeatUntil } : {}),
        ...(extras.parentId ? { parentId: extras.parentId } : {}),
        ...(extras.reminderAllDay ? { reminderAllDay: true } : {}),
        ...(extras.reminderLead ? { reminderLead: extras.reminderLead } : {}),
      });
    }
    // Q1: z terminem toast mówi, kiedy zadzwoni; „Cofnij” działa tak samo jak przy zwykłej notatce.
    const reminderAt = args[4] as number | null;
    const added = reminderAt !== null && reminderAt !== undefined ? `Dodano z terminem: ${formatReminderShort(reminderAt)}` : "Dodano notatkę";
    toastWithUndo(added, () => deleteNote(id), { icon: "📝", duration: 4000, id: "composer-added" });
    return id;
  }, [handleAddNoteGlow, updateNote, deleteNote]);

  /** Kandydaci na rodzica w pasku nowej notatki: jawne, żywe notatki, od ostatnio edytowanych. */
  const composerParents = useMemo(
    () => [...notes].filter((n) => !n.locked && !n.archived && !n.trashed).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 200).map((n) => ({ id: n.id, title: n.title })),
    [notes],
  );

  const handleMoveToFolderGlow = useCallback((id: string, folderId: string | null) => {
    const from = pointOfNote(id);
    const target = folderId
      ? document.querySelector(`[data-folder-drop="${folderId}"]`)
      : document.querySelector("[data-folder-drop-root]");
    const to = centerOf(target);
    if (from && to) glowStreak(from, to, "move");
    else if (from) glowPulse(from, "move");
    moveNoteToFolder(id, folderId);
  }, [moveNoteToFolder]);

  return { handleAddNoteGlow, handleComposerAdd, composerParents, handleMoveToFolderGlow };
}

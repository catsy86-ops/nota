import { useCallback } from "react";
import { toast } from "sonner";
import type { Folder, useNotes } from "@/hooks/useNotes";
import type { InboxCaptureExtras } from "@/components/InboxCapture";
import { captureParts } from "@/lib/inbox";
import { toastWithUndo } from "@/lib/undoToast";
import { formatReminderShort } from "@/lib/reminderTime";
import { requestNotificationPermissionOnIntent } from "@/lib/notificationPermission";

type Actions = ReturnType<typeof useNotes>;

interface Args {
  /** Dodanie notatki z kontekstem widoku (folder, etykieta) i błyskiem — `handleAddNoteGlow` ze strony. */
  addNote: (...args: Parameters<Actions["addNote"]>) => string;
  deleteNote: Actions["deleteNote"];
  addLabel: Actions["addLabel"];
  folders: Folder[];
}

/**
 * Skrzynka: zapis z pola przechwytywania (Enter, bez pytań, „Cofnij” w dymku) i z wklejonych albo upuszczonych plików
 * (zdjęcia i PDF jak przy udostępnianiu, tekst z pola to tytuł). Wyciągnięte z `Index.tsx` bez zmiany zachowania.
 */
export function useInboxCapture({ addNote: handleAddNoteGlow, deleteNote, addLabel, folders }: Args) {
  // Pole Skrzynki: Enter zapisuje od razu, bez pytań; „Cofnij” w dymku kasuje świeżą notatkę.
  const captureToInbox = useCallback((title: string, content: string, extras?: InboxCaptureExtras) => {
    extras?.newLabels.forEach((l) => addLabel(l));
    const id = handleAddNoteGlow(title, content, undefined, extras?.labels, extras?.reminder ?? null, undefined, undefined, extras?.priority ?? undefined, extras?.folderId ?? null);
    if (extras?.reminder) requestNotificationPermissionOnIntent();
    // 2.1: dymek mówi, dokąd trafiła notatka — z etykietą albo folderem nie ma jej już w Skrzynce.
    const folderName = extras?.folderId ? folders.find((f) => f.id === extras.folderId)?.name : undefined;
    const where = [...(extras?.labels ?? []).map((l) => `#${l}`), ...(folderName ? [folderName] : []), ...(extras?.reminder ? [formatReminderShort(extras.reminder)] : [])];
    const filed = (extras?.labels.length ?? 0) > 0 || !!folderName;
    const msg = where.length === 0 ? "Zapisano w skrzynce" : filed ? `Zapisano w ${where.join(" · ")}` : `Zapisano w skrzynce · ${where.join(" · ")}`;
    toastWithUndo(msg, () => deleteNote(id), { icon: "📥", duration: 4000, id: "inbox-capture" });
  }, [handleAddNoteGlow, deleteNote, addLabel, folders]);

  // Skrzynka 2.5: wklejony obraz albo upuszczony plik — zdjęcia i PDF jak przy udostępnianiu, tekst z pola to tytuł.
  const captureFilesToInbox = useCallback((files: File[], text: string) => {
    void import("@/lib/inboxFiles").then(async ({ importNoteFiles, warnImportedFiles }) => {
      const imported = await importNoteFiles(files);
      warnImportedFiles(imported);
      const count = imported.images.length + imported.attachments.length;
      if (count === 0) return;
      const parts = captureParts(text) ?? { title: "", content: "" };
      const id = handleAddNoteGlow(parts.title, parts.content, undefined, [], null, imported.images, [], undefined, null, imported.attachments);
      toastWithUndo(count === 1 ? "Zapisano w skrzynce z plikiem" : `Zapisano w skrzynce z ${count} plikami`, () => deleteNote(id), { icon: "📥", duration: 4000, id: "inbox-capture" });
    }, () => toast.error("Nie udało się wczytać plików", { description: "Sprawdź połączenie i spróbuj jeszcze raz." }));
  }, [handleAddNoteGlow, deleteNote]);

  return { captureToInbox, captureFilesToInbox };
}

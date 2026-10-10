import { Lock, LockOpen } from "lucide-react";
import { lockNoteFlow, removeLockFlow } from "@/lib/privateActions";

/**
 * Akcja w menu „więcej” kafla: Zablokuj / Zdejmij blokadę. Osobny komponent,
 * żeby `NoteCard` dostał minimalny patch, a cała logika została tutaj.
 */
export function PrivateNoteButton({ noteId, locked }: { noteId: string; locked: boolean }) {
  const title = locked ? "Zdejmij blokadę" : "Zablokuj (notatka prywatna)";
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        void (locked ? removeLockFlow(noteId) : lockNoteFlow(noteId));
      }}
      aria-label={title}
      data-tip={title}
      className="card-action text-muted-foreground"
    >
      {locked ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
    </button>
  );
}

import type { ReactNode } from "react";
import type { Note, NoteColor } from "@/hooks/useNotes";
import type { useNoteViewActions } from "@/hooks/NoteViewActionsContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ColorPicker } from "./ColorPicker";
import { NoteImage } from "./NoteImage";
import { PrimaryActions } from "./NoteCardActions";

type Actions = ReturnType<typeof useNoteViewActions>;

/**
 * Arkusz „⋯” na dotyku: tytuł, kolor, szybkie akcje i reszta („Więcej”). `more` to ten sam
 * element co w rozwinięciu kafla (`NoteCard` go buduje). Dotknięcie w arkuszu nie otwiera
 * edytora kafla — stąd zatrzymanie zdarzeń na `SheetContent`.
 */
export function ActionSheet({
  open,
  onOpenChange,
  note,
  isArchived,
  pinSparkle,
  onAskDeleteConfirm,
  more,
  onUpdate,
  onTogglePin,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note;
  isArchived?: boolean;
  pinSparkle: boolean;
  onAskDeleteConfirm: () => void;
  more: ReactNode;
} & Pick<Actions, "onUpdate" | "onTogglePin" | "onArchive" | "onUnarchive" | "onDelete">) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Portal: zdarzenia i tak płyną drzewem Reacta do kafla — bez stopPropagation stuknięcie otwierałoby edytor. */}
      <SheetContent side="bottom" className="note-sheet rounded-t-3xl border-t border-border/60 pb-[calc(env(safe-area-inset-bottom)+16px)]" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
        <SheetHeader className="text-left pr-10">
          <SheetTitle className="font-display truncate">{note.locked ? "Notatka prywatna" : note.title.trim() || "Notatka bez tytułu"}</SheetTitle>
        </SheetHeader>
        {!isArchived && !note.trashed && (
          <section className="pt-4">
            <h3 className="px-1 pb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Kolor</h3>
            <ColorPicker selected={note.color} onSelect={(c: NoteColor) => onUpdate?.(note.id, { color: c })} />
          </section>
        )}
        <section className="pt-4">
          <h3 className="px-1 pb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Szybkie</h3>
          <div className="note-sheet-grid">
            <PrimaryActions
              note={note}
              isArchived={isArchived}
              inSheet
              pinSparkle={pinSparkle}
              onClose={() => onOpenChange(false)}
              onAskDeleteConfirm={onAskDeleteConfirm}
              onUpdate={onUpdate}
              onTogglePin={onTogglePin}
              onArchive={onArchive}
              onUnarchive={onUnarchive}
              onDelete={onDelete}
            />
          </div>
        </section>
        <section className="pt-4">
          <h3 className="px-1 pb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Więcej</h3>
          <div className="note-sheet-grid">{more}</div>
        </section>
      </SheetContent>
    </Sheet>
  );
}

/** Podgląd obrazka z kafla na pełnym ekranie; zamknięcie czyści `imageRef`. */
export function ImagePreviewDialog({ imageRef, onClose }: { imageRef: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!imageRef} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl p-2 bg-transparent border-none shadow-none">
        {imageRef && <NoteImage imageRef={imageRef} loading="eager" className="w-full rounded-card shadow-elevation-3" placeholderClassName="aspect-video" />}
      </DialogContent>
    </Dialog>
  );
}

/** Potwierdzenie usunięcia notatki z kosza (trwale). */
export function DeleteNoteDialog({
  open,
  onOpenChange,
  note,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: Note;
} & Pick<Actions, "onDelete">) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Usunąć notatkę?</AlertDialogTitle>
          <AlertDialogDescription>
            {note.title ? `„${note.title}" zostanie trwale usunięta.` : "Ta notatka zostanie trwale usunięta."} Tej operacji nie można cofnąć.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={() => onDelete(note.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Usuń</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

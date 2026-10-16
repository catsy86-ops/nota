import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Potwierdzenie trwałego usunięcia zaznaczonych (z Kosza); `ids === null` = zamknięte. */
export function DeleteForeverDialog({ ids, onCancel, onConfirm }: { ids: string[] | null; onCancel: () => void; onConfirm: (ids: string[]) => void }) {
  const n = ids?.length ?? 0;
  return (
    <AlertDialog open={ids !== null} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Usunąć trwale?</AlertDialogTitle>
          <AlertDialogDescription>
            {n} {n === 1 ? "notatka zostanie" : "notatki zostaną"} trwale usunięte. Tej operacji nie można cofnąć.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(ids ?? [])} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Usuń trwale
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Potwierdzenie opróżnienia Kosza. */
export function EmptyTrashDialog({ open, onOpenChange, count, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; count: number; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Opróżnić kosz?</AlertDialogTitle>
          <AlertDialogDescription>
            Wszystkie {count} {count === 1 ? "notatka zostanie" : "notatki zostaną"} trwale usunięte. Tej operacji nie można cofnąć.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Anuluj</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Opróżnij
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

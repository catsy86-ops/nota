import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { readLastImport, undoImport } from "@/lib/import/commit";
import { pluralPl } from "@/lib/plural";
import { Section } from "./SettingsShared";

/**
 * „Cofnij ostatni import” przez dobę od importu (Z-18.8, I2 audytu 2): dymek po imporcie znika po 10 s, a przerwany
 * import (zamknięta karta) zostawia listę zapisanych przed zapisem identyfikatorów — cofnięcie usuwa to, co istnieje.
 */
export function LastImportUndo() {
  const [last, setLast] = useState(() => readLastImport());
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (!last) return null;
  const n = last.noteIds.length;
  const label = pluralPl(n, ["notatka", "notatki", "notatek"]);

  function undo() {
    if (!last) return;
    undoImport(last);
    setLast(null);
    toast.success("Cofnięto ostatni import");
  }

  return (
    <Section title="Ostatni import">
      <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="last-import">
        <p className="min-w-0 flex-1 text-muted-foreground">
          {format(last.at, "dd.MM HH:mm")} — {n} {label}. Cofnięcie jest dostępne przez dobę od importu.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => setConfirmOpen(true)} className="coarse:h-11">Cofnij import</Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cofnąć ostatni import?</AlertDialogTitle>
            <AlertDialogDescription>
              Usunie {n} {label} dodane tym importem — także te, które potem zmieniono. Foldery, etykiety i pola z importu znikną,
              jeśli nic ich już nie używa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={undo}>Cofnij import</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}

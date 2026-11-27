import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { SIGNALS } from "@/lib/storage/names";
import { awayTitle, type AwayNote } from "@/lib/sync/awayChanges";

/**
 * Q4.2: okno „Co się zmieniło, gdy mnie nie było” — otwiera je „Pokaż” w komunikacie po synchronizacji
 * po przerwie (`showAwayChanges`). Stuknięcie w notatkę zamyka okno i otwiera ją.
 */
export function AwayChangesHost({ onOpenNote }: { onOpenNote: (id: string) => void }) {
  const [notes, setNotes] = useState<AwayNote[] | null>(null);

  useEffect(() => {
    const onShow = (e: Event) => setNotes((e as CustomEvent<AwayNote[]>).detail ?? []);
    window.addEventListener(SIGNALS.awayChanges, onShow);
    return () => window.removeEventListener(SIGNALS.awayChanges, onShow);
  }, []);

  if (!notes) return null;
  return (
    <Dialog open onOpenChange={(o) => { if (!o) setNotes(null); }}>
      <ResponsiveDialogContent className="max-w-md" data-testid="away-changes">
        <DialogHeader>
          <DialogTitle className="font-display">{awayTitle(notes.length)}</DialogTitle>
          <DialogDescription>Zmiany, które przyszły po przerwie. Stuknij, żeby otworzyć.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-1">
          {notes.map((n) => (
            <li key={n.id}>
              <Button type="button" variant="ghost" className="h-auto w-full justify-between gap-3 py-2 text-left coarse:min-h-11"
                onClick={() => { setNotes(null); onOpenNote(n.id); }}>
                <span className="min-w-0 truncate font-medium">{n.title || "Bez tytułu"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(n.updatedAt, { addSuffix: true, locale: pl })}</span>
              </Button>
            </li>
          ))}
        </ul>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

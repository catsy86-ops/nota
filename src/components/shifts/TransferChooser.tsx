import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import type { TransferMode } from "@/lib/shifts";

/** Wybór po upuszczeniu zmiany: przenieś, skopiuj albo zamień (`swap`, tylko gdy dzień docelowy ma zmianę). */
export type DropChoice = TransferMode | "swap";

/** Dotyk nie ma Alta — po upuszczeniu zmiany pytamy, co z nią zrobić. */
export function TransferChooser({ pending, label, canSwap, onChoose, onClose }: {
  pending: { from: string; to: string } | null;
  label: string;
  /** Dzień docelowy ma zmianę — wtedy można je zamienić miejscami. */
  canSwap: boolean;
  onChoose: (mode: DropChoice) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={pending !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <ResponsiveDialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{canSwap ? "Przenieść, skopiować czy zamienić?" : "Przenieść czy skopiować?"}</DialogTitle>
          <DialogDescription>{label}{canSwap ? " Dzień docelowy ma już zmianę." : ""}</DialogDescription>
        </DialogHeader>
        <ResponsiveDialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={() => onChoose("copy")}>Skopiuj</Button>
          {canSwap && <Button type="button" variant="outline" onClick={() => onChoose("swap")}>Zamień</Button>}
          <Button type="button" onClick={() => onChoose("move")}>Przenieś</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

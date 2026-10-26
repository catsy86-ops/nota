import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { parseNaturalDate } from "@/lib/parseNaturalDate";
import { formatReminderShort } from "@/lib/reminderTime";

interface SnoozeUntilDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Wywoływane z wybraną chwilą (ms). Zapis i cofnięcie robi wywołujący. */
  onPick: (at: number) => void;
}

/**
 * „Odłóż do…” (2.2): pole tekstowe z tym samym parserem co przypomnienie („piątek 8:00”, „12.11 9:00”).
 * Pokazuje, co zostanie ustawione, zanim zapis; przeszłości ani pustego tekstu nie przyjmuje.
 */
export function SnoozeUntilDialog({ open, onOpenChange, onPick }: SnoozeUntilDialogProps) {
  const [text, setText] = useState("");
  const inputId = useId();
  const parsed = text.trim() ? parseNaturalDate(text, new Date()) : null;
  const valid = parsed !== null && parsed.getTime() > Date.now();

  const save = () => {
    if (!valid || !parsed) return;
    onPick(parsed.getTime());
    setText("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Odłóż do…</DialogTitle>
          <DialogDescription>Wpisz kiedy, np. „piątek 8:00”, „jutro 15”, „12.11 9:00”. Odłoży tylko to jedno wystąpienie.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save(); }} className="space-y-2">
          <label htmlFor={inputId} className="text-sm font-medium">Kiedy</label>
          <Input id={inputId} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="piątek 8:00" aria-invalid={text.trim() !== "" && !valid} />
          <p className="text-xs text-muted-foreground min-h-4" role="status">
            {text.trim() === "" ? "" : valid && parsed ? `Ustawię na: ${formatReminderShort(parsed.getTime())}` : "Nie rozumiem tej daty albo jest w przeszłości."}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
            <Button type="submit" disabled={!valid}>Odłóż</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

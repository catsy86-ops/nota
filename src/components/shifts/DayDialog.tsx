import { useEffect, useState } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { entryMinutes, formatDuration, holidayName, setDayEntry, shiftInk, type DayEntry, type ShiftType } from "@/lib/shifts";
import { cn } from "@/lib/utils";

interface DayDialogProps {
  dayKey: string | null;
  entry: DayEntry | undefined;
  types: ShiftType[];
  onOpenChange: (open: boolean) => void;
}

const STEP = 15;

/** Szczegóły jednego dnia: rodzaj zmiany, odchylenie od planu i notatka. */
export function DayDialog({ dayKey, entry, types, onOpenChange }: DayDialogProps) {
  const [typeId, setTypeId] = useState<string | null>(null);
  const [extra, setExtra] = useState(0);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!dayKey) return;
    setTypeId(entry?.type ?? null);
    setExtra(entry?.extraMin ?? 0);
    setNote(entry?.note ?? "");
  }, [dayKey, entry]);

  if (!dayKey) return null;
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const holiday = holidayName(dayKey);
  const type = types.find((t) => t.id === typeId);

  function save() {
    if (!dayKey) return;
    setDayEntry(dayKey, typeId ? { type: typeId, ...(extra ? { extraMin: extra } : {}), ...(note.trim() ? { note: note.trim() } : {}) } : null);
    onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display capitalize">{format(date, "EEEE, d MMMM", { locale: pl })}</DialogTitle>
          {holiday && <DialogDescription className="text-destructive">{holiday} — dzień ustawowo wolny</DialogDescription>}
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <fieldset>
            <legend className="text-sm font-medium mb-2">Zmiana</legend>
            <div role="radiogroup" aria-label="Zmiana" className="flex flex-wrap gap-2">
              {[null, ...types].map((t) => {
                const id = t?.id ?? null;
                const active = typeId === id;
                return (
                  <button key={id ?? "free"} type="button" role="radio" aria-checked={active} onClick={() => setTypeId(id)}
                    className={cn("pressable h-10 coarse:h-11 px-3 rounded-xl border text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "border-transparent" : "border-border/60 bg-card/50 hover:bg-muted",
                      active && !t && "bg-foreground text-background")}
                    style={active && t ? { backgroundColor: t.color, color: shiftInk(t.color) } : undefined}>
                    {t?.name ?? "Wolne"}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {type && type.kind !== "absence" && (
            <div className="space-y-1.5">
              <Label id="extra-label">Dłużej / krócej niż w planie</Label>
              <div className="flex items-center gap-2" role="group" aria-labelledby="extra-label">
                <Button type="button" variant="outline" size="icon" aria-label={`Odejmij ${STEP} minut`} onClick={() => setExtra((x) => x - STEP)}>
                  <Minus className="w-4 h-4" />
                </Button>
                <output aria-live="polite" className={cn("flex-1 text-center font-semibold tabular-nums", extra > 0 && "text-accent", extra < 0 && "text-muted-foreground")}>
                  {extra === 0 ? "zgodnie z planem" : `${extra > 0 ? "+" : ""}${formatDuration(extra)}`}
                </output>
                <Button type="button" variant="outline" size="icon" aria-label={`Dodaj ${STEP} minut`} onClick={() => setExtra((x) => x + STEP)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Czas tego dnia: <span className="font-semibold text-foreground">{formatDuration(entryMinutes(type, { extraMin: extra }))}</span>
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="day-note">Notatka</Label>
            <textarea id="day-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="np. zastępstwo za Kasię"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
          </div>

          <DialogFooter>
            <Button type="submit">Zapisz dzień</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

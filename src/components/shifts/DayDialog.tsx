import { useState } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { dayType, entryMinutes, formatDuration, holidayName, isAbsence, setDayEntry, shiftInk, type DayEntry, type ShiftType } from "@/lib/shifts";
import { cn } from "@/lib/utils";

interface DayDialogProps {
  dayKey: string | null;
  entry: DayEntry | undefined;
  types: ShiftType[];
  onOpenChange: (open: boolean) => void;
}

const STEP = 15;

/**
 * Szczegóły jednego dnia: rodzaj zmiany, odchylenie od planu i notatka.
 * Formularz startuje od wpisu z chwili otwarcia (`key` = dzień) — zmiana
 * z innej karty nie nadpisuje tego, co ktoś akurat pisze.
 */
export function DayDialog({ dayKey, entry, types, onOpenChange }: DayDialogProps) {
  if (!dayKey) return null;
  // Okno zostaje, gdy zmienia się dzień (np. skok z palety): remontuje się tylko treść
  // i wjeżdża miękko, zamiast zamykać i otwierać cały dialog z overlayem.
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DayForm key={dayKey} dayKey={dayKey} entry={entry} types={types} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function DayForm({ dayKey, entry, types, onOpenChange }: DayDialogProps & { dayKey: string }) {
  const [typeId, setTypeId] = useState<string | null>(entry?.type ?? null);
  const [extra, setExtra] = useState(entry?.extraMin ?? 0);
  const [note, setNote] = useState(entry?.note ?? "");
  const [offSchedule, setOffSchedule] = useState(entry?.offSchedule === true);
  const [inLieu, setInLieu] = useState(entry?.inLieu === true);

  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const holiday = holidayName(dayKey);
  const base = types.find((t) => t.id === typeId);
  // Ten sam rodzaj co w zapisie: godziny z tamtego dnia (jeśli rodzaj później zmienił godziny).
  const keepHours = typeId === entry?.type ? entry?.hours : undefined;
  const type = base && dayType(base, { hours: keepHours });
  const isWork = !!type && !isAbsence(type);
  // W niedzielę i święto „poza grafikiem” zmienia dodatek za nadgodziny, w pozostałe dni — wolne za niedzielę.
  const askOffSchedule = isWork && (date.getDay() === 0 || !!holiday);
  const askInLieu = isWork && !askOffSchedule;

  function save() {
    setDayEntry(dayKey, typeId ? {
      type: typeId,
      ...(extra && !(type && isAbsence(type)) ? { extraMin: extra } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(askOffSchedule && offSchedule ? { offSchedule: true as const } : {}),
      ...(askInLieu && inLieu ? { inLieu: true as const } : {}),
      ...(keepHours ? { hours: keepHours } : {}),
    } : null);
    onOpenChange(false);
  }

  return (
    <>
        <DialogHeader className="soft-swap">
          <DialogTitle className="font-display first-letter:uppercase">{format(date, "EEEE, d MMMM", { locale: pl })}</DialogTitle>
          {holiday && <DialogDescription className="text-destructive">{holiday} — dzień ustawowo wolny</DialogDescription>}
        </DialogHeader>
        <form className="space-y-4 soft-swap" onSubmit={(e) => { e.preventDefault(); save(); }}>
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
                <output aria-live="polite" className={cn("flex-1 text-center font-semibold tabular-nums", extra > 0 && "text-primary", extra < 0 && "text-muted-foreground")}>
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

          {askOffSchedule && (
            <div className="flex gap-2.5">
              <Checkbox id="day-off-schedule" checked={offSchedule} onCheckedChange={(v) => setOffSchedule(v === true)}
                aria-describedby="day-off-schedule-hint" className="mt-0.5" />
              <div className="space-y-0.5">
                <Label htmlFor="day-off-schedule">Poza grafikiem</Label>
                <p id="day-off-schedule-hint" className="text-xs text-muted-foreground">
                  Ten dzień miał być wolny. Nadgodziny w niedzielę lub święto wolne wg grafiku mają dodatek 100%, w zaplanowane — 50%.
                </p>
              </div>
            </div>
          )}

          {askInLieu && (
            <div className="flex gap-2.5">
              <Checkbox id="day-in-lieu" checked={inLieu} onCheckedChange={(v) => setInLieu(v === true)}
                aria-describedby="day-in-lieu-hint" className="mt-0.5" />
              <div className="space-y-0.5">
                <Label htmlFor="day-in-lieu">W dzień wolny za niedzielę lub święto</Label>
                <p id="day-in-lieu-hint" className="text-xs text-muted-foreground">
                  Ten dzień był wolny w zamian za pracę w niedzielę lub święto. Nadgodziny w taki dzień mają dodatek 100%.
                </p>
              </div>
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
    </>
  );
}

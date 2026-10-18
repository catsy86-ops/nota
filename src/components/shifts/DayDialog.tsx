import { useState } from "react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Minus, Plus } from "lucide-react";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { dayType, entryMinutes, formatDuration, holidayName, isAbsence, setDayEntry, shiftHours, shiftInk, type DayEntry, type ShiftHours, type ShiftType } from "@/lib/shifts";
import { cn } from "@/lib/utils";
import { TimeStepper } from "./TimeStepper";

interface DayDialogProps {
  dayKey: string | null;
  entry: DayEntry | undefined;
  types: ShiftType[];
  onOpenChange: (open: boolean) => void;
}

const STEP = 15;
const HM = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Godziny wpisane ręcznie dla dnia: ciągi z pól, żeby dało się je dopisywać bez walidacji w trakcie. */
interface HoursDraft { start: string; end: string; breakMin: string }

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
      <ResponsiveDialogContent className="max-w-sm">
        <DayForm key={dayKey} dayKey={dayKey} entry={entry} types={types} onOpenChange={onOpenChange} />
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function DayForm({ dayKey, entry, types, onOpenChange }: DayDialogProps & { dayKey: string }) {
  const [typeId, setTypeId] = useState<string | null>(entry?.type ?? null);
  const [extra, setExtra] = useState(entry?.extraMin ?? 0);
  const [note, setNote] = useState(entry?.note ?? "");
  const [offSchedule, setOffSchedule] = useState(entry?.offSchedule === true);
  const [inLieu, setInLieu] = useState(entry?.inLieu === true);
  // Ręczne godziny tego dnia; `null` = godziny rodzaju (albo zapisane z dnia).
  const [custom, setCustom] = useState<HoursDraft | null>(
    entry?.customHours && entry.hours
      ? { start: entry.hours.start, end: entry.hours.end, breakMin: String(entry.hours.breakMin) }
      : null,
  );

  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const holiday = holidayName(dayKey);
  const base = types.find((t) => t.id === typeId);
  // Ten sam rodzaj co w zapisie: godziny z tamtego dnia (jeśli rodzaj później zmienił godziny).
  // Godziny wpisane ręcznie to osobny stan (`custom`), nie godziny rodzaju.
  const keepHours = typeId === entry?.type && !entry?.customHours ? entry?.hours : undefined;
  const stored = base && dayType(base, { hours: keepHours });
  const customOk = !!custom && HM.test(custom.start) && HM.test(custom.end)
    && custom.breakMin !== "" && Number.isInteger(Number(custom.breakMin)) && Number(custom.breakMin) >= 0;
  const customHours: ShiftHours | null = custom && customOk
    ? { start: custom.start, end: custom.end, breakMin: Number(custom.breakMin) } : null;
  // Przerwa „od” dotyczy godzin rodzaju; przy ręcznych godzinach nie ma sensu.
  const type = stored && (customHours ? { ...stored, ...customHours, breakAt: undefined } : stored);
  const isWork = !!type && !isAbsence(type);
  // W niedzielę i święto „poza grafikiem” zmienia dodatek za nadgodziny, w pozostałe dni — wolne za niedzielę.
  const askOffSchedule = isWork && (date.getDay() === 0 || !!holiday);
  const askInLieu = isWork && !askOffSchedule;

  const hoursInvalid = !!custom && !customOk;

  function editHours(patch: Partial<HoursDraft>) {
    if (!stored) return;
    const next = { start: stored.start, end: stored.end, breakMin: String(stored.breakMin), ...custom, ...patch };
    // Równe godzinom rodzaju = brak ręcznego nadpisania.
    const same = next.start === stored.start && next.end === stored.end && Number(next.breakMin) === stored.breakMin;
    setCustom(same ? null : next);
  }

  /** Strzałki przesuwają wybór po rodzajach (jeden przystanek tabulatora na grupę, jak w ARIA radiogroup). */
  function onTypeKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const ids = [null, ...types.map((t) => t.id)];
    const at = Math.max(0, ids.indexOf(typeId));
    const next = ids[(at + step + ids.length) % ids.length];
    pickType(next);
    const radios = e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-type-radio]");
    radios[(at + step + ids.length) % ids.length]?.focus();
  }

  function pickType(id: string | null) {
    if (id !== typeId) setCustom(null);
    setTypeId(id);
  }

  function save() {
    if (hoursInvalid) return;
    setDayEntry(dayKey, typeId ? {
      type: typeId,
      ...(extra && !(type && isAbsence(type)) ? { extraMin: extra } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(askOffSchedule && offSchedule ? { offSchedule: true as const } : {}),
      ...(askInLieu && inLieu ? { inLieu: true as const } : {}),
      ...(customHours && isWork ? { hours: shiftHours(customHours), customHours: true as const } : keepHours ? { hours: keepHours } : {}),
    } : null);
    onOpenChange(false);
  }

  return (
    <>
        <DialogHeader className="soft-swap">
          <DialogTitle className="font-display first-letter:uppercase">{format(date, "EEEE, d MMMM", { locale: pl })}</DialogTitle>
          {holiday && <DialogDescription className="text-destructive-ink">{holiday} — dzień ustawowo wolny</DialogDescription>}
        </DialogHeader>
        <form className="space-y-4 soft-swap" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <fieldset className="min-w-0">
            <legend className="text-sm font-medium mb-2">Zmiana</legend>
            <div role="radiogroup" aria-label="Zmiana" className="flex flex-wrap gap-2" onKeyDown={onTypeKey}>
              {[null, ...types].map((t) => {
                const id = t?.id ?? null;
                const active = typeId === id;
                return (
                  <button key={id ?? "free"} type="button" role="radio" aria-checked={active} data-type-radio
                    tabIndex={active ? 0 : -1} onClick={() => pickType(id)}
                    className={cn("pressable h-10 coarse:h-11 px-3 rounded-xl border text-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
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
                <output aria-live="polite" className={cn("flex-1 text-center font-semibold tabular-nums", extra > 0 && "text-primary-ink", extra < 0 && "text-muted-foreground")}>
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

          {type && stored && type.kind !== "absence" && (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium mb-1.5">Godziny tego dnia</legend>
              <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                <TimeStepper id="day-start" label="Od" value={custom?.start ?? stored.start}
                  invalid={!!custom && !HM.test(custom.start)} onChange={(v) => editHours({ start: v })} />
                <TimeStepper id="day-end" label="Do" value={custom?.end ?? stored.end}
                  invalid={!!custom && !HM.test(custom.end)} onChange={(v) => editHours({ end: v })} />
                <div className="space-y-1 col-span-2">
                  <Label htmlFor="day-break" className="text-xs text-muted-foreground">Przerwa (min)</Label>
                  <Input id="day-break" type="number" min={0} step={5} inputMode="numeric" value={custom?.breakMin ?? String(stored.breakMin)}
                    aria-invalid={!!custom && custom.breakMin === ""} onChange={(e) => editHours({ breakMin: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 min-h-8">
                <p className="text-xs text-muted-foreground">
                  {custom
                    ? hoursInvalid ? "Uzupełnij godziny." : `Ręcznie wpisane — zamiast ${base?.start}–${base?.end}.`
                    : `Wg zmiany „${base?.name}”.`}
                </p>
                {custom && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCustom(null)}>Przywróć godziny zmiany</Button>
                )}
              </div>
            </fieldset>
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
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring resize-none" />
          </div>

          <ResponsiveDialogFooter>
            <Button type="submit" disabled={hoursInvalid}>Zapisz dzień</Button>
          </ResponsiveDialogFooter>
        </form>
    </>
  );
}

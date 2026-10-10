import { useState } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDuration, shiftHours, type ShiftHours, type ShiftType } from "@/lib/shifts";
import { cn } from "@/lib/utils";
import { TimeStepper } from "./TimeStepper";

const HM = /^([01]?\d|2[0-3]):[0-5]\d$/;

/** Gotowe długości zmiany od wybranego początku — najczęstsze wpisy bez klikania w pola czasu. */
const PRESETS: [string, number][] = [["4 h", 4], ["6 h", 6], ["8 h", 8], ["10 h", 10], ["12 h", 12]];

const toMin = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };
const fromMin = (min: number) => {
  const t = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

interface BrushHoursProps {
  type: ShiftType;
  /** Godziny, które pędzel nanosi zamiast godzin rodzaju; `null` = godziny rodzaju. */
  hours: ShiftHours | null;
  onChange: (hours: ShiftHours | null) => void;
}

/**
 * Własne godziny dla pędzla: stuknięcie w dzień nanosi wybraną zmianę
 * z tymi godzinami (np. 07:30–15:45), bez otwierania okna dnia.
 */
export function BrushHours({ type, hours, onChange }: BrushHoursProps) {
  const [open, setOpen] = useState(hours !== null);
  const base = shiftHours(type);
  const cur = hours ?? base;
  const [draft, setDraft] = useState({ start: cur.start, end: cur.end, breakMin: String(cur.breakMin) });

  function edit(patch: Partial<typeof draft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    const brk = Number(next.breakMin);
    if (!HM.test(next.start) || !HM.test(next.end) || next.breakMin === "" || !Number.isInteger(brk) || brk < 0) return;
    const same = next.start === base.start && next.end === base.end && brk === base.breakMin;
    onChange(same ? null : { start: next.start, end: next.end, breakMin: brk });
  }

  function reset() {
    setDraft({ start: base.start, end: base.end, breakMin: String(base.breakMin) });
    onChange(null);
  }

  const span = HM.test(draft.start) && HM.test(draft.end)
    ? (() => { const d = toMin(draft.end) - toMin(draft.start); return d <= 0 ? d + 1440 : d; })()
    : null;
  const net = span === null ? null : Math.max(0, span - (Number(draft.breakMin) || 0));

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="pressable -mt-2 flex items-center gap-1.5 h-9 coarse:h-10 px-3 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Clock className="w-4 h-4" /> Własne godziny dla „{type.name}”
      </button>
    );
  }

  return (
    <section aria-label={`Własne godziny dla zmiany ${type.name}`} className="-mt-2 rounded-2xl border border-border/60 bg-card/50 p-3 space-y-2.5">
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40"><TimeStepper id="brush-start" label="Od" value={draft.start} onChange={(v) => edit({ start: v })} /></div>
        <div className="w-40"><TimeStepper id="brush-end" label="Do" value={draft.end} onChange={(v) => edit({ end: v })} /></div>
        <div className="space-y-1">
          <Label htmlFor="brush-break" className="text-xs text-muted-foreground">Przerwa (min)</Label>
          <Input id="brush-break" type="number" min={0} step={5} inputMode="numeric" value={draft.breakMin}
            onChange={(e) => edit({ breakMin: e.target.value })} className="w-24" />
        </div>
        <button type="button" onClick={reset} disabled={hours === null}
          className="pressable h-10 coarse:h-11 px-3 rounded-xl flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <RotateCcw className="w-4 h-4" /> Godziny zmiany
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map(([label, h]) => {
          const disabled = !HM.test(draft.start);
          return (
            <button key={label} type="button" disabled={disabled}
              onClick={() => edit({ end: fromMin(toMin(draft.start) + h * 60) })}
              className={cn("pressable h-8 coarse:h-10 px-2.5 rounded-lg border border-border/60 text-xs font-medium tabular-nums hover:bg-muted disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                span === h * 60 && "bg-muted")}>
              {label}
            </button>
          );
        })}
        <span aria-live="polite" className="ml-auto text-xs text-muted-foreground tabular-nums">
          {net === null ? "Uzupełnij godziny." : hours ? `Stuknięcie nanosi ${draft.start}–${draft.end}, ${formatDuration(net)}.` : `Wg zmiany: ${base.start}–${base.end}.`}
        </span>
      </div>
    </section>
  );
}

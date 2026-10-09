import { useMemo, useState } from "react";
import { pluralPl } from "@/lib/plural";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Delete, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { daysUntilMonthEnd, deletePattern, savePattern, shiftInk, shiftTextOnCard, type ShiftPattern, type ShiftType } from "@/lib/shifts";
import { cn } from "@/lib/utils";

interface PatternDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: ShiftType[];
  patterns: ShiftPattern[];
  /** Domyślny pierwszy dzień — początek oglądanego miesiąca. */
  defaultStart: string;
  onApply: (steps: (string | null)[], startKey: string, length: number) => void;
}

const RANGES = [
  { months: 0, label: "Do końca miesiąca" },
  { months: 2, label: "3 miesiące" },
  { months: 11, label: "Rok" },
] as const;

const PREVIEW_DAYS = 14;

/**
 * Układanie i nakładanie cyklu zmian, np. D D N N – – – –. Formularz
 * montuje się z każdym otwarciem, więc usunięcie zapisanego cyklu nie
 * kasuje układanych właśnie kroków.
 */
export function PatternDialog({ open, onOpenChange, ...form }: PatternDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <PatternForm onOpenChange={onOpenChange} {...form} />
      </DialogContent>
    </Dialog>
  );
}

function PatternForm({ onOpenChange, types, patterns, defaultStart, onApply }: Omit<PatternDialogProps, "open">) {
  const [steps, setSteps] = useState<(string | null)[]>(() => patterns[0]?.steps ?? []);
  const [start, setStart] = useState(defaultStart);
  const [range, setRange] = useState(0);
  const [name, setName] = useState("");
  const typesById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);

  const length = start ? daysUntilMonthEnd(start, RANGES[range].months) : 0;
  const valid = steps.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(start);
  const preview = Array.from({ length: PREVIEW_DAYS }, (_, i) => {
    const [y, m, d] = start.split("-").map(Number);
    return { date: new Date(y, m - 1, d + i), step: steps.length ? steps[i % steps.length] : undefined };
  });

  function apply() {
    if (!valid) return;
    if (name.trim()) savePattern({ id: `c${Date.now().toString(36)}`, name: name.trim(), steps });
    onApply(steps, start, length);
    onOpenChange(false);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display">Cykl zmian</DialogTitle>
        <DialogDescription>Ułóż powtarzający się układ i nałóż go na grafik.</DialogDescription>
      </DialogHeader>

      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); apply(); }}>
        {patterns.length > 0 && (
          <fieldset>
            <legend className="text-sm font-medium mb-2">Zapisane cykle</legend>
            <ul className="space-y-1.5">
              {patterns.map((p) => (
                <li key={p.id} className="flex items-center gap-1">
                  <button type="button" onClick={() => setSteps(p.steps)}
                    className="pressable flex-1 min-w-0 text-left px-3 py-2 rounded-xl border border-border/60 bg-card/50 hover:bg-muted text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="block font-medium truncate">{p.name}</span>
                    <span className="block text-2xs text-muted-foreground font-mono truncate">
                      {p.steps.map((s) => (s ? typesById.get(s)?.short ?? "?" : "–")).join(" ")}
                    </span>
                  </button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Usuń cykl ${p.name}`} onClick={() => deletePattern(p.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        <fieldset>
          <legend className="text-sm font-medium mb-2">Kolejne dni cyklu ({steps.length})</legend>
          <div aria-live="polite" className="min-h-[2.75rem] flex flex-wrap gap-1 p-2 rounded-xl bg-muted/50">
            {steps.length === 0 && <span className="text-sm text-muted-foreground self-center px-1">Stuknij zmiany poniżej, po kolei</span>}
            {steps.map((s, i) => {
              const t = s ? typesById.get(s) : undefined;
              return (
                <span key={i} className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-display", !t && "border border-dashed border-border text-muted-foreground")}
                  style={t ? { backgroundColor: t.color, color: shiftInk(t.color) } : undefined}>
                  {t?.short ?? "–"}
                </span>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {types.filter((t) => t.kind !== "absence").map((t) => (
              <button key={t.id} type="button" onClick={() => setSteps((s) => [...s, t.id])} aria-label={`Dodaj do cyklu: ${t.name}`}
                className="pressable h-9 coarse:h-11 px-3 rounded-xl text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ backgroundColor: t.color, color: shiftInk(t.color) }}>
                + {t.short}
              </button>
            ))}
            <button type="button" onClick={() => setSteps((s) => [...s, null])} aria-label="Dodaj do cyklu: wolne"
              className="pressable h-9 coarse:h-11 px-3 rounded-xl border border-dashed border-border text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              + Wolne
            </button>
            <button type="button" onClick={() => setSteps((s) => s.slice(0, -1))} disabled={!steps.length} aria-label="Usuń ostatni dzień cyklu"
              className="pressable h-9 coarse:h-11 px-3 rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Delete className="w-4 h-4" />
            </button>
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="pattern-start">Od dnia</Label>
            <Input id="pattern-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pattern-range">Na okres</Label>
            <select id="pattern-range" value={range} onChange={(e) => setRange(Number(e.target.value))}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {RANGES.map((r, i) => <option key={r.label} value={i}>{r.label}</option>)}
            </select>
          </div>
        </div>

        {valid && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Podgląd pierwszych {PREVIEW_DAYS} dni · razem {length} {pluralPl(length, ["dzień", "dni", "dni"])}</p>
            <div className="grid grid-cols-7 gap-1">
              {preview.map(({ date, step }, i) => {
                const t = step ? typesById.get(step) : undefined;
                return (
                  <div key={i} className="rounded-lg bg-muted/50 p-1 text-center">
                    <span className="block text-2xs text-muted-foreground">{format(date, "EEEEEE d", { locale: pl })}</span>
                    <span className="block text-xs font-bold font-display" style={t ? { color: shiftTextOnCard(t.color) } : undefined}>{t?.short ?? "–"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="pattern-name">Zapisz cykl jako (opcjonalnie)</Label>
          <Input id="pattern-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Mój system 12 h" />
        </div>

        <DialogFooter>
          <Button type="submit" disabled={!valid}>Nałóż cykl</Button>
        </DialogFooter>
      </form>
    </>
  );
}

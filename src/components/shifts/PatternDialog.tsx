import { useMemo, useState } from "react";
import { pluralPl } from "@/lib/plural";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { Delete, Trash } from "lucide-react";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDaysKey, dayDiff, daysUntilMonthEnd, deletePattern, newShiftId, savePattern, shiftInk, shiftTextOnCard, type PatternOverlapKind, type ShiftPattern, type ShiftType } from "@/lib/shifts";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toastWithUndo } from "@/lib/undoToast";
import { TAP } from "@/lib/platform";

interface PatternDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: ShiftType[];
  patterns: ShiftPattern[];
  /** Domyślny pierwszy dzień — początek oglądanego miesiąca. */
  defaultStart: string;
  /** `anchorKey` — dzień pierwszego kroku cyklu; faza każdego dnia liczy się od niego. `skipProtected` — zostawić urlop, L4 i notatki. */
  onApply: (steps: (string | null)[], startKey: string, length: number, anchorKey: string, skipProtected: boolean) => void;
  /** Ile istniejących wpisów nałożenie by zmieniło (przed zatwierdzeniem). */
  overlapOf: (steps: (string | null)[], startKey: string, length: number, anchorKey: string) => Partial<Record<PatternOverlapKind, number>>;
}

const RANGES = [
  { months: 0, label: "Do końca miesiąca" },
  { months: 2, label: "3 miesiące" },
  { months: 11, label: "Rok" },
] as const;

const PREVIEW_DAYS = 14;

/** Zdanie o tym, co nałożenie zrobi z urlopami, L4 i notatkami. */
function overlapSummary(overlap: Partial<Record<PatternOverlapKind, number>>, skipProtected: boolean): string {
  const part = (n: number | undefined, forms: [string, string, string]) => (n ? `${n} ${pluralPl(n, forms)}` : null);
  const parts = [
    part(overlap.leave, ["dzień urlopu", "dni urlopu", "dni urlopu"]),
    part(overlap.sick, ["dzień L4", "dni L4", "dni L4"]),
    part(overlap.other, ["dzień nieobecności", "dni nieobecności", "dni nieobecności"]),
    part(overlap.note, ["notatka", "notatki", "notatek"]),
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return "Nie dotyka urlopów, L4 ani notatek.";
  return `${skipProtected ? "Pominie" : "Zastąpi"}: ${parts.join(", ")}.`;
}

/**
 * Układanie i nakładanie cyklu zmian, np. D D N N – – – –. Formularz
 * montuje się z każdym otwarciem, więc usunięcie zapisanego cyklu nie
 * kasuje układanych właśnie kroków.
 */
export function PatternDialog({ open, onOpenChange, ...form }: PatternDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <PatternForm onOpenChange={onOpenChange} {...form} />
      </ResponsiveDialogContent>
    </Dialog>
  );
}

function PatternForm({ onOpenChange, types, patterns, defaultStart, onApply, overlapOf }: Omit<PatternDialogProps, "open">) {
  const [steps, setSteps] = useState<(string | null)[]>(() => patterns[0]?.steps ?? []);
  const [start, setStart] = useState(defaultStart);
  const [range, setRange] = useState(0);
  const [name, setName] = useState("");
  // Zapisany cykl, którego kroki są wczytane (do „Przedłuż cykl” i zapisu kotwicy).
  const [selected, setSelected] = useState<ShiftPattern | null>(null);
  const [anchor, setAnchor] = useState(defaultStart);
  // Domyślnie nie ruszamy urlopów, L4 i notatek — nadpisanie trzeba włączyć świadomie.
  const [skipProtected, setSkipProtected] = useState(true);
  const typesById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);

  const length = start ? daysUntilMonthEnd(start, RANGES[range].months) : 0;
  const anchorOk = /^\d{4}-\d{2}-\d{2}$/.test(anchor);
  const valid = steps.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(start) && anchorOk;
  const overlap = valid ? overlapOf(steps, start, length, anchor) : {};
  const preview = Array.from({ length: PREVIEW_DAYS }, (_, i) => {
    const [y, m, d] = start.split("-").map(Number);
    const offset = anchorOk ? dayDiff(anchor, addDaysKey(start, i)) : i;
    return { date: new Date(y, m - 1, d + i), step: steps.length ? steps[((offset % steps.length) + steps.length) % steps.length] : undefined };
  });

  function loadPattern(p: ShiftPattern) {
    setSteps(p.steps);
    setSelected(p);
    setAnchor(p.anchor ?? start);
  }

  function apply() {
    if (!valid) return;
    const meta = { anchor, appliedUntil: addDaysKey(start, length - 1) };
    onApply(steps, start, length, anchor, skipProtected);
    if (name.trim()) savePattern({ id: newShiftId("c"), name: name.trim(), steps, ...meta });
    else if (selected) savePattern({ ...selected, steps, ...meta });
    onOpenChange(false);
  }

  // Przedłużenie: od dnia po ostatnim nałożonym, z fazą od kotwicy zapisanego cyklu.
  const extendKey = selected?.appliedUntil ? addDaysKey(selected.appliedUntil, 1) : null;
  const extendFrom = extendKey ? (() => { const [y, m, d] = extendKey.split("-").map(Number); return new Date(y, m - 1, d); })() : null;

  function extend() {
    if (!selected?.appliedUntil || !extendKey) return;
    const from = extendKey;
    const len = daysUntilMonthEnd(from, RANGES[range].months);
    const kotwica = selected.anchor ?? selected.appliedUntil;
    onApply(selected.steps, from, len, kotwica, skipProtected);
    savePattern({ ...selected, anchor: kotwica, appliedUntil: addDaysKey(from, len - 1) });
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
          <fieldset className="min-w-0">
            <legend className="text-sm font-medium mb-2">Zapisane cykle</legend>
            <ul className="space-y-1.5">
              {patterns.map((p) => (
                <li key={p.id} className="flex items-center gap-1">
                  <button type="button" onClick={() => loadPattern(p)}
                    className="pressable flex-1 min-w-0 text-left px-3 py-2 rounded-xl border border-border/60 bg-card/50 hover:bg-muted text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                    <span className="block font-medium truncate">{p.name}</span>
                    <span className="block text-2xs text-muted-foreground font-mono truncate">
                      {p.steps.map((s) => (s ? typesById.get(s)?.short ?? "?" : "–")).join(" ")}
                    </span>
                  </button>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Usuń cykl ${p.name}`} onClick={() => { deletePattern(p.id); toastWithUndo(`Usunięto cykl „${p.name}”`, () => savePattern(p)); }}>
                    <Trash className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        <fieldset className="min-w-0">
          <legend className="text-sm font-medium mb-2">Kolejne dni cyklu ({steps.length})</legend>
          <div aria-live="polite" className="min-h-11 flex flex-wrap gap-1 p-2 rounded-xl bg-muted/50">
            {steps.length === 0 && <span className="text-sm text-muted-foreground self-center px-1">{TAP[0].toUpperCase() + TAP.slice(1)} zmiany poniżej, po kolei</span>}
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
                className="pressable h-9 coarse:h-11 px-3 rounded-xl text-sm font-medium outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                style={{ backgroundColor: t.color, color: shiftInk(t.color) }}>
                + {t.short}
              </button>
            ))}
            <button type="button" onClick={() => setSteps((s) => [...s, null])} aria-label="Dodaj do cyklu: wolne"
              className="pressable h-9 coarse:h-11 px-3 rounded-xl border border-dashed border-border text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
              + Wolne
            </button>
            <button type="button" onClick={() => setSteps((s) => s.slice(0, -1))} disabled={!steps.length} aria-label="Usuń ostatni dzień cyklu"
              className="pressable h-9 coarse:h-11 px-3 rounded-xl text-muted-foreground hover:bg-muted disabled:opacity-40 outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
              <Delete className="w-4 h-4" />
            </button>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="pattern-start">Od dnia</Label>
            <Input id="pattern-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="min-w-0" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="pattern-range">Na okres</Label>
            <select id="pattern-range" value={range} onChange={(e) => setRange(Number(e.target.value))}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
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

        {valid && (
          <div className="space-y-2 rounded-card border border-border/60 p-3">
            <p className="text-sm" aria-live="polite">{overlapSummary(overlap, skipProtected)}</p>
            <label className="flex items-center gap-2 text-sm coarse:min-h-11">
              <Checkbox checked={skipProtected} onCheckedChange={(v) => setSkipProtected(v === true)} />
              Pomiń dni z nieobecnością i notatką
            </label>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="pattern-anchor">Kotwica: pierwszy dzień cyklu</Label>
          <Input id="pattern-anchor" type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} className="min-w-0" />
          <p className="text-2xs text-muted-foreground">Każdy dzień ma krok liczony od tej daty, więc nakładanie od innego dnia trzyma rytm.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pattern-name">Zapisz cykl jako (opcjonalnie)</Label>
          <Input id="pattern-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Mój system 12 h" />
        </div>

        <ResponsiveDialogFooter className="sticky bottom-0 -mx-1 bg-background/95 px-1 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur-xs">
          {extendFrom && (
            <Button type="button" variant="outline" onClick={extend} disabled={steps.length === 0}>
              Przedłuż cykl od {format(extendFrom, "d MMM", { locale: pl })}
            </Button>
          )}
          <Button type="submit" disabled={!valid}>Nałóż cykl</Button>
        </ResponsiveDialogFooter>
      </form>
    </>
  );
}

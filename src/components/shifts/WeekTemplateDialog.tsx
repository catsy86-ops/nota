import { useState } from "react";
import { Trash } from "lucide-react";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deletePattern, hasWorkSteps, newShiftId, patternOverlapInStore, savePattern, shiftInk, weekTemplateAnchor, type ShiftPattern, type ShiftType } from "@/lib/shifts";
import { toastWithUndo } from "@/lib/undoToast";
import { overlapSummary } from "./PatternDialog";

/** Pn–Nd, w kolejności kroków szablonu (indeks 0 = poniedziałek). */
const WEEKDAYS = ["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"];

interface WeekTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  types: ShiftType[];
  /** Zapisane szablony tygodnia (bez cykli). */
  templates: ShiftPattern[];
  /** Kroki tygodnia do zapisu; `null` poza widokiem tygodnia (wtedy sekcja zapisu się nie pokazuje). */
  weekSteps: (string | null)[] | null;
  /** Dokąd nałożyć szablon: pierwszy dzień zakresu i liczba dni (tydzień albo cały miesiąc). */
  target: { label: string; startKey: string; length: number };
  onApply: (steps: (string | null)[], startKey: string, length: number, anchorKey: string, skipProtected: boolean) => void;
}

/**
 * Szablon tygodnia (G4.6): zapisany układ pn–nd, nakładany na tydzień albo cały miesiąc.
 * Kroki z dni nieobecności (urlop, L4) nie wchodzą do szablonu, a przy nakładaniu
 * nieobecności zostają — stąd `skipProtected` zawsze włączone.
 */
export function WeekTemplateDialog({ open, onOpenChange, types, templates, weekSteps, target, onApply }: WeekTemplateDialogProps) {
  const [name, setName] = useState("");
  const typesById = new Map(types.map((t) => [t.id, t]));
  const canSave = weekSteps !== null && hasWorkSteps(weekSteps);

  function save() {
    if (!canSave) return;
    const label = name.trim() || `Szablon ${templates.length + 1}`;
    savePattern({ id: newShiftId("w"), name: label, steps: weekSteps ?? [], kind: "week" });
    setName("");
  }

  function apply(steps: (string | null)[]) {
    onApply(steps, target.startKey, target.length, weekTemplateAnchor(target.startKey), true);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Szablony tygodnia</DialogTitle>
          <DialogDescription>Układ pn–nd nakładany na {target.label}. Urlopy i L4 zostają.</DialogDescription>
        </DialogHeader>

        {templates.length > 0 ? (
          <fieldset className="min-w-0">
            <legend className="text-sm font-medium mb-2">Zapisane szablony</legend>
            <ul className="space-y-1.5">
              {templates.map((p) => {
                const overlap = patternOverlapInStore(p.steps, target.startKey, target.length, weekTemplateAnchor(target.startKey));
                return (
                  <li key={p.id} className="flex items-center gap-1">
                    <button type="button" onClick={() => apply(p.steps)} aria-label={`Nałóż szablon ${p.name} na ${target.label}`}
                      className="pressable flex-1 min-w-0 text-left px-3 py-2 rounded-card border border-border/60 bg-card/50 hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
                      <span className="block font-medium truncate">{p.name}</span>
                      <span className="mt-1 flex gap-1" aria-hidden>
                        {p.steps.map((s, i) => {
                          const t = s ? typesById.get(s) : undefined;
                          return (
                            <span key={i} title={WEEKDAYS[i]} className="w-6 h-6 rounded-field flex items-center justify-center text-2xs font-bold font-display"
                              style={t ? { backgroundColor: t.color, color: shiftInk(t.color) } : undefined}>
                              {t ? t.short : <span className="text-muted-foreground">–</span>}
                            </span>
                          );
                        })}
                      </span>
                      <span className="block text-2xs text-muted-foreground mt-1">{overlapSummary(overlap, true)}</span>
                    </button>
                    <Button type="button" variant="ghost" size="icon" aria-label={`Usuń szablon ${p.name}`} onClick={() => { deletePattern(p.id); toastWithUndo(`Usunięto szablon „${p.name}”`, () => savePattern(p)); }}>
                      <Trash className="w-4 h-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : (
          <p className="text-sm text-muted-foreground">Nie ma jeszcze szablonów. Ułóż zmiany w tym tygodniu i zapisz go poniżej.</p>
        )}

        {weekSteps !== null && (
          <>
          <fieldset className="min-w-0 space-y-2">
            <legend className="text-sm font-medium mb-2">Zapisz ten tydzień</legend>
            <div className="flex items-center gap-1" aria-hidden>
              {weekSteps.map((s, i) => {
                const t = s ? typesById.get(s) : undefined;
                return (
                  <span key={i} className="w-7 h-7 rounded-field flex items-center justify-center text-xs font-bold font-display"
                    style={t ? { backgroundColor: t.color, color: shiftInk(t.color) } : undefined}>
                    {t ? t.short : <span className="text-muted-foreground">–</span>}
                  </span>
                );
              })}
            </div>
            <div className="space-y-1">
              <Label htmlFor="week-template-name" className="text-xs text-muted-foreground">Nazwa (np. Standard)</Label>
              <Input id="week-template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`Szablon ${templates.length + 1}`} maxLength={40} />
            </div>
          </fieldset>

          <ResponsiveDialogFooter>
            <Button type="button" onClick={save} disabled={!canSave}>
              Zapisz ten tydzień jako szablon
            </Button>
          </ResponsiveDialogFooter>
          </>
        )}
      </ResponsiveDialogContent>
    </Dialog>
  );
}

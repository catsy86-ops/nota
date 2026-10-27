import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  addDefaultShiftTypes, applyPatternToStore, createSchedule, setActiveSchedule, setHourlyRate, setWorkSystem,
  type WorkSystem,
} from "@/lib/shifts";
import { parseMoney } from "@/lib/shifts/money";
import { cn } from "@/lib/utils";
import { WORK_SYSTEM_LABELS } from "./labels";

/** Pierwszy cykl (G4.2): bez cyklu albo dniówka pn–pt od dziś. Kroki to id rodzajów z `DEFAULT_SHIFT_TYPES`. */
export const FIRST_CYCLES = {
  none: { label: "Bez cyklu — zaczniesz od pustej siatki", steps: null },
  weekdays: { label: "Dniówka 8–16 od poniedziałku do piątku, od dziś na 4 tygodnie", steps: ["e", "e", "e", "e", "e", null, null] },
} as const;
export type FirstCycle = keyof typeof FIRST_CYCLES;
export const CYCLE_LENGTH_DAYS = 28;

const CONTROL = "w-full h-10 coarse:h-11 rounded-field border border-input bg-background px-3 text-sm outline-hidden focus-visible:ring-2 focus-visible:ring-ring";
const STEPS = ["Grafik", "Rodzaje zmian", "Pierwszy cykl"] as const;

/**
 * Kreator nowego grafiku (G4.2): zamiast pustej siatki po „Nowy grafik” trzy kroki — nazwa i stawka,
 * rodzaje zmian, pierwszy cykl. Na końcu tworzy grafik i przełącza na niego; wszystko jest zwykłym zapisem.
 */
export function NewScheduleWizard({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");
  const [workSystem, setWorkSys] = useState<WorkSystem>("basic");
  const [withTypes, setWithTypes] = useState(true);
  const [cycle, setCycle] = useState<FirstCycle>("none");

  const reset = () => { setStep(0); setName(""); setRate(""); setWorkSys("basic"); setWithTypes(true); setCycle("none"); };
  const close = () => { onOpenChange(false); reset(); };

  // Cykl wymaga rodzajów „Dniówka”; bez nich zostaje brak cyklu.
  const cycleAvailable = withTypes;
  const effectiveCycle: FirstCycle = cycleAvailable ? cycle : "none";

  const finish = () => {
    const schedule = createSchedule(name.trim());
    if (!schedule) { toast.error("Nie udało się dodać grafiku", { description: "Podaj nazwę albo sprawdź limit grafików." }); return; }
    setActiveSchedule(schedule.id);
    const money = parseMoney(rate);
    if (money !== null) setHourlyRate(money);
    setWorkSystem(workSystem);
    if (withTypes) addDefaultShiftTypes();
    const preset = FIRST_CYCLES[effectiveCycle];
    if (preset.steps) applyPatternToStore([...preset.steps], format(new Date(), "yyyy-MM-dd"), CYCLE_LENGTH_DAYS, undefined, true);
    toast.success(`Dodano grafik: ${schedule.name}`);
    close();
  };

  const canNext = step === 0 ? name.trim().length > 0 : true;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(true); }}>
      <ResponsiveDialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Nowy grafik</DialogTitle>
          <DialogDescription>Krok {step + 1} z {STEPS.length}: {STEPS[step]}</DialogDescription>
        </DialogHeader>

        <ol className="flex gap-1.5" aria-label="Kroki kreatora">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === step ? "step" : undefined}
              className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="sched-name" className="text-sm font-medium">Nazwa</label>
              <input id="sched-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Budowa Lipowa" className={CONTROL} autoFocus />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="sched-rate" className="text-sm font-medium">Stawka za godzinę (zł, nieobowiązkowa)</label>
              <input id="sched-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="np. 32" className={CONTROL} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="sched-system" className="text-sm font-medium">System czasu pracy</label>
              <select id="sched-system" value={workSystem} onChange={(e) => setWorkSys(e.target.value as WorkSystem)} className={CONTROL}>
                {(Object.keys(WORK_SYSTEM_LABELS) as WorkSystem[]).map((w) => <option key={w} value={w}>{WORK_SYSTEM_LABELS[w]}</option>)}
              </select>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" checked={withTypes} onChange={(e) => setWithTypes(e.target.checked)} className="mt-1 size-4 accent-primary" />
              <span>
                Dodaj startowe rodzaje
                <span className="block text-xs text-muted-foreground">Dniówka 8–16, Budowa 7–17, urlop i L4. Potem zmienisz je albo dodasz własne.</span>
              </span>
            </label>
          </div>
        )}

        {step === 2 && (
          <fieldset className="space-y-2">
            <legend className="sr-only">Pierwszy cykl</legend>
            {(Object.keys(FIRST_CYCLES) as FirstCycle[]).map((key) => {
              const disabled = key !== "none" && !cycleAvailable;
              return (
                <label key={key} className={cn("flex items-start gap-2.5 rounded-card border border-border/60 p-3 text-sm", disabled && "opacity-50")}>
                  <input type="radio" name="first-cycle" value={key} checked={effectiveCycle === key} disabled={disabled}
                    onChange={() => setCycle(key)} className="mt-1 accent-primary" />
                  <span>{FIRST_CYCLES[key].label}{disabled && <span className="block text-xs text-muted-foreground">Najpierw dodaj startowe rodzaje.</span>}</span>
                </label>
              );
            })}
          </fieldset>
        )}

        <ResponsiveDialogFooter className="gap-2 sm:gap-2">
          {step > 0 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>Wstecz</Button>}
          {step < STEPS.length - 1
            ? <Button type="button" disabled={!canNext} onClick={() => setStep(step + 1)}>Dalej</Button>
            : <Button type="button" onClick={finish}>Utwórz grafik</Button>}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

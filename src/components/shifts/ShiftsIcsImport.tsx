import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toastWithUndo } from "@/lib/undoToast";
import { pluralPl } from "@/lib/plural";
import { applyShiftImport, restoreDays, useShifts } from "@/lib/shifts";
import { planShiftsFromIcs, type ShiftImportPlan } from "@/lib/shifts/icsShifts";

const dni = (n: number) => `${n} ${pluralPl(n, ["dzień", "dni", "dni"])}`;

/**
 * Import zmian z pliku .ics do Grafiku (E3): wybór pliku i rodzaju zmiany, podgląd liczb,
 * dopiero potem zapis. Po zapisie „Cofnij” przywraca dni sprzed importu.
 */
export function ShiftsIcsImport() {
  const data = useShifts();
  const workTypes = data.types.filter((t) => t.kind === "work");
  const [typeId, setTypeId] = useState(workTypes[0]?.id ?? "");
  const [plan, setPlan] = useState<ShiftImportPlan | null>(null);
  const [fileName, setFileName] = useState("");
  const input = useRef<HTMLInputElement>(null);

  async function pick(file: File) {
    setFileName(file.name);
    const text = await file.text();
    const next = planShiftsFromIcs(text, data, typeId);
    setPlan(next);
    if (next.imported === 0) toast(next.skippedFilled > 0 ? "Wszystkie dni z pliku są już w grafiku." : "W pliku nie ma zmian do zaimportowania.");
  }

  function apply() {
    if (!plan) return;
    const before = applyShiftImport(plan.changes);
    if (!before) return;
    toastWithUndo(`Zaimportowano ${dni(plan.imported)} z pliku`, () => restoreDays(before));
    setPlan(null);
    setFileName("");
  }

  return (
    <section aria-label="Import zmian z pliku" className="rounded-card bg-muted/50 px-3 py-2.5 text-sm">
      <p className="font-medium">Import zmian z pliku .ics</p>
      <p className="mt-1 text-xs text-muted-foreground">Każde zdarzenie staje się dniem z wybraną zmianą. Dni, które już mają wpis, zostają bez zmian.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs">
          Rodzaj zmiany
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="coarse:h-11 rounded-control border border-border bg-background px-2 py-1 text-xs">
            {workTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()} disabled={!typeId} className="coarse:h-11">
          Wybierz plik .ics
        </Button>
        <input ref={input} type="file" accept=".ics,text/calendar" className="hidden" tabIndex={-1} aria-hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void pick(f); }} />
      </div>
      {plan && (
        <div className="mt-3 space-y-2" aria-live="polite">
          <p className="text-xs">
            Plik <span className="font-medium">{fileName}</span>: do wpisania <span className="font-medium">{dni(plan.imported)}</span>
            {plan.skippedFilled > 0 && `, pominięto ${plan.skippedFilled} zajętych`}
            {plan.repeating > 0 && `. Cykliczne zdarzenia (${plan.repeating}) wzięto tylko pierwszym wystąpieniem`}
            {plan.unreadable > 0 && `. Bez poprawnej daty: ${plan.unreadable}`}.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={apply} disabled={plan.imported === 0} className="coarse:h-11">Importuj {plan.imported > 0 ? dni(plan.imported) : ""}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setPlan(null); setFileName(""); }} className="coarse:h-11">Anuluj</Button>
          </div>
        </div>
      )}
    </section>
  );
}

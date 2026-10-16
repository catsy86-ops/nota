import { useState } from "react";
import { Calculator, Plus, X } from "lucide-react";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResponsiveDialogContent } from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import { parseNum, pipeLiters, PIPES, plNum, SLOPE_TYPICAL, slopeDrop, slopeFromDrop, slopeNote, waterTest } from "@/lib/study/calc";

const fieldClass =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 font-mono text-base tabular-nums outline-hidden focus:ring-2 focus:ring-ring";
const chipClass = "pressable rounded-full border px-3 py-1 text-sm coarse:min-h-11";

/**
 * Kalkulatory na budowę: spadek kanalizacji (różnica wysokości albo procent), próba wodna
 * (ciśnienie próbne i manometr) i pojemność instalacji. Liczby z materiału G-HEAT, reszta to
 * geometria (`lib/study/calc.ts`). Przycisk obok ściągi wysokości w nagłówku działu.
 */
export function CalculatorsButton({ variant = "pill", className }: { variant?: "pill" | "icon"; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={variant === "icon" ? "Kalkulatory" : undefined}
        title="Spadek, próba wodna, pojemność instalacji"
        className={cn(
          "pressable inline-flex items-center gap-2 text-muted-foreground hover:text-foreground",
          variant === "pill" && "rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted coarse:min-h-11",
          variant === "icon" && "size-9 justify-center rounded-full border border-border hover:bg-muted coarse:size-11",
          className,
        )}
      >
        <Calculator className="h-4 w-4" aria-hidden />
        {variant !== "icon" && "Kalkulatory"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg" data-testid="calculators">
          <div className="pr-8">
            <DialogTitle className="font-display text-lg">Kalkulatory</DialogTitle>
            <DialogDescription className="text-xs">Liczby z materiału G-HEAT. W razie wątpliwości — projekt albo Grzegorz.</DialogDescription>
          </div>
          <SlopeCalc />
          <WaterTestCalc />
          <VolumeCalc />
        </ResponsiveDialogContent>
      </Dialog>
    </>
  );
}

function Result({ label, value, unit, testId }: { label: string; value: string | null; unit: string; testId: string }) {
  return (
    <p className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2" data-testid={testId}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-2xl font-semibold tabular-nums text-primary-ink">
        {value ?? "—"}{value !== null && <span className="ml-1 text-base font-normal text-muted-foreground">{unit}</span>}
      </span>
    </p>
  );
}

function SlopeCalc() {
  const [mode, setMode] = useState<"drop" | "slope">("drop");
  const [length, setLength] = useState("");
  const [slope, setSlope] = useState("2");
  const [drop, setDrop] = useState("");
  const L = parseNum(length);
  const s = parseNum(slope);
  const d = parseNum(drop);
  const dropCm = mode === "drop" && L !== null && s !== null ? slopeDrop(L, s) : null;
  const pct = mode === "slope" && L !== null && d !== null ? slopeFromDrop(L, d) : null;
  const shown = mode === "drop" ? s : pct;
  const note = shown !== null ? slopeNote(shown) : null;

  return (
    <section className="space-y-2 border-t border-border pt-3" aria-label="Spadek kanalizacji">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Spadek kanalizacji</h3>
        <div className="flex gap-1" role="group" aria-label="Co liczysz">
          {(["drop", "slope"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(chipClass, mode === m ? "border-primary bg-primary/10 text-primary-ink" : "border-border text-muted-foreground hover:bg-muted")}
            >
              {m === "drop" ? "Różnica wysokości" : "Spadek w %"}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Długość [m]
          <input inputMode="decimal" value={length} onChange={(e) => setLength(e.target.value)} placeholder="np. 8" className={fieldClass} />
        </label>
        {mode === "drop" ? (
          <label className="space-y-1 text-xs text-muted-foreground">
            Spadek [%]
            <input inputMode="decimal" value={slope} onChange={(e) => setSlope(e.target.value)} className={fieldClass} />
          </label>
        ) : (
          <label className="space-y-1 text-xs text-muted-foreground">
            Różnica wysokości [cm]
            <input inputMode="decimal" value={drop} onChange={(e) => setDrop(e.target.value)} placeholder="np. 20" className={fieldClass} />
          </label>
        )}
      </div>
      {mode === "drop" && (
        <div className="flex gap-1.5" aria-label="Szybki spadek">
          {["2", "2,5", "3"].map((v) => (
            <button key={v} type="button" onClick={() => setSlope(v)} className={cn(chipClass, slope === v ? "border-primary bg-primary/10 text-primary-ink" : "border-border text-muted-foreground hover:bg-muted")}>
              {v}%
            </button>
          ))}
        </div>
      )}
      {mode === "drop"
        ? <Result label="Różnica wysokości" value={dropCm !== null ? plNum(dropCm) : null} unit="cm" testId="calc-slope-result" />
        : <Result label="Spadek" value={pct !== null ? plNum(pct, 2) : null} unit="%" testId="calc-slope-result" />}
      {note && (
        <p className="text-xs text-warning-ink" role="note">
          {note === "low" ? "Mniej niż" : "Więcej niż"} typowe {SLOPE_TYPICAL[0]}–{SLOPE_TYPICAL[1]}% — sprawdź wymagany spadek dla tej średnicy.
        </p>
      )}
      <p className="text-xs text-muted-foreground">1% = 1 cm na każdy metr. Za mały spadek — zaleganie; za duży — odrywanie wody.</p>
    </section>
  );
}

function WaterTestCalc() {
  const [working, setWorking] = useState("");
  const w = parseNum(working);
  const t = w !== null && w > 0 ? waterTest(w) : null;
  return (
    <section className="space-y-2 border-t border-border pt-3" aria-label="Próba wodna">
      <h3 className="font-semibold">Próba wodna</h3>
      <label className="block space-y-1 text-xs text-muted-foreground">
        Ciśnienie robocze [bar]
        <input inputMode="decimal" value={working} onChange={(e) => setWorking(e.target.value)} placeholder="np. 4" className={fieldClass} />
      </label>
      <Result label="Ciśnienie próbne (1,5 × robocze)" value={t ? plNum(t.testBar) : null} unit="bar" testId="calc-test-result" />
      <Result label="Manometr — zakres co najmniej" value={t ? plNum(t.gaugeMinBar) : null} unit="bar" testId="calc-gauge-result" />
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
        <li>Manometr z podziałką 0,1 bar, w najniższym punkcie; przed próbą odłącz armaturę i odpowietrz.</li>
        <li>Na budowie robocza kontrola: powietrze 6 bar. Protokół odbiorowy: 9 bar.</li>
      </ul>
    </section>
  );
}

interface Row { id: number; pipe: string; inner: string; length: string }

function VolumeCalc() {
  const [rows, setRows] = useState<Row[]>([{ id: 1, pipe: PIPES[0].id, inner: "", length: "" }]);
  const patch = (id: number, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const inner = (r: Row) => (r.pipe === "custom" ? parseNum(r.inner) : PIPES.find((p) => p.id === r.pipe)?.innerMm ?? null);
  const liters = rows.map((r) => { const d = inner(r); const L = parseNum(r.length); return d !== null && L !== null ? pipeLiters(d, L) : null; });
  const total = liters.some((v) => v !== null) ? liters.reduce<number>((a, v) => a + (v ?? 0), 0) : null;

  return (
    <section className="space-y-2 border-t border-border pt-3" aria-label="Pojemność instalacji">
      <h3 className="font-semibold">Pojemność instalacji</h3>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              Rura {i + 1}
              <select value={r.pipe} onChange={(e) => patch(r.id, { pipe: e.target.value })} className={cn(fieldClass, "font-sans")} aria-label={`Rura ${i + 1}`}>
                {/* Krótko — na telefonie pole ma ~165 px; „wewn.” jest w podpisie pod kalkulatorem. */}
                {PIPES.map((p) => <option key={p.id} value={p.id}>{p.label} · {p.innerMm} mm</option>)}
                <option value="custom">Inna rura</option>
              </select>
            </label>
            {r.pipe === "custom" ? (
              <label className="space-y-1 text-xs text-muted-foreground">
                Wewn. [mm] / długość [m]
                <span className="flex gap-1">
                  <input inputMode="decimal" value={r.inner} onChange={(e) => patch(r.id, { inner: e.target.value })} aria-label={`Rura ${i + 1}: średnica wewnętrzna`} className={fieldClass} />
                  <input inputMode="decimal" value={r.length} onChange={(e) => patch(r.id, { length: e.target.value })} aria-label={`Rura ${i + 1}: długość`} className={fieldClass} />
                </span>
              </label>
            ) : (
              <label className="space-y-1 text-xs text-muted-foreground">
                Długość [m]
                <input inputMode="decimal" value={r.length} onChange={(e) => patch(r.id, { length: e.target.value })} aria-label={`Rura ${i + 1}: długość`} className={fieldClass} />
              </label>
            )}
            <button
              type="button"
              onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.id !== r.id) : rs))}
              disabled={rows.length === 1}
              aria-label={`Usuń rurę ${i + 1}`}
              className="pressable grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-40"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setRows((rs) => [...rs, { id: Math.max(...rs.map((x) => x.id)) + 1, pipe: PIPES[0].id, inner: "", length: "" }])}
        disabled={rows.length >= 8}
        className="pressable inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground hover:bg-muted coarse:min-h-11"
      >
        <Plus className="h-4 w-4" aria-hidden />Kolejny odcinek
      </button>
      <Result label="Razem" value={total !== null ? plNum(total, total < 10 ? 2 : 1) : null} unit="l" testId="calc-volume-total" />
      <p className="text-xs text-muted-foreground">Ile wody wejdzie przy napełnianiu i płukaniu. Średnica wewnętrzna = zewnętrzna − 2 × ścianka.</p>
    </section>
  );
}

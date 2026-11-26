import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptics";
import { TRAINING_REPS_MAX } from "@/lib/training/model";
import { stepKg } from "./trainingFormat";

const kgText = (kg: number) => String(kg).replace(".", ",");

/**
 * C2.2 Zapis serii jednym stuknięciem: „Zrobione: 10 × 20 kg” wpisuje serię do formularza (do pierwszego pustego
 * wiersza, a gdy wszystkie pełne — do nowego). −/+ poprawiają powtórzenia i kilogramy przed stuknięciem. Wartości startowe
 * z podpowiedzi progresji, ostatniej sesji albo celu planu. Zapis całego wpisu zostaje przy „Zapisz serie”.
 */
export function QuickSet({ start, done, onDone }: { start: { reps: number; kg?: number }; done: number; onDone: (reps: number, kg: number | undefined) => void }) {
  const [reps, setReps] = useState(start.reps);
  const [kg, setKg] = useState<number | undefined>(start.kg);
  // Nowe ćwiczenie albo nowa podpowiedź — wartości od nowa.
  useEffect(() => { setReps(start.reps); setKg(start.kg); }, [start.reps, start.kg]);

  const label = kg !== undefined ? `${reps} × ${kgText(kg)} kg` : `${reps} powt.`;
  return (
    <div className="space-y-2 rounded-field border border-primary/40 bg-primary/5 p-3" data-testid="quick-set">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Stepper label="Powtórzenia" value={String(reps)} onMinus={() => setReps((r) => Math.max(1, r - 1))} onPlus={() => setReps((r) => Math.min(TRAINING_REPS_MAX, r + 1))} />
        <Stepper label="Ciężar" value={kg !== undefined ? `${kgText(kg)} kg` : "bez kg"} onMinus={() => setKg((k) => (k === undefined || k <= 0.5 ? undefined : stepKg(k, -1)))} onPlus={() => setKg((k) => stepKg(k ?? 0, 1))} />
      </div>
      <Button type="button" size="lg" className="w-full coarse:h-12" onClick={() => { haptic("success"); onDone(reps, kg); }}>
        Zrobione: {label}
      </Button>
      {done > 0 && <p className="ui-meta" role="status">Wpisanych serii: {done}. Na koniec „Zapisz serie”.</p>}
    </div>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1.5">
      <span className="ui-meta w-20">{label}</span>
      <Button type="button" variant="outline" size="icon-sm" aria-label={`${label}: mniej`} onClick={onMinus}><Minus aria-hidden /></Button>
      <span className="min-w-14 text-center font-mono text-sm tabular-nums" aria-live="polite">{value}</span>
      <Button type="button" variant="outline" size="icon-sm" aria-label={`${label}: więcej`} onClick={onPlus}><Plus aria-hidden /></Button>
    </div>
  );
}

import { useState } from "react";
import { toast } from "sonner";
import { Scale, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localDayKey } from "@/lib/dayDone";
import { toastWithUndo } from "@/lib/undoToast";
import { parseKg, weightTrend } from "@/lib/weight/model";
import { removeWeight, restoreWeight, setWeight, useWeights } from "@/lib/weight/store";
import { WeightChart } from "./WeightChart";
import { cardClass } from "@/components/ui/card";
import { AnimatePresence, m as motion } from "framer-motion";
import { listItemMotion } from "@/lib/cardMotion";
import { useMotionPref } from "@/hooks/useMotionPref";

/** Masa ciała (C-2): ważenie dnia, zmiana względem poprzedniego i średnia z 7 ważeń. */
export function WeightSection() {
  const rowMotion = listItemMotion(useMotionPref().reduced);
  const entries = useWeights();
  const [kgText, setKgText] = useState("");
  const [day, setDay] = useState(() => localDayKey());
  const recent = entries.slice(-14).reverse();
  const { delta, average } = weightTrend(entries);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const kg = parseKg(kgText);
    if (kg === null) {
      toast.error("Podaj masę od 20 do 300 kg");
      return;
    }
    if (!setWeight(day, kg)) {
      toast.error("Nie udało się zapisać ważenia");
      return;
    }
    setKgText("");
  }

  function remove(d: string) {
    const removed = removeWeight(d);
    if (!removed) return;
    toastWithUndo(`Usunięto ważenie z ${d}`, () => restoreWeight(removed), { icon: "⚖️" });
  }

  return (
    <section aria-labelledby="weight-title" className={`${cardClass} space-y-3 p-4`}>
      <h3 id="weight-title" className="flex items-center gap-2 font-display text-base">
        <Scale className="size-4 text-primary-ink" aria-hidden />Masa ciała
      </h3>

      <form onSubmit={save} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Masa (kg)
          <Input
            inputMode="decimal"
            value={kgText}
            onChange={(e) => setKgText(e.target.value)}
            placeholder="np. 82,4"
            className="w-28"
            aria-label="Masa w kilogramach"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Dzień
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value || localDayKey())} className="w-40" />
        </label>
        <Button type="submit" size="sm" className="coarse:h-11">Zapisz ważenie</Button>
      </form>

      {entries.length > 0 ? (
        <>
          <p className="text-sm tabular-nums" data-testid="weight-trend">
            {delta === null ? "Pierwsze ważenie." : `Zmiana: ${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg od poprzedniego.`}
            {average !== null && <span className="text-muted-foreground"> Średnia z 7 ważeń: {average.toFixed(1)} kg.</span>}
          </p>
          <WeightChart entries={entries} />
          <ul className="divide-y divide-border/60" data-testid="weight-list">
            <AnimatePresence initial={false}>
            {recent.map((w) => (
              <motion.li key={w.day} {...rowMotion} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span className="tabular-nums">{w.day}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono tabular-nums">{w.kg.toFixed(1)} kg</span>
                  <Button variant="ghost" size="icon" className="size-8 coarse:h-11 coarse:w-11" onClick={() => remove(w.day)} aria-label={`Usuń ważenie z ${w.day}`}>
                    <Trash className="size-3.5" aria-hidden />
                  </Button>
                </span>
              </motion.li>
            ))}
            </AnimatePresence>
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Zapisz pierwsze ważenie. Wpisy zostają w dokumencie i w kopii zapasowej.</p>
      )}
    </section>
  );
}

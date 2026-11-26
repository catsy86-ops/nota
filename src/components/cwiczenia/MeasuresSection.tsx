import { useState } from "react";
import { toast } from "sonner";
import { Ruler, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cardClass } from "@/components/ui/card";
import { localDayKey } from "@/lib/dayDone";
import { toastWithUndo } from "@/lib/undoToast";
import { MEASURE_LABEL, MEASURE_MAX_CM, MEASURE_MIN_CM, MEASURE_PARTS, measureTrend, parseCm, type MeasurePart } from "@/lib/weight/measures";
import { removeMeasure, restoreMeasure, setMeasure, useMeasures } from "@/lib/weight/store";
import { WeightChart } from "./WeightChart";

const cmText = (cm: number) => cm.toFixed(1).replace(".", ",");

/**
 * C3.4 Obwody ciała (pas, klatka, ramię, udo) w zakładce „Waga”: wybór partii, pomiar w cm na dzień, ostatni wynik
 * każdej partii ze zmianą i ten sam wykres co masa ciała (`WeightChart`) dla wybranej partii.
 */
export function MeasuresSection() {
  const all = useMeasures();
  const [part, setPart] = useState<MeasurePart>("pas");
  const [text, setText] = useState("");
  const [day, setDay] = useState(() => localDayKey());
  const own = all.filter((m) => m.part === part);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const cm = parseCm(text);
    if (cm === null) { toast.error(`Podaj obwód od ${MEASURE_MIN_CM} do ${MEASURE_MAX_CM} cm`); return; }
    if (!setMeasure(day, part, cm)) { toast.error("Nie udało się zapisać pomiaru"); return; }
    setText("");
  }

  function remove(d: string) {
    const gone = removeMeasure(part, d);
    if (gone) toastWithUndo(`Usunięto pomiar: ${MEASURE_LABEL[part]}, ${d}`, () => restoreMeasure(gone), { icon: "📏" });
  }

  return (
    <section aria-labelledby="measures-title" className={`${cardClass} space-y-3 p-4`} data-testid="measures">
      <h3 id="measures-title" className="flex items-center gap-2 font-display text-base">
        <Ruler className="size-4 text-primary-ink" aria-hidden />Obwody
      </h3>

      <div role="group" aria-label="Partia ciała" className="flex flex-wrap gap-1.5">
        {MEASURE_PARTS.map((p) => {
          const { last, delta } = measureTrend(all, p);
          return (
            <Button key={p} type="button" variant="chip" size="chip" aria-pressed={part === p} onClick={() => setPart(p)}>
              {MEASURE_LABEL[p]}
              {last && <span className="font-mono tabular-nums text-muted-foreground">{cmText(last.cm)}{delta !== null && delta !== 0 ? ` (${delta > 0 ? "+" : "−"}${cmText(Math.abs(delta))})` : ""}</span>}
            </Button>
          );
        })}
      </div>

      <form onSubmit={save} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {MEASURE_LABEL[part]} (cm)
          <Input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="np. 88,5" className="w-28" aria-label={`Obwód: ${MEASURE_LABEL[part]} w centymetrach`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Dzień
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value || localDayKey())} className="w-40" />
        </label>
        <Button type="submit" size="sm" className="coarse:h-11">Zapisz pomiar</Button>
      </form>

      {own.length > 0 ? (
        <>
          <WeightChart entries={own.map((m) => ({ day: m.day, kg: m.cm, created: m.created }))} unit="cm" label={`Obwód: ${MEASURE_LABEL[part]}`} noun={["pomiar", "pomiary", "pomiarów"]} empty="Brak pomiarów" />
          <ul className="divide-y divide-border/60" data-testid="measures-list">
            {[...own].reverse().slice(0, 10).map((m) => (
              <li key={m.day} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span className="tabular-nums">{m.day}</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono tabular-nums">{cmText(m.cm)} cm</span>
                  <Button variant="ghost" size="icon" className="size-8 coarse:h-11 coarse:w-11" onClick={() => remove(m.day)} aria-label={`Usuń pomiar z ${m.day}`}>
                    <Trash className="size-3.5" aria-hidden />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="ui-hint">Zmierz {MEASURE_LABEL[part].toLowerCase()} i zapisz — pomiary są w dokumencie, synchronizacji i kopii.</p>
      )}
    </section>
  );
}

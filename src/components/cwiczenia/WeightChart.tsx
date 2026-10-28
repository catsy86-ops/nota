import { useState } from "react";
import { Button } from "@/components/ui/button";
import { localDayKey } from "@/lib/dayDone";
import { weightSeries, type WeightRange } from "@/lib/weight/chart";
import type { WeightEntry } from "@/lib/weight/model";

const W = 320;
const H = 120;

/**
 * Wykres masy ciała (plan Ćwiczeń D2): linia z punktami w oknie 30 albo 90 dni. Rysunek SVG bez
 * Recharts (mały, bez ładowania paczki). Oś X od dnia, Y z zapasem 0,5 kg. Podsumowanie liczbowe
 * jest w `aria-label`, a lista ważeń pod wykresem to jednocześnie tabela dla czytnika.
 */
export function WeightChart({ entries }: { entries: WeightEntry[] }) {
  const [range, setRange] = useState<WeightRange>(30);
  const series = weightSeries(entries, range, localDayKey(), W, H);
  const ranges: WeightRange[] = [30, 90];

  return (
    <div className="space-y-2" data-testid="weight-chart">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label="Zakres wykresu">
          {ranges.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "secondary" : "ghost"}
              className="coarse:h-11"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
            >
              {r} dni
            </Button>
          ))}
        </div>
        {series && (
          <p className="text-xs tabular-nums text-muted-foreground">
            {series.min.toFixed(1)}–{series.max.toFixed(1)} kg
          </p>
        )}
      </div>

      {series ? (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Masa ciała, ostatnie ${range} dni: ${series.points.length} ważeń od ${series.points[0].kg.toFixed(1)} kg do ${series.points[series.points.length - 1].kg.toFixed(1)} kg, zakres ${series.min.toFixed(1)}–${series.max.toFixed(1)} kg.`}
          className="block h-auto w-full overflow-visible text-primary-ink"
        >
          {series.points.length > 1 && (
            <polyline
              points={series.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {series.points.map((p) => (
            <circle key={p.day} cx={p.x} cy={p.y} r={3} fill="var(--card)" stroke="currentColor" strokeWidth={1.5}>
              <title>{`${p.day}: ${p.kg.toFixed(1)} kg`}</title>
            </circle>
          ))}
        </svg>
      ) : (
        <p className="rounded-control border border-dashed border-border/70 px-3 py-6 text-center text-xs text-muted-foreground">
          Brak ważeń w ostatnich {range} dniach.
        </p>
      )}
      {series && (
        <div className="flex justify-between text-2xs tabular-nums text-muted-foreground">
          <span>{series.from}</span>
          <span>{series.to}</span>
        </div>
      )}
    </div>
  );
}

import { useId } from "react";
import { Bar, Line, BarChart, ComposedChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { YearChartRow } from "@/lib/shifts/yearCharts";
import { ChartFrame, HatchPattern, type ChartSeries } from "@/components/ui/chart-frame";
import { CHART_TICK, CHART_TOOLTIP_STYLE } from "@/components/ui/chart-style";

const hoursLabel = (v: number) => `${v.toFixed(1).replace(".", ",")} h`;
const sumOf = (rows: YearChartRow[], key: "hours" | "overtime") => rows.reduce((s, r) => s + r[key], 0);
/** Suma roku w oprawie: pełne godziny ze spacją tysięcy, jednostka mniejsza (jak `Stat`). */
const total = (h: number) => <>{Math.round(h).toLocaleString("pl-PL")}<span className="ml-1 text-base text-muted-foreground">h</span></>;

const HOURS_SERIES: ChartSeries[] = [
  { label: "Godziny", color: "var(--chart-1)", shape: "bar" },
  { label: "Norma", color: "var(--foreground)", shape: "dash" },
];
const EXTRA_SERIES: ChartSeries[] = [
  { label: "Nadgodziny", color: "var(--warning)", shape: "bar" },
  { label: "Noc", color: "var(--chart-2)", shape: "hatch" },
];

/**
 * Wykresy roku (G4.3): godziny z normą miesiąc po miesiącu, a niżej nadgodziny i noc. Ładowane leniwie
 * (recharts jest ciężki), kolory z tokenów przez klasy z `index.css` (`.year-chart-*`), oprawa `ChartFrame` (W5.1).
 * Noc kreskowana, norma przerywana — serie odróżnia też kształt (W5.2); liczby są w tabeli roku pod wykresami.
 * Bez animacji przy redukcji ruchu.
 */
export function YearCharts({ rows }: { rows: YearChartRow[] }) {
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hatchId = `night-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div className="space-y-5">
      <ChartFrame title="Godziny i norma" value={total(sumOf(rows, "hours"))} series={HOURS_SERIES} plotClassName="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} className="year-chart-grid" />
            <XAxis dataKey="label" interval={0} tickLine={false} axisLine={false} tick={CHART_TICK} />
            <YAxis tickLine={false} axisLine={false} tick={CHART_TICK} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => hoursLabel(v)} />
            <Bar dataKey="hours" name="Godziny" className="year-chart-hours" radius={[3, 3, 0, 0]} isAnimationActive={!reduce} />
            <Line dataKey="norm" name="Norma" dot={false} type="monotone" className="year-chart-norm" isAnimationActive={!reduce} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
      <ChartFrame title="Nadgodziny i noc" value={total(sumOf(rows, "overtime"))} series={EXTRA_SERIES} plotClassName="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <defs><HatchPattern id={hatchId} color="var(--chart-2)" /></defs>
            <CartesianGrid vertical={false} className="year-chart-grid" />
            <XAxis dataKey="label" interval={0} tickLine={false} axisLine={false} tick={CHART_TICK} />
            <YAxis tickLine={false} axisLine={false} tick={CHART_TICK} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(v: number) => hoursLabel(v)} />
            <Bar dataKey="overtime" name="Nadgodziny" stackId="x" className="year-chart-over" isAnimationActive={!reduce} />
            <Bar dataKey="night" name="Noc" stackId="x" fill={`url(#${hatchId})`} isAnimationActive={!reduce} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

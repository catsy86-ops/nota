import { Bar, Line, BarChart, ComposedChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { YearChartRow } from "@/lib/shifts/yearCharts";

const TOOLTIP_STYLE = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 };
const hoursLabel = (v: number) => `${v.toFixed(1).replace(".", ",")} h`;

/**
 * Wykresy roku (G4.3): godziny z normą miesiąc po miesiącu, a niżej nadgodziny i noc. Ładowane leniwie
 * (recharts jest ciężki), kolory z tokenów przez klasy z `index.css` (`.year-chart-*`).
 * Bez animacji przy redukcji ruchu.
 */
export function YearCharts({ rows }: { rows: YearChartRow[] }) {
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div className="space-y-4">
      <figure className="h-44" aria-label="Godziny i norma miesiąc po miesiącu">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} className="year-chart-grid" />
            <XAxis dataKey="label" interval={0} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => hoursLabel(v)} />
            <Bar dataKey="hours" name="Godziny" className="year-chart-hours" isAnimationActive={!reduce} />
            <Line dataKey="norm" name="Norma" dot={false} type="monotone" className="year-chart-norm" isAnimationActive={!reduce} />
          </ComposedChart>
        </ResponsiveContainer>
      </figure>
      <figure className="h-36" aria-label="Nadgodziny i godziny nocne miesiąc po miesiącu">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} className="year-chart-grid" />
            <XAxis dataKey="label" interval={0} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => hoursLabel(v)} />
            <Bar dataKey="overtime" name="Nadgodziny" stackId="x" className="year-chart-over" isAnimationActive={!reduce} />
            <Bar dataKey="night" name="Noc" stackId="x" className="year-chart-night" isAnimationActive={!reduce} />
          </BarChart>
        </ResponsiveContainer>
      </figure>
    </div>
  );
}

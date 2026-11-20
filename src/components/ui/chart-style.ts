import type { CSSProperties } from "react";

// Wspólne ustawienia recharts dla `ChartFrame` (W5.1) — osobno, bo plik komponentu eksportuje tylko komponenty.

/** Dymek recharts w tokenach motywu (domyślnie biały, bez kontrastu stylu). */
export const CHART_TOOLTIP_STYLE: CSSProperties = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
};

/** Podpis osi: rozmiar `ui-meta`, kolor `--chart-axis` daje `.recharts-cartesian-axis-tick-value`. */
export const CHART_TICK = { fontSize: 11 } as const;

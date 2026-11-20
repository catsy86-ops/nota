import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Kształt znacznika serii (W5.2): seria rozpoznawalna też bez koloru. */
export type SeriesShape = "bar" | "hatch" | "line" | "dash";

export interface ChartSeries {
  label: string;
  /** Kolor jako wartość CSS, zwykle token (`var(--chart-1)`). */
  color: string;
  shape: SeriesShape;
}

/** Wzór kreskowania do `fill="url(#id)"`: wstawić w `<defs>` wykresu, ten sam wygląd co znacznik `hatch`. */
export function HatchPattern({ id, color }: { id: string; color: string }) {
  return (
    <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="5" height="5" fill={color} opacity="0.35" />
      <line x1="0" y1="0" x2="0" y2="5" stroke={color} strokeWidth="2.5" />
    </pattern>
  );
}

function SeriesKey({ shape, color }: { shape: SeriesShape; color: string }) {
  // 14×10 jak wysokość małej litery: znacznik stoi w linii podpisu.
  if (shape === "line" || shape === "dash") {
    return (
      <svg width="16" height="10" aria-hidden className="shrink-0">
        <line x1="1" y1="5" x2="15" y2="5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeDasharray={shape === "dash" ? "4 3" : undefined} />
      </svg>
    );
  }
  return (
    <svg width="10" height="10" aria-hidden className="shrink-0">
      {shape === "hatch" ? (
        <>
          <rect width="10" height="10" rx="2" fill={color} opacity="0.35" />
          <path d="M-1 4 L4 -1 M-1 9 L9 -1 M4 11 L11 4" stroke={color} strokeWidth="2" />
        </>
      ) : (
        <rect width="10" height="10" rx="2" fill={color} />
      )}
    </svg>
  );
}

export interface ChartFrameProps {
  title: string;
  /** Wartość główna (suma, wynik) — największy tekst oprawy, `num-lg`. */
  value?: ReactNode;
  /** Zakres danych („sty–gru 2026”, „ostatnie 14 dni”) przy prawej krawędzi. */
  range?: ReactNode;
  /** Podpisy serii pod tytułem, zamiast osobnej ramki legendy w wykresie. */
  series?: ChartSeries[];
  /** Wysokość obszaru wykresu (klasa Tailwind, np. `h-44`). */
  plotClassName?: string;
  /** Tabela z tymi samymi danymi dla czytnika ekranu i do odczytu liczb (W5.2), zwinięta pod wykresem. */
  table?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Wspólna oprawa wykresu (W5.1): tytuł, wartość, zakres, podpisy serii ze znacznikiem kształtu,
 * obszar wykresu i opcjonalna tabela danych. Bez recharts — sam wykres podaje wywołujący,
 * więc oprawa nie ciągnie biblioteki do paczki wejściowej.
 */
export function ChartFrame({ title, value, range, series, plotClassName = "h-44", table, className, children }: ChartFrameProps) {
  return (
    <figure className={cn("space-y-2", className)}>
      <figcaption className="space-y-1.5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="ui-label text-muted-foreground">{title}</p>
            {value !== undefined && <p className="num-lg">{value}</p>}
          </div>
          {range && <p className="ui-meta shrink-0 pb-1">{range}</p>}
        </div>
        {series && series.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 ui-meta">
            {series.map((s) => (
              <li key={s.label} className="flex items-center gap-1.5">
                <SeriesKey shape={s.shape} color={s.color} />
                {s.label}
              </li>
            ))}
          </ul>
        )}
      </figcaption>
      <div className={plotClassName} aria-hidden={table ? true : undefined}>{children}</div>
      {table && (
        <details className="ui-meta">
          <summary className="cursor-pointer select-none rounded-control py-1 hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring coarse:py-3">Pokaż dane</summary>
          <div className="mt-1 overflow-x-auto">{table}</div>
        </details>
      )}
    </figure>
  );
}

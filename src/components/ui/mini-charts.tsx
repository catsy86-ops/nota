import { cn } from "@/lib/utils";

// W5.3: małe wykresy w kartach — sam SVG, bez recharts, więc nie kosztują paczki.
// Wszystkie są ozdobą obok liczby (`aria-hidden`): wartość zawsze mówi tekst karty.

/**
 * Iskra: przebieg wartości (np. salda po kolejnych wpisach), od najstarszej do najnowszej.
 * Linia w `currentColor`, kropka na ostatniej wartości; gdy przebieg przechodzi przez zero — przerywana linia zera.
 */
export function Sparkline({ values, className }: { values: readonly number[]; className?: string }) {
  if (values.length < 2) return null;
  const W = 100, H = 24, P = 2.5;
  // Zero zawsze w skali: przy saldzie liczy się, jak daleko jest do rozliczenia.
  const min = Math.min(...values), max = Math.max(...values);
  const lo = Math.min(min, 0), hi = Math.max(max, 0);
  const span = hi - lo || 1;
  const x = (i: number) => P + (i / (values.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - lo) / span) * (H - 2 * P);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const crossesZero = min < 0 && max > 0;
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden className={cn("h-6 w-24 overflow-visible", className)}>
      {crossesZero && <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--chart-grid)" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />}
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {/* Kropka jako odcinek zerowej długości z okrągłym końcem: przy `preserveAspectRatio="none"` koło by się rozciągnęło. */}
      <line x1={x(last)} y1={y(values[last])} x2={x(last)} y2={y(values[last])} stroke="currentColor" strokeWidth={5} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const WEEK_LETTERS = ["P", "W", "Ś", "C", "P", "S", "N"];

/**
 * Pasek tygodnia: siedem słupków pon–nd z literą dnia pod spodem. Dzisiejszy w akcencie, pozostałe wyciszone;
 * dzień bez wartości to kreska przy podstawie, żeby rytm tygodnia był widoczny także przy pustych dniach.
 */
export function WeekBars({ values, today, className }: { values: readonly number[]; today?: number; className?: string }) {
  const max = Math.max(...values, 1);
  return (
    <div aria-hidden className={cn("grid w-36 grid-cols-7 gap-1", className)}>
      {values.slice(0, 7).map((v, i) => (
        <div key={i} className="flex flex-col items-stretch gap-1">
          <div className="flex h-6 items-end">
            <div
              className={cn("w-full rounded-t-[2px]", i === today ? "bg-primary" : "bg-muted-foreground/35")}
              style={{ height: v > 0 ? `${Math.max(15, (v / max) * 100)}%` : "2px" }}
            />
          </div>
          <span className={cn("text-center text-2xs", i === today ? "font-semibold text-foreground" : "text-muted-foreground")}>{WEEK_LETTERS[i]}</span>
        </div>
      ))}
    </div>
  );
}

/** Pierścień postępu (0–1) w akcencie na torze `--muted`. Rozmiar z `className` (domyślnie 36 px). */
export function ProgressRing({ value, className, strokeWidth = 4 }: { value: number; className?: string; strokeWidth?: number }) {
  const v = Math.min(1, Math.max(0, value));
  const r = 18 - strokeWidth / 2;
  return (
    <svg viewBox="0 0 36 36" aria-hidden className={cn("size-9 shrink-0 -rotate-90", className)}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--muted)" strokeWidth={strokeWidth} />
      {v > 0 && <circle cx="18" cy="18" r={r} fill="none" stroke="var(--primary)" strokeWidth={strokeWidth} strokeLinecap="round" pathLength={100} strokeDasharray={`${v * 100} 100`} />}
    </svg>
  );
}

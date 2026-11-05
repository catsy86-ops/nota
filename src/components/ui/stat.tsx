import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-4xl",
} as const;

const TONE = {
  default: "text-foreground",
  primary: "text-primary-ink",
  success: "text-success-ink",
  warning: "text-warning-ink",
} as const;

export interface StatProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Etykieta zdaniem, nad liczbą („Są nam winni”, „Przepracowane”). */
  label: ReactNode;
  /** Liczba — tekst albo `AnimatedNumber`/`CountUp`, które zostają w środku. */
  value: ReactNode;
  /** Jednostka po liczbie, mniejsza i przygaszona („h”, „zł”). */
  unit?: ReactNode;
  /** Dopisek po jednostce w tej samej linii („/ 176 h normy”). */
  suffix?: ReactNode;
  /** Linijka pod liczbą. */
  hint?: ReactNode;
  /** Pasek pod liczbą (np. proporcja, postęp). */
  bar?: ReactNode;
  size?: keyof typeof SIZE;
  tone?: keyof typeof TONE;
  align?: "start" | "end";
  /** `dl`: etykieta jako `dt`, liczba jako `dd` — gdy Stat stoi w liście opisów. */
  term?: boolean;
}

/**
 * Jeden wygląd liczby (nowy plan 2026-11-05, 2.3): etykieta zdaniem, liczba w mono z cyframi tabelarycznymi,
 * jednostka mniejsza, opcjonalnie dopisek, linijka i pasek. Animacja liczby zostaje w `value`
 * (`AnimatedNumber`, `CountUp`), więc Stat nie zależy od framer-motion.
 */
export function Stat({ label, value, unit, suffix, hint, bar, size = "md", tone = "default", align = "start", term = false, className, ...rest }: StatProps) {
  const Label = term ? "dt" : "p";
  const Value = term ? "dd" : "p";
  return (
    <div className={cn(align === "end" && "text-right", className)} {...rest}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Value className={cn("mt-1 font-mono font-semibold leading-none tabular-nums", SIZE[size], TONE[tone])}>
        {value}
        {unit && <span className="ml-1 text-[0.5em] font-medium text-muted-foreground">{unit}</span>}
        {suffix && <span className="ml-2 font-sans text-sm font-medium text-muted-foreground">{suffix}</span>}
      </Value>
      {hint && (term ? <dd className="mt-1 text-xs text-muted-foreground tabular-nums">{hint}</dd> : <p className="mt-1 text-xs text-muted-foreground tabular-nums">{hint}</p>)}
      {bar}
    </div>
  );
}

import { cn } from "@/lib/utils";

/**
 * Wspólny wygląd siatki miesiąca — Kalendarz przypomnień i Grafik mają
 * te same komórki, nagłówki dni, znacznik „dziś”, weekendy i święta.
 */

/** Nagłówek dnia tygodnia; sobota i niedziela (indeks 5 i 6) w kolorze marki. */
export const weekdayHeadClass = (i: number) =>
  cn("text-2xs uppercase tracking-wider text-center py-1", i >= 5 ? "text-primary/80" : "text-muted-foreground");

/** Komórka dnia bez rozmiaru — wysokość zależy od tego, co komórka pokazuje. Pełne tło: kratka tła nie prześwituje. */
export const dayCellClass = (inMonth: boolean, today = false) => cn(
  "relative rounded-xl border text-left transition-colors outline-none",
  // Obramowanie „dziś” oddycha — bardzo subtelnie (CSS `today-breath`, wyłączone przy reduced motion).
  today && inMonth && "today-breath",
  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
  // Dzień spoza miesiąca: szary tekst, nie przezroczystość — przy opacity czerwone święto znikało w ciemnym motywie.
  inMonth ? "border-border/50 bg-card dark:border-transparent" : "border-transparent text-muted-foreground",
);

/** Numer dnia: „dziś” w kółku marki, święto pogrubione (czerwone w bieżącym miesiącu). */
export const dayNumberClass = ({ today, holiday, inMonth }: { today: boolean; holiday: boolean; inMonth: boolean }) => cn(
  "text-xs font-medium tabular-nums w-5 h-5 flex items-center justify-center rounded-full shrink-0",
  today ? "bg-primary text-primary-foreground" : holiday && cn("font-bold", inMonth && "text-destructive"),
);

/** Nazwa święta pod numerem (od `sm`); na telefonie zostaje kropka `holidayDotClass`. */
export const holidayNameClass = (inMonth: boolean) => cn("hidden sm:block text-2xs leading-tight truncate", inMonth && "text-destructive/80");

export const holidayDotClass = (inMonth: boolean) => cn("sm:hidden w-1.5 h-1.5 rounded-full", inMonth ? "bg-destructive" : "bg-muted-foreground");

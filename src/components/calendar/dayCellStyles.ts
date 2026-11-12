import { cn } from "@/lib/utils";

/**
 * Wspólny wygląd siatki miesiąca — Kalendarz przypomnień i Grafik mają
 * te same komórki, nagłówki dni, znacznik „dziś”, weekendy i święta.
 */

/** Nagłówek dnia tygodnia („Pon”, zdaniem — nowy plan 2.6); sobota i niedziela (indeks 5 i 6) w kolorze marki. */
export const weekdayHeadClass = (i: number) =>
  cn("text-xs font-medium capitalize text-center py-1.5", i >= 5 ? "text-primary-ink" : "text-muted-foreground");

/**
 * Komórka dnia bez rozmiaru — wysokość zależy od tego, co komórka pokazuje. Pełne tło: kratka tła nie prześwituje.
 * `empty` (Kalendarz, nowy plan 2.5): dzień bez niczego to przerywany obrys bez białego kafla — 35 pustych białych
 * kafli wyglądało jak niewczytana siatka.
 */
export const dayCellClass = (inMonth: boolean, today = false, empty = false) => cn(
  "relative rounded-card border text-left transition-colors outline-hidden",
  // Obramowanie „dziś” oddycha — bardzo subtelnie (CSS `today-breath`, wyłączone przy reduced motion).
  today && inMonth && "today-breath",
  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
  // Dzień spoza miesiąca: szary tekst, nie przezroczystość — przy opacity czerwone święto znikało w ciemnym motywie.
  inMonth ? "border-border/50 bg-card hover:border-primary/40 hover:shadow-sm dark:border-transparent dark:hover:border-primary/40" : "border-transparent text-muted-foreground",
  // Dzisiejszy dzień ma delikatne tło marki, nie tylko kółko przy numerze.
  today && inMonth && "bg-[color-mix(in_srgb,var(--primary)_5%,var(--card))]",
  inMonth && empty && !today && "border-dashed bg-transparent dark:border-border/40",
);

/** Numer dnia: „dziś” w kółku marki, święto pogrubione (czerwone w bieżącym miesiącu). */
export const dayNumberClass = ({ today, holiday, inMonth }: { today: boolean; holiday: boolean; inMonth: boolean }) => cn(
  "text-xs font-medium tabular-nums w-5 h-5 flex items-center justify-center rounded-full shrink-0",
  today ? "bg-primary text-primary-foreground" : holiday && cn("font-bold", inMonth && "text-destructive-ink"),
);

/** Nazwa święta pod numerem (od `sm`); na telefonie zostaje kropka `holidayDotClass`. */
export const holidayNameClass = (inMonth: boolean, container = false) => cn(container ? "hidden @[6rem]:block" : "hidden sm:block", "text-2xs leading-tight truncate", inMonth && "text-destructive-ink");

export const holidayDotClass = (inMonth: boolean, container = false) => cn(container ? "@[6rem]:hidden" : "sm:hidden", "w-1.5 h-1.5 rounded-full", inMonth ? "bg-destructive" : "bg-muted-foreground");

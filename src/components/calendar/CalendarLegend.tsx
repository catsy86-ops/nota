import { ChevronDown, HardHat } from "lucide-react";

/**
 * Legenda kształtów w siatce (K4.1): każdy stan dnia ma własny kształt, nie tylko odcień,
 * więc da się go odczytać bez koloru. Zwijana, bo na telefonie zajmuje dużo miejsca.
 */
export function CalendarLegend() {
  return (
    <details data-testid="calendar-legend" className="group rounded-card border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-medium text-foreground sm:min-h-0">
        Legenda
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        <li className="flex items-center gap-2">
          <span aria-hidden className="inline-block size-2 rounded-full bg-primary" />
          Termin z notatki
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="inline-block size-2 rounded-[1px] bg-destructive" />
          Zaległy termin (kwadrat)
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="inline-block size-2 rounded-full ring-1 ring-primary" />
          Prognoza serii, jeszcze nie zapisany termin
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="inline-block size-2 rounded-full bg-destructive" />
          Święto
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-[3px] w-4 rounded-full bg-primary" />
          Zmiana z Grafiku (kolor zmiany)
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">1</span>
          Dziś
        </li>
        <li className="flex items-center gap-2">
          <HardHat className="size-3.5" aria-hidden />
          Wizyta lub dostawa z Pracy
        </li>
      </ul>
    </details>
  );
}

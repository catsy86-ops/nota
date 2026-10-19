import { Repeat } from "lucide-react";
import type { SeriesForecast } from "@/lib/reminderForecast";

/**
 * Jeden wiersz na serię w „Najbliższe 7 dni”: ile kolejnych wystąpień wypada w tym tygodniu.
 * To prognoza, nie zapisane terminy — dlatego wiersz nie ma akcji i jest oznaczony jako prognoza.
 */
export function SeriesForecastRows({ forecasts }: { forecasts: SeriesForecast[] }) {
  if (forecasts.length === 0) return null;
  return (
    <ul aria-label="Prognoza serii" data-testid="series-forecast" className="space-y-1 text-sm">
      {forecasts.map((f) => (
        <li key={f.noteId} className="flex items-center gap-2 text-muted-foreground">
          <Repeat className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{f.title.trim() || "Bez tytułu"}</span>
          <span className="shrink-0 font-mono text-xs tabular-nums">
            +{f.count} {f.count === 1 ? "wystąpienie" : "wystąpień"} (prognoza)
          </span>
        </li>
      ))}
    </ul>
  );
}

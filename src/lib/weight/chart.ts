import type { WeightEntry } from "./model";

/** Okno wykresu w dniach (D2): 30 albo 90 ostatnich dni kalendarzowych do dziś. */
export type WeightRange = 30 | 90;

export interface WeightPoint { day: string; kg: number; x: number; y: number }

export interface WeightSeries {
  points: WeightPoint[];
  min: number;
  max: number;
  /** Pierwszy i ostatni dzień okna (do etykiet osi X). */
  from: string;
  to: string;
}

const DAY_MS = 86_400_000;

/** Dzień `YYYY-MM-DD` jako północ UTC — żeby różnice dni nie zależały od strefy czasu. */
function toUtc(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function dayKeyOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Punkty wykresu wagi w oknie `range` dni do `today` (klucz dnia). Oś X liczona od dnia, nie od
 * indeksu wpisu, więc dni bez ważenia zostawiają przerwę. Y: kg skalowane w `[min, max]` z zapasem
 * 0,5 kg (żeby punkty nie dotykały krawędzi). `null` gdy w oknie nie ma żadnego ważenia.
 */
export function weightSeries(entries: readonly WeightEntry[], range: WeightRange, today: string, width = 320, height = 140): WeightSeries | null {
  const end = toUtc(today);
  const start = end - (range - 1) * DAY_MS;
  const inWindow = entries
    .filter((e) => { const t = toUtc(e.day); return t >= start && t <= end; })
    .sort((a, b) => toUtc(a.day) - toUtc(b.day));
  if (inWindow.length === 0) return null;
  const kgs = inWindow.map((e) => e.kg);
  const min = Math.min(...kgs) - 0.5;
  const max = Math.max(...kgs) + 0.5;
  const span = max - min || 1;
  const points = inWindow.map((e) => ({
    day: e.day,
    kg: e.kg,
    x: ((toUtc(e.day) - start) / ((range - 1) * DAY_MS || 1)) * width,
    y: height - ((e.kg - min) / span) * height,
  }));
  return { points, min: min + 0.5, max: max - 0.5, from: dayKeyOf(start), to: dayKeyOf(end) };
}

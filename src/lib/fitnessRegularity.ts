import { addDaysToKey, startOfWeekKey } from "@/lib/week";

/**
 * C3.1 Kalendarz regularności: ostatnie 12 tygodni (pn–nd, od najstarszego), dzień po dniu — czy był trening,
 * czy odhaczono odżywkę, czy wpisano posiłek. Czysta logika; rysuje `RegularityGrid` w Ćwiczeniach.
 */

export const REGULARITY_WEEKS = 12;

export interface RegularityDay {
  day: string;
  training: boolean;
  supplements: boolean;
  diet: boolean;
  /** Dzień po dzisiejszym w bieżącym tygodniu — nie rysujemy go. */
  future: boolean;
}

export function regularityWeeks(
  today: string,
  sets: { training: ReadonlySet<string>; supplements: ReadonlySet<string>; diet: ReadonlySet<string> },
  weeks = REGULARITY_WEEKS,
): RegularityDay[][] {
  const first = addDaysToKey(startOfWeekKey(today), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => {
    const day = addDaysToKey(first, w * 7 + d);
    return { day, training: sets.training.has(day), supplements: sets.supplements.has(day), diet: sets.diet.has(day), future: day > today };
  }));
}

/** Ile dni z czym (bez dni przyszłych) — zdanie dla czytnika ekranu i podpis siatki. */
export function regularityCounts(weeks: readonly RegularityDay[][]): { training: number; supplements: number; diet: number } {
  const days = weeks.flat().filter((d) => !d.future);
  return { training: days.filter((d) => d.training).length, supplements: days.filter((d) => d.supplements).length, diet: days.filter((d) => d.diet).length };
}

/** Ile z trzech rzeczy zrobiono danego dnia (0–3) — nasycenie komórki. */
export const regularityLevel = (d: RegularityDay) => Number(d.training) + Number(d.supplements) + Number(d.diet);

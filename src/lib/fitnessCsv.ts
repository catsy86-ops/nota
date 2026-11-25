import { csvDocument, csvNumber, csvText } from "@/lib/csv";
import { byTrainingTime, type TrainingEntry } from "@/lib/training/model";
import type { Meal } from "@/lib/diet/model";
import type { WeightEntry } from "@/lib/weight/model";

/**
 * C3.5 Eksport Ćwiczeń jako CSV pod polski Excel (wspólny format z `src/lib/csv.ts`, jak w Długach): trening
 * (seria na wiersz), posiłki i masa ciała, od najstarszego. Pola tekstowe z wpisów idą przez `csvText`
 * (ochrona przed formułami), liczby przez `csvNumber`.
 */

const byDayTime = <T extends { day: string; time?: string; created: number }>(a: T, b: T) =>
  a.day.localeCompare(b.day) || (a.time ?? "").localeCompare(b.time ?? "") || a.created - b.created;

/** `nameOf` — nazwa ćwiczenia (katalog i własne); nieznane id zostaje jako id. */
export function trainingCsv(entries: readonly TrainingEntry[], nameOf: (id: string) => string | undefined): string {
  const rows: string[][] = [["Data", "Godzina", "Ćwiczenie", "Seria", "Powtórzenia", "Sekundy", "Ciężar [kg]", "Notatka"].map(csvText)];
  for (const e of [...entries].sort(byTrainingTime)) {
    e.sets.forEach((s, i) => {
      rows.push([csvText(e.day), csvText(e.time ?? ""), csvText(nameOf(e.exerciseId) ?? e.exerciseId), csvNumber(i + 1),
        s.seconds !== undefined ? "" : csvNumber(s.reps), csvNumber(s.seconds), csvNumber(s.kg), i === 0 ? csvText(e.note) : ""]);
    });
  }
  return csvDocument(rows);
}

export function mealsCsv(meals: readonly Meal[]): string {
  const rows: string[][] = [["Data", "Godzina", "Posiłek", "Kalorie [kcal]", "Białko [g]"].map(csvText)];
  for (const m of [...meals].sort(byDayTime)) rows.push([csvText(m.day), csvText(m.time ?? ""), csvText(m.text), csvNumber(m.kcal), csvNumber(m.protein)]);
  return csvDocument(rows);
}

export function weightsCsv(weights: readonly WeightEntry[]): string {
  const rows: string[][] = [["Data", "Masa [kg]"].map(csvText)];
  for (const w of [...weights].sort((a, b) => a.day.localeCompare(b.day))) rows.push([csvText(w.day), csvNumber(w.kg)]);
  return csvDocument(rows);
}

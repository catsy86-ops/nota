import { bestKg, byTrainingTime, type TrainingEntry } from "@/lib/training/model";
import type { Meal } from "@/lib/diet/model";
import type { WeightEntry } from "@/lib/weight/model";

/**
 * C3.3 Podsumowanie miesiąca w Ćwiczeniach (`month` = `YYYY-MM`): dni z treningiem, nowe rekordy ciężaru (seria
 * cięższa niż wszystko wcześniej w tym ćwiczeniu — pierwszy zapis ćwiczenia rekordem nie jest), średnie kcal
 * i białko z dni z wpisami, masa na początku i na końcu miesiąca. Do udostępnienia jako tekst.
 */
export interface MonthFitness {
  month: string;
  trainingDays: number;
  records: number;
  avgKcal: number | null;
  avgProtein: number | null;
  dietDays: number;
  weightFrom: number | null;
  weightTo: number | null;
}

export function monthFitness(training: readonly TrainingEntry[], meals: readonly Meal[], weights: readonly WeightEntry[], month: string): MonthFitness {
  const inMonth = (day: string) => day.startsWith(month);
  const days = new Set<string>();
  let records = 0;
  const best = new Map<string, number>();
  for (const e of [...training].sort(byTrainingTime)) {
    const b = bestKg(e.sets);
    const prev = best.get(e.exerciseId);
    if (inMonth(e.day)) {
      days.add(e.day);
      if (b !== undefined && prev !== undefined && b > prev) records++;
    }
    if (b !== undefined && (prev === undefined || b > prev)) best.set(e.exerciseId, b);
  }
  const kcalByDay = new Map<string, number>();
  const proteinByDay = new Map<string, number>();
  for (const m of meals) {
    if (!inMonth(m.day)) continue;
    if (m.kcal !== undefined) kcalByDay.set(m.day, (kcalByDay.get(m.day) ?? 0) + m.kcal);
    if (m.protein !== undefined) proteinByDay.set(m.day, (proteinByDay.get(m.day) ?? 0) + m.protein);
  }
  const avg = (xs: Iterable<number>) => { const a = [...xs]; return a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null; };
  const w = weights.filter((x) => inMonth(x.day)).sort((a, b) => a.day.localeCompare(b.day));
  return {
    month,
    trainingDays: days.size,
    records,
    avgKcal: avg(kcalByDay.values()),
    avgProtein: avg(proteinByDay.values()),
    dietDays: new Set([...kcalByDay.keys(), ...proteinByDay.keys()]).size,
    weightFrom: w[0]?.kg ?? null,
    weightTo: w.at(-1)?.kg ?? null,
  };
}

const MONTHS = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień"];
const kg = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Tekst do wiadomości; puste części (np. bez diety) pomijane. */
export function monthFitnessText(m: MonthFitness): string {
  const [y, mm] = m.month.split("-");
  const name = MONTHS[Number(mm) - 1] ?? m.month;
  const lines = [`Ćwiczenia — ${name} ${y}`, `Treningi: ${m.trainingDays} ${m.trainingDays === 1 ? "dzień" : "dni"}`];
  if (m.records > 0) lines.push(`Nowe rekordy: ${m.records}`);
  if (m.dietDays > 0) {
    const parts = [m.avgKcal !== null ? `${m.avgKcal} kcal` : null, m.avgProtein !== null ? `${m.avgProtein} g białka` : null].filter(Boolean);
    lines.push(`Średnio dziennie: ${parts.join(", ")} (${m.dietDays} ${m.dietDays === 1 ? "dzień" : "dni"} z wpisami)`);
  }
  if (m.weightFrom !== null && m.weightTo !== null) {
    const d = Math.round((m.weightTo - m.weightFrom) * 10) / 10;
    lines.push(m.weightFrom === m.weightTo && d === 0 ? `Masa: ${kg(m.weightTo)} kg` : `Masa: ${kg(m.weightFrom)} → ${kg(m.weightTo)} kg (${d > 0 ? "+" : d < 0 ? "−" : ""}${kg(Math.abs(d))} kg)`);
  }
  return lines.join("\n");
}

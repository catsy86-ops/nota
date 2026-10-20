/**
 * Dieta: dziennik posiłków (opis, godzina, kalorie, białko) i cele dzienne.
 * Czysta logika bez Yjs i bez React. Wejście z dokumentu, kopii i peera przechodzi przez czyszczenie,
 * więc śmieci nie wywracają widoku.
 */

export const DIET_TEXT_MAX = 200;
/** Wartości odżywcze na posiłek: zakres rozsądny, nie dietetyczny. */
export const DIET_KCAL_MAX = 10_000;
export const DIET_PROTEIN_MAX = 1_000;
/** Limit posiłków w dokumencie — zabezpieczenie przed zalaniem. */
export const DIET_MAX_MEALS = 5_000;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface Meal {
  id: string;
  /** Dzień `YYYY-MM-DD`, lokalny. */
  day: string;
  /** Godzina posiłku „HH:MM”; brak = bez godziny. */
  time?: string;
  /** Co zjedzono, zapisane słowami. */
  text: string;
  /** Kalorie w kcal; brak = nieznane (posiłek liczy się do listy, nie do sumy). */
  kcal?: number;
  /** Białko w gramach; brak = nieznane. */
  protein?: number;
  created: number;
}

export interface DietGoals {
  kcal?: number;
  protein?: number;
}

/** Wartość liczbowa w zakresie `[0, max]`, zaokrąglona; inaczej `undefined`. */
export function cleanAmount(v: unknown, max: number): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max) return undefined;
  return Math.round(v);
}

/** Wejście → posiłek; `null` gdy brakuje id, poprawnego dnia albo opisu. */
export function cleanMeal(raw: unknown): Meal | null {
  const m = raw as Partial<Meal> | null;
  if (!m || typeof m !== "object") return null;
  if (typeof m.id !== "string" || !m.id || m.id.length > 64) return null;
  if (typeof m.day !== "string" || !DAY_RE.test(m.day)) return null;
  if (typeof m.text !== "string" || !m.text.trim()) return null;
  const time = typeof m.time === "string" && TIME_RE.test(m.time) ? m.time : undefined;
  const kcal = cleanAmount(m.kcal, DIET_KCAL_MAX);
  const protein = cleanAmount(m.protein, DIET_PROTEIN_MAX);
  return {
    id: m.id,
    day: m.day,
    text: m.text.trim().slice(0, DIET_TEXT_MAX),
    created: typeof m.created === "number" && Number.isFinite(m.created) ? m.created : 0,
    ...(time ? { time } : {}),
    ...(kcal !== undefined ? { kcal } : {}),
    ...(protein !== undefined ? { protein } : {}),
  };
}

/** Cele: tylko poprawne liczby; pusty obiekt = brak celów. */
export function cleanGoals(raw: unknown): DietGoals {
  const g = raw as Partial<DietGoals> | null;
  if (!g || typeof g !== "object") return {};
  const kcal = cleanAmount(g.kcal, DIET_KCAL_MAX);
  const protein = cleanAmount(g.protein, DIET_PROTEIN_MAX);
  return { ...(kcal !== undefined && kcal > 0 ? { kcal } : {}), ...(protein !== undefined && protein > 0 ? { protein } : {}) };
}

/** Kolejność dnia: wg godziny, posiłki bez godziny na końcu, potem wg czasu dodania. */
export function byMealOrder(a: Meal, b: Meal): number {
  if (a.time && b.time && a.time !== b.time) return a.time < b.time ? -1 : 1;
  if (a.time && !b.time) return -1;
  if (!a.time && b.time) return 1;
  return a.created - b.created;
}

export interface DaySummary {
  day: string;
  meals: number;
  /** Suma kcal tylko z posiłków, które mają wartość. */
  kcal: number;
  /** Ile posiłków ma podaną kalorię (żeby sumę dało się ocenić). */
  kcalKnown: number;
  protein: number;
  proteinKnown: number;
}

/** Podsumowanie jednego dnia z listy posiłków. */
export function summarizeDay(meals: readonly Meal[], day: string): DaySummary {
  const s: DaySummary = { day, meals: 0, kcal: 0, kcalKnown: 0, protein: 0, proteinKnown: 0 };
  for (const m of meals) {
    if (m.day !== day) continue;
    s.meals++;
    if (m.kcal !== undefined) { s.kcal += m.kcal; s.kcalKnown++; }
    if (m.protein !== undefined) { s.protein += m.protein; s.proteinKnown++; }
  }
  return s;
}

/** Podsumowania ostatnich `days` dni, od najstarszego do `endDay` (włącznie). */
export function summarizeRange(meals: readonly Meal[], endDay: string, days: number, addDays: (key: string, n: number) => string): DaySummary[] {
  const out: DaySummary[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(summarizeDay(meals, addDays(endDay, -i)));
  return out;
}

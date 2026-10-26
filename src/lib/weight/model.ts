/** Masa ciała (C-2): jedno ważenie dziennie, w kilogramach. */
export interface WeightEntry {
  /** Dzień `YYYY-MM-DD`; jedno ważenie na dzień (klucz wpisu). */
  day: string;
  kg: number;
  /** Moment zapisu (ms) — przy scalaniu kopii wygrywa nowszy zapis dnia. */
  created: number;
}

export const WEIGHT_MIN_KG = 20;
export const WEIGHT_MAX_KG = 300;
/** Ile dni wstecz można zapisać — bez tego kopia z daleka wypełniłaby historię śmieciami. */
export const WEIGHT_MAX_ENTRIES = 1000;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Liczba z przecinkiem albo kropką, z dokładnością do 0,1 kg; poza zakresem `null`. */
export function parseKg(text: string): number | null {
  const n = Number(text.trim().replace(",", "."));
  if (!Number.isFinite(n) || n < WEIGHT_MIN_KG || n > WEIGHT_MAX_KG) return null;
  return Math.round(n * 10) / 10;
}

/** Wpis z dokumentu albo kopii → poprawny `WeightEntry` lub `null`. */
export function cleanWeight(raw: unknown): WeightEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Record<keyof WeightEntry, unknown>>;
  if (typeof r.day !== "string" || !DAY_RE.test(r.day)) return null;
  if (typeof r.kg !== "number" || !Number.isFinite(r.kg) || r.kg < WEIGHT_MIN_KG || r.kg > WEIGHT_MAX_KG) return null;
  if (typeof r.created !== "number" || !Number.isFinite(r.created)) return null;
  return { day: r.day, kg: Math.round(r.kg * 10) / 10, created: r.created };
}

/**
 * Zmiana względem poprzedniego ważenia i średnia z ostatnich 7 ważeń (wpisy od najstarszego).
 * Bez dwóch ważeń zmiany nie ma (`null`).
 */
export function weightTrend(entries: readonly WeightEntry[]): { delta: number | null; average: number | null } {
  if (entries.length === 0) return { delta: null, average: null };
  const last = entries[entries.length - 1];
  const delta = entries.length >= 2 ? Math.round((last.kg - entries[entries.length - 2].kg) * 10) / 10 : null;
  const recent = entries.slice(-7);
  const average = Math.round((recent.reduce((s, e) => s + e.kg, 0) / recent.length) * 10) / 10;
  return { delta, average };
}

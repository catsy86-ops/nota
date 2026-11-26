import { extraOf } from "@/lib/extraFields";

/**
 * C3.4 Obwody ciała (pas, klatka, ramię, udo) w centymetrach — według wzoru masy ciała, ale jeden wpis na **dzień
 * i partię**: dwa telefony mierzące tego samego dnia różne partie scalają się bez strat.
 */

export const MEASURE_PARTS = ["pas", "klatka", "ramie", "udo"] as const;
export type MeasurePart = (typeof MEASURE_PARTS)[number];
export const MEASURE_LABEL: Record<MeasurePart, string> = { pas: "Pas", klatka: "Klatka", ramie: "Ramię", udo: "Udo" };

export const MEASURE_MIN_CM = 10;
export const MEASURE_MAX_CM = 250;
export const MEASURE_MAX_ENTRIES = 2000;

export interface Measure {
  day: string;
  part: MeasurePart;
  cm: number;
  /** Moment zapisu (ms) — przy scalaniu kopii wygrywa nowszy pomiar tej partii tego dnia. */
  created: number;
  extra?: Record<string, unknown>;
}

export const MEASURE_KNOWN = ["day", "part", "cm", "created"] as const;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Klucz w mapie `bodyMeasures`. */
export const measureKey = (part: MeasurePart, day: string) => `${part}:${day}`;

/** Liczba z przecinkiem albo kropką, co 0,1 cm; poza zakresem `null`. */
export function parseCm(text: string): number | null {
  const n = Number(text.trim().replace(",", "."));
  if (!text.trim() || !Number.isFinite(n) || n < MEASURE_MIN_CM || n > MEASURE_MAX_CM) return null;
  return Math.round(n * 10) / 10;
}

export function cleanMeasure(raw: unknown): Measure | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Record<keyof Measure, unknown>>;
  if (typeof r.day !== "string" || !DAY_RE.test(r.day)) return null;
  if (!MEASURE_PARTS.includes(r.part as MeasurePart)) return null;
  if (typeof r.cm !== "number" || !Number.isFinite(r.cm) || r.cm < MEASURE_MIN_CM || r.cm > MEASURE_MAX_CM) return null;
  if (typeof r.created !== "number" || !Number.isFinite(r.created)) return null;
  const extra = extraOf(r, MEASURE_KNOWN);
  return { day: r.day, part: r.part as MeasurePart, cm: Math.round(r.cm * 10) / 10, created: r.created, ...(extra ? { extra } : {}) };
}

/** Ostatni pomiar partii i zmiana względem poprzedniego (wpisy dowolnie posortowane). */
export function measureTrend(list: readonly Measure[], part: MeasurePart): { last: Measure | null; delta: number | null } {
  const own = list.filter((m) => m.part === part).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  const last = own.at(-1) ?? null;
  const prev = own.at(-2);
  return { last, delta: last && prev ? Math.round((last.cm - prev.cm) * 10) / 10 : null };
}

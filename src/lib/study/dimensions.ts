/**
 * Wymiary na zdjęciach (B3.3): linia z opisem („35 cm od narożnika”) zapisana jako dane przy zdjęciu, nie wypalona
 * w obraz — oryginał zostaje. Współrzędne są względne (0–1 szerokości i wysokości zdjęcia), więc działają przy
 * każdym rozmiarze i po zmniejszeniu zdjęcia.
 */

export interface Dimension {
  from: [number, number]; // [x, y] względne, 0–1
  to: [number, number];
  text: string;           // np. "120 cm"
}

export const MAX_DIMENSIONS_PER_IMAGE = 20;
export const DIMENSION_TEXT_MAX = 80;
/** Krótszą linię (ułamek zdjęcia) uznajemy za przypadkowe stuknięcie. */
export const DIMENSION_MIN_LENGTH = 0.03;

const inUnit = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1;
const point = (v: unknown): [number, number] | null => (Array.isArray(v) && v.length === 2 && inUnit(v[0]) && inUnit(v[1]) ? [v[0], v[1]] : null);

/** Lista wymiarów jednego zdjęcia z dowolnego wejścia: poprawne punkty (0–1), niepusty opis, najwyżej 20. */
export function cleanDimensions(dims: unknown): Dimension[] {
  if (!Array.isArray(dims)) return [];
  const out: Dimension[] = [];
  for (const d of dims) {
    if (out.length >= MAX_DIMENSIONS_PER_IMAGE) break;
    const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
    const from = point(o.from);
    const to = point(o.to);
    const text = typeof o.text === "string" ? o.text.replace(/\s+/g, " ").trim().slice(0, DIMENSION_TEXT_MAX) : "";
    if (from && to && text) out.push({ from, to, text });
  }
  return out;
}

/** Opisy wymiarów zdjęcia w jednej linii („35 cm, 120 cm”) — do podpisu w protokole; pusty = brak wymiarów. */
export const dimensionsLine = (dims: readonly Dimension[] | undefined): string => (dims ?? []).map((d) => d.text).join(", ");

/**
 * Wymiary na zdjęciach (B3.3): współrzędne punktów i tekst wymiaru.
 */

export interface Dimension {
  from: [number, number]; // [x, y] punkt początkowy
  to: [number, number];   // [x, y] punkt końcowy
  text: string;           // tekst wymiaru (np. "120 cm")
}

export const MAX_DIMENSIONS_PER_IMAGE = 20;

export function cleanDimensions(
  dims: Dimension[] | undefined
): Dimension[] {
  if (!Array.isArray(dims)) return [];
  return dims
    .filter((d) => {
      return (
        Array.isArray(d.from) && d.from.length === 2 &&
        typeof d.from[0] === "number" && typeof d.from[1] === "number" &&
        Array.isArray(d.to) && d.to.length === 2 &&
        typeof d.to[0] === "number" && typeof d.to[1] === "number" &&
        typeof d.text === "string" && d.text.trim()
      );
    })
    .slice(0, MAX_DIMENSIONS_PER_IMAGE);
}

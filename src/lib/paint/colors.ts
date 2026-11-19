/**
 * W1.8: kolory rysunku na canvasie i w eksporcie (JPEG, PNG, PDF) w jednym miejscu.
 *
 * Dwa rodzaje:
 * - `tokenColor` — kolor stylu odczytany z CSS w chwili rysowania (konfetti, podgląd na ekranie). Token jest pełnym
 *   kolorem (`oklch(...)`), który canvas przyjmuje wprost; bez okna albo tokenu wraca zapas.
 * - stałe niżej — rysunek, który wychodzi z aplikacji (zdjęcie z podpisem, miniatura, podpis klienta, wymiary na
 *   zdjęciu). Nie idzie za stylem: plik ma wyglądać tak samo w każdym motywie i na papierze.
 */

export function tokenColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw || fallback;
}

/** Tło pod obrazem bez przezroczystości (JPEG nie ma kanału alfa) i napis na pasku zdjęcia. */
export const PAPER = "#ffffff";
/** Tusz podpisu: granat długopisu, czytelny na białym i w druku. */
export const SIGNATURE_INK = "#1f2a44";
/** Podpis pod linią podpisu (wyciszony granat). */
export const SIGNATURE_MUTED = "#3a4358";
/** Wymiar zatwierdzony na zdjęciu (bursztyn) i rysowany (czerwień) — widoczne na każdym zdjęciu. */
export const MEASURE_DONE = "#f59e0b";
export const MEASURE_ACTIVE = "#ef4444";
export const MEASURE_TEXT = "#111";

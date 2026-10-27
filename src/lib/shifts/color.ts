/**
 * Czytelny tekst na kolorze zmiany. Kolory rodzajów są zapisane w danych
 * użytkownika, więc nie wystarczy przyciemnić palety — liczymy kontrast
 * (WCAG) i wybieramy biel albo „tusz”: ten sam odcień przyciemniony do 15%.
 */

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const full = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const INK_FACTOR = 0.15;

/** Kolor tekstu na tle `color`: `#fff` albo ciemny odcień tego samego koloru — co da większy kontrast. */
export function shiftInk(color: string): string {
  const rgb = parseHex(color);
  if (!rgb) return "#fff";
  const ink = rgb.map((v) => Math.round(v * INK_FACTOR)) as [number, number, number];
  const bg = luminance(rgb);
  if (contrast(bg, 1) >= contrast(bg, luminance(ink))) return "#fff";
  return `#${ink.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Kontrast WCAG między dwoma kolorami hex (do testów i walidacji palety). */
export function contrastRatio(a: string, b: string): number {
  const x = parseHex(a);
  const y = parseHex(b);
  return x && y ? contrast(luminance(x), luminance(y)) : 1;
}

/**
 * Kolor zmiany jako tekst na tle karty (nieobecności, skróty w podglądzie):
 * domieszka koloru tekstu motywu ściemnia go w jasnym i rozjaśnia w ciemnym. Udział koloru zmiany to
 * `--shift-text-mix` (domyślnie 55%); styl z kolorowym tłem obniża go (zielona Tablica: 30%), bo kolor zmiany
 * zbliżony do tła dawał za mały kontrast.
 */
export const shiftTextOnCard = (color: string) => `color-mix(in oklab, ${color} var(--shift-text-mix, 55%), var(--foreground))`;

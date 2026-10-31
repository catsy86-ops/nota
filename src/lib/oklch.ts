// Kolory tokenów są w OKLCH (D-1), a WCAG liczy kontrast w sRGB. Używa tego generator własnego motywu
// (`customTheme.ts`) i testy kontrastu (`src/test/oklch.ts` reeksportuje).

export type Oklch = [number, number, number];
export type Rgb = [number, number, number];

/**
 * Wartość `oklch(L C H)` jako [L, C, H]; `null`, gdy to nie oklch. Przyjmuje zapis z plików (`0.975`)
 * i ten, który zwraca przeglądarka w `getComputedStyle` (`91.67%`, `.0034`), oraz opcjonalne `/ alfa`.
 * L w procentach dzieli się przez 100, C 100% = 0.4 (jak w CSS).
 */
export function parseOklch(value: string): Oklch | null {
  const m = /oklch\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.%]+\s*)?\)/.exec(value);
  if (!m) return null;
  const num = (v: string, pctScale: number) => (v.endsWith("%") ? (Number(v.slice(0, -1)) / 100) * pctScale : Number(v));
  return [num(m[1], 1), num(m[2], 0.4), Number(m[3])];
}

/** Zapis w CSS, np. `oklch(0.9750 0.0200 120.00)`. */
export function formatOklch([L, C, H]: Oklch): string {
  return `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${H.toFixed(2)})`;
}

/** OKLCH → sRGB (0..1, z kodowaniem gamma), przycięte do zakresu. */
export function oklchToRgb([L, C, H]: Oklch): Rgb {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  return lin.map((c) => Math.min(1, Math.max(0, gamma(c)))) as Rgb;
}

/** OKLCH → `#rrggbb` (do funkcji, które przyjmują hex). */
export function oklchToHex(c: Oklch): string {
  return "#" + oklchToRgb(c).map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

/** Luminancja względna WCAG z sRGB. */
export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Stosunek kontrastu WCAG (1–21) dwóch kolorów OKLCH. */
export function contrastRatio(a: Oklch, b: Oklch): number {
  const la = relativeLuminance(oklchToRgb(a));
  const lb = relativeLuminance(oklchToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Pomocnicze dla testów kontrastu: tokeny są w OKLCH (D-1), a WCAG liczy się w sRGB.
// Odwrotność konwersji z docs/tools/d1-oklch/oklch-convert.cjs.

export type Oklch = [number, number, number];
export type Rgb = [number, number, number];

/** Wartość `oklch(L C H)` (także z ułamkami i spacjami) jako [L, C, H]; `null`, gdy to nie oklch. */
export function parseOklch(value: string): Oklch | null {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/.exec(value);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
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

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { oklchToRgb } from "@/test/oklch";

// Kontrast liczony z tokenów w index.css (bez przeglądarki). Axe nie widzi
// gradientów, a nie liczy 1.4.11 dla pól — dlatego ten test pilnuje tokenów.

const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

/** Treść bloku zaczynającego się od `selector {` (do pierwszego `\n  }` na tym poziomie). */
function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Brak bloku ${selector}`);
  const end = css.indexOf("\n  }", start);
  return css.slice(start, end);
}

/** Wartość tokenu `--name: oklch(L C H);` z podanego bloku, jako [L, C, H]. */
function token(source: string, name: string): [number, number, number] {
  const m = source.match(new RegExp(`--${name}:\\s*oklch\\(\\s*([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\s*\\);`));
  if (!m) throw new Error(`Brak tokenu --${name}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(oklchToRgb(a));
  const lb = luminance(oklchToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const light = block(":root");
const dark = block(".dark");

describe("kontrast tokenów Zeszytu (WCAG AA)", () => {
  it("jasny: tekst muted i czerwony tekst ≥4.5:1 na tłach", () => {
    const bg = token(light, "background");
    const surfaces = { background: bg, muted: token(light, "muted") };
    for (const [name, fg] of [
      ["muted-foreground", token(light, "muted-foreground")],
      ["destructive-ink", token(light, "destructive-ink")],
    ] as const) {
      for (const [surface, s] of Object.entries(surfaces)) {
        expect(contrast(fg, s), `${name} na ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("ciemny: czerwony tekst ≥4.5:1 na tle, karcie, muted i secondary", () => {
    const fg = token(dark, "destructive-ink");
    for (const surface of ["background", "card", "muted", "secondary"]) {
      expect(contrast(fg, token(dark, surface)), `destructive-ink na ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ciemny: krawędź pól ≥3:1 na tle, karcie, muted i secondary (1.4.11)", () => {
    const input = token(dark, "input");
    for (const surface of ["background", "card", "muted", "secondary"]) {
      expect(contrast(input, token(dark, surface)), `input na ${surface}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("ciemny: muted-foreground ≥4.5:1 na tle i karcie", () => {
    const fg = token(dark, "muted-foreground");
    for (const surface of ["background", "card"]) {
      expect(contrast(fg, token(dark, surface)), `muted-foreground na ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

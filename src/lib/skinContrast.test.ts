import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SKIN_SCHEME, type Skin } from "@/lib/skins";

// Kontrast tokenów każdego stylu (WCAG AA), liczony z `index.css` i `styles/skins.css` bez przeglądarki.
// Zeszyt jest sprawdzany w obu motywach, pozostałe w swoim jedynym schemacie.

const index = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const skins = readFileSync(resolve(process.cwd(), "src/styles/skins.css"), "utf8");

function block(src: string, selector: string): string {
  const start = src.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Brak bloku ${selector}`);
  return src.slice(start, src.indexOf("\n  }", start) < 0 ? src.indexOf("}", start) : src.indexOf("}", start));
}

type Hsl = [number, number, number];
function tokens(text: string): Record<string, Hsl | number> {
  const out: Record<string, Hsl | number> = {};
  for (const m of text.matchAll(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%;/g)) out[m[1]] = [+m[2], +m[3], +m[4]];
  for (const m of text.matchAll(/--([\w-]+):\s*([\d.]+)%;/g)) out[m[1]] = +m[2];
  return out;
}

function hslToRgb([h, s, l]: Hsl): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: [number, number, number], b: [number, number, number]) => {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const rgb = (t: Record<string, Hsl | number>, name: string) => hslToRgb(t[name] as Hsl);

/** Pary tekst/tło (tekst ≥4.5:1) i krawędź pola na tle (≥3:1, 1.4.11). */
const TEXT_PAIRS: [string, string][] = [
  ["foreground", "background"], ["foreground", "card"],
  ["muted-foreground", "background"], ["muted-foreground", "card"], ["muted-foreground", "muted"],
  ["primary-foreground", "primary"], ["destructive-foreground", "destructive"], ["accent-foreground", "accent"],
  ["destructive-ink", "background"], ["destructive-ink", "card"], ["destructive-ink", "muted"],
];

function resolveSkin(skin: Skin, scheme: "light" | "dark") {
  const base = tokens(block(index, scheme === "dark" ? ".dark" : ":root"));
  if (skin === "zeszyt") return base;
  return { ...base, ...tokens(block(skins, `html[data-skin="${skin}"]`)) };
}

const cases: [Skin, "light" | "dark"][] = [
  ["zeszyt", "light"], ["zeszyt", "dark"],
  ...(["plan", "neon", "zorza", "miedz", "matrix", "hydraulika"] as Skin[]).map((s) => [s, SKIN_SCHEME[s] ?? "light"] as [Skin, "light" | "dark"]),
];

describe("kontrast tokenów wszystkich stylów (WCAG AA)", () => {
  for (const [skin, scheme] of cases) {
    it(`${skin} (${scheme}): tekst ≥4.5:1, krawędź pola ≥3:1`, () => {
      const t = resolveSkin(skin, scheme);
      for (const [fg, bg] of TEXT_PAIRS) {
        expect(contrast(rgb(t, fg), rgb(t, bg)), `${fg} na ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const surface of ["background", "card"]) {
        expect(contrast(rgb(t, "input"), rgb(t, surface)), `input na ${surface}`).toBeGreaterThanOrEqual(3);
      }
      // `warning-ink` = warning zmieszany z czernią w proporcji z tailwind.config.ts (warning-ink-mix, a dalej ink-mix).
      const inkMix = (t["warning-ink-mix"] ?? t["ink-mix"] ?? 62) as number;
      const warningBase = (t["warning-ink-base"] ? rgb(t, "warning-ink-base") : rgb(t, "warning"));
      const warningInk = warningBase.map((c) => c * inkMix / 100) as [number, number, number];
      for (const surface of ["background", "card"]) {
        expect(contrast(warningInk, rgb(t, surface)), `warning-ink na ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

// Sezony zmieniają `--season-accent` i dekoracje, nie `--accent` (długopis w Zeszycie): inaczej linki wypadają z kontrastu.
describe("sezony nie nadpisują --accent (długopis w Zeszycie)", () => {
  it("żaden blok html[data-season] nie definiuje --accent", () => {
    const blocks = [...index.matchAll(/html\[data-season="[a-z]+"\]\s*\{([^}]*)\}/g)].map((m) => m[1]);
    expect(blocks.length).toBeGreaterThan(0);
    for (const body of blocks) expect(body).not.toMatch(/(^|[\s;{])--accent:/);
  });
});

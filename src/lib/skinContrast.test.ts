import { readFileSync } from "node:fs";
import { readSkinCss } from "@/test/skinCss";
import { ACCENT_COUNT } from "@/lib/accent";
import { ACCENT_META } from "@/lib/accentMeta";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SKINS, SKIN_SCHEME, type Skin } from "@/lib/skins";
import { oklchToRgb, parseOklch, type Oklch } from "@/test/oklch";

// Kontrast tokenów każdego stylu (WCAG AA), liczony z `index.css` i `styles/skins/*.css` bez przeglądarki.
// Zeszyt jest sprawdzany w obu motywach, pozostałe w swoim jedynym schemacie.

const index = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const skins = readSkinCss();

function block(src: string, selector: string): string {
  const start = src.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Brak bloku ${selector}`);
  return src.slice(start, src.indexOf("\n  }", start) < 0 ? src.indexOf("}", start) : src.indexOf("}", start));
}

function tokens(text: string): Record<string, Oklch | number> {
  const out: Record<string, Oklch | number> = {};
  for (const m of text.matchAll(/--([\w-]+):\s*(oklch\([^)]*\));/g)) {
    const c = parseOklch(m[2]);
    if (c) out[m[1]] = c;
  }
  for (const m of text.matchAll(/--([\w-]+):\s*([\d.]+)%;/g)) out[m[1]] = +m[2];
  return out;
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

const rgb = (t: Record<string, Oklch | number>, name: string) => oklchToRgb(t[name] as Oklch);

/** Pary tekst/tło (tekst ≥4.5:1) i krawędź pola na tle (≥3:1, 1.4.11). */
const TEXT_PAIRS: [string, string][] = [
  ["foreground", "background"], ["foreground", "card"],
  ["muted-foreground", "background"], ["muted-foreground", "card"], ["muted-foreground", "muted"],
  ["primary-foreground", "primary"], ["destructive-foreground", "destructive"], ["accent-foreground", "accent"],
  ["destructive-ink", "background"], ["destructive-ink", "card"], ["destructive-ink", "muted"],
];

/** Selektor drugiego schematu stylu (plan motywów 4.1). */
const altSelector = (skin: Skin) => `html[data-skin="${skin}"]${SKIN_SCHEME[skin] === "dark" ? ":not(.dark)" : ".dark"}`;

function resolveSkin(skin: Skin, scheme: "light" | "dark") {
  const base = tokens(block(index, scheme === "dark" ? ".dark" : ":root"));
  if (skin === "zeszyt") return base;
  const own = { ...base, ...tokens(block(skins, `html[data-skin="${skin}"]`)) };
  return scheme === SKIN_SCHEME[skin] ? own : { ...own, ...tokens(block(skins, altSelector(skin))) };
}

// Każdy styl w obu schematach (od 4.1).
const cases: [Skin, "light" | "dark"][] = SKINS.flatMap((s) => [[s, "light"], [s, "dark"]] as [Skin, "light" | "dark"][]);

function checkAll(t: Record<string, Oklch | number>, scheme: "light" | "dark") {
  for (const [fg, bg] of TEXT_PAIRS) {
    expect(contrast(rgb(t, fg), rgb(t, bg)), `${fg} na ${bg}`).toBeGreaterThanOrEqual(4.5);
  }
  for (const surface of ["background", "card"]) {
    expect(contrast(rgb(t, "input"), rgb(t, surface)), `input na ${surface}`).toBeGreaterThanOrEqual(3);
  }
  // Ikony działów w nawigacji (D-4): wariant „ink” (kolor zmieszany z czernią, jak `--sec-*` w index.css).
  // Grafika, więc 3:1 (1.4.11), nie 4.5:1.
  // Jak `--sec-*` w index.css: jasne tło — przyciemnione o 50% czerni, ciemne — czysty kolor motywu.
  const sectionInk = (token: string): [number, number, number] =>
    (scheme === "dark" ? rgb(t, token) : rgb(t, token).map((c) => c * 0.5)) as [number, number, number];
  for (const token of ["primary", "accent", "warning", "success"]) {
    for (const surface of ["background", "card"]) {
      expect(contrast(sectionInk(token), rgb(t, surface)), `ikona ${token} na ${surface}`).toBeGreaterThanOrEqual(3);
    }
  }
  // `primary-ink` i `warning-ink` = kolor zmieszany z czernią w proporcji z tailwind.config.ts.
  const inkMix = (t["ink-mix"] ?? 62) as number;
  const primaryInk = rgb(t, "primary").map((c) => c * inkMix / 100) as [number, number, number];
  const warningMix = (t["warning-ink-mix"] ?? inkMix) as number;
  const warningBase = (t["warning-ink-base"] ? rgb(t, "warning-ink-base") : rgb(t, "warning"));
  const warningInk = warningBase.map((c) => c * warningMix / 100) as [number, number, number];
  for (const surface of ["background", "card"]) {
    expect(contrast(primaryInk, rgb(t, surface)), `primary-ink na ${surface}`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(warningInk, rgb(t, surface)), `warning-ink na ${surface}`).toBeGreaterThanOrEqual(4.5);
  }
}

describe("kontrast tokenów wszystkich stylów (WCAG AA)", () => {
  for (const [skin, scheme] of cases) {
    it(`${skin} (${scheme}): tekst ≥4.5:1, krawędź pola ≥3:1`, () => {
      checkAll(resolveSkin(skin, scheme), scheme);
    });
  }
});

// Akcenty (plan motywów 1.1/1.5): każdy odcień z `accents.css` przechodzi te same progi co barwa stylu.
const accentsCss = readFileSync(resolve(process.cwd(), "src/styles/accents.css"), "utf8");
function accentBlock(skin: Skin, scheme: "light" | "dark", n: number): string | null {
  const sel = `html[data-skin="${skin}"]${scheme === "dark" ? ".dark" : ":not(.dark)"}[data-accent="${n}"]`;
  const start = accentsCss.indexOf(`${sel} {`);
  return start < 0 ? null : accentsCss.slice(start, accentsCss.indexOf("}", start));
}

describe("akcenty stylów: kontrast i komplet odcieni", () => {
  for (const [skin, scheme] of cases) {
    it(`${skin} (${scheme}): ${ACCENT_COUNT - 1} odcieni, każdy ≥ progów`, () => {
      expect(ACCENT_META[skin]).toHaveLength(ACCENT_COUNT);
      for (let n = 1; n < ACCENT_COUNT; n++) {
        const body = accentBlock(skin, scheme, n);
        expect(body, `brak akcentu ${n}`).not.toBeNull();
        checkAll({ ...resolveSkin(skin, scheme), ...tokens(body!) }, scheme);
      }
      expect(accentBlock(skin, scheme, ACCENT_COUNT), "akcent poza listą").toBeNull();
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

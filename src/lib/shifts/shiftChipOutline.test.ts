import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { contrastRatio } from "./color";
import { oklchToHex, parseOklch } from "@/test/oklch";
import { readSkinCss } from "@/test/skinCss";

/** Wartość tokenu `oklch(...)` z bloku CSS, na hex; `null`, gdy go nie ma. */
function token(block: string, name: string): string | null {
  const m = new RegExp(name + ":\\s*(oklch\\([^)]*\\))").exec(block);
  const c = m ? parseOklch(m[1]) : null;
  return c ? oklchToHex(c) : null;
}

/** Pary (karta, tekst) dla każdego stylu z `styles/skins/*.css` i motywu bazowego z `index.css`. */
function surfaces(): Record<string, { card: string; ink: string }> {
  const out: Record<string, { card: string; ink: string }> = {};
  for (const m of readSkinCss().matchAll(/html\[data-skin="(\w+)"\]\s*\{([^}]*)\}/g)) {
    const card = token(m[2], "--card");
    const ink = token(m[2], "--foreground");
    if (card && ink && !(m[1] in out)) out[m[1]] = { card, ink };
  }
  const root = /:root\s*\{([^}]*)\}/.exec(readFileSync("src/index.css", "utf8"));
  if (root) {
    const card = token(root[1], "--card");
    const ink = token(root[1], "--foreground");
    if (card && ink) out.default = { card, ink };
  }
  return out;
}

describe("obwódka znacznika zmiany (5.2): tekst karty na tle każdego stylu", () => {
  const all = surfaces();

  it("znalazłem pary karta/tekst dla stylów", () => {
    expect(Object.keys(all).length).toBeGreaterThanOrEqual(5);
  });

  for (const [skin, { card, ink }] of Object.entries(all)) {
    it(`styl ${skin}: obwódka w kolorze tekstu ma co najmniej 3:1 na karcie`, () => {
      expect(contrastRatio(ink, card)).toBeGreaterThanOrEqual(3);
    });
  }
});

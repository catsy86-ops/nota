import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { contrastRatio } from "./color";

/** HSL z tokenu (`--card: 211 58% 22%`) na hex. */
function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

/** Wartość tokenu HSL z bloku CSS, na hex; `null`, gdy go nie ma. */
function token(block: string, name: string): string | null {
  const re = new RegExp(name + ":\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%");
  const m = re.exec(block);
  return m ? hslToHex(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

/** Pary (karta, tekst) dla każdego stylu z `skins.css` i motywu bazowego z `index.css`. */
function surfaces(): Record<string, { card: string; ink: string }> {
  const out: Record<string, { card: string; ink: string }> = {};
  for (const m of readFileSync("src/styles/skins.css", "utf8").matchAll(/html\[data-skin="(\w+)"\]\s*\{([^}]*)\}/g)) {
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

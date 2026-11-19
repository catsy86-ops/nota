import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readSkinCss } from "@/test/skinCss";
import { SKINS, SKIN_SCHEME, type Skin } from "@/lib/skins";
import { oklchToRgb, parseOklch, type Oklch } from "@/test/oklch";

/**
 * W0.3 (`docs/plan-warstwa-wizualna-2026-11-15.md`): tabela kontrastu par tokenów dla 10 stylów × 2 schematów.
 * Progi i pary tekstu pilnuje `skinContrast.test.ts`; tu dochodzą elementy interfejsu (≥ 3:1, WCAG 1.4.11 i 2.4.13):
 * akcent na tle (przycisk, zaznaczenie) i pierścień fokusu. `--border` to `color-mix` z przezroczystością — bez
 * przeglądarki go nie policzymy, więc go tu nie ma.
 * Porażki to lista zadań W6.1 — `KNOWN` może tylko maleć. Tabela: `UI_CONTRAST_REPORT=1 npx vitest run …`
 * zapisuje `docs/kontrast-tokenow.md`.
 */

const index = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
const skins = readSkinCss();

function block(src: string, selector: string): string {
  const start = src.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Brak bloku ${selector}`);
  return src.slice(start, src.indexOf("}", start));
}
function tokens(text: string): Record<string, Oklch> {
  const out: Record<string, Oklch> = {};
  for (const m of text.matchAll(/--([\w-]+):\s*(oklch\([^)]*\));/g)) {
    const c = parseOklch(m[2]);
    if (c) out[m[1]] = c;
  }
  return out;
}
const altSelector = (skin: Skin) => `html[data-skin="${skin}"]${SKIN_SCHEME[skin] === "dark" ? ":not(.dark)" : ".dark"}`;
/** `--faint` = `color-mix(in oklch, muted-foreground P%, background)` — P z bloku schematu w `index.css`. */
function faintShare(scheme: "light" | "dark"): number {
  const m = /--faint:\s*color-mix\(in oklch, var\(--muted-foreground\) (\d+)%, var\(--background\)\)/.exec(block(index, scheme === "dark" ? ".dark" : ":root"));
  if (!m) throw new Error(`brak --faint w schemacie ${scheme}`);
  return Number(m[1]) / 100;
}
/** Mieszanie w OKLCH jak w CSS: odcień koloru bez nasycenia nie bierze udziału. */
function mixOklch(a: Oklch, b: Oklch, p: number): Oklch {
  const hue = a[1] < 0.02 ? b[2] : b[1] < 0.02 ? a[2] : a[2] * p + b[2] * (1 - p);
  return [a[0] * p + b[0] * (1 - p), a[1] * p + b[1] * (1 - p), hue];
}
function resolveSkin(skin: Skin, scheme: "light" | "dark"): Record<string, Oklch> {
  const base = tokens(block(index, scheme === "dark" ? ".dark" : ":root"));
  const own = skin === "zeszyt" ? base : { ...base, ...tokens(block(skins, `html[data-skin="${skin}"]`)) };
  const t = skin === "zeszyt" || scheme === SKIN_SCHEME[skin] ? own : { ...own, ...tokens(block(skins, altSelector(skin))) };
  return { ...t, faint: mixOklch(t["muted-foreground"], t.background, faintShare(scheme)) };
}
const lum = (rgb: [number, number, number]) => {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: Oklch, b: Oklch) => {
  const la = lum(oklchToRgb(a));
  const lb = lum(oklchToRgb(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** [pierwszy plan, tło, próg]. */
const PAIRS: [string, string, number][] = [
  ["foreground", "background", 4.5], ["muted-foreground", "background", 4.5], ["muted-foreground", "card", 4.5],
  ["faint", "background", 4.5], ["faint", "card", 4.5], ["faint", "muted", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["primary", "background", 3], ["primary", "card", 3],
  ["ring", "background", 3], ["ring", "card", 3],
  ["input", "background", 3],
];

/** Znane porażki (`styl/schemat: para`) — do naprawy w W6.1 w tokenach stylów. Lista może tylko maleć. */
const KNOWN: string[] = ["zeszyt/light: primary/background", "zeszyt/light: primary/card"];

const rows = SKINS.flatMap((skin) => (["light", "dark"] as const).map((scheme) => {
  const t = resolveSkin(skin, scheme);
  return { skin, scheme, values: PAIRS.map(([fg, bg, min]) => ({ pair: `${fg}/${bg}`, min, r: t[fg] && t[bg] ? ratio(t[fg], t[bg]) : NaN })) };
}));

describe("W0.3: kontrast elementów interfejsu wszystkich stylów", () => {
  it("porażki tylko ze znanej listy, a lista nie zawiera już naprawionych", () => {
    const fails = rows.flatMap((r) => r.values.filter((v) => v.min > 0 && !(v.r >= v.min)).map((v) => `${r.skin}/${r.scheme}: ${v.pair}`));
    expect(fails.filter((f) => !KNOWN.includes(f)), "nowe porażki").toEqual([]);
    expect(KNOWN.filter((k) => !fails.includes(k)), "naprawione — usuń z KNOWN").toEqual([]);
  });

  it.skipIf(!process.env.UI_CONTRAST_REPORT)("zapisuje tabelę do docs/kontrast-tokenow.md", () => {
    const head = `| styl | schemat | ${PAIRS.map(([f, b, m]) => `${f} / ${b}${m ? ` (≥ ${m})` : ""}`).join(" | ")} |`;
    const sep = `|---|---|${PAIRS.map(() => "---:").join("|")}|`;
    const body = rows.map((r) => `| ${r.skin} | ${r.scheme} | ${r.values.map((v) => (Number.isNaN(v.r) ? "—" : `${v.min && v.r < v.min ? "**" : ""}${v.r.toFixed(2)}${v.min && v.r < v.min ? "**" : ""}`)).join(" | ")} |`);
    const md = `# Kontrast tokenów (W0.3)\n\nWygenerowane przez \`src/lib/skinContrastReport.test.ts\` (${new Date().toISOString().slice(0, 10)}). Pogrubione — poniżej progu (zadania W6.1).\n\n${[head, sep, ...body].join("\n")}\n`;
    writeFileSync(resolve(process.cwd(), "docs/kontrast-tokenow.md"), md);
  });
});

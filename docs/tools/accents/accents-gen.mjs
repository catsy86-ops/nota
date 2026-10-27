// Generator `src/styles/accents.css` (plan motywów 1.1). Uruchom: `node docs/tools/accents/accents-gen.mjs`.
// Dla każdej skórki i każdego odcienia z ACCENTS bierze jasność (L) i nasycenie (C) `--primary` skórki,
// przycina C do gamutu sRGB, a gdy kontrast nie przechodzi — przesuwa L (najbliżej wyjściowej).
// Progi = te same co `src/lib/skinContrast.test.ts`: primary-foreground na primary 4,5:1,
// primary-ink na tle i karcie 4,5:1, ikona działu (sec-notes) na tle i karcie 3:1.
// Nazwy i kolejność odcieni muszą się zgadzać z `ACCENT_META` w `src/lib/accentMeta.ts`.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../..");
const index = readFileSync(resolve(ROOT, "src/index.css"), "utf8");
const skinDir = resolve(ROOT, "src/styles/skins");
const skinCss = readdirSync(skinDir).map((f) => readFileSync(resolve(skinDir, f), "utf8")).join("\n");

/** Odcień: H w stopniach, opcjonalnie stałe C (barwy prawie szare) i jasność startowa L (żółcie wymagają jaśniejszej). Indeks 0 = barwa skórki (bez wpisu). */
export const ACCENTS = {
  zeszyt: [{ h: 255 }, { h: 150 }, { h: 25 }, { h: 300 }],
  plan: [{ h: 60 }, { h: 150 }, { h: 350 }, { h: 240, c: 0.02 }],
  neon: [{ h: 206 }, { h: 100, l: 0.9 }, { h: 145 }, { h: 300 }],
  zorza: [{ h: 300 }, { h: 350 }, { h: 230 }, { h: 85 }],
  miedz: [{ h: 185 }, { h: 85 }, { h: 250, c: 0.05 }, { h: 28 }],
  matrix: [{ h: 75 }, { h: 200 }, { h: 28 }, { h: 140, c: 0.03 }],
  hydraulika: [{ h: 230 }, { h: 85 }, { h: 25 }, { h: 255 }],
};

// --- OKLCH ↔ sRGB (jak src/test/oklch.ts, plus sprawdzenie gamutu) ---
function oklchToLinear([L, C, H]) {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const inGamut = (c) => oklchToLinear(c).every((v) => v >= -1e-4 && v <= 1 + 1e-4);
const gamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const toRgb = (c) => oklchToLinear(c).map((v) => Math.min(1, Math.max(0, gamma(v))));
const lum = (rgb) => {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// --- tokeny ---
function block(src, selector) {
  const start = src.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Brak bloku ${selector}`);
  return src.slice(start, src.indexOf("}", start));
}
function tokens(text) {
  const out = {};
  for (const m of text.matchAll(/--([\w-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\);/g)) out[m[1]] = [+m[2], +m[3], +m[4]];
  for (const m of text.matchAll(/--([\w-]+):\s*([\d.]+)%;/g)) out[m[1]] = +m[2];
  return out;
}
function resolve2(skin, scheme) {
  const base = tokens(block(index, scheme === "dark" ? ".dark" : ":root"));
  return skin === "zeszyt" ? base : { ...base, ...tokens(block(skinCss, `html[data-skin="${skin}"]`)) };
}

const SCHEMES = { zeszyt: ["light", "dark"], plan: ["dark"], neon: ["dark"], zorza: ["dark"], miedz: ["light"], matrix: ["dark"], hydraulika: ["dark"] };

function passes(t, scheme, primary) {
  const p = toRgb(primary);
  const inkMix = (t["ink-mix"] ?? 62) / 100;
  const ink = p.map((c) => c * inkMix);
  const sec = scheme === "dark" ? p : p.map((c) => c * 0.5);
  const surfaces = [toRgb(t.background), toRgb(t.card)];
  return contrast(toRgb(t["primary-foreground"]), p) >= 4.6
    && surfaces.every((s) => contrast(ink, s) >= 4.6)
    && surfaces.every((s) => contrast(sec, s) >= 3.1);
}

function fit(t, scheme, L0, C0, h, fixedC) {
  for (let step = 0; step <= 30; step++) {
    for (const dir of step === 0 ? [0] : [1, -1]) {
      const L = +(L0 + dir * step * 0.01).toFixed(4);
      if (L <= 0.05 || L >= 0.98) continue;
      let C = fixedC ?? C0;
      while (C > 0 && !inGamut([L, C, h])) C = +(C - 0.002).toFixed(4);
      const c = [L, +C.toFixed(4), h];
      if (passes(t, scheme, c)) return c;
    }
  }
  throw new Error(`Nie da się dobrać L dla H=${h}`);
}

const fmt = ([L, C, H]) => `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${H.toFixed(2)})`;
const hueClose = (a, b) => Math.abs(((a - b + 540) % 360) - 180) < 20;

let css = `/*
  Kolor akcentu (plan motywów 1.1, \`src/lib/accent.ts\`). PLIK GENEROWANY: \`node docs/tools/accents/accents-gen.mjs\`.
  \`html[data-accent="N"]\` zmienia odcień \`--primary\` (i \`--ring\`, gdy ma ten sam odcień) w stylu; jasność
  jest dobrana tak, żeby przechodziły progi \`src/lib/skinContrast.test.ts\`. Akcent 0 = barwa stylu (bez atrybutu).
*/
`;
for (const [skin, list] of Object.entries(ACCENTS)) {
  for (const scheme of SCHEMES[skin]) {
    const t = resolve2(skin, scheme);
    const [L0, C0, H0] = t.primary;
    const ring = t.ring;
    list.forEach((a, i) => {
      const primary = fit(t, scheme, a.l ?? L0, C0, a.h, a.c);
      const sel = skin === "zeszyt"
        ? `html[data-skin="zeszyt"]${scheme === "dark" ? ".dark" : ":not(.dark)"}[data-accent="${i + 1}"]`
        : `html[data-skin="${skin}"][data-accent="${i + 1}"]`;
      const lines = [`  --primary: ${fmt(primary)};`];
      if (ring && hueClose(ring[2], H0)) {
        // Pierścień: ta sama różnica jasności co w stylu, nowy odcień.
        const L = Math.min(0.97, Math.max(0.1, primary[0] + (ring[0] - L0)));
        let C = a.c ?? ring[1];
        while (C > 0 && !inGamut([L, C, a.h])) C -= 0.002;
        lines.push(`  --ring: ${fmt([L, Math.max(0, C), a.h])};`);
      }
      if (skin === "matrix" || skin === "hydraulika") {
        lines.push("  --glow-primary: 0 10px 30px -8px color-mix(in srgb, var(--primary) 55%, transparent);");
      }
      css += `${sel} {\n${lines.join("\n")}\n}\n`;
    });
  }
}
writeFileSync(resolve(ROOT, "src/styles/accents.css"), css);
console.log("zapisano src/styles/accents.css");

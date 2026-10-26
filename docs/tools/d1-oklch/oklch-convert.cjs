// D-1: konwersja tokenów kolorów z HSL (kanały "H S% L%") na OKLCH.
// Tryb dry (domyślny): liczy i sprawdza odchylenie, nic nie zapisuje. Tryb --apply: zapisuje.
const fs = require("fs");
const path = require("path");
const ROOT = "C:/Users/catsy/OneDrive/Pulpit/Notatnik/";
const APPLY = process.argv.includes("--apply");

// --- HSL -> sRGB (0..1) ---
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

// --- sRGB -> OKLab -> OKLCH (Björn Ottosson) ---
function rgbToOklch([r0, g0, b0]) {
  const r = toLinear(r0), g = toLinear(g0), b = toLinear(b0);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H: C < 1e-4 ? 0 : H };
}

// --- odwrotnie, do walidacji ---
function oklchToRgb({ L, C, H }) {
  const a = C * Math.cos((H * Math.PI) / 180), b = C * Math.sin((H * Math.PI) / 180);
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [toSrgb(r), toSrgb(g), toSrgb(bb)].map((x) => Math.min(1, Math.max(0, x)));
}

const fmt = ({ L, C, H }) => `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${H.toFixed(2)})`;

// Pliki z definicjami tokenów (kanały HSL).
const CSS_FILES = ["src/index.css", "src/styles/skins.css", "src/styles/site.css"].filter((f) => fs.existsSync(ROOT + f));
const TOKEN_DEF = /(--[\w-]+)\s*:\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*;/g;

let maxErr = 0, count = 0;
const defs = {};
for (const f of CSS_FILES) {
  const text = fs.readFileSync(ROOT + f, "utf8");
  const out = text.replace(TOKEN_DEF, (_m, name, h, s, l) => {
    const rgb = hslToRgb(+h, +s, +l);
    const ok = rgbToOklch(rgb);
    const back = oklchToRgb(ok);
    for (let i = 0; i < 3; i++) maxErr = Math.max(maxErr, Math.abs(back[i] - rgb[i]) * 255);
    count++;
    defs[name] = true;
    return `${name}: ${fmt(ok)};`;
  });
  if (APPLY) fs.writeFileSync(ROOT + f, out.replace(/\r\n/g, "\r\n"), "utf8");
}
console.log(`tokenów: ${count}, nazw: ${Object.keys(defs).length}, maks. odchylenie (0-255): ${maxErr.toFixed(3)}`);
console.log(APPLY ? "zapisano definicje" : "dry-run: nic nie zapisano");

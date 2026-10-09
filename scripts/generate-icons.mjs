// Ikony PWA i ekran startowy z wordmarkiem NOTKI (font Unbounded, gradient marki).
// Android składa ekran startowy z `pwa-512.png` i `background_color` z manifestu,
// więc tło ikon jest tym samym ciemnym kolorem — logo „wisi” na jednolitym tle.
// Usage: node scripts/generate-icons.mjs
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const BG = "#0f0d10";
const font = readFileSync("node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2").toString("base64");

// `tile`: zaokrąglony kafel na przezroczystym tle (purpose "any").
// `bleed`: pełne tło do krawędzi (maskable, apple-touch — system sam przycina).
// `text`/`width`: ułamek boku, który zajmuje wordmark; maskable trzyma się bezpiecznej strefy (80%).
const ICONS = [
  { file: "pwa-512.png", size: 512, mode: "tile", text: "NOTKI", width: 0.62 },
  { file: "pwa-192.png", size: 192, mode: "tile", text: "NOTKI", width: 0.62 },
  { file: "pwa-512-maskable.png", size: 512, mode: "bleed", text: "NOTKI", width: 0.56 },
  { file: "apple-touch-icon.png", size: 180, mode: "bleed", text: "NOTKI", width: 0.66 },
  // 64 px nie uniesie pięciu liter — w karcie przeglądarki zostaje samo N.
  { file: "favicon.png", size: 64, mode: "tile", text: "N", width: 0.42 },
];

function html({ size, mode, text, width }) {
  const radius = mode === "tile" ? size * 0.22 : 0;
  const inset = mode === "tile" ? size * 0.06 : 0;
  return `<!doctype html><html><head><style>
    @font-face { font-family: Unbounded; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 200 900; }
    html, body { margin: 0; width: ${size}px; height: ${size}px; background: transparent; }
    .tile {
      position: absolute; inset: ${inset}px; border-radius: ${radius}px;
      background: radial-gradient(120% 90% at 50% 0%, #2a1a14 0%, ${BG} 60%);
      display: flex; align-items: center; justify-content: center;
    }
    .word {
      font-family: Unbounded; font-weight: 800; line-height: 1; letter-spacing: 0.02em;
      color: transparent; -webkit-background-clip: text; background-clip: text;
      background-image: linear-gradient(170deg, hsl(38 100% 62%), hsl(25 95% 53%) 45%, hsl(340 75% 55%));
      filter: drop-shadow(0 ${size * 0.008}px ${size * 0.03}px hsl(25 95% 53% / 0.45));
      white-space: nowrap;
    }
    .caret { display: inline-block; width: 0.09em; height: 0.78em; margin-left: 0.1em; border-radius: 1px; background: hsl(340 75% 55%); }
  </style></head><body><div class="tile"><span class="word" id="w">${text}${text.length > 1 ? '<span class="caret"></span>' : ""}</span></div></body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const icon of ICONS) {
  await page.setViewportSize({ width: icon.size, height: icon.size });
  await page.setContent(html(icon));
  await page.evaluate(() => document.fonts.ready);
  // Dobierz rozmiar fontu tak, żeby wordmark zajął zadany ułamek szerokości.
  await page.evaluate(({ target }) => {
    const w = document.getElementById("w");
    w.style.fontSize = "100px";
    w.style.fontSize = `${(100 * target) / w.getBoundingClientRect().width}px`;
  }, { target: icon.size * icon.width });
  await page.screenshot({ path: `public/${icon.file}`, omitBackground: icon.mode === "tile" });
  console.log("wrote", icon.file);
}
await browser.close();

#!/usr/bin/env node
// Metryki warstwy wizualnej (W0.2, docs/plan-warstwa-wizualna-2026-11-15.md §1). Liczy wzorce w src/ bez testów
// i zapisuje docs/ui-metryki.json. Każdy etap planu podaje liczby przed i po.
//   node scripts/ui-metrics.mjs            — wypisuje i zapisuje
//   node scripts/ui-metrics.mjs --check    — tylko wypisuje (bez zapisu)
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SRC = join(ROOT, "src");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (!/\.(test|spec)\.[tj]sx?$/.test(name) && !p.includes(`${join("src", "test")}`)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const code = files.filter((f) => /\.(ts|tsx)$/.test(f)).map((f) => [f, readFileSync(f, "utf8")]);
const css = files.filter((f) => f.endsWith(".css")).map((f) => [f, readFileSync(f, "utf8")]);

/** Liczba trafień i plików dla wyrażenia w podanym zbiorze. */
function count(set, re) {
  let hits = 0;
  let inFiles = 0;
  for (const [, text] of set) {
    const n = (text.match(re) ?? []).length;
    hits += n;
    if (n) inFiles++;
  }
  return { hits, files: inFiles };
}
const cls = (name) => new RegExp(`(?<![\\w-])${name}(?![\\w-])`, "g");

const metrics = {
  "tekst: text-xs": count(code, cls("text-xs")),
  "tekst: text-sm": count(code, cls("text-sm")),
  "tekst: text-base": count(code, cls("text-base")),
  "tekst: text-lg": count(code, cls("text-lg")),
  "tekst: text-xl": count(code, cls("text-xl")),
  "tekst: text-2xl+": count(code, /(?<![\w-])text-[2-9]xl(?![\w-])/g),
  "tekst: title-section": count(code, cls("title-section")),
  "tekst: title-page": count(code, cls("title-page")),
  "tekst: text-[Npx]": count(code, /text-\[\d+px\]/g),
  "grubość: font-medium": count(code, cls("font-medium")),
  "grubość: font-semibold": count(code, cls("font-semibold")),
  "grubość: font-bold": count(code, cls("font-bold")),
  "interlinia: leading-": count(code, /(?<![\w-])leading-[\w[\]./]+/g),
  "interlinia: tracking-": count(code, /(?<![\w-])tracking-[\w[\]./]+/g),
  "łamanie: text-balance/pretty": count(code, /(?<![\w-])text-(balance|pretty)(?![\w-])/g),
  "wyciszenie: opacity-NN": count(code, /(?<![\w-])opacity-\d+/g),
  "wyciszenie: text-muted-foreground/NN": count(code, /text-muted-foreground\/\d+/g),
  "karty: rounded-card border": count(code, /rounded-card border(?![\w-])/g),
  "karty: <SectionCard": count(code, /<SectionCard\b/g),
  "karty: <Card": count(code, /<Card\b/g),
  "cienie: shadow-elevation": count(code, /shadow-elevation/g),
  "cienie: shadow-sm..2xl": count(code, /(?<![\w-])shadow-(sm|md|lg|xl|2xl)(?![\w-])/g),
  "cienie: shadow-[": count(code, /shadow-\[/g),
  "kolor: hex w ts/tsx": count(code, /#[0-9a-fA-F]{3,8}\b(?![\w-])/g),
  "kolor: hsl( w CSS": count(css, /hsl\(/g),
  "kolor: #hex w CSS": count(css, /#[0-9a-fA-F]{3,8}\b/g),
  "kolor: dark:": count(code, /(?<![\w-])dark:/g),
  "kolor: paleta Tailwinda": count(code, /(?<![\w-])(text|bg|border)-(red|green|blue|yellow|amber|orange|emerald|sky|slate|gray|zinc|neutral)-\d{2,3}/g),
  "ikony: h-3": count(code, /(?<![\w-])h-3(?![\w.-])/g),
  "ikony: h-3.5": count(code, /(?<![\w-])h-3\.5/g),
  "ikony: h-4": count(code, /(?<![\w-])h-4(?![\w.-])/g),
  "ikony: h-5": count(code, /(?<![\w-])h-5(?![\w.-])/g),
  "ikony: h-6": count(code, /(?<![\w-])h-6(?![\w.-])/g),
  "ikony: size-N": count(code, /(?<![\w-])size-\d+(\.\d)?(?![\w-])/g),
  "ikony: strokeWidth": count(code, /strokeWidth/g),
  "wymiary: w/h-[N]": count(code, /(?<![\w-])(w|h|min-w|min-h|max-w|max-h)-\[[^\]]+\]/g),
  "warstwy: z-[": count(code, /(?<![\w-])z-\[/g),
  "warstwy: z-10..50": count(code, /(?<![\w-])z-(10|20|30|40|50)(?![\w-])/g),
  "stany: hover:": count(code, /(?<![\w-])hover:/g),
  "stany: focus-visible:": count(code, /focus-visible:/g),
  "stany: disabled:": count(code, /(?<![\w-])disabled:/g),
  "stany: active:": count(code, /(?<![\w-])active:/g),
  "kontrolki: surowe <button": count(code, /<button\b/g),
  "kontrolki: <Button": count(code, /<Button\b/g),
  "kontrolki: surowe pola": count(code, /<(input|textarea|select)\b/g),
  "css: !important": count(css, /!important/g),
  "css: @layer": count(css, /@layer\b/g),
  "css: @container": count(css, /@container\b/g),
  "css: forced-colors": count(css, /forced-colors/g),
  "css: prefers-contrast": count(css, /prefers-contrast/g),
  "css: @media print": count(css, /@media print/g),
  "dane: <svg": count(code, /<svg\b/g),
  "dane: <img": count(code, /<img\b/g),
  "rozmycie: backdrop-blur": count(code, /backdrop-blur/g),
  "gradienty: bg-gradient/linear-gradient": count([...code, ...css], /(bg-gradient-|linear-gradient\(|radial-gradient\()/g),
};

const indexCss = css.find(([f]) => relative(ROOT, f).replace(/\\/g, "/") === "src/index.css");
const result = {
  date: new Date().toISOString().slice(0, 10),
  files: { code: code.length, css: css.length },
  "index.css linie": indexCss ? indexCss[1].split("\n").length : null,
  metrics,
};

for (const [k, v] of Object.entries(metrics)) console.log(`${k.padEnd(40)} ${String(v.hits).padStart(5)}  w ${v.files} plikach`);
if (!process.argv.includes("--check")) {
  writeFileSync(join(ROOT, "docs", "ui-metryki.json"), JSON.stringify(result, null, 2) + "\n");
  console.log("\nzapisano docs/ui-metryki.json");
}

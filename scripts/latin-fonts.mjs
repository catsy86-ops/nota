// Generuje kopie CSS krojów z samymi podzbiorami latin i latin-ext (bez cyrylicy, greki i wietnamskiego).
// Uruchom po zmianie wersji @fontsource: `node scripts/latin-fonts.mjs`. Wynik trafia do src/styles/fonts-latin/.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "src", "styles", "fonts-latin");

// Pakiet + plik CSS z `src/main.tsx`. Nazwa wyjściowa: ten sam ciąg z „/” zamienionym na „-”.
const SOURCES = [
  "@fontsource-variable/plus-jakarta-sans/index.css",
  "@fontsource-variable/jetbrains-mono/wght.css",
  "@fontsource/barlow-condensed/600.css",
  "@fontsource-variable/unbounded/wght.css",
  "@fontsource-variable/fraunces/soft.css",
  "@fontsource-variable/bricolage-grotesque/wght.css",
  "@fontsource-variable/inter/wght.css",
  "@fontsource-variable/nunito/wght.css",
  "@fontsource-variable/atkinson-hyperlegible-next/wght.css",
  "@fontsource-variable/literata/wght.css",
  "@fontsource-variable/manrope/wght.css",
  "@fontsource-variable/lexend/wght.css",
];

// Bloki `@font-face` rozdziela pusta linia; plik źródłowy z podzbioru jest w `url(./files/<nazwa>.woff2)`.
const KEEP_FILE = /-(latin|latin-ext)-/;

function filterCss(id) {
  const pkgDir = id.split("/").slice(0, id.startsWith("@") ? 2 : 1).join("/");
  const src = readFileSync(path.join(root, "node_modules", id), "utf8");
  const blocks = src.split(/\n(?=\/\*|@font-face)/);
  const kept = blocks.filter((block) => {
    // Komentarz z nazwą podzbioru idzie razem z blokiem, którego dotyczy.
    if (/^\/\*[^*]*(cyrillic|greek|vietnamese)/.test(block.trim())) return false;
    if (!block.includes("@font-face")) return true;
    const file = block.match(/url\(\.\/files\/([^)]+)\)/);
    return !!file && KEEP_FILE.test(file[1]);
  });
  const body = kept.join("\n").replace(/url\(\.\/files\//g, `url(../../../node_modules/${pkgDir}/files/`);
  const header = `/* Generowane przez scripts/latin-fonts.mjs z ${id} — tylko latin i latin-ext. Nie edytuj ręcznie. */\n`;
  return { name: id.replace(/\//g, "-").replace(/\.css$/, ""), css: header + body + "\n" };
}

mkdirSync(outDir, { recursive: true });
for (const id of SOURCES) {
  const { name, css } = filterCss(id);
  writeFileSync(path.join(outDir, `${name}.css`), css);
  console.log(`${name}.css`);
}

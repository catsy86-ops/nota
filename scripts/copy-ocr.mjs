// Kopiuje silnik OCR (tesseract.js) i dane języków do public/ocr/<wersja core>/ — serwowane z własnego
// adresu, nigdy z CDN (obrazy planów nie wychodzą na zewnątrz). Uruchamiany w predev/prebuild.
// Plik o tym samym rozmiarze jest pomijany: repo leży w OneDrive, więc ~9 MB synchronizuje się raz na wersję.
// public/ocr/ jest w .gitignore — binariów nie commitujemy.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = (...p) => join(root, "node_modules", ...p);
const version = JSON.parse(readFileSync(nm("tesseract.js-core", "package.json"), "utf8")).version;
const out = join(root, "public", "ocr", version);

const files = [
  [nm("tesseract.js", "dist", "worker.min.js"), "worker.min.js"],
  [nm("tesseract.js-core", "tesseract-core-simd-lstm.js"), "tesseract-core-simd-lstm.js"],
  [nm("tesseract.js-core", "tesseract-core-simd-lstm.wasm"), "tesseract-core-simd-lstm.wasm"],
  [nm("tesseract.js-core", "tesseract-core-lstm.js"), "tesseract-core-lstm.js"],
  [nm("tesseract.js-core", "tesseract-core-lstm.wasm"), "tesseract-core-lstm.wasm"],
  [nm("@tesseract.js-data", "eng", "4.0.0_best_int", "eng.traineddata.gz"), "eng.traineddata.gz"],
  [nm("@tesseract.js-data", "pol", "4.0.0_best_int", "pol.traineddata.gz"), "pol.traineddata.gz"],
];

mkdirSync(out, { recursive: true });
let copied = 0;
for (const [src, name] of files) {
  if (!existsSync(src)) throw new Error(`copy-ocr: brak ${src} — uruchom npm install`);
  const dst = join(out, name);
  if (existsSync(dst) && statSync(dst).size === statSync(src).size) continue;
  copyFileSync(src, dst);
  copied++;
}
console.log(`copy-ocr: ${version} — skopiowano ${copied}, aktualne ${files.length - copied}`);

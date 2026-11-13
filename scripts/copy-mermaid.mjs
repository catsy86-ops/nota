// Kopiuje Mermaid (diagramy w notatkach, plan Notatek 5.5) z node_modules do public/mermaid/<wersja>/ — serwowany
// z własnego adresu i ładowany przez `import()` dopiero przy pierwszym bloku ```mermaid. Poza paczką Vite i poza
// precache service workera (bundlowanie dawało ok. 5 MiB dodatkowego precache), jak silnik OCR (copy-ocr.mjs).
// Plik o tym samym rozmiarze jest pomijany: repo leży w OneDrive, więc ~24 MB synchronizuje się raz na wersję.
// public/mermaid/ jest w .gitignore — plików nie commitujemy. Uruchamiany w predev/prebuild.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "node_modules", "mermaid");
if (!existsSync(pkgDir)) throw new Error("copy-mermaid: brak node_modules/mermaid — uruchom npm install");
const version = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version;
const out = join(root, "public", "mermaid", version);

let copied = 0;
let kept = 0;
function copyTree(srcDir, dstDir) {
  mkdirSync(dstDir, { recursive: true });
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const src = join(srcDir, entry.name);
    const dst = join(dstDir, entry.name);
    if (entry.isDirectory()) { copyTree(src, dst); continue; }
    if (existsSync(dst) && statSync(dst).size === statSync(src).size) { kept++; continue; }
    copyFileSync(src, dst);
    copied++;
  }
}

// Wejście i jego chunki (ścieżki względne `./chunks/mermaid.esm.min/…` działają po skopiowaniu obok siebie).
mkdirSync(out, { recursive: true });
const entry = join(pkgDir, "dist", "mermaid.esm.min.mjs");
if (!existsSync(entry)) throw new Error(`copy-mermaid: brak ${entry}`);
const dstEntry = join(out, "mermaid.esm.min.mjs");
if (existsSync(dstEntry) && statSync(dstEntry).size === statSync(entry).size) kept++;
else { copyFileSync(entry, dstEntry); copied++; }
copyTree(join(pkgDir, "dist", "chunks", "mermaid.esm.min"), join(out, "chunks", "mermaid.esm.min"));
console.log(`copy-mermaid: ${version} — skopiowano ${copied}, aktualne ${kept}`);

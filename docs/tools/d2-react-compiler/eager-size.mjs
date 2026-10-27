// Mierzy rozmiar gzip paczki startowej (statyczny graf z dist/index.html), tak jak e2e/bundle.spec.ts.
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const dist = process.argv[2];
const assets = path.join(dist, "assets");
const html = readFileSync(path.join(dist, "index.html"), "utf8");
const roots = [...html.matchAll(/(?:src|href)="\/assets\/([A-Za-z0-9._-]+\.js)"/g)].map((m) => m[1]);
const seen = new Set();
const queue = [...roots];
while (queue.length) {
  const f = queue.pop();
  if (seen.has(f)) continue;
  seen.add(f);
  const code = readFileSync(path.join(assets, f), "utf8");
  for (const m of code.matchAll(/(?:from|import)"\.\/([A-Za-z0-9._-]+\.js)"/g)) queue.push(m[1]);
}
let gz = 0;
let raw = 0;
for (const f of seen) {
  const buf = readFileSync(path.join(assets, f));
  raw += buf.length;
  gz += gzipSync(buf).length;
}
const all = readdirSync(assets).filter((f) => f.endsWith(".js"));
console.log(`eager: ${seen.size} plików z ${all.length} js`);
console.log(`eager gzip: ${gz} B (${(gz / 1024).toFixed(2)} KB), raw: ${(raw / 1024).toFixed(2)} KB`);

// D0.1: generuje `docs/dane-mapa.md` — spis map Yjs z kategoriami z `src/lib/docMapsInventory.test.ts`.
// Uruchom: node scripts/dane-mapa.mjs
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";

const inv = readFileSync("src/lib/docMapsInventory.test.ts", "utf8");
const block = (name) => {
  const start = inv.indexOf(`const ${name}`);
  const body = inv.slice(inv.indexOf("{", start) + 1, inv.indexOf("\n};", start));
  return Object.fromEntries([...body.matchAll(/^\s*([A-Za-z0-9_]+):\s*"((?:[^"\\]|\\.)*)",?\s*$/gm)].map((m) => [m[1], m[2]]));
};
const preserves = block("PRESERVES");
const exempt = block("EXEMPT");
const constsLine = inv.slice(inv.indexOf("const CONSTS")).split("\n")[0];
const consts = Object.fromEntries([...constsLine.matchAll(/([A-Z_]+): "([A-Za-z]+)"/g)].map((m) => [m[1], m[2]]));

const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) files.push(p);
  }
})("src");

const where = new Map();
const add = (name, file) => {
  if (!where.has(name)) where.set(name, new Set());
  where.get(name).add(file.split(sep).join("/"));
};
for (const p of files) {
  for (const m of readFileSync(p, "utf8").matchAll(/getMap(?:<[^(]*>)?\(\s*(?:"([A-Za-z0-9_-]+)"|([A-Z_]+))\s*\)/g)) {
    const name = m[1] ?? consts[m[2]];
    if (name) add(name, p);
  }
}
// Grafik: nazwy składane na grafik (`shiftsMapName`) — jak w teście spisu.
for (const n of ["shiftTypes", "shiftDays", "shiftPatterns", "shiftBonuses", "shiftMeta", "shiftMigrations"]) add(n, "src/lib/shifts/yShifts.ts");

const rows = [...where.keys()].sort().map((name) => {
  const mods = [...where.get(name)].sort().map((f) => "`" + f.replace(/^src\//, "") + "`").join(", ");
  const kind = preserves[name] ? "zachowuje nieznane pola" : exempt[name] ? "wyjęta" : "**bez kategorii**";
  const why = preserves[name] ? "test: `" + preserves[name] + "`" : (exempt[name] ?? "");
  return `| \`${name}\` | ${mods} | ${kind} | ${why} |`;
});

writeFileSync("docs/dane-mapa.md", `# Mapy dokumentu Yjs (D0.1)

Wygenerowane przez \`node scripts/dane-mapa.mjs\` z kodu (\`getMap(…)\`) i kategorii w \`src/lib/docMapsInventory.test.ts\`. Nie edytuj ręcznie — popraw kategorię w teście i wygeneruj plik od nowa. Test pilnuje, żeby każda mapa miała kategorię; ten plik ją tylko pokazuje.

- **zachowuje nieznane pola** — wpis to zwykły obiekt, zapis scala go z surową wartością (\`mergeStored\`, \`toStored\` w \`src/lib/extraFields.ts\`); obok jest test „nieznane pole przeżywa edycję”.
- **wyjęta** — mapa pól (\`Y.Map\` na wpis), wartości proste albo mapa sterująca; uzasadnienie w kolumnie.

Mapy Grafiku (\`shift*\`) istnieją dla każdego grafiku z prefiksem identyfikatora (\`shiftsMapName\`); główny grafik jest bez prefiksu. Które sekcje pełnej kopii JSON niosą które dane — \`buildFullBackupWithReport\` w \`src/lib/exportNotes.ts\`. Bazy IndexedDB, klucze \`localStorage\` i migracje: \`docs/dane-spisy.md\`.

${where.size} map.

| Mapa | Moduły | Kategoria | Test albo uzasadnienie |
|---|---|---|---|
${rows.join("\n")}
`);
console.log(`docs/dane-mapa.md: ${where.size} map`);

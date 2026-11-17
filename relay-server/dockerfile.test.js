// Obraz Dockera musi zawierać każdy lokalny moduł, który importuje serwer (H4 przeglądu F2: brak `config.js`
// w `COPY` = kontener, który nie startuje). Sprawdzane bez budowania obrazu.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = import.meta.dirname;

function localImports(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  const src = readFileSync(join(dir, file), "utf8");
  for (const m of src.matchAll(/from\s+["']\.\/([^"']+)["']/g)) localImports(m[1], seen);
  return seen;
}

test("Dockerfile kopiuje wszystkie lokalne moduły serwera i ustawia produkcję", () => {
  const dockerfile = readFileSync(join(dir, "Dockerfile"), "utf8");
  const copied = new Set(dockerfile.split(/\r?\n/).filter((l) => l.startsWith("COPY ")).flatMap((l) => l.slice(5).trim().split(/\s+/).slice(0, -1)));
  for (const f of localImports("server.js")) assert.ok(copied.has(f), `Dockerfile nie kopiuje ${f}`);
  assert.match(dockerfile, /NODE_ENV=production/);
});

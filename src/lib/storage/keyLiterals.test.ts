import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { KEY_LITERAL_EXEMPT } from "./keyLiterals.exempt";

/**
 * D6.2 (`docs/plan-migracje-yjs-2026-11-15.md`): nazwa klucza `localStorage` jako literał `"kaczy…"` żyje tylko w
 * rejestrze (`src/lib/storage/keys.ts`). Pliki jeszcze nieprzeniesione są w `keyLiterals.exempt.ts`; lista może
 * tylko maleć — plik przeniesiony, a nadal na liście, też wywraca test.
 */
const ROOT = join(__dirname, "..", "..", "..");
const SRC = join(ROOT, "src");
const LITERAL = /["'`]kaczy[.:-]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return e.name === "test" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : [];
  });
}

/** Kod bez komentarzy — opis klucza w komentarzu nie jest użyciem. */
const codeOf = (text: string) =>
  text.split("\n").filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).map((l) => l.replace(/\s\/\/.*$/, "")).join("\n");

describe("literały kluczy localStorage (D6.2)", () => {
  const withLiteral = sourceFiles(SRC)
    .map((p) => relative(ROOT, p).replace(/\\/g, "/"))
    .filter((p) => p !== "src/lib/storage/keys.ts" && p !== "src/lib/storage/keyLiterals.exempt.ts")
    .filter((p) => LITERAL.test(codeOf(readFileSync(join(ROOT, p), "utf8"))))
    .sort();
  const exempt = new Set(KEY_LITERAL_EXEMPT);

  it("nowy literał tylko w rejestrze kluczy", () => {
    expect(withLiteral.filter((p) => !exempt.has(p))).toEqual([]);
  });

  it("lista wyjątków maleje: przeniesiony plik schodzi z listy", () => {
    expect(KEY_LITERAL_EXEMPT.filter((p) => !withLiteral.includes(p))).toEqual([]);
  });
});

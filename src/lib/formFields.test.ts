import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Pola formularzy na telefonie (plan UI 3.7). Test przechodzi po źródłach komponentów i pilnuje,
 * żeby pole liczbowe miało klawiaturę liczbową, a pole wyszukiwania klawisz „Szukaj”.
 * Dopasowuje tagi zapisane w kodzie, nie drzewo DOM — działa bez renderowania całej aplikacji.
 */

const SRC = join(__dirname, "..");

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) tsxFiles(p, out);
    else if (name.endsWith(".tsx") && !name.endsWith(".test.tsx")) out.push(p);
  }
  return out;
}

/**
 * Tagi pól (`<input`, `<Input`, `<textarea`, `<Textarea`) z atrybutami, także rozciągnięte na kilka linii.
 * Koniec tagu szukany poza nawiasami klamrowymi i cudzysłowami, bo `onChange={(e) => …}` zawiera `>`.
 */
function fieldTags(src: string): { tag: string; attrs: string; line: number }[] {
  const out: { tag: string; attrs: string; line: number }[] = [];
  const open = /<(input|Input|textarea|Textarea)\b/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let quote: string | null = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === "\"" || c === "'" || c === "`") { quote = c; continue; }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0) break;
    }
    out.push({ tag: m[1], attrs: src.slice(m.index + m[0].length, i), line: src.slice(0, m.index).split("\n").length });
  }
  return out;
}

const hasAttr = (attrs: string, name: RegExp) => name.test(attrs);

function violations(rule: (f: { tag: string; attrs: string }) => boolean): string[] {
  const bad: string[] = [];
  for (const file of tsxFiles(SRC)) {
    const src = readFileSync(file, "utf8");
    for (const f of fieldTags(src)) {
      if (!rule(f)) bad.push(`${relative(SRC, file).split(sep).join("/")}:${f.line}`);
    }
  }
  return bad;
}

describe("pola formularzy na telefonie (plan 3.7)", () => {
  it("przegląd obejmuje realną liczbę pól (skaner nie jest pusty)", () => {
    let total = 0;
    for (const file of tsxFiles(SRC)) total += fieldTags(readFileSync(file, "utf8")).length;
    expect(total).toBeGreaterThan(150);
  });

  it("każde pole type=\"number\" ma inputMode (klawiatura liczbowa)", () => {
    const bad = violations((f) => !/type\s*=\s*["']number["']/.test(f.attrs) || hasAttr(f.attrs, /\binputMode\s*=/));
    expect(bad, `bez inputMode: ${bad.join(", ")}`).toEqual([]);
  });

  it("każde pole type=\"search\" ma enterKeyHint=\"search\" (klawisz „Szukaj”)", () => {
    const bad = violations((f) => !/type\s*=\s*["']search["']/.test(f.attrs) || /enterKeyHint\s*=\s*["']search["']/.test(f.attrs));
    expect(bad, `bez enterKeyHint: ${bad.join(", ")}`).toEqual([]);
  });

  it("każde pole type=\"tel\" ma inputMode=\"tel\"", () => {
    const bad = violations((f) => !/type\s*=\s*["']tel["']/.test(f.attrs) || /inputMode\s*=\s*["']tel["']/.test(f.attrs));
    expect(bad, `bez inputMode=tel: ${bad.join(", ")}`).toEqual([]);
  });

  it("tytuł notatki (TitleField) zaczyna zdanie wielką literą i Enter idzie do treści", () => {
    const src = readFileSync(join(SRC, "components", "TitleField.tsx"), "utf8");
    expect(src).toMatch(/autoCapitalize="sentences"/);
    expect(src).toMatch(/enterKeyHint="next"/);
  });
});

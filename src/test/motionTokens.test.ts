import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { dur, ease } from "@/lib/motion";
import { readAppCss } from "@/test/appCss";

// Plan ruchu M1.2: czasy i krzywe są w dwóch miejscach — `--dur-*`/`--ease-*` w CSS (tokens.css) i ich lustro
// dla framer-motion w `src/lib/motion.ts`. Zmiana jednego bez drugiego rozjeżdża CSS i JS.
describe("M1.2 — tokeny ruchu CSS = motion.ts", () => {
  const css = readAppCss();
  const token = (name: string) => css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();

  it("czasy --dur-* w ms = dur w s", () => {
    for (const [k, s] of Object.entries(dur)) expect(token(`dur-${k}`), `--dur-${k}`).toBe(`${Math.round(s * 1000)}ms`);
  });

  it("krzywe --ease-* = ease", () => {
    for (const [k, curve] of Object.entries(ease)) expect(token(`ease-${k}`), `--ease-${k}`).toBe(`cubic-bezier(${curve.join(", ")})`);
  });
});

// M1.5: czas animacji tylko z tokenu (`duration-press|fast|base|slow`, `dur.*`). Zostają wyjątki, które mogą tylko maleć:
// - `duration-500`/`duration-1000` liniowo w licznikach, gdzie czas przejścia = odstęp tyknięcia (przerwa w treningu, próba ciśnienia);
// - literały `duration: 0.x` w dekoracjach framer-motion (pieczątka osiągnięcia ×2, pisanie wordmarku, przewijanie liczby).
const SRC = resolve(process.cwd(), "src");
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return name.endsWith(".tsx") && !name.includes(".test.") ? [path] : [];
  });
}
const SOURCES = tsxFiles(SRC).map((path) => readFileSync(path, "utf8"));
const count = (re: RegExp) => SOURCES.reduce((n, text) => n + (text.match(re)?.length ?? 0), 0);

describe("M1.5 — czasy animacji z tokenów", () => {
  it("klasy duration-<liczba>: co najwyżej 2 (liczniki)", () => {
    expect(count(/(?<![\w-])duration-\d+(?![\w-])/g)).toBeLessThanOrEqual(2);
  });
  it("literały duration: 0.x w .tsx: co najwyżej 4 (dekoracje)", () => {
    expect(count(/duration:\s*0\.\d/g)).toBeLessThanOrEqual(4);
  });
});

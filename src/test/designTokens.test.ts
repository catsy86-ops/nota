import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Strażnik systemu projektowego (plan UI/UX 2026-10-25, Faza 0.3): liczy surowe klasy,
// które Faza 1 ma zastąpić tokenami — promienie `rounded-md/lg/xl/3xl`, cienie `shadow-md/lg/2xl`
// i warstwy `z-10…z-70` wpisywane ręcznie. Progi to stan z dnia wprowadzenia testu.
// Faza 1 obniża je w miarę codemodów; liczba nie może rosnąć, więc nowy kod bierze tokeny.
// 2026-10-27 (plan motywów 0.1): progi = stan po codemodach. Zostało 11 `rounded-sm` — elementy
// wewnątrz kontrolek (pozycje menu, zakładki, checkbox, pieczątka), liczone od `--radius` w
// tailwind.config.ts, więc idą za kształtem motywu; nowe miejsca biorą `rounded-control`.

const SRC = resolve(process.cwd(), "src");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return name.endsWith(".tsx") ? [path] : [];
  });
}

const SOURCES = tsxFiles(SRC).map((path) => ({ path, text: readFileSync(path, "utf8") }));

function count(pattern: RegExp): number {
  return SOURCES.reduce((sum, { text }) => sum + (text.match(pattern)?.length ?? 0), 0);
}

const LIMITS = {
  // Lookbehind/lookahead, żeby `rounded-lg` nie łapało np. `my-rounded-lg-x`, a `z-10` nie łapało `fz-10`.
  rawRadius: { pattern: /(?<![\w-])rounded-(?:lg|xl|md|sm|3xl)(?![\w-])/g, max: 11, token: "rounded-field / rounded-card / rounded-control" },
  rawShadow: { pattern: /(?<![\w-])shadow-(?:md|lg|2xl)(?![\w-])/g, max: 0, token: "shadow-elevation-1..3" },
  rawZIndex: { pattern: /(?<![\w-])z-\d+(?![\w-])/g, max: 0, token: "z-sticky / z-dropdown / z-overlay / z-modal / z-toast" },
} as const;

describe("tokeny projektowe — surowe klasy nie przybywają", () => {
  for (const [name, { pattern, max, token }] of Object.entries(LIMITS)) {
    it(`${name}: co najwyżej ${max} wystąpień (zamiast tego: ${token})`, () => {
      expect(count(pattern)).toBeLessThanOrEqual(max);
    });
  }
});

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
  // Plan UI 2026-11-06, 1.7: progi = stan z 2026-11-06; Etapy 2 i 5 je obniżają.
  // Rozmiar tekstu w px/rem omija skalę i `--text-scale`.
  pxText: { pattern: /(?<![\w-])text-\[\d+(?:\.\d+)?(?:px|rem)\]/g, max: 10, token: "text-2xs / text-xs / text-sm" },
  // Goły `rounded` (0.25rem) nie idzie za kształtem motywu (`--shape`).
  bareRadius: { pattern: /(?<![\w-])rounded(?![\w-[])/g, max: 38, token: "rounded-control / rounded-field" },
  // `shadow` i `shadow-sm` to dwie nazwy na `--elevation-1`.
  bareShadow: { pattern: /(?<![\w-])shadow(?:-sm)?(?![\w-[])/g, max: 24, token: "shadow-elevation-1" },
  // Zmienna `--radius-*` nie istnieje — promienie to `--r-control/field/card`.
  missingRadiusVar: { pattern: /var\(--radius-/g, max: 0, token: "var(--r-field) itd." },
  // Blady przycisk wygląda na zepsuty (nowy plan 2.4) — nieaktywny szarzeje kolorem.
  disabledOpacity: { pattern: /(?<![\w-])disabled:opacity-\d+/g, max: 30, token: "disabled:text-muted-foreground / Button" },
} as const;

describe("tokeny projektowe — surowe klasy nie przybywają", () => {
  for (const [name, { pattern, max, token }] of Object.entries(LIMITS)) {
    it(`${name}: co najwyżej ${max} wystąpień (zamiast tego: ${token})`, () => {
      expect(count(pattern)).toBeLessThanOrEqual(max);
    });
  }
});

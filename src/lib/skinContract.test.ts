import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SKINS, SKIN_SCHEME, type Skin } from "@/lib/skins";

// Kontrakt tokenów skórek (plan motywów 2026-10-27, 0.2). Skórka, która nie zdefiniuje tokenu,
// cicho bierze wartość Zeszytu (`:root` / `.dark` w index.css) — np. jasny kolor notatki na granacie.
// Test wymaga pełnego kompletu w każdej skórce i pilnuje, żeby selektory nie wskazywały
// nieistniejącej skórki (tak przez tydzień nie działały cieńsze ikony Matrycy: `data-skin="matryca"`).

const STYLES = resolve(process.cwd(), "src");

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return name.endsWith(".css") ? [path] : [];
  });
}

const CSS = cssFiles(STYLES).map((path) => ({ path, text: readFileSync(path, "utf8") }));

/** Tokeny kolorów i głębi — każda skórka (i oba schematy Zeszytu) definiuje je sama. */
const SKIN_TOKENS = [
  "--background", "--foreground", "--card", "--card-foreground", "--popover", "--popover-foreground",
  "--primary", "--primary-foreground", "--ink-mix", "--secondary", "--secondary-foreground",
  "--muted", "--muted-foreground", "--accent", "--accent-foreground",
  "--destructive", "--destructive-foreground", "--border", "--input", "--ring",
  "--grid", "--margin",
  "--note-default", "--note-coral", "--note-peach", "--note-sand", "--note-mint",
  "--note-sage", "--note-sky", "--note-lavender", "--note-rose",
  "--elevation-1", "--elevation-2", "--elevation-3", "--elevation-up", "--glow-primary",
] as const;

/** Sygnatura ruchu (plan rozbudowy 1b) — każda skórka, łącznie z Zeszytem. */
const MOTION_TOKENS = ["--sig-ease", "--sig-dur"] as const;

/** Nazwy tokenów zdefiniowanych w blokach o dokładnie tym selektorze (bez potomków). */
function tokensOf(selector: RegExp): Set<string> {
  const found = new Set<string>();
  for (const { text } of CSS) {
    const re = new RegExp(`(?:^|[\\n,}])\\s*${selector.source}\\s*\\{([^{}]*)\\}`, "g");
    for (const block of text.matchAll(re)) {
      for (const t of block[1].matchAll(/(--[\w-]+)\s*:/g)) found.add(t[1]);
    }
  }
  return found;
}

const escape = (s: string) => s.replace(/[[\]"().]/g, (c) => `\\${c}`);
const skinSelector = (skin: string) => new RegExp(escape(`html[data-skin="${skin}"]`));
/** Drugi schemat stylu (plan motywów 4.1): jasny wariant ciemnego stylu albo odwrotnie. */
const altSelector = (skin: Skin) =>
  new RegExp(escape(`html[data-skin="${skin}"]${SKIN_SCHEME[skin] === "dark" ? ":not(.dark)" : ".dark"}`));

describe("kontrakt tokenów skórek", () => {
  for (const skin of SKINS) {
    it(`${skin}: komplet tokenów`, () => {
      const own = tokensOf(skinSelector(skin));
      const sets =
        SKIN_SCHEME[skin] === null
          ? [new Set([...own, ...tokensOf(/:root/)]), new Set([...own, ...tokensOf(/\.dark/)])]
          : [own];
      for (const defined of sets) {
        expect(SKIN_TOKENS.filter((t) => !defined.has(t)), "brakujące tokeny").toEqual([]);
      }
      expect(MOTION_TOKENS.filter((t) => !own.has(t)), "brakująca sygnatura ruchu").toEqual([]);
    });
    if (skin !== "zeszyt") {
      it(`${skin}: drugi schemat ma pełny komplet tokenów`, () => {
        const alt = tokensOf(altSelector(skin));
        expect(SKIN_TOKENS.filter((t) => !alt.has(t)), "brakujące tokeny drugiego schematu").toEqual([]);
      });
    }
  }

  // Dwie `@keyframes` o tej samej nazwie: wygrywa późniejsza i cicho psuje pierwszą animację
  // (tak fala zapisu Zorzy była niewidoczna, bo przejęła ją animacja wejścia gwiazd).
  it("nazwy `@keyframes` są unikalne w całym CSS", () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const { path, text } of CSS) {
      for (const m of text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/@keyframes\s+([\w-]+)/g)) {
        if (seen.has(m[1])) dupes.push(`${m[1]} (${seen.get(m[1])} i ${path})`);
        else seen.set(m[1], path);
      }
    }
    expect(dupes).toEqual([]);
  });

  it("selektory `data-skin` wskazują tylko istniejące skórki", () => {
    const unknown = new Set<string>();
    for (const { path, text } of CSS) {
      for (const m of text.matchAll(/data-skin=["']?([\w-]+)/g)) {
        if (!(SKINS as readonly string[]).includes(m[1])) unknown.add(`${m[1]} (${path})`);
      }
    }
    expect([...unknown]).toEqual([]);
  });
});

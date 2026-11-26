import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Strażnik słownika okna Ustawień (plan Ustawień 1.2): w tekstach dla użytkownika „kopia”, nie „backup”, oraz
// „styl”, „krój”, nie „skórka”, „czcionka”. Sprawdza tylko napisy ze spacją i tekst JSX — klucze, identyfikatory
// i słowa wyszukiwania (`words` w `settingsIndex.ts`, którego tu nie ma) mogą zostać po staremu.

const SRC = resolve(process.cwd(), "src");
const FILES = [
  ...readdirSync(join(SRC, "components/settings")).map((name) => join(SRC, "components/settings", name)),
  join(SRC, "components/SettingsDialog.tsx"),
  join(SRC, "components/SyncSettings.tsx"),
  join(SRC, "hooks/useBackupReminders.ts"),
].filter((path) => statSync(path).isFile() && /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path));

const FORBIDDEN = /\b(backup\w*|skórk\w*|czcionk\w*)/i;

/** Napisy w cudzysłowach i odwróconych apostrofach oraz tekst między znacznikami JSX, bez komentarzy. */
function visibleTexts(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const literals = Array.from(code.matchAll(/"([^"\n]*)"|`([^`]*)`/g), (m) => (m[1] ?? m[2]).replace(/\$\{[^}]*\}/g, ""));
  const jsxText = Array.from(code.matchAll(/>([^<>{}\n]*[\p{L}][^<>{}\n]*)</gu), (m) => m[1]);
  return [...literals, ...jsxText].filter((text) => /\s/.test(text.trim()));
}

describe("słownik okna Ustawień", () => {
  it("bez „backup”, „skórka”, „czcionka” w tekstach dla użytkownika", () => {
    const offenders = FILES.flatMap((path) =>
      visibleTexts(readFileSync(path, "utf8"))
        // Identyfikatory w camelCase (np. `backupReminderDays` z zagnieżdżonego `${…}`) to kod, nie tekst.
        .filter((text) => FORBIDDEN.test(text.replace(/\b\w*[a-z][A-Z]\w*/g, "")))
        .map((text) => `${basename(path)}: ${text.trim().slice(0, 80)}`),
    );
    expect(offenders).toEqual([]);
  });
});

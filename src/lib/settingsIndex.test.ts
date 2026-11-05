import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SETTINGS_INDEX, searchSettings } from "./settingsIndex";

const dir = resolve(process.cwd(), "src/components/settings");
const sources = [
  ...readdirSync(dir).filter((f) => f.endsWith(".tsx") && !f.includes(".test.")).map((f) => join(dir, f)),
  resolve(process.cwd(), "src/components/SyncSettings.tsx"),
].map((p) => readFileSync(p, "utf8")).join("\n");

describe("indeks Ustawień w palecie", () => {
  it.each(SETTINGS_INDEX.map((e) => e.title))("sekcja „%s” nadal istnieje w kodzie Ustawień", (title) => {
    expect(sources).toContain(`title="${title}"`);
  });

  it("szuka bez polskich znaków i po słowach zastępczych", () => {
    expect(searchSettings("krój")[0]?.title).toBe("Krój tekstu");
    expect(searchSettings("czcionka").map((e) => e.title)).toContain("Krój tekstu");
    expect(searchSettings("skarbiec")[0]).toMatchObject({ title: "Prywatne notatki", tab: "general" });
    expect(searchSettings("jasnosc")[0]?.title).toBe("Jasność");
  });

  it("puste i jednoznakowe zapytanie nic nie zwraca", () => {
    expect(searchSettings("")).toEqual([]);
    expect(searchSettings("a")).toEqual([]);
  });
});

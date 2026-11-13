import { describe, expect, it } from "vitest";
import { highlightCode, knownCodeLanguage, HIGHLIGHT_MAX_CHARS } from "./codeHighlight";

describe("kolorowanie bloków kodu (plan Notatek 5.3)", () => {
  it("rozpoznaje języki i aliasy bez rozróżniania wielkości liter", () => {
    for (const n of ["js", "ts", "TSX", "json", "sql", "py", "yml", "html"]) expect(knownCodeLanguage(n), n).toBe(true);
    expect(knownCodeLanguage("brainfuck")).toBe(false);
  });

  it("dzieli kod na fragmenty z klasami tok-*, a złożone z powrotem daje oryginał", async () => {
    const code = "const x = 42; // liczba\nconst s = \"tekst\";";
    const spans = await highlightCode(code, "js");
    expect(spans).not.toBeNull();
    expect(spans!.map((s) => s.text).join("")).toBe(code);
    expect(spans!.some((s) => s.cls?.includes("tok-keyword"))).toBe(true);
    expect(spans!.some((s) => s.cls?.includes("tok-comment"))).toBe(true);
    expect(spans!.some((s) => s.cls?.includes("tok-string"))).toBe(true);
  });

  it("koloruje też dane i zapytania", async () => {
    const json = await highlightCode('{"a": 1, "b": [true]}', "json");
    expect(json!.some((s) => s.cls?.includes("tok-number"))).toBe(true);
    const sql = await highlightCode("SELECT id FROM notatki WHERE id = 1;", "sql");
    expect(sql!.some((s) => s.cls?.includes("tok-keyword"))).toBe(true);
  });

  it("nieznany język i zbyt długi blok zostają zwykłym tekstem", async () => {
    expect(await highlightCode("x", "brainfuck")).toBeNull();
    expect(await highlightCode("a".repeat(HIGHLIGHT_MAX_CHARS + 1), "js")).toBeNull();
  });
});

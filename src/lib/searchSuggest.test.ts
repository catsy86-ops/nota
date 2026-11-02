import { describe, expect, it } from "vitest";
import { emptySuggestions, suggestOperators } from "./searchSuggest";

describe("puste pole i opisy (rozbudowa wyszukiwarki, 2026-11-02)", () => {
  it("puste pole: ostatnie wyszukiwania, szybkie filtry z opisem, „Wyczyść ostatnie”", () => {
    const items = emptySuggestions(["rury", "etykieta:praca"]);
    expect(items.slice(0, 2)).toEqual([
      { label: "rury", insert: "rury", hint: "ostatnio", kind: "recent" },
      { label: "etykieta:praca", insert: "etykieta:praca", hint: "ostatnio", kind: "recent" },
    ]);
    expect(items.filter((s) => s.kind === "operator").map((s) => s.label)).toEqual(["ma:przypomnienie", "przypięte", "lista:otwarte", "nowsze:7d"]);
    expect(items.at(-1)).toMatchObject({ kind: "clear" });
    expect(emptySuggestions([]).some((s) => s.kind === "clear")).toBe(false);
  });

  it("operatory i nazwy mają opis", () => {
    expect(suggestOperators("ma:p", { labels: [], folders: [] }).items[0]).toMatchObject({ label: "ma:przypomnienie", hint: "z przypomnieniem" });
    expect(suggestOperators("etykieta:dom", { labels: ["domowe"], folders: [] }).items[0]).toMatchObject({ label: "domowe", hint: "etykieta", kind: "value" });
  });
});

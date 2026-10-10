import { describe, expect, it } from "vitest";
import { findMatches, replaceAll, replaceAt } from "./findReplace";

describe("findReplace", () => {
  it("znajduje bez rozróżniania wielkości liter, także polskich znaków", () => {
    expect(findMatches("Żaba i żaba", "żABA")).toEqual([0, 7]);
  });

  it("rozróżnia wielkość liter na życzenie", () => {
    expect(findMatches("Kot kot", "kot", { caseSensitive: true })).toEqual([4]);
  });

  it("puste zapytanie nic nie znajduje, wystąpienia się nie nakładają", () => {
    expect(findMatches("aaa", "")).toEqual([]);
    expect(findMatches("aaaa", "aa")).toEqual([0, 2]);
  });

  it("zamienia jedno i wszystkie wystąpienia", () => {
    expect(replaceAt("a-b-c", 1, 1, "+")).toBe("a+b-c");
    expect(replaceAll("a-b-c", "-", "")).toEqual({ text: "abc", count: 2 });
    expect(replaceAll("abc", "x", "y")).toEqual({ text: "abc", count: 0 });
  });

  it("zamiana na tekst zawierający zapytanie nie zapętla się", () => {
    expect(replaceAll("ab", "a", "aa")).toEqual({ text: "aab", count: 1 });
  });
});

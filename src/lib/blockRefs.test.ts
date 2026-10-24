import { describe, it, expect } from "vitest";
import { blockIdOfHeading, blockIdOfLine, blockRefQuery, findBlock, listBlockIds, stripBlockId } from "./blockRefs";

const note = [
  "# Plan",
  "Pierwszy akapit ^wstep",
  "drugi wiersz tego akapitu",
  "",
  "- punkt jeden ^p1",
  "- punkt dwa",
  "  kontynuacja dwa",
  "",
  "## Sekcja ^nag",
  "Tekst pod nagłówkiem ^zolw",
].join("\n");

describe("blockIdOfLine / stripBlockId", () => {
  it("znacznik na końcu linii po spacji", () => {
    expect(blockIdOfLine("Tekst ^abc")).toBe("abc");
    expect(blockIdOfLine("Tekst ^abc  ")).toBe("abc");
    expect(blockIdOfLine("^abc")).toBe("abc");
    expect(stripBlockId("Tekst ^abc")).toBe("Tekst");
  });

  it("nie łapie ^ w środku ani bez spacji przed id", () => {
    expect(blockIdOfLine("2^3 to potęga")).toBeNull();
    expect(blockIdOfLine("Tekst^abc")).toBeNull();
    expect(blockIdOfLine("Tekst ^abc i dalej")).toBeNull();
    expect(stripBlockId("2^3 to potęga")).toBe("2^3 to potęga");
  });

  it("polskie litery w id", () => {
    expect(blockIdOfLine("Zakup ^zażółć")).toBe("zażółć");
  });
});

describe("blockIdOfHeading", () => {
  it("nagłówek ^id daje id, zwykły nagłówek nie", () => {
    expect(blockIdOfHeading("^abc")).toBe("abc");
    expect(blockIdOfHeading("Sekcja")).toBeNull();
    expect(blockIdOfHeading("^")).toBeNull();
    expect(blockIdOfHeading(null)).toBeNull();
  });
});

describe("findBlock", () => {
  it("akapit z id — cały, bez znacznika", () => {
    expect(findBlock(note, "wstep")).toBe("Pierwszy akapit\ndrugi wiersz tego akapitu");
  });

  it("punkt listy to osobny blok, z kontynuacją", () => {
    expect(findBlock(note, "p1")).toBe("- punkt jeden");
  });

  it("nagłówek z id to jednolinijkowy blok; dopasowanie bez względu na wielkość liter", () => {
    expect(findBlock(note, "NAG")).toBe("## Sekcja");
    expect(findBlock(note, "zolw")).toBe("Tekst pod nagłówkiem");
  });

  it("brak id → null", () => {
    expect(findBlock(note, "nie-ma")).toBeNull();
    expect(findBlock(note, "  ")).toBeNull();
  });
});

describe("listBlockIds", () => {
  it("kolejność występowania, bez duplikatów", () => {
    expect(listBlockIds(note)).toEqual(["wstep", "p1", "nag", "zolw"]);
    expect(listBlockIds("a ^x\n\nb ^x")).toEqual(["x"]);
  });
});

describe("blockRefQuery", () => {
  it("dzieli zapytanie po #^", () => {
    expect(blockRefQuery("Plan#^we")).toEqual({ title: "Plan", prefix: "we" });
    expect(blockRefQuery("Plan#^")).toEqual({ title: "Plan", prefix: "" });
    expect(blockRefQuery("Plan#Sekcja")).toBeNull();
    expect(blockRefQuery("Plan")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { firstSnippet, matchParts } from "./searchHighlight";

const hits = (text: string, tokens: string[]) => matchParts(text, tokens).filter((p) => p.hit).map((p) => p.text);

describe("matchParts", () => {
  it("bez tokenów i bez trafień zwraca cały tekst jako zwykły", () => {
    expect(matchParts("Zakup", [])).toEqual([{ text: "Zakup", hit: false }]);
    expect(matchParts("Zakup", ["kot"])).toEqual([{ text: "Zakup", hit: false }]);
  });

  it("wielkość liter bez znaczenia", () => {
    expect(hits("Plan Tygodnia", ["plan"])).toEqual(["Plan"]);
  });

  it("dopasowuje bez ogonków: „zolw” trafia w „żółw”, zaznaczając oryginał", () => {
    expect(hits("Mały żółw", ["zolw"])).toEqual(["żółw"]);
    expect(hits("Łódź", ["lodz"])).toEqual(["Łódź"]);
  });

  it("wiele trafień i wiele tokenów, bez nakładania", () => {
    expect(hits("ala ma kota, kot ma ale", ["kot", "ala"])).toEqual(["ala", "kot", "kot"]);
  });

  it("nakładające się zakresy łączą się w jeden", () => {
    expect(hits("abcdef", ["abc", "bcd"])).toEqual(["abcd"]);
  });

  it("zachowuje cały tekst po złożeniu fragmentów", () => {
    const text = "Zolw żółw ZÓŁW";
    expect(matchParts(text, ["zolw"]).map((p) => p.text).join("")).toBe(text);
  });
});

describe("firstSnippet", () => {
  it("zwraca pierwsze trafienie z kontekstem", () => {
    const s = firstSnippet("Na początku jest szukane słowo i dalej tekst", ["szukane"]);
    expect(s).toEqual({ before: "Na początku jest ", match: "szukane", after: " słowo i dalej tekst" });
  });

  it("brak trafienia → null", () => {
    expect(firstSnippet("nic tu nie ma", ["xyz"])).toBeNull();
  });

  it("długi kontekst jest przycinany wielokropkiem", () => {
    const long = "a".repeat(100) + "KOT" + "b".repeat(100);
    const s = firstSnippet(long, ["kot"], 10);
    expect(s?.before.startsWith("…")).toBe(true);
    expect(s?.after.endsWith("…")).toBe(true);
    expect(s?.match).toBe("KOT");
  });
});

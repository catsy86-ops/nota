import { describe, expect, it } from "vitest";
import { countWords, statsLabel, textStats } from "./textStats";

describe("textStats", () => {
  it("pusty tekst: zera, bez czasu czytania", () => {
    expect(textStats("")).toEqual({ words: 0, chars: 0, minutes: 0 });
    expect(textStats("  \n ")).toMatchObject({ words: 0, minutes: 0 });
  });
  it("liczy słowa przy różnych białych znakach i polskich znakach", () => {
    expect(countWords("zażółć  gęślą\njaźń\tdziś")).toBe(4);
  });
  it("czas czytania jest co najmniej 1 min", () => {
    expect(textStats("jedno słowo").minutes).toBe(1);
    expect(textStats("a ".repeat(440)).minutes).toBe(2);
  });
});

describe("statsLabel", () => {
  it("bez zaznaczenia: słowa, znaki, czas", () => {
    expect(statsLabel("ala ma kota")).toBe("3 słowa · 11 znaków · ~1 min czytania");
    expect(statsLabel("")).toBe("0 słów · 0 znaków");
  });
  it("z zaznaczeniem: liczby zaznaczenia", () => {
    expect(statsLabel("ala ma kota", 0, 6)).toBe("Zaznaczono 2 słowa · 6 znaków");
    expect(statsLabel("ala ma kota", 0, 3)).toBe("Zaznaczono 1 słowo · 3 znaki");
  });
  it("zaznaczenie samych spacji wraca do statystyk całości", () => {
    expect(statsLabel("a   b", 1, 4)).toBe("2 słowa · 5 znaków · ~1 min czytania");
  });
});

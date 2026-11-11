import { describe, it, expect } from "vitest";
import { cleanDimensions, dimensionsLine, DIMENSION_TEXT_MAX, MAX_DIMENSIONS_PER_IMAGE } from "./dimensions";

const d = (text: string, from: unknown = [0.1, 0.2], to: unknown = [0.5, 0.6]) => ({ from, to, text });

describe("dimensions", () => {
  it("cleanDimensions: nie-tablica daje pustą listę", () => {
    expect(cleanDimensions(undefined)).toEqual([]);
    expect(cleanDimensions("x")).toEqual([]);
    expect(cleanDimensions({})).toEqual([]);
  });

  it("zwija białe znaki i ucina opis do limitu", () => {
    expect(cleanDimensions([d("  35   cm\n od  narożnika ")])[0]?.text).toBe("35 cm od narożnika");
    expect(cleanDimensions([d("x".repeat(DIMENSION_TEXT_MAX + 30))])[0]?.text).toHaveLength(DIMENSION_TEXT_MAX);
  });

  it("odrzuca punkty poza 0–1, złe kształty i pusty opis", () => {
    expect(cleanDimensions([d("a", [1.2, 0.5])])).toEqual([]);
    expect(cleanDimensions([d("a", [-0.1, 0.5])])).toEqual([]);
    expect(cleanDimensions([d("a", [0.1])])).toEqual([]);
    expect(cleanDimensions([d("a", [NaN, 0.5])])).toEqual([]);
    expect(cleanDimensions([d("a", "oops")])).toEqual([]);
    expect(cleanDimensions([d("   ")])).toEqual([]);
    expect(cleanDimensions([null, 5, d("ok")])).toHaveLength(1);
  });

  it("zostawia punkty brzegowe 0 i 1", () => {
    expect(cleanDimensions([d("kraj", [0, 0], [1, 1])])).toEqual([{ from: [0, 0], to: [1, 1], text: "kraj" }]);
  });

  it("bierze najwyżej 20 wymiarów", () => {
    const many = Array.from({ length: MAX_DIMENSIONS_PER_IMAGE + 5 }, (_, i) => d(`w${i}`));
    expect(cleanDimensions(many)).toHaveLength(MAX_DIMENSIONS_PER_IMAGE);
  });

  it("dimensionsLine: kolejność zapisu, pusty dla braku", () => {
    expect(dimensionsLine(cleanDimensions([d("35 cm"), d("120 cm")]))).toBe("35 cm, 120 cm");
    expect(dimensionsLine(undefined)).toBe("");
    expect(dimensionsLine([])).toBe("");
  });
});

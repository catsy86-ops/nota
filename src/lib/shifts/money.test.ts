import { describe, expect, it } from "vitest";
import { parseMoney } from "./money";

describe("parseMoney", () => {
  it.each([
    ["32,50", 32.5],
    ["32.50", 32.5],
    ["32", 32],
    ["1 000", 1000],
    ["1 000,50", 1000.5],
    ["1.000,50", 1000.5],
    ["1,000.50", 1000.5],
    ["  40 ", 40],
  ])("odczytuje %s jako %s", (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it("pusta wartość to 0, nie błąd", () => {
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("   ")).toBe(0);
  });

  it.each(["abc", "1,2,3", "12zł", "-5", "1,555", "NaN"])("odrzuca %s", (input) => {
    expect(parseMoney(input)).toBeNull();
  });
});

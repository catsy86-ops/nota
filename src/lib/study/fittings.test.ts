import { describe, expect, it } from "vitest";
import { cleanFittings, FITTINGS_MAX, fittingsLine, suggestFittingNames, sumFittings } from "./fittings";

describe("kształtki", () => {
  it("cleanFittings: śmieci odpadają, liczby całkowite, ta sama nazwa się sumuje", () => {
    expect(cleanFittings("x")).toEqual([]);
    expect(cleanFittings([
      { name: " Kolano  16 ", qty: 3.7 },
      { name: "kolano 16", qty: 2 },
      { name: "", qty: 4 },
      { name: "Trójnik 16", qty: 0 },
      { name: "Złączka 20", qty: 1 },
      { name: "Bez liczby" },
    ])).toEqual([{ name: "Kolano 16", qty: 5 }, { name: "Złączka 20", qty: 1 }]);
    expect(cleanFittings(Array.from({ length: 30 }, (_, i) => ({ name: `K${i}`, qty: 1 })))).toHaveLength(FITTINGS_MAX);
  });

  it("sumFittings: suma z wielu wpisów bez względu na pisownię, od największej", () => {
    expect(sumFittings([[{ name: "Kolano 16", qty: 4 }], undefined, [{ name: "KOLANO 16", qty: 2 }, { name: "Trójnik 16", qty: 9 }]])).toEqual([
      { name: "Trójnik 16", qty: 9 },
      { name: "Kolano 16", qty: 6 },
    ]);
  });

  it("fittingsLine i podpowiedzi: najpierw używane, bez już wpisanych", () => {
    expect(fittingsLine([{ name: "Kolano 16", qty: 4 }, { name: "Trójnik 16", qty: 2 }])).toBe("Kolano 16 × 4, Trójnik 16 × 2");
    const s = suggestFittingNames([[{ name: "Mufa 32", qty: 7 }, { name: "Kolano 16", qty: 1 }]], ["kolano 16"]);
    expect(s[0]).toBe("Mufa 32");
    expect(s).not.toContain("Kolano 16");
    expect(s).toContain("Trójnik 16");
  });
});

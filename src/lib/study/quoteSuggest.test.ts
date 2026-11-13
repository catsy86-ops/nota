import { describe, expect, it } from "vitest";
import { materialChips, suggestPrice } from "./quoteSuggest";

const pricing = { items: [{ id: "p1", name: "WC podwieszane", price: 350, pointType: "H-4", createdAt: 1 }] };

describe("podpowiedzi do wyceny (4.2)", () => {
  it("chipy materiału: tylko kształtki z katalogu, które mają cenę, z poprawną nazwą", () => {
    expect(materialChips({})).toEqual([]);
    expect(materialChips({ "trojnik 16": 6, "kolano 16": 4.5, "inna rzecz": 1 })).toEqual([
      { name: "Kolano 16", price: 4.5 },
      { name: "Trójnik 16", price: 6 },
    ]);
  });

  it("cena po nazwie: materiał z cennika kształtek, robocizna z cennika robocizny, bez ogonków i wielkości liter", () => {
    expect(suggestPrice("material", "  TRÓJNIK  16 ", pricing, { "trojnik 16": 6 })).toBe(6);
    expect(suggestPrice("labor", "wc Podwieszane", pricing, {})).toBe(350);
    // Rodzaje się nie mieszają: robocizna nie bierze ceny materiału i odwrotnie.
    expect(suggestPrice("labor", "trójnik 16", pricing, { "trojnik 16": 6 })).toBeUndefined();
    expect(suggestPrice("material", "wc podwieszane", pricing, {})).toBeUndefined();
    expect(suggestPrice("material", "   ", pricing, { "": 3 })).toBeUndefined();
  });
});

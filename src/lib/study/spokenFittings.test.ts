import { describe, expect, it } from "vitest";
import { mergeFittings, parseSpokenFittings, wordsToDigits } from "./spokenFittings";
import { FITTING_SUGGESTIONS } from "./fittings";

describe("wordsToDigits", () => {
  it("zamienia liczebniki na cyfry, także złożone", () => {
    expect(wordsToDigits("kolano szesnaście cztery sztuki")).toBe("kolano 16 4 sztuki");
    expect(wordsToDigits("złączka dwadzieścia pięć")).toBe("złączka 25");
    expect(wordsToDigits("trójnik dwadzieścia")).toBe("trójnik 20");
  });
});

describe("parseSpokenFittings", () => {
  it("rozpoznaje kilka pozycji z cyframi i słowem „sztuki”", () => {
    expect(parseSpokenFittings("kolano 16 4 sztuki, trójnik 16 2 sztuki")).toEqual([
      { name: "Kolano 16", qty: 4 },
      { name: "Trójnik 16", qty: 2 },
    ]);
  });

  it("rozumie liczby słownie i liczbę na początku („cztery kolana szesnaście”)", () => {
    expect(parseSpokenFittings("cztery kolana szesnaście i trzy złączki dwadzieścia")).toEqual([
      { name: "Kolano 16", qty: 4 },
      { name: "Złączka 20", qty: 3 },
    ]);
  });

  it("ostatnia z dwóch liczb to sztuki („trójnik 16 dwa”), jedna liczba to wymiar", () => {
    expect(parseSpokenFittings("trójnik 16 dwa")).toEqual([{ name: "Trójnik 16", qty: 2 }]);
    expect(parseSpokenFittings("kolano 16")).toEqual([{ name: "Kolano 16", qty: 1 }]);
  });

  it("„20 na 16” to wymiar redukcji, nie liczba sztuk", () => {
    expect(parseSpokenFittings("redukcja dwadzieścia na szesnaście dwie sztuki")).toEqual([{ name: "Redukcja 20/16", qty: 2 }]);
  });

  it("mnożnik „x 3” i „3x” po nazwie", () => {
    expect(parseSpokenFittings("mufa 32 x 3; korek 1/2 2x")).toEqual([
      { name: "Mufa 32", qty: 3 },
      { name: "Korek 1/2", qty: 2 },
    ]);
  });

  it("przyjmuje pisownię znanej nazwy i sumuje powtórzenia", () => {
    const parsed = parseSpokenFittings("kolano naścienne 16 dwa, kolano naścienne szesnaście jeden", FITTING_SUGGESTIONS);
    expect(parsed).toEqual([{ name: "Kolano naścienne 16", qty: 3 }]);
  });

  it("pomija same liczby i puste kawałki", () => {
    expect(parseSpokenFittings("16, , cztery")).toEqual([]);
  });
});

describe("mergeFittings", () => {
  it("sumuje tę samą nazwę, nowe dokłada na koniec, a pusty wiersz wypełnia", () => {
    const current = [{ name: "Kolano 16", qty: 2 }, { name: "", qty: 1 }];
    expect(mergeFittings(current, [{ name: "kolano 16", qty: 3 }, { name: "Trójnik 16", qty: 1 }, { name: "Mufa 32", qty: 2 }])).toEqual([
      { name: "Kolano 16", qty: 5 },
      { name: "Trójnik 16", qty: 1 },
      { name: "Mufa 32", qty: 2 },
    ]);
  });

  it("nie przekracza limitu pozycji", () => {
    const full = Array.from({ length: 20 }, (_, i) => ({ name: `K${i}`, qty: 1 }));
    expect(mergeFittings(full, [{ name: "Nowa", qty: 1 }])).toHaveLength(20);
  });
});

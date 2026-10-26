import { describe, it, expect } from "vitest";
import { cleanWeight, parseKg, weightTrend, type WeightEntry } from "./model";

const e = (day: string, kg: number): WeightEntry => ({ day, kg, created: 1 });

describe("masa ciała: model (C-2)", () => {
  it("parseKg przyjmuje przecinek, zaokrągla do 0,1 i odrzuca poza zakresem", () => {
    expect(parseKg("82,44")).toBe(82.4);
    expect(parseKg(" 75.05 ")).toBe(75.1);
    expect(parseKg("19,9")).toBeNull();
    expect(parseKg("301")).toBeNull();
    expect(parseKg("abc")).toBeNull();
  });

  it("cleanWeight odrzuca zły dzień i wartości, a poprawny zostawia", () => {
    expect(cleanWeight({ day: "2026-10-26", kg: 80.04, created: 5 })).toEqual({ day: "2026-10-26", kg: 80, created: 5 });
    expect(cleanWeight({ day: "26.10.2026", kg: 80, created: 5 })).toBeNull();
    expect(cleanWeight({ day: "2026-10-26", kg: "80", created: 5 })).toBeNull();
    expect(cleanWeight(null)).toBeNull();
  });

  it("zmiana względem poprzedniego ważenia i średnia z ostatnich 7", () => {
    expect(weightTrend([])).toEqual({ delta: null, average: null });
    expect(weightTrend([e("2026-10-01", 80)])).toEqual({ delta: null, average: 80 });
    const many = [e("d1", 90), e("d2", 88), e("d3", 86), e("d4", 85), e("d5", 84), e("d6", 83), e("d7", 82), e("d8", 81)];
    // Średnia z ostatnich 7: (88+86+85+84+83+82+81)/7 = 84,1.
    expect(weightTrend(many)).toEqual({ delta: -1, average: 84.1 });
  });
});

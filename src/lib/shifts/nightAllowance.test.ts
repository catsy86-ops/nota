import { describe, expect, it } from "vitest";
import { MIN_MONTHLY_WAGE, minimumMonthlyWage, nightAllowance, nightRateFor } from "./nightAllowance";

describe("dodatek nocny (art. 151⁸ KP)", () => {
  it("20% z minimalnego wynagrodzenia podzielonego przez godziny wymiaru miesiąca", () => {
    // Luty 2026: 20 dni roboczych = 160 h → 4806 / 160 = 30,04 zł; 20% = 6,01 zł.
    expect(nightRateFor(2026, 1, 0)).toBe(6.01);
    // Lipiec 2026: 23 dni robocze = 184 h → 26,12 zł; 20% = 5,22 zł.
    expect(nightRateFor(2026, 6, 0)).toBe(5.22);
  });

  it("stawka zależy od miesiąca, nie tylko od roku", () => {
    expect(nightRateFor(2026, 1, 0)).not.toBe(nightRateFor(2026, 6, 0));
  });

  it("ręczna stawka nadpisuje wyliczoną", () => {
    expect(nightRateFor(2026, 1, 9.5)).toBe(9.5);
  });

  it("rok spoza tabeli bierze ostatnio znany, a nie zero", () => {
    expect(minimumMonthlyWage(2099)).toBe(MIN_MONTHLY_WAGE[2026]);
  });

  it("kwota z minut pracy nocnej", () => {
    expect(nightAllowance(90, 6)).toBe(9);
    expect(nightAllowance(0, 6)).toBe(0);
    expect(nightAllowance(60 * 7, 6.28)).toBe(43.96);
  });
});

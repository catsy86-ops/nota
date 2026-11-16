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

  it("rok po tabeli bierze ostatnio znany, a rok sprzed tabeli — najwcześniejszy", () => {
    expect(minimumMonthlyWage(2099)).toBe(MIN_MONTHLY_WAGE[2027]);
    expect(minimumMonthlyWage(2020)).toBe(MIN_MONTHLY_WAGE[2026]);
  });

  it("2027: kwota z rozporządzenia z 14.09.2026", () => {
    // Styczeń 2027: 21 dni pon.–pt. minus 1 i 6 stycznia = 19 dni = 152 h → 4950 / 152 = 32,57 zł; 20% = 6,51 zł.
    expect(nightRateFor(2027, 0, 0)).toBe(6.51);
  });

  it("kwota z minut pracy nocnej", () => {
    expect(nightAllowance(90, 6)).toBe(9);
    expect(nightAllowance(0, 6)).toBe(0);
    expect(nightAllowance(60 * 7, 6.28)).toBe(43.96);
  });
});

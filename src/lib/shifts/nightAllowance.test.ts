import { describe, expect, it } from "vitest";
import { MIN_HOURLY_WAGE, minimumHourlyWage, nightAllowance, nightRateFor } from "./nightAllowance";

describe("dodatek nocny (art. 151⁸ KP)", () => {
  it("20% minimalnej stawki roku, zaokrąglone do grosza", () => {
    const year = 2026;
    expect(nightRateFor(year, 0)).toBe(Math.round(MIN_HOURLY_WAGE[year] * 0.2 * 100) / 100);
  });

  it("ręczna stawka nadpisuje minimalną", () => {
    expect(nightRateFor(2026, 9.5)).toBe(9.5);
  });

  it("rok spoza tabeli bierze ostatnio znany, a nie zero", () => {
    expect(minimumHourlyWage(2099)).toBe(MIN_HOURLY_WAGE[2026]);
  });

  it("kwota z minut pracy nocnej", () => {
    expect(nightAllowance(90, 6)).toBe(9);
    expect(nightAllowance(0, 6)).toBe(0);
    expect(nightAllowance(60 * 7, 6.28)).toBe(43.96);
  });
});

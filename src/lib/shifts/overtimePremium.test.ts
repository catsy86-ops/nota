import { describe, it, expect } from "vitest";
import { type ShiftData } from "./model";
import { monthSummary } from "./summary";
import { TEST_SHIFT_TYPES, TEST_EMPTY_SHIFT_DATA } from "./testShiftTypes";

// Stawka 33,33 zł daje ułamki groszy przy każdej pozycji — akurat tu wychodzą rozjazdy zaokrągleń.
const data: ShiftData = {
  ...TEST_EMPTY_SHIFT_DATA,
  types: TEST_SHIFT_TYPES,
  hourlyRate: 33.33,
  days: {
    "2026-10-05": { type: "d", extraMin: 120 },
    "2026-10-06": { type: "d", extraMin: 45 },
    "2026-10-07": { type: "d", extraMin: 77 },
    "2026-10-10": { type: "n", extraMin: 60 },
  },
};

describe("rachunek: podstawa + dodatek za nadgodziny = zarobek co do grosza", () => {
  const s = monthSummary(data, 2026, 9);

  it("dodatek za nadgodziny jest osobną kwotą w podsumowaniu", () => {
    expect(s.overtimePremium).toBeGreaterThan(0);
  });

  it("zarobek = podstawa + dodatek + premie (bez odejmowania w widoku)", () => {
    expect(s.earnings).toBe(Math.round((s.basePay + s.overtimePremium + s.bonusTotal) * 100) / 100);
  });

  it("dodatek 50% i 100% w osobnych kwotach sumują się do dodatku za nadgodziny", () => {
    expect(s.overtimePremium100).toBeGreaterThan(0);
    expect(s.overtimePremium50).toBeGreaterThan(0);
    expect(s.overtimePremium).toBe(Math.round((s.overtimePremium100 + s.overtimePremium50) * 100) / 100);
  });

  it("podstawa to suma zaokrąglonych pozycji rodzajów, tak jak w rachunku", () => {
    const fromLines = s.byType
      .filter((t) => t.type.kind !== "absence")
      .reduce((acc, t) => acc + Math.round((t.minutes / 60) * (t.type.rate ?? data.hourlyRate) * 100) / 100, 0);
    expect(s.basePay).toBeCloseTo(fromLines, 10);
  });
});

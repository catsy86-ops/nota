import { describe, expect, it } from "vitest";
import { DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA, type ShiftData } from "./model";
import { monthSummary, monthSummaryToDate } from "./summary";

const data: ShiftData = {
  ...EMPTY_SHIFT_DATA,
  types: DEFAULT_SHIFT_TYPES,
  hourlyRate: 30,
  days: {
    "2026-10-05": { type: "d" },
    "2026-10-06": { type: "d" },
    "2026-10-20": { type: "d" },
    "2026-10-21": { type: "d" },
  },
  bonuses: [{ id: "b1", month: "2026-10", name: "Premia", amount: 500 }],
};

describe("przepracowane do dziś", () => {
  it("pomija dni po dziś, prognoza zostaje pełna", () => {
    const toDate = monthSummaryToDate(data, 2026, 9, "2026-10-06");
    const full = monthSummary(data, 2026, 9);
    expect(toDate.daysWorked).toBe(2);
    expect(full.daysWorked).toBe(4);
  });

  it("bez premii — premia jest miesięczna i wchodzi tylko do prognozy", () => {
    expect(monthSummaryToDate(data, 2026, 9, "2026-10-21").bonusTotal).toBe(0);
    expect(monthSummary(data, 2026, 9).bonusTotal).toBe(500);
  });
});

import { describe, it, expect } from "vitest";
import { DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA, type ShiftData } from "./model";
import { yearChartRows, yearDayMinutes } from "./yearCharts";

const eight = DEFAULT_SHIFT_TYPES.find((t) => t.id === "e")!; // 8–16
const leave = DEFAULT_SHIFT_TYPES.find((t) => t.id === "u")!;
const data = (days: ShiftData["days"]): ShiftData => ({ ...EMPTY_SHIFT_DATA, types: [eight, leave], days });

describe("wykresy roku (G4.3)", () => {
  it("dwanaście miesięcy z etykietami i godzinami", () => {
    const rows = yearChartRows(data({ "2026-10-05": { type: "e" } }), 2026);
    expect(rows).toHaveLength(12);
    expect(rows[9].hours).toBe(8);
    expect(rows[0].hours).toBe(0);
    expect(rows[9].label).toBe("paź");
  });

  it("mapa dni: tylko dni z pracą, urlop się nie liczy", () => {
    const map = yearDayMinutes(data({ "2026-10-05": { type: "e" }, "2026-10-06": { type: "u" }, "2025-10-05": { type: "e" } }), 2026);
    expect(map.get("2026-10-05")).toBe(8 * 60);
    expect(map.has("2026-10-06")).toBe(false);
    expect(map.has("2025-10-05")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { EMPTY_SHIFT_DATA, DEFAULT_SHIFT_TYPES, type ShiftData } from "@/lib/shifts";
import { shiftPresets } from "./reminderShiftPresets";

const [day] = DEFAULT_SHIFT_TYPES;
// Typ `day` to 06:00–14:00 (domyślny typ grafiku), w dniach 2026-10-27 i 2026-10-28.
const data = (days: Record<string, { type: string }>): ShiftData => ({ ...EMPTY_SHIFT_DATA, days });

describe("terminy względem grafiku (T-2)", () => {
  it("po dzisiejszej zmianie i 30 min przed jutrzejszą, gdy oba dni mają zmianę", () => {
    const d = data({ "2026-10-27": { type: day.id }, "2026-10-28": { type: day.id } });
    const now = new Date(2026, 9, 27, 9, 0);
    const out = shiftPresets(d, now);
    expect(out.map((p) => p.label)).toEqual(["Po dzisiejszej zmianie", "30 min przed jutrzejszą zmianą"]);
    expect(out[0].at.getHours()).toBe(14);
    expect(out[1].at.getDate()).toBe(28);
    expect(out[1].at.getHours()).toBe(5);
    expect(out[1].at.getMinutes()).toBe(30);
  });

  it("bez dzisiejszej zmiany pomija „po dzisiejszej”, a bez grafiku nie zwraca nic", () => {
    const d = data({ "2026-10-28": { type: day.id } });
    expect(shiftPresets(d, new Date(2026, 9, 27, 9, 0)).map((p) => p.label)).toEqual(["30 min przed jutrzejszą zmianą"]);
    expect(shiftPresets(EMPTY_SHIFT_DATA, new Date(2026, 9, 27, 9, 0))).toEqual([]);
  });

  it("po zakończeniu dzisiejszej zmiany nie proponuje już jej końca", () => {
    const d = data({ "2026-10-27": { type: day.id } });
    expect(shiftPresets(d, new Date(2026, 9, 27, 17, 0)).some((p) => p.label === "Po dzisiejszej zmianie")).toBe(false);
  });
});

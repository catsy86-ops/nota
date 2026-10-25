import { describe, expect, it } from "vitest";
import { DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA, type ShiftData } from "./model";
import { weeklyRestShort } from "./summary";

const withDays = (days: Record<string, { type: string; extraMin?: number }>): ShiftData => ({ ...EMPTY_SHIFT_DATA, types: DEFAULT_SHIFT_TYPES, days });

// Zmiana „d” to 6:00–14:00 (8 h).
describe("odpoczynek tygodniowy 35 h (art. 133 KP)", () => {
  it("dwie zmiany w tygodniu zostawiają ponad 35 h ciągłego odpoczynku", () => {
    // Pn i wt 6–14: przerwa od wt 14:00 do przyszłego pn ma ponad 5 dni.
    expect(weeklyRestShort(withDays({ "2026-10-05": { type: "d" }, "2026-10-06": { type: "d" } }), "2026-10-")).toEqual([]);
  });

  it("zmiany każdego dnia tygodnia: najdłuższa przerwa to 16 h, tydzień jest oznaczony", () => {
    const days: Record<string, { type: string }> = {};
    for (let d = 5; d <= 11; d++) days[`2026-10-${String(d).padStart(2, "0")}`] = { type: "d" };
    expect(weeklyRestShort(withDays(days), "2026-10-")).toEqual([{ weekStart: "2026-10-05", restMinutes: 16 * 60 }]);
  });

  it("tydzień bez zmian w tym miesiącu nie jest oznaczany", () => {
    expect(weeklyRestShort(withDays({ "2026-09-28": { type: "d" } }), "2026-10-")).toEqual([]);
  });
});

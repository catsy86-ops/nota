import { describe, expect, it } from "vitest";
import type { DayEntry, ShiftPattern, ShiftType } from "./model";
import { cyclePatterns, hasWorkSteps, weekTemplateAnchor, weekTemplateSteps, weekTemplates } from "./weekTemplate";

const types: ShiftType[] = [
  { id: "d", name: "Dzień", short: "D", color: "#fb923c", start: "06:00", end: "14:00", breakMin: 0, kind: "work" },
  { id: "u", name: "Urlop", short: "U", color: "#22c55e", start: "00:00", end: "00:00", breakMin: 0, kind: "absence" },
];

// 2026-10-26 to poniedziałek.
const MON = "2026-10-26";

describe("szablon tygodnia (G4.6)", () => {
  it("odczytuje 7 kroków od poniedziałku, pomija nieobecności i puste dni", () => {
    const days: Record<string, DayEntry> = {
      "2026-10-26": { type: "d" },
      "2026-10-28": { type: "d" },
      "2026-10-29": { type: "u" },
      "2026-10-31": { type: "gone" },
    };
    expect(weekTemplateSteps(days, MON, types)).toEqual(["d", null, "d", null, null, null, null]);
  });

  it("nie czyta dni spoza tygodnia", () => {
    const days: Record<string, DayEntry> = { "2026-10-25": { type: "d" }, "2026-11-02": { type: "d" } };
    expect(weekTemplateSteps(days, MON, types)).toEqual([null, null, null, null, null, null, null]);
  });

  it("hasWorkSteps: pusty szablon nie jest zapisywany", () => {
    expect(hasWorkSteps([null, null, null, null, null, null, null])).toBe(false);
    expect(hasWorkSteps([null, "d", null, null, null, null, null])).toBe(true);
  });

  it("kotwica to poniedziałek tygodnia, także gdy zakres zaczyna się w środku tygodnia", () => {
    expect(weekTemplateAnchor("2026-10-28")).toBe(MON);
    expect(weekTemplateAnchor(MON)).toBe(MON);
    expect(weekTemplateAnchor("2026-11-01")).toBe("2026-10-26");
  });

  it("rozdziela szablony tygodnia od cykli", () => {
    const cycle: ShiftPattern = { id: "c1", name: "Cykl", steps: ["d", null] };
    const week: ShiftPattern = { id: "w1", name: "Tydzień", steps: ["d", null, null, null, null, null, null], kind: "week" };
    expect(weekTemplates([cycle, week])).toEqual([week]);
    expect(cyclePatterns([cycle, week])).toEqual([cycle]);
  });
});

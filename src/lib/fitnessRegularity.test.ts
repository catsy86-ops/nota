import { describe, expect, it } from "vitest";
import { regularityCounts, regularityLevel, regularityWeeks } from "./fitnessRegularity";

// C3.1: 12 tygodni pn–nd od najstarszego, dni po dziś pominięte w liczeniu.

describe("regularityWeeks (C3.1)", () => {
  const today = "2026-11-26"; // czwartek
  const sets = { training: new Set(["2026-11-24", "2026-09-07"]), supplements: new Set(["2026-11-24", "2026-11-25"]), diet: new Set(["2026-11-24", "2026-11-30"]) };
  const weeks = regularityWeeks(today, sets);

  it("12 tygodni po 7 dni, od poniedziałku 11 tygodni wstecz do niedzieli bieżącego", () => {
    expect(weeks).toHaveLength(12);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0].day).toBe("2026-09-07");
    expect(weeks[11][6].day).toBe("2026-11-29");
  });

  it("dni po dziś są przyszłe i nie liczą się", () => {
    expect(weeks[11].map((d) => d.future)).toEqual([false, false, false, false, true, true, true]);
    expect(regularityCounts(weeks)).toEqual({ training: 2, supplements: 2, diet: 1 });
  });

  it("poziom dnia = ile z trzech rzeczy", () => {
    expect(regularityLevel(weeks[11][1])).toBe(3);
    expect(regularityLevel(weeks[11][2])).toBe(1);
    expect(regularityLevel(weeks[11][3])).toBe(0);
  });
});

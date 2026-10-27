import { describe, it, expect } from "vitest";
import { DEFAULT_SHIFT_TYPES } from "@/lib/shifts/model";
import { CYCLE_LENGTH_DAYS, FIRST_CYCLES } from "./NewScheduleWizard";

// G4.2: kroki pierwszego cyklu muszą wskazywać rodzaje, które kreator dodaje krok wcześniej.
describe("kreator nowego grafiku (G4.2)", () => {
  it("cykl pn–pt używa domyślnej dniówki i ma 5 dni pracy na 7", () => {
    const steps = FIRST_CYCLES.weekdays.steps;
    expect(steps).toHaveLength(7);
    expect(steps.filter((s) => s !== null)).toHaveLength(5);
    for (const id of steps.filter((s) => s !== null) as string[]) {
      expect(DEFAULT_SHIFT_TYPES.some((t) => t.id === id)).toBe(true);
    }
  });

  it("„bez cyklu” nie nakłada niczego", () => {
    expect(FIRST_CYCLES.none.steps).toBeNull();
  });

  it("cykl obejmuje cztery tygodnie", () => {
    expect(CYCLE_LENGTH_DAYS).toBe(28);
  });
});

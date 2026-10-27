import { describe, it, expect } from "vitest";
import { atWorkingHours } from "./reminderConflict";
import { DEFAULT_SHIFT_TYPES } from "./model";

const day = (h: number, m = 0) => new Date(2026, 9, 5, h, m).getTime();
const eight = DEFAULT_SHIFT_TYPES.find((t) => t.id === "e")!; // 8–16

describe("termin w czasie zmiany (K3.4)", () => {
  it("termin w godzinach zmiany to konflikt", () => {
    expect(atWorkingHours(day(10), eight)).toBe(true);
    expect(atWorkingHours(day(15, 59), eight)).toBe(true);
  });

  it("przed zmianą, po zmianie i w dniu bez zmiany nie ma konfliktu", () => {
    expect(atWorkingHours(day(7, 59), eight)).toBe(false);
    expect(atWorkingHours(day(16), eight)).toBe(false);
    expect(atWorkingHours(day(10), undefined)).toBe(false);
  });

  it("urlop nie ma godzin, więc nie ma konfliktu", () => {
    const leave = DEFAULT_SHIFT_TYPES.find((t) => t.id === "u")!;
    expect(atWorkingHours(day(10), leave)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA, type ShiftData } from "./model";
import { absenceEstimate, SICK_RATE } from "./absenceEstimate";

const leave = DEFAULT_SHIFT_TYPES.find((t) => t.kind === "absence" && /urlop/i.test(t.name))!;
const sick = DEFAULT_SHIFT_TYPES.find((t) => t.kind === "absence" && /^l-?4|chorob/i.test(t.name))!;

// Wrzesień: cztery 8-godzinne zmiany po 30 zł/h → średnia 30 zł/h.
const september = Object.fromEntries([1, 2, 3, 4].map((d) => [`2026-09-0${d}`, { type: "d" }]));

describe("szacunek urlopu i L4 (3.6, G-2)", () => {
  const data: ShiftData = {
    ...EMPTY_SHIFT_DATA,
    types: DEFAULT_SHIFT_TYPES,
    hourlyRate: 30,
    days: { ...september, "2026-10-05": { type: leave.id }, "2026-10-06": { type: sick.id } },
  };

  it("urlop wg średniej godzinowej z trzech miesięcy, L4 w 80%", () => {
    const e = absenceEstimate(data, 2026, 9)!;
    expect(e.avgRate).toBe(30);
    expect(e.leave).toEqual({ days: 1, minutes: 480, amount: 240 });
    expect(e.sick.amount).toBe(240 * SICK_RATE);
  });

  it("miesiąc bez urlopu i L4 nie ma szacunku", () => {
    expect(absenceEstimate(data, 2026, 8)).toBeNull();
  });
});

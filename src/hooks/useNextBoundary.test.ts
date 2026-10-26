import { describe, expect, it } from "vitest";
import { nextBoundary } from "./useNextBoundary";

const at = (d: number, h = 0, min = 0) => new Date(2026, 9, d, h, min).getTime();

describe("nextBoundary (T 1.1)", () => {
  it("bez terminów granicą jest północ", () => {
    expect(nextBoundary([], at(19, 12))).toBe(at(20, 0));
  });

  it("najbliższy termin wygrywa z północą", () => {
    expect(nextBoundary([{ reminder: at(19, 13), reminderAllDay: false }], at(19, 12))).toBe(at(19, 13));
  });

  it("termin całodzienny zmienia grupę dopiero po końcu dnia", () => {
    const allDay = { reminder: at(19, 9), reminderAllDay: true };
    expect(nextBoundary([allDay], at(19, 12))).toBe(at(20, 0));
  });

  it("minione terminy nie są granicami", () => {
    expect(nextBoundary([{ reminder: at(19, 8), reminderAllDay: false }], at(19, 12))).toBe(at(20, 0));
  });
});

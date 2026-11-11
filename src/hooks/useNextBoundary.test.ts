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

describe("nextBoundary: zmiana czasu (D1)", () => {
  it("w dniu zmiany na zimowy (25 h) następna północ jest o prawdziwej północy, nie o 23:00", () => {
    // 2026-10-25 w Europe/Warsaw: 03:00 → 02:00. Po 23:00 granica musi być jutrzejszą północą.
    const now = new Date(2026, 9, 25, 23, 30).getTime();
    expect(nextBoundary([], now)).toBe(new Date(2026, 9, 26, 0, 0).getTime());
    expect(nextBoundary([], now)).toBeGreaterThan(now);
  });

  it("w dniu zmiany na letni (23 h) granica też wypada o północy", () => {
    const now = new Date(2026, 2, 29, 12, 0).getTime();
    expect(nextBoundary([], now)).toBe(new Date(2026, 2, 30, 0, 0).getTime());
  });
});

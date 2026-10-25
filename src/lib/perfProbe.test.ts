import { describe, expect, it } from "vitest";
import { createPerfTally } from "@/lib/perfProbe";

describe("sonda INP/CLS — liczenie", () => {
  it("INP to najdłuższa interakcja; krótsze jej nie nadpisują", () => {
    const tally = createPerfTally();
    expect(tally.recordEvent({ name: "click", duration: 80, startTime: 10 })?.duration).toBe(80);
    expect(tally.recordEvent({ name: "keydown", duration: 40, startTime: 20 })).toBeNull();
    expect(tally.recordEvent({ name: "pointerup", duration: 210, startTime: 30 })?.name).toBe("pointerup");
    expect(tally.worstInteraction).toEqual({ name: "pointerup", duration: 210, at: 30 });
  });

  it("zerowe i ujemne czasy są pomijane", () => {
    const tally = createPerfTally();
    expect(tally.recordEvent({ name: "click", duration: 0, startTime: 1 })).toBeNull();
    expect(tally.worstInteraction).toBeNull();
  });

  it("CLS sumuje przesunięcia, ale pomija te po akcji użytkownika", () => {
    const tally = createPerfTally();
    expect(tally.recordLayoutShift({ value: 0.05, hadRecentInput: false })).toBeCloseTo(0.05);
    expect(tally.recordLayoutShift({ value: 0.2, hadRecentInput: true })).toBeCloseTo(0.05);
    expect(tally.recordLayoutShift({ value: 0.01, hadRecentInput: false })).toBeCloseTo(0.06);
  });
});

import { describe, expect, it } from "vitest";
import { slopeDegrees, slopeLabel, slopePercent, slopeZone, smooth } from "./slope";

describe("spadek z czujnika (B3.4)", () => {
  it("slopePercent: tan kąta, nie proporcja (1° to ok. 1,7%, a nie 17%)", () => {
    expect(slopePercent(0)).toBe(0);
    expect(slopePercent(1)).toBe(1.7);
    expect(slopePercent(1.2)).toBe(2.1);
    expect(slopePercent(45)).toBe(100);
    expect(slopePercent(-1.2)).toBe(-2.1);
    expect(slopePercent(Number.NaN)).toBe(0);
  });

  it("slopeDegrees to odwrotność slopePercent", () => {
    expect(slopeDegrees(2)).toBe(1.15);
    expect(slopePercent(slopeDegrees(2.5))).toBeCloseTo(2.5, 1);
  });

  it("slopeZone: 2–3% w obie strony jest w normie, reszta poza", () => {
    for (const p of [2, 2.5, 3, -2, -3]) expect(slopeZone(p), String(p)).toBe("ok");
    for (const p of [0, 1.9, 3.1, -1.9, 10]) expect(slopeZone(p), String(p)).toBe("off");
  });

  it("smooth: pierwszy odczyt bez zmian, kolejne wygładzone", () => {
    expect(smooth(null, 5)).toBe(5);
    expect(smooth(0, 10, 0.2)).toBe(2);
    expect(smooth(2, 10, 0.5)).toBe(6);
  });

  it("slopeLabel: spadek z przecinkiem, znak pomijany", () => {
    expect(slopeLabel(1.2)).toBe("2,1% (1,2°)");
    expect(slopeLabel(-1.2)).toBe("2,1% (1,2°)");
    expect(slopeLabel(0)).toBe("0% (0°)");
  });
});

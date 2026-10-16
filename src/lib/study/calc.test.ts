import { describe, expect, it } from "vitest";
import { parseNum, pipeLiters, PIPES, plNum, slopeDrop, slopeFromDrop, slopeNote, waterTest } from "./calc";

describe("kalkulatory na budowę", () => {
  it("parseNum: przecinek, kropka, spacje; śmieci → null", () => {
    expect(parseNum("2,5")).toBe(2.5);
    expect(parseNum(" 12.75 ")).toBe(12.75);
    expect(parseNum("1 200")).toBe(1200);
    expect(parseNum(",5")).toBe(0.5);
    expect(parseNum("")).toBeNull();
    expect(parseNum("-3")).toBeNull();
    expect(parseNum("abc")).toBeNull();
    expect(parseNum("2,5,1")).toBeNull();
  });

  it("plNum: polski przecinek i bez zbędnych zer", () => {
    expect(plNum(2.5)).toBe("2,5");
    expect(plNum(12)).toBe("12");
    expect(plNum(1.256, 2)).toBe("1,26");
    expect(plNum(1500)).toBe("1500");
  });

  it("spadek: 1% = 1 cm na metr, w obie strony", () => {
    expect(slopeDrop(8, 2)).toBe(16);
    expect(slopeDrop(5, 2.5)).toBe(12.5);
    expect(slopeFromDrop(8, 20)).toBe(2.5);
    expect(slopeFromDrop(0, 5)).toBeNull();
  });

  it("spadek poza typowym zakresem 2–3% — podpowiedź", () => {
    expect(slopeNote(1.5)).toBe("low");
    expect(slopeNote(2)).toBeNull();
    expect(slopeNote(3)).toBeNull();
    expect(slopeNote(4)).toBe("high");
  });

  it("próba wodna: 1,5 × robocze, manometr +50% od próbnego", () => {
    expect(waterTest(6)).toEqual({ testBar: 9, gaugeMinBar: 13.5 });
    expect(waterTest(4)).toEqual({ testBar: 6, gaugeMinBar: 9 });
  });

  it("pojemność rury: π·r²·L; 10 m rury 16×2 to ok. 1,13 l", () => {
    const p16 = PIPES.find((p) => p.id === "16x2")!;
    expect(p16.innerMm).toBe(12);
    expect(pipeLiters(12, 10)).toBeCloseTo(1.131, 3);
    expect(pipeLiters(16, 1)).toBeCloseTo(0.201, 3);
    for (const p of PIPES) {
      const [od, wall] = p.id.split("x").map(Number);
      expect(p.innerMm).toBeCloseTo(od - 2 * wall, 5);
    }
  });
});

import { describe, expect, it } from "vitest";
import { cleanMeasure, measureTrend, parseCm, type Measure } from "./measures";

describe("obwody ciała (C3.4)", () => {
  it("parseCm: przecinek i kropka, 0,1 cm, zakres 10–250", () => {
    expect(parseCm("88,46")).toBe(88.5);
    expect(parseCm("101.2")).toBe(101.2);
    expect(parseCm("9")).toBeNull();
    expect(parseCm("251")).toBeNull();
    expect(parseCm("")).toBeNull();
  });

  it("cleanMeasure: zła partia, dzień albo wartość — null; nieznane pola w extra", () => {
    expect(cleanMeasure({ day: "2026-11-01", part: "szyja", cm: 40, created: 1 })).toBeNull();
    expect(cleanMeasure({ day: "1.11", part: "pas", cm: 90, created: 1 })).toBeNull();
    expect(cleanMeasure({ day: "2026-11-01", part: "pas", cm: 5, created: 1 })).toBeNull();
    expect(cleanMeasure({ day: "2026-11-01", part: "pas", cm: 90.04, created: 1, x: 1 })).toEqual({ day: "2026-11-01", part: "pas", cm: 90, created: 1, extra: { x: 1 } });
  });

  it("measureTrend: ostatni pomiar partii i zmiana od poprzedniego", () => {
    const list: Measure[] = [
      { day: "2026-11-10", part: "pas", cm: 90, created: 1 },
      { day: "2026-11-01", part: "pas", cm: 92, created: 1 },
      { day: "2026-11-10", part: "udo", cm: 58, created: 1 },
    ];
    expect(measureTrend(list, "pas")).toMatchObject({ last: { day: "2026-11-10", cm: 90 }, delta: -2 });
    expect(measureTrend(list, "udo")).toMatchObject({ last: { cm: 58 }, delta: null });
    expect(measureTrend(list, "klatka")).toEqual({ last: null, delta: null });
  });
});

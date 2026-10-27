import { describe, expect, it } from "vitest";
import { dayProgress, moonPhase, moonPath } from "@/lib/daySignature";

describe("faza Księżyca", () => {
  it("rozpoznaje znane fazy (pełnia 25.12.2015, nów 7.10.2018, pierwsza kwadra 10.11.2027)", () => {
    expect(moonPhase(new Date(Date.UTC(2015, 11, 25, 12))).name).toBe("Pełnia");
    expect(moonPhase(new Date(Date.UTC(2018, 9, 9, 3))).name).toBe("Nów");
    const quarter = moonPhase(new Date(Date.UTC(2026, 10, 17, 12)));
    expect(quarter.name).toBe("Pierwsza kwadra");
    expect(quarter.waxing).toBe(true);
    expect(quarter.illumination).toBeGreaterThan(0.3);
    expect(quarter.illumination).toBeLessThan(0.7);
  });

  it("oświetlenie w pełni bliskie 1, w nowiu bliskie 0", () => {
    expect(moonPhase(new Date(Date.UTC(2015, 11, 25, 12))).illumination).toBeGreaterThan(0.97);
    expect(moonPhase(new Date(Date.UTC(2018, 9, 9, 3))).illumination).toBeLessThan(0.03);
  });

  it("ścieżka tarczy to poprawne SVG w ramce 2r", () => {
    const d = moonPath(moonPhase(new Date(Date.UTC(2026, 9, 27))), 10);
    expect(d).toMatch(/^M10 0A10 10 0 0 [01] 10 20A[\d.]+ 10 0 0 [01] 10 0Z$/);
  });
});

describe("postęp doby", () => {
  it("północ 0, południe 0,5", () => {
    expect(dayProgress(new Date(2026, 9, 27, 0, 0))).toBe(0);
    expect(dayProgress(new Date(2026, 9, 27, 12, 0))).toBe(0.5);
  });
});

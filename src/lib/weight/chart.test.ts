import { describe, expect, it } from "vitest";
import { weightSeries } from "./chart";

const w = (day: string, kg: number) => ({ day, kg, created: 0 });

describe("weightSeries", () => {
  it("bierze tylko dni z okna i kładzie je na osi wg dnia, nie wg indeksu", () => {
    const s = weightSeries([w("2026-10-01", 80), w("2026-10-28", 82), w("2026-09-01", 99)], 30, "2026-10-28", 300, 100);
    expect(s).not.toBeNull();
    expect(s!.points.map((p) => p.day)).toEqual(["2026-10-01", "2026-10-28"]);
    expect(s!.points[0].x).toBeCloseTo((2 / 29) * 300); // 1 paź to 2 dni po początku okna (29 wrz)
    expect(s!.points[1].x).toBeCloseTo(300);
    expect(s!.from).toBe("2026-09-29");
    expect(s!.to).toBe("2026-10-28");
  });

  it("skaluje Y tak, że najniższe ważenie jest na dole, a najwyższe na górze", () => {
    const s = weightSeries([w("2026-10-10", 80), w("2026-10-20", 84)], 30, "2026-10-28", 300, 100)!;
    expect(s.points[0].y).toBeGreaterThan(s.points[1].y);
    expect(s.min).toBe(80);
    expect(s.max).toBe(84);
  });

  it("zwraca null, gdy w oknie nie ma ważeń", () => {
    expect(weightSeries([w("2026-01-01", 80)], 30, "2026-10-28")).toBeNull();
  });
});

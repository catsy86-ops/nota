import { beforeEach, describe, expect, it } from "vitest";
import { measureSpan, percentile, perfReportLines, resetPerfForTests, startPerfProbe } from "./perf";

beforeEach(resetPerfForTests);

describe("pomiar wydajności Pracy", () => {
  it("percentyl: najbliższa pozycja", () => {
    expect(percentile([], 75)).toBeNull();
    expect(percentile([10], 75)).toBe(10);
    expect(percentile([40, 10, 30, 20], 75)).toBe(30);
    expect(percentile([40, 10, 30, 20], 100)).toBe(40);
  });

  it("odcinek trafia do raportu po klatce", async () => {
    const end = measureSpan("karta-budowy");
    end();
    await new Promise((r) => setTimeout(r, 60));
    expect(perfReportLines().join("\n")).toMatch(/karta-budowy \(1\): mediana \d+ ms/);
  });

  it("bez próbek raport mówi „brak”, a start sondy nie rzuca", () => {
    expect(() => startPerfProbe()).not.toThrow();
    expect(perfReportLines()[0]).toContain("brak");
  });
});

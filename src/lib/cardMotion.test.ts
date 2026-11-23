import { beforeEach, describe, expect, it } from "vitest";
import { cascadeDelay, resetCascade } from "./cardMotion";

describe("cascadeDelay (M2.3)", () => {
  beforeEach(() => resetCascade());

  it("pierwsze 8 kart, ostatnia rusza najpóźniej po 240 ms", () => {
    const delays = Array.from({ length: 12 }, (_, i) => cascadeDelay(i, false, 0));
    expect(delays.slice(8).every((d) => d === 0)).toBe(true);
    expect(Math.max(...delays)).toBeLessThanOrEqual(0.24);
    expect(delays[7]).toBeGreaterThan(delays[6]);
  });

  it("powrót do widoku po oknie kaskady — bez opóźnienia", () => {
    cascadeDelay(0, false, 0);
    expect(cascadeDelay(3, false, 100)).toBeGreaterThan(0);
    expect(cascadeDelay(3, false, 5000)).toBe(0);
  });

  it("ograniczony ruch — zawsze 0", () => {
    expect(cascadeDelay(3, true, 0)).toBe(0);
  });
});

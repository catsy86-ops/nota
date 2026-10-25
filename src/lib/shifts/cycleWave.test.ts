import { describe, expect, it, vi, afterEach } from "vitest";
import { setCycleWave, getCycleWave, DELAY_STEP_MS } from "./cycleWave";

afterEach(() => vi.useRealTimers());

describe("fala pieczątek po cyklu (5.6)", () => {
  it("kolejne dni dostają kolejne indeksy, a fala gaśnie po chwili", () => {
    vi.useFakeTimers();
    setCycleWave(["2026-10-05", "2026-10-06", "2026-10-07"]);
    expect(getCycleWave().get("2026-10-06")).toBe(1);
    expect(getCycleWave().get("2026-10-07")).toBe(2);
    expect(DELAY_STEP_MS).toBe(40);
    vi.advanceTimersByTime(3 * DELAY_STEP_MS + 1000);
    expect(getCycleWave().size).toBe(0);
  });
});

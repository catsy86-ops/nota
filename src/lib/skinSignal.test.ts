import { describe, expect, it, vi, afterEach } from "vitest";
import { pulseSkinSignal, SKIN_SIGNAL_MS } from "./skinSignal";

describe("pulseSkinSignal", () => {
  afterEach(() => { vi.useRealTimers(); document.documentElement.removeAttribute("data-sig"); });

  it("ustawia sygnał na chwilę i go zdejmuje", () => {
    vi.useFakeTimers();
    pulseSkinSignal("save");
    expect(document.documentElement.dataset.sig).toBe("save");
    vi.advanceTimersByTime(SKIN_SIGNAL_MS);
    expect(document.documentElement.dataset.sig).toBeUndefined();
  });

  it("kolejny sygnał przedłuża okno, a nie zostawia starego timera", () => {
    vi.useFakeTimers();
    pulseSkinSignal("save");
    vi.advanceTimersByTime(SKIN_SIGNAL_MS - 100);
    pulseSkinSignal("save");
    vi.advanceTimersByTime(200);
    expect(document.documentElement.dataset.sig).toBe("save");
  });
});

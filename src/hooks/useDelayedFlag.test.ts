import { describe, expect, it, vi, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDelayedFlag } from "./useDelayedFlag";

afterEach(() => vi.useRealTimers());

describe("useDelayedFlag", () => {
  it("nie włącza się przed opóźnieniem i gaśnie od razu po zakończeniu", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 300), { initialProps: { active: false } });
    expect(result.current).toBe(false);
    rerender({ active: true });
    vi.advanceTimersByTime(299);
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(true);
    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  it("szybka operacja (krócej niż opóźnienie) nie włącza wskaźnika", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 300), { initialProps: { active: false } });
    rerender({ active: true });
    vi.advanceTimersByTime(100);
    rerender({ active: false });
    vi.advanceTimersByTime(500);
    expect(result.current).toBe(false);
  });
});

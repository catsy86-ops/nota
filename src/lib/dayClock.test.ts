import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { subscribeDayClock, msUntilMidnight, _dayClockSubscriberCount } from "./dayClock";
import { useToday } from "@/hooks/useToday";

describe("msUntilMidnight", () => {
  it("counts to the next local midnight plus a small margin", () => {
    const t = new Date(2026, 9, 10, 23, 59, 0).getTime();
    expect(msUntilMidnight(t)).toBe(60_000 + 250);
  });
});

describe("dayClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 10, 23, 58, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("ticks after midnight and keeps ticking nightly", () => {
    const l = vi.fn();
    const off = subscribeDayClock(l);
    vi.advanceTimersByTime(60_000);
    expect(l).not.toHaveBeenCalled();
    vi.advanceTimersByTime(121_000);
    expect(l).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(24 * 3600_000);
    expect(l).toHaveBeenCalledTimes(2);
    off();
  });

  it("ticks on visibility return, focus and pageshow", () => {
    const l = vi.fn();
    const off = subscribeDayClock(l);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(l).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("pageshow"));
    expect(l).toHaveBeenCalledTimes(3);
    off();
  });

  it("releases listeners and timers when idle", () => {
    const l = vi.fn();
    const off = subscribeDayClock(l);
    expect(_dayClockSubscriberCount()).toBe(1);
    off();
    expect(_dayClockSubscriberCount()).toBe(0);
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(24 * 3600_000);
    expect(l).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("useToday", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 10, 23, 59, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves to the next day after midnight without a reload", () => {
    const { result } = renderHook(() => useToday());
    expect(result.current.getDate()).toBe(10);
    act(() => { vi.advanceTimersByTime(61_000); });
    expect(result.current.getDate()).toBe(11);
  });

  it("catches up on focus after a long sleep (timers frozen)", () => {
    const { result } = renderHook(() => useToday());
    act(() => {
      vi.setSystemTime(new Date(2026, 9, 12, 8, 0, 0));
      window.dispatchEvent(new Event("focus"));
    });
    expect(result.current.getDate()).toBe(12);
  });
});

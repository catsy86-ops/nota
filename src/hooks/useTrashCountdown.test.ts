import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTrashCountdown } from "./useTrashCountdown";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;
const NOW = new Date("2026-01-15T12:00:00Z").getTime();

describe("useTrashCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when trashedAt is missing", () => {
    const { result } = renderHook(() => useTrashCountdown(null));
    expect(result.current).toBeNull();
  });

  it("returns 30 days for a freshly trashed note", () => {
    const { result } = renderHook(() => useTrashCountdown(NOW));
    expect(result.current?.days).toBe(30);
    expect(result.current?.urgent).toBe(false);
    expect(result.current?.label).toBe("Usunięcie za 30 dni");
  });

  it("flags urgent when 3 or fewer days remain", () => {
    const trashedAt = NOW - (THIRTY_DAYS_MS - 3 * ONE_DAY_MS); // 3 days left
    const { result } = renderHook(() => useTrashCountdown(trashedAt));
    expect(result.current?.days).toBe(3);
    expect(result.current?.urgent).toBe(true);
  });

  it("does not flag urgent when 4+ days remain", () => {
    const trashedAt = NOW - (THIRTY_DAYS_MS - 4 * ONE_DAY_MS);
    const { result } = renderHook(() => useTrashCountdown(trashedAt));
    expect(result.current?.days).toBe(4);
    expect(result.current?.urgent).toBe(false);
  });

  it("uses the 'tomorrow' label when 1 day remains", () => {
    const trashedAt = NOW - (THIRTY_DAYS_MS - ONE_DAY_MS);
    const { result } = renderHook(() => useTrashCountdown(trashedAt));
    expect(result.current?.days).toBe(1);
    expect(result.current?.label).toBe("Zostanie usunięta jutro");
    expect(result.current?.urgent).toBe(true);
  });

  it("uses the 'today' label when deletion is imminent", () => {
    const trashedAt = NOW - THIRTY_DAYS_MS;
    const { result } = renderHook(() => useTrashCountdown(trashedAt));
    expect(result.current?.days).toBe(0);
    expect(result.current?.label).toBe("Usunięcie dzisiaj");
    expect(result.current?.urgent).toBe(true);
  });

  it("clamps to 0 days after the deadline has passed", () => {
    const trashedAt = NOW - (THIRTY_DAYS_MS + 5 * ONE_DAY_MS);
    const { result } = renderHook(() => useTrashCountdown(trashedAt));
    expect(result.current?.days).toBe(0);
    expect(result.current?.label).toBe("Usunięcie dzisiaj");
  });

  it("respects the English locale", () => {
    const trashedAt = NOW - (THIRTY_DAYS_MS - 5 * ONE_DAY_MS);
    const { result } = renderHook(() =>
      useTrashCountdown(trashedAt, undefined, "en")
    );
    expect(result.current?.days).toBe(5);
    expect(result.current?.label).toBe("Deletes in 5 days");
  });

  it("uses singular English form when 1 day remains", () => {
    const trashedAt = NOW - (THIRTY_DAYS_MS - ONE_DAY_MS);
    const { result } = renderHook(() =>
      useTrashCountdown(trashedAt, undefined, "en")
    );
    expect(result.current?.label).toBe("Deletes tomorrow");
  });

  it("refreshes label as time advances via the global hourly tick", () => {
    // Trashed so that exactly 5 days remain at NOW.
    const trashedAt = NOW - (THIRTY_DAYS_MS - 5 * ONE_DAY_MS);
    const { result } = renderHook(() => useTrashCountdown(trashedAt));
    expect(result.current?.days).toBe(5);

    // Advance the clock by 2 days and let the hourly ticker fire.
    act(() => {
      vi.advanceTimersByTime(2 * ONE_DAY_MS);
    });
    expect(result.current?.days).toBe(3);
    expect(result.current?.urgent).toBe(true);
    expect(result.current?.label).toBe("Usunięcie za 3 dni");
  });

  it("transitions to the 'tomorrow' label as the deadline approaches", () => {
    // Start with 2 days left.
    const trashedAt = NOW - (THIRTY_DAYS_MS - 2 * ONE_DAY_MS);
    const { result } = renderHook(() => useTrashCountdown(trashedAt));
    expect(result.current?.days).toBe(2);

    act(() => {
      vi.advanceTimersByTime(ONE_DAY_MS);
    });
    expect(result.current?.days).toBe(1);
    expect(result.current?.label).toBe("Zostanie usunięta jutro");
  });
});

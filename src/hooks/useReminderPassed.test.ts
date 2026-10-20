import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useReminderPassed } from "./useReminderPassed";

describe("useReminderPassed", () => {
  const NOW = new Date(2026, 9, 20, 9, 0, 0).getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("przełącza się na „minął” dokładnie w chwili terminu, bez zmiany czegokolwiek innego", () => {
    const { result } = renderHook(() => useReminderPassed(NOW + 60_000));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(59_999));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
  });

  it("termin już minął — od razu true", () => {
    const { result } = renderHook(() => useReminderPassed(NOW - 1));
    expect(result.current).toBe(true);
  });

  it("termin dalej niż najdłuższy timeout — nie przełącza się za wcześnie", () => {
    const far = NOW + 3_000_000_000;
    const { result } = renderHook(() => useReminderPassed(far));
    act(() => vi.advanceTimersByTime(2_147_483_647));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(3_000_000_000 - 2_147_483_647));
    expect(result.current).toBe(true);
  });

  it("zmiana terminu przelicza od nowa", () => {
    const { result, rerender } = renderHook(({ at }) => useReminderPassed(at), {
      initialProps: { at: NOW + 60_000 },
    });
    rerender({ at: NOW - 1 });
    expect(result.current).toBe(true);
    rerender({ at: NOW + 120_000 });
    expect(result.current).toBe(false);
  });
});

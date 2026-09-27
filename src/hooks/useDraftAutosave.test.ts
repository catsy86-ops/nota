import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDraftAutosave } from "./useDraftAutosave";

describe("useDraftAutosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("zapisuje po przerwie w pisaniu", () => {
    const onSave = vi.fn();
    renderHook(() => useDraftAutosave({ active: true, draftKey: "a", intervalSeconds: 5, onSave }));
    vi.advanceTimersByTime(4999);
    expect(onSave).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("restartuje odliczanie przy każdej zmianie szkicu", () => {
    const onSave = vi.fn();
    const { rerender } = renderHook(
      ({ draftKey }) => useDraftAutosave({ active: true, draftKey, intervalSeconds: 5, onSave }),
      { initialProps: { draftKey: "a" } },
    );
    vi.advanceTimersByTime(4000);
    rerender({ draftKey: "ab" });
    vi.advanceTimersByTime(4000);
    expect(onSave).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("nie zapisuje cyklicznie, gdy autosave jest wyłączony (0 s)", () => {
    const onSave = vi.fn();
    renderHook(() => useDraftAutosave({ active: true, draftKey: "a", intervalSeconds: 0, onSave }));
    vi.advanceTimersByTime(60_000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("nie zapisuje, gdy sesja edycji jest zamknięta", () => {
    const onSave = vi.fn();
    const { unmount } = renderHook(() =>
      useDraftAutosave({ active: false, draftKey: "a", intervalSeconds: 5, onSave }),
    );
    vi.advanceTimersByTime(60_000);
    unmount();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("zapisuje przy odmontowaniu w trakcie edycji — nawet z wyłączonym autosave", () => {
    const onSave = vi.fn();
    const { unmount } = renderHook(() =>
      useDraftAutosave({ active: true, draftKey: "a", intervalSeconds: 0, onSave }),
    );
    unmount();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("po zamknięciu edytora odmontowanie już nie zapisuje", () => {
    const onSave = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ active }) => useDraftAutosave({ active, draftKey: "a", intervalSeconds: 0, onSave }),
      { initialProps: { active: true } },
    );
    rerender({ active: false });
    unmount();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("woła zawsze najświeższe onSave, nie to z pierwszego renderu", () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ onSave }) => useDraftAutosave({ active: true, draftKey: "a", intervalSeconds: 0, onSave }),
      { initialProps: { onSave: stale } },
    );
    rerender({ onSave: fresh });
    unmount();
    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });
});

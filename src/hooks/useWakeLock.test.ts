import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWakeLock } from "./useWakeLock";

function makeSentinel() {
  const listeners: (() => void)[] = [];
  return {
    release: vi.fn(async () => { listeners.forEach((l) => l()); }),
    addEventListener: (_t: string, cb: () => void) => { listeners.push(cb); },
  };
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

describe("useWakeLock", () => {
  let request: ReturnType<typeof vi.fn>;
  let sentinels: ReturnType<typeof makeSentinel>[];

  beforeEach(() => {
    sentinels = [];
    request = vi.fn(async () => { const s = makeSentinel(); sentinels.push(s); return s; });
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request } });
    setVisibility("visible");
  });
  afterEach(() => {
    Reflect.deleteProperty(navigator, "wakeLock");
    setVisibility("visible");
  });

  it("requests a screen lock while active and releases on deactivation", async () => {
    const { rerender } = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } });
    await flush();
    expect(request).toHaveBeenCalledWith("screen");
    rerender({ on: false });
    await flush();
    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it("does nothing when inactive", async () => {
    renderHook(() => useWakeLock(false));
    await flush();
    expect(request).not.toHaveBeenCalled();
  });

  it("releases on unmount", async () => {
    const { unmount } = renderHook(() => useWakeLock(true));
    await flush();
    unmount();
    await flush();
    expect(sentinels[0].release).toHaveBeenCalled();
  });

  it("re-requests after the tab becomes visible again (browser dropped the lock)", async () => {
    renderHook(() => useWakeLock(true));
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    // Przeglądarka zwalnia blokadę przy ukryciu karty.
    setVisibility("hidden");
    await act(async () => { await sentinels[0].release(); document.dispatchEvent(new Event("visibilitychange")); });
    expect(request).toHaveBeenCalledTimes(1);
    setVisibility("visible");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    await flush();
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("tolerates a missing API and a rejected request", async () => {
    Reflect.deleteProperty(navigator, "wakeLock");
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
    Object.defineProperty(navigator, "wakeLock", { configurable: true, value: { request: vi.fn().mockRejectedValue(new Error("denied")) } });
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
    await flush();
  });
});

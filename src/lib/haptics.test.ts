import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { haptic } from "./haptics";
import { setEffectEnabled } from "./effectsSettings";
import { setMotionMode } from "@/hooks/useMotionPref";

function mockMatchMedia(matches: (q: string) => boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (q: string) => ({ matches: matches(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  });
}

describe("haptic", () => {
  const vibrate = vi.fn();
  beforeEach(() => {
    vibrate.mockReset().mockReturnValue(true);
    Object.defineProperty(navigator, "vibrate", { configurable: true, writable: true, value: vibrate });
    mockMatchMedia((q) => q.includes("pointer: coarse"));
    setEffectEnabled("haptics", true);
    setMotionMode("full");
  });
  afterEach(() => {
    setMotionMode("system");
    Reflect.deleteProperty(navigator, "vibrate");
  });

  it("wibruje różnymi wzorcami na dotyku", () => {
    haptic("tap");
    haptic("success");
    haptic("warn");
    expect(vibrate).toHaveBeenCalledTimes(3);
    const patterns = vibrate.mock.calls.map((c) => JSON.stringify(c[0]));
    expect(new Set(patterns).size).toBe(3);
  });

  it("nie wibruje przy wskaźniku precyzyjnym (mysz)", () => {
    mockMatchMedia((q) => q.includes("pointer: fine"));
    haptic("tap");
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("nie wibruje przy ograniczonym ruchu", () => {
    setMotionMode("reduced");
    haptic("success");
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("nie wibruje po wyłączeniu w ustawieniach", () => {
    setEffectEnabled("haptics", false);
    haptic("tap");
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("cicho znosi brak navigator.vibrate i wyjątek", () => {
    Reflect.deleteProperty(navigator, "vibrate");
    expect(() => haptic("tap")).not.toThrow();
    Object.defineProperty(navigator, "vibrate", { configurable: true, writable: true, value: () => { throw new Error("x"); } });
    expect(() => haptic("tap")).not.toThrow();
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { installKeyboardInset } from "./keyboardInset";

function fakeViewport(height: number, offsetTop = 0) {
  const listeners: Record<string, () => void> = {};
  const vv = {
    height, offsetTop,
    addEventListener: (t: string, fn: () => void) => { listeners[t] = fn; },
  };
  Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
  return { vv, fire: () => listeners.resize?.() };
}

describe("installKeyboardInset", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    document.documentElement.style.removeProperty("--kb-inset");
  });

  it("bez klawiatury: 0", () => {
    fakeViewport(800);
    installKeyboardInset();
    expect(document.documentElement.style.getPropertyValue("--kb-inset")).toBe("0px");
    expect(document.documentElement.hasAttribute("data-keyboard")).toBe(false);
  });

  it("klawiatura zasłania dół: wysokość klawiatury", () => {
    const { vv, fire } = fakeViewport(800);
    installKeyboardInset();
    vv.height = 480;
    fire();
    expect(document.documentElement.style.getPropertyValue("--kb-inset")).toBe("320px");
    expect(document.documentElement.hasAttribute("data-keyboard")).toBe(true);
  });

  it("mała różnica (pasek adresu) nie liczy się jako klawiatura", () => {
    const { vv, fire } = fakeViewport(800);
    installKeyboardInset();
    vv.height = 744;
    fire();
    expect(document.documentElement.style.getPropertyValue("--kb-inset")).toBe("0px");
  });
});

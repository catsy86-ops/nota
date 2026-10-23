import { describe, expect, it } from "vitest";
import { PARALLAX_VAR, scrollOffset, startScrollParallax } from "./scrollParallax";

describe("scrollOffset", () => {
  it("bierze przewinięcie z elementu, a dla dokumentu z window", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollTop", { value: 240, configurable: true });
    expect(scrollOffset(el)).toBe(240);
    expect(scrollOffset(document)).toBe(window.scrollY);
    expect(scrollOffset(null)).toBe(window.scrollY);
  });
});

describe("startScrollParallax", () => {
  it("ustawia zmienną na przewinięciu i sprząta ją po zakończeniu", async () => {
    const root = document.createElement("html");
    const stop = startScrollParallax(root);
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollTop", { value: 90, configurable: true });
    el.dispatchEvent(new Event("scroll"));
    document.body.appendChild(el);
    // Zdarzenie przechwytywane z elementu w drzewie dokumentu.
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(root.style.getPropertyValue(PARALLAX_VAR)).toBe("90");
    stop();
    expect(root.style.getPropertyValue(PARALLAX_VAR)).toBe("");
    el.remove();
  });
});

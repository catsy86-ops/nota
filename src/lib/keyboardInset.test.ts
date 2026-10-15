import { describe, it, expect, beforeEach } from "vitest";
import { installKeyboardInset, isTextEntry } from "./keyboardInset";

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
    Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
    document.documentElement.style.removeProperty("--kb-inset");
    document.documentElement.removeAttribute("data-typing");
    document.body.innerHTML = "";
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

  it("Android: okno niższe przy fokusie w polu → data-typing", () => {
    const { vv, fire } = fakeViewport(800);
    installKeyboardInset();
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    expect(document.documentElement.hasAttribute("data-typing")).toBe(false);
    Object.defineProperty(window, "innerHeight", { value: 500, configurable: true });
    vv.height = 500;
    fire();
    expect(document.documentElement.hasAttribute("data-typing")).toBe(true);
    // Klawiatura schowana „wstecz”, pole dalej aktywne.
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    vv.height = 800;
    fire();
    expect(document.documentElement.hasAttribute("data-typing")).toBe(false);
  });

  it("iOS: klawiatura nad polem → data-typing; bez fokusu w polu nie", () => {
    const { vv, fire } = fakeViewport(800);
    installKeyboardInset();
    vv.height = 480;
    fire();
    expect(document.documentElement.hasAttribute("data-typing")).toBe(false);
    const area = document.createElement("textarea");
    document.body.append(area);
    area.focus();
    expect(document.documentElement.hasAttribute("data-typing")).toBe(true);
  });

  it("obrót ekranu nie udaje klawiatury", () => {
    const { vv, fire } = fakeViewport(800);
    installKeyboardInset();
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    Object.defineProperty(window, "innerWidth", { value: 844, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 390, configurable: true });
    vv.height = 390;
    fire();
    expect(document.documentElement.hasAttribute("data-typing")).toBe(false);
  });

  it("isTextEntry: pola tekstowe tak, przyciski i pola tylko do odczytu nie", () => {
    const make = (html: string) => {
      document.body.innerHTML = html;
      return document.body.firstElementChild;
    };
    expect(isTextEntry(make('<input type="search">'))).toBe(true);
    expect(isTextEntry(make("<textarea></textarea>"))).toBe(true);
    expect(isTextEntry(make('<input type="checkbox">'))).toBe(false);
    expect(isTextEntry(make("<input readonly>"))).toBe(false);
    expect(isTextEntry(make("<button>x</button>"))).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});

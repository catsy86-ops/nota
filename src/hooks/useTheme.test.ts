import { describe, it, expect } from "vitest";
import { resolveDark, revealClip, revealRadius, shouldUseViewTransition } from "./useTheme";

describe("shouldUseViewTransition", () => {
  const base = { supported: true, reduced: false, enabled: true, changed: true };
  it("animuje, gdy wszystko pozwala", () => {
    expect(shouldUseViewTransition(base)).toBe(true);
  });
  it.each([
    ["brak wsparcia", { supported: false }],
    ["reduced motion", { reduced: true }],
    ["efekt wyłączony", { enabled: false }],
    ["pierwsze malowanie", { changed: false }],
  ])("nie animuje: %s", (_n, patch) => {
    expect(shouldUseViewTransition({ ...base, ...patch })).toBe(false);
  });
});

describe("resolveDark", () => {
  it("Zeszyt słucha przełącznika i systemu", () => {
    expect(resolveDark("dark", "zeszyt", false)).toBe(true);
    expect(resolveDark("light", "zeszyt", true)).toBe(false);
    expect(resolveDark("system", "zeszyt", true)).toBe(true);
  });
  it("styl z własnym schematem wygrywa z przełącznikiem", () => {
    expect(resolveDark("light", "neon", false)).toBe(true);
    expect(resolveDark("light", "plan", false)).toBe(true);
    expect(resolveDark("dark", "miedz", true)).toBe(false);
  });
});

describe("revealRadius", () => {
  it("koło od rogu zakrywa przeciwległy róg", () => {
    expect(revealRadius(0, 0, 300, 400)).toBe(500);
    expect(revealRadius(150, 0, 300, 400)).toBe(Math.ceil(Math.hypot(150, 400)));
  });
});

describe("revealClip — kształt wejścia stylu (plan motywów 2.4)", () => {
  it("Plan rozwija się od lewej, Matryca z góry, Hydraulika od dołu", () => {
    expect(revealClip("plan", 10, 10, 300, 400)).toEqual(["inset(0 100% 0 0)", "inset(0 0 0 0)"]);
    expect(revealClip("matrix", 10, 10, 300, 400)[0]).toBe("inset(0 0 100% 0)");
    expect(revealClip("hydraulika", 10, 10, 300, 400)[0]).toBe("inset(100% 0 0 0)");
  });
  it("Miedź rośnie kołem z prawego dolnego rogu", () => {
    expect(revealClip("miedz", 10, 10, 300, 400)).toEqual(["circle(0px at 300px 400px)", "circle(500px at 300px 400px)"]);
  });
  it("pozostałe style i zmiana jasności — koło od miejsca kliknięcia", () => {
    expect(revealClip("neon", 0, 0, 300, 400)).toEqual(["circle(0px at 0px 0px)", "circle(500px at 0px 0px)"]);
    expect(revealClip(null, 0, 0, 300, 400)[1]).toBe("circle(500px at 0px 0px)");
  });
});

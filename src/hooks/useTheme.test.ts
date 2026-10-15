import { describe, it, expect } from "vitest";
import { resolveDark, revealRadius, shouldUseViewTransition } from "./useTheme";

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

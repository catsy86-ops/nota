import { describe, it, expect } from "vitest";
import { shouldUseViewTransition } from "./useTheme";

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

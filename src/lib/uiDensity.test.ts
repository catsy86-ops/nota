import { beforeEach, describe, expect, it } from "vitest";
import { setUiDensity } from "@/lib/uiDensity";
import { APPEARANCE_KEYS } from "@/lib/appearanceCode";
import { readAppCss } from "@/test/appCss";

const css = readAppCss();

describe("gęstość interfejsu (plan motywów 4.2)", () => {
  beforeEach(() => { localStorage.clear(); setUiDensity("normal"); });

  it("kompakt i luźno ustawiają atrybut; standard go zdejmuje", () => {
    setUiDensity("compact");
    expect(document.documentElement.dataset.uiDensity).toBe("compact");
    setUiDensity("comfy");
    expect(document.documentElement.dataset.uiDensity).toBe("comfy");
    setUiDensity("normal");
    expect(document.documentElement.dataset.uiDensity).toBeUndefined();
  });

  it("klucz w kodzie wyglądu, a skalowanie tylko przy myszy (pointer: fine)", () => {
    expect(APPEARANCE_KEYS).toContain("kaczy.uiDensity.v1");
    expect(css).toMatch(/@media \(pointer: fine\) \{\s*html\[data-ui-density="compact"\] \{ --spacing: 0\.2rem; \}/);
  });
});

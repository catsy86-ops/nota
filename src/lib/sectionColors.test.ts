import { beforeEach, describe, expect, it } from "vitest";
import { setSectionColors } from "@/lib/sectionColors";
import { APPEARANCE_KEYS } from "@/lib/appearanceCode";
import { readAppCss } from "@/test/appCss";

const css = readAppCss();

describe("kolory działów: subtelne / wyraźne (plan motywów 3.4)", () => {
  beforeEach(() => { localStorage.clear(); setSectionColors("subtle"); });

  it("wyraźne ustawia data-sections na html, subtelne go zdejmuje", () => {
    setSectionColors("bold");
    expect(document.documentElement.dataset.sections).toBe("bold");
    setSectionColors("subtle");
    expect(document.documentElement.dataset.sections).toBeUndefined();
  });

  it("klucz w kodzie wyglądu, a grubość kreski zależy od trybu", () => {
    expect(APPEARANCE_KEYS).toContain("kaczy.sectionColors.v1");
    expect(css).toContain('html[data-sections="bold"] .section-title::after { height: 3px; opacity: 1; }');
  });
});

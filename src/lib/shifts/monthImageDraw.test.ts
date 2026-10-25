import { describe, expect, it } from "vitest";
import { imagePalette } from "./monthImageDraw";

describe("motyw obrazu miesiąca (4.3)", () => {
  it("jasny: białe tło i ciemny tekst", () => {
    const p = imagePalette("light");
    expect(p.bg).toBe("#ffffff");
    expect(p.ink).toBe("#1f2937");
  });

  it("ciemny: ciemne tło i jasny tekst, a etykieta na kolorowym kafelku zostaje ciemna", () => {
    const p = imagePalette("dark");
    expect(p.bg).toBe("#111827");
    expect(p.ink).toBe("#f9fafb");
    expect(p.chipInk).toBe("#111827");
  });

  it("aktywny styl bierze kolory z body, nie z palety stałej", () => {
    const p = imagePalette("style");
    expect(typeof p.bg).toBe("string");
    expect(p.empty).toBe("rgba(128, 128, 128, 0.25)");
  });
});

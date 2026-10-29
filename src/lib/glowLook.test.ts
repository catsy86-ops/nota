import { describe, it, expect } from "vitest";
import { DEFAULT_GLOW_LOOK, GLOW_COLORS, fabGlowValue } from "./glowLook";

describe("fabGlowValue", () => {
  it("domyślna siła i barwa nic nie nadpisują (null)", () => {
    expect(fabGlowValue(DEFAULT_GLOW_LOOK)).toBeNull();
  });

  it("wyłączona poświata to brak cienia", () => {
    expect(fabGlowValue({ strength: "off", color: "theme" })).toBe("none");
    expect(fabGlowValue({ strength: "off", color: "blue" })).toBe("none");
  });

  it("siła mnoży krycie halo (delikatna 50 %, mocna 80 % przy 50 % bazowym)", () => {
    expect(fabGlowValue({ strength: "soft", color: "theme" })).toContain("calc(50% * 0.5)");
    expect(fabGlowValue({ strength: "strong", color: "theme" })).toContain("calc(50% * 1.6)");
  });

  it("wybrana barwa wchodzi do cienia zamiast akcentu motywu", () => {
    const v = fabGlowValue({ strength: "normal", color: "blue" });
    expect(v).toContain(GLOW_COLORS.blue.hex!);
    expect(v).not.toContain("var(--primary)");
  });
});

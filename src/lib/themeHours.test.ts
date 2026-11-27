import { describe, expect, it } from "vitest";
import { resolveDark } from "@/hooks/useTheme";
import { darkByHours, THEME_HOURS_DEFAULT } from "@/lib/themeHours";

const at = (h: number, m = 0) => new Date(2026, 10, 27, h, m);

describe("Q3.3: jasność według pory", () => {
  it("domyślnie jasno od 7:00 do 19:00, ciemno poza tym", () => {
    expect(darkByHours(at(6, 59), THEME_HOURS_DEFAULT)).toBe(true);
    expect(darkByHours(at(7), THEME_HOURS_DEFAULT)).toBe(false);
    expect(darkByHours(at(18, 59), THEME_HOURS_DEFAULT)).toBe(false);
    expect(darkByHours(at(19), THEME_HOURS_DEFAULT)).toBe(true);
  });

  it("jasne przez północ (np. zmiana nocna) i równe godziny = zawsze jasno", () => {
    const night = { from: "22:00", to: "06:00" };
    expect(darkByHours(at(23), night)).toBe(false);
    expect(darkByHours(at(12), night)).toBe(true);
    expect(darkByHours(at(3), { from: "08:00", to: "08:00" })).toBe(false);
  });

  it("resolveDark: `time` w Zeszycie i w stylu z własnym wyborem, niezależnie od systemu", () => {
    expect(resolveDark("time", "zeszyt", true, {}, at(12), THEME_HOURS_DEFAULT)).toBe(false);
    expect(resolveDark("time", "zeszyt", false, {}, at(22), THEME_HOURS_DEFAULT)).toBe(true);
    expect(resolveDark("light", "neon", false, { neon: "time" }, at(22), THEME_HOURS_DEFAULT)).toBe(true);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { oledOn, setOled } from "@/lib/oled";
import { APPEARANCE_KEYS } from "@/lib/appearanceCode";
import { readAppCss } from "@/test/appCss";

const css = readAppCss();

describe("czarne tło OLED (plan motywów 3.3)", () => {
  beforeEach(() => { localStorage.clear(); setOled(false); });

  it("włączenie ustawia data-oled na html, wyłączenie je zdejmuje", () => {
    setOled(true);
    expect(document.documentElement.dataset.oled).toBe("on");
    expect(oledOn()).toBe(true);
    setOled(false);
    expect(document.documentElement.dataset.oled).toBeUndefined();
  });

  it("klucz jest w kodzie wyglądu, a reguła CSS działa tylko w ciemnym schemacie", () => {
    expect(APPEARANCE_KEYS).toContain("kaczy.oled.v1");
    expect(css).toContain('html[data-oled="on"][data-skin].dark { --background: oklch(0.0000 0.0000 0.00); }');
  });
});

import { describe, it, expect } from "vitest";
import { whatsappOrderUrl } from "./order";

describe("link WhatsApp do zamówień (U7)", () => {
  it("bez numeru hurtowni WhatsApp pyta o odbiorcę", () => {
    expect(whatsappOrderUrl("Kształtki")).toBe("https://wa.me/?text=Kszta%C5%82tki");
  });

  it("z numerem hurtowni link idzie do jej rozmowy (same cyfry)", () => {
    const url = whatsappOrderUrl("Kształtki", "22 000 00 00");
    expect(url).toMatch(/^https:\/\/wa\.me\/\d{9,}\?text=/);
    expect(url).not.toMatch(/\s/);
  });

  it("zepsuty numer nie psuje linku — wraca do wersji bez numeru", () => {
    expect(whatsappOrderUrl("x", "abc")).toBe("https://wa.me/?text=x");
  });
});

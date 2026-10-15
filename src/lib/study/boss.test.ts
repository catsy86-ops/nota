import { describe, expect, it } from "vitest";
import { cleanBoss, cleanGroup, formatPhone, normalizeGroupLink, normalizePhone, whatsappUrl, WHATSAPP_TEXT_MAX } from "./boss";

describe("szef — numer i link WhatsApp", () => {
  it("normalizePhone: kierunkowy, 00, polski bez kierunkowego, śmieci", () => {
    expect(normalizePhone("+48 600-100-200")).toBe("48600100200");
    expect(normalizePhone("0048 600 100 200")).toBe("48600100200");
    expect(normalizePhone("600 100 200")).toBe("48600100200");
    expect(normalizePhone("+49 151 2345 6789")).toBe("4915123456789");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("szef")).toBeNull();
  });

  it("formatPhone pokazuje polski numer w grupach", () => {
    expect(formatPhone("48600100200")).toBe("+48 600 100 200");
    expect(formatPhone("4915123456789")).toBe("+4915123456789");
  });

  it("cleanBoss odrzuca brak numeru, przycina imię", () => {
    expect(cleanBoss({ name: "Jan" })).toBeNull();
    expect(cleanBoss({ name: "  Jan Kowalski ", phone: "600100200" })).toEqual({ name: "Jan Kowalski", phone: "48600100200" });
  });

  it("whatsappUrl koduje tekst i przycina długi raport na granicy linii", () => {
    expect(whatsappUrl("48600100200", "Raport & zdjęcia")).toBe("https://wa.me/48600100200?text=Raport%20%26%20zdj%C4%99cia");
    const long = Array.from({ length: 400 }, (_, i) => `linia ${i}`).join("\n");
    const text = decodeURIComponent(whatsappUrl("48600100200", long).split("?text=")[1]);
    expect(text.length).toBeLessThan(WHATSAPP_TEXT_MAX + 60);
    expect(text).toMatch(/\nlinia \d+\n…\n\(raport skrócony — reszta w aplikacji\)$/);
  });

  it("grupa: link zaproszenia w różnych postaciach, nazwa obowiązkowa", () => {
    expect(normalizeGroupLink("chat.whatsapp.com/AbCdEf1234567890xyZ")).toBe("https://chat.whatsapp.com/AbCdEf1234567890xyZ");
    expect(normalizeGroupLink("http://chat.whatsapp.com/invite/AbCdEf1234567890xyZ/?utm=x")).toBe("https://chat.whatsapp.com/AbCdEf1234567890xyZ");
    expect(normalizeGroupLink("https://evil.com/AbCdEf1234567890xyZ")).toBeNull();
    expect(cleanGroup({ name: " Brygada ", link: "" })).toEqual({ name: "Brygada", link: "" });
    expect(cleanGroup({ name: "", link: "chat.whatsapp.com/AbCdEf1234567890xyZ" })).toBeNull();
    expect(cleanGroup({ name: "B", link: "zły" })).toEqual({ name: "B", link: "" });
  });
});

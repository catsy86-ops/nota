import { describe, expect, it } from "vitest";
import { mapsHref, prettyPhone, primaryCall, smsHref, telHref } from "./contact";
import { cleanSite } from "./sites";

describe("kontakt z karty budowy", () => {
  it("linki tel: i sms: z numerem kierunkowym", () => {
    expect(telHref("600 100-200")).toBe("tel:+48600100200");
    expect(smsHref("0048 (600) 100 200")).toBe("sms:+48600100200");
    expect(telHref("brak")).toBeNull();
    expect(telHref("")).toBeNull();
  });

  it("nawigacja do adresu", () => {
    expect(mapsHref("ul. Lipowa 5, Kraków")).toBe("https://www.google.com/maps/dir/?api=1&destination=ul.%20Lipowa%205%2C%20Krak%C3%B3w");
    expect(mapsHref("  ")).toBeNull();
  });

  it("czytelny zapis numeru, nie-numer bez zmian", () => {
    expect(prettyPhone("600100200")).toBe("+48 600 100 200");
    expect(prettyPhone(" u sąsiada ")).toBe("u sąsiada");
  });

  it("karta: pola kontaktu opcjonalne, puste wypadają, długie ucięte", () => {
    const card = cleanSite({ id: "a", name: "Lipowa", address: "", investor: "", created: 1, phone: " 600 100 200 ", manager: "", access: "x".repeat(500) });
    expect(card?.phone).toBe("600 100 200");
    expect(card && "manager" in card).toBe(false);
    expect(card?.access).toHaveLength(300);
  });
});

describe("primaryCall — telefon w „Przed wejściem”", () => {
  it("najpierw inwestor, bez jego numeru kierownik, bez numerów nic", () => {
    expect(primaryCall({ phone: "600 100 200", managerPhone: "700 800 900" })).toEqual({ href: "tel:+48600100200", label: "Zadzwoń do inwestora: +48 600 100 200" });
    expect(primaryCall({ phone: "brak", managerPhone: "700 800 900" })?.label).toBe("Zadzwoń do kierownika: +48 700 800 900");
    expect(primaryCall({})).toBeNull();
  });
});

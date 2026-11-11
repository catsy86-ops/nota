import { describe, it, expect } from "vitest";
import { cleanPricing, addPricingItem, removePricingItem, EMPTY_PRICING } from "./pricing";

describe("pricing", () => {
  it("cleanPricing: zwraca pusty pricing dla undefined", () => {
    const result = cleanPricing(undefined);
    expect(result).toEqual(EMPTY_PRICING);
  });

  it("cleanPricing: zwraca pusty pricing dla nie-obiektu", () => {
    const result = cleanPricing("string");
    expect(result).toEqual(EMPTY_PRICING);
  });

  it("cleanPricing: odrzuca pustą nazwę, ujemną i nieskończoną cenę, śmieci", () => {
    const data = {
      items: [
        { id: "p1", name: "WC", price: 350, pointType: "H-4", createdAt: 123 },
        { id: "p2", name: "  ", price: 100, pointType: "E-4", createdAt: 123 },
        { id: "p3", name: "Bateria", price: -50, pointType: "H-4", createdAt: 123 },
        { id: "p4", name: "Zawór", price: Infinity, pointType: "H-4", createdAt: 123 },
        null,
        "x",
      ],
    };
    expect(cleanPricing(data).items.map((i) => i.id)).toEqual(["p1"]);
  });

  it("cleanPricing: limity — nazwa 80 znaków, najwyżej 100 pozycji", () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ id: `p${i}`, name: "x".repeat(200), price: 1, pointType: "H-4", createdAt: 1 }));
    const out = cleanPricing({ items: many });
    expect(out.items).toHaveLength(100);
    expect(out.items[0].name).toHaveLength(80);
  });

  it("addPricingItem: zaokrągla cenę do groszy i nie przekracza limitu pozycji", () => {
    expect(addPricingItem(EMPTY_PRICING, "Kran", 12.345, "H-4").items[0].price).toBe(12.35);
    let p = EMPTY_PRICING;
    for (let i = 0; i < 100; i++) p = addPricingItem(p, `Poz ${i}`, 1, "H-4");
    expect(addPricingItem(p, "ponad limit", 1, "H-4").items).toHaveLength(100);
  });

  it("cleanPricing: zachowuje prawidłowe pozycje", () => {
    const data = {
      items: [
        { id: "p1", name: "WC", price: 350, pointType: "H-4", createdAt: 123 },
      ],
    };
    const result = cleanPricing(data);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("WC");
  });

  it("addPricingItem: dodaje nową pozycję", () => {
    const pricing = EMPTY_PRICING;
    const updated = addPricingItem(pricing, "WC podwieszane", 350, "H-4");
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].name).toBe("WC podwieszane");
    expect(updated.items[0].price).toBe(350);
    expect(updated.items[0].pointType).toBe("H-4");
  });

  it("addPricingItem: zwraca oryginał dla pustej nazwy", () => {
    const pricing = EMPTY_PRICING;
    const updated = addPricingItem(pricing, "", 350, "H-4");
    expect(updated).toEqual(EMPTY_PRICING);
  });

  it("addPricingItem: zwraca oryginał dla ujemnej ceny", () => {
    const pricing = EMPTY_PRICING;
    const updated = addPricingItem(pricing, "WC", -350, "H-4");
    expect(updated).toEqual(EMPTY_PRICING);
  });

  it("addPricingItem: przycina spacje z nazwy", () => {
    const pricing = EMPTY_PRICING;
    const updated = addPricingItem(pricing, "  WC  ", 350, "H-4");
    expect(updated.items[0].name).toBe("WC");
  });

  it("addPricingItem: utrzymuje porządek pozycji", () => {
    let pricing = EMPTY_PRICING;
    pricing = addPricingItem(pricing, "Pozycja 1", 100, "H-4");
    pricing = addPricingItem(pricing, "Pozycja 2", 200, "E-4");
    expect(pricing.items).toHaveLength(2);
    expect(pricing.items[0].name).toBe("Pozycja 1");
    expect(pricing.items[1].name).toBe("Pozycja 2");
  });

  it("removePricingItem: usuwa pozycję po ID", () => {
    let pricing = EMPTY_PRICING;
    pricing = addPricingItem(pricing, "WC", 350, "H-4");
    const id = pricing.items[0].id;
    const updated = removePricingItem(pricing, id);
    expect(updated.items).toHaveLength(0);
  });

  it("removePricingItem: zwraca oryginał dla nieistniejącego ID", () => {
    const pricing = addPricingItem(EMPTY_PRICING, "WC", 350, "H-4");
    const updated = removePricingItem(pricing, "nonexistent");
    expect(updated.items).toHaveLength(1);
  });

  it("removePricingItem: usuwa tylko wybraną pozycję", () => {
    let pricing = EMPTY_PRICING;
    pricing = addPricingItem(pricing, "Pozycja 1", 100, "H-4");
    pricing = addPricingItem(pricing, "Pozycja 2", 200, "E-4");
    const id = pricing.items[0].id;
    const updated = removePricingItem(pricing, id);
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0].name).toBe("Pozycja 2");
  });
});

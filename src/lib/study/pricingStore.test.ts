import { beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYPricing, legacyId } from "./yPricing";
import { addPricingItem, PRICING_ITEMS_MAX } from "@/lib/pricing";
import { importLegacyPricing, LEGACY_PRICES_KEY, LEGACY_PRICING_KEY, getPricing, getPrices, pricingDump, setFittingPrice, setPricing } from "./pricingStore";
import { yjsStore } from "@/lib/yjsStore";

const sync = (a: Y.Doc, b: Y.Doc) => {
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
};

describe("createYPricing: robocizna i ceny kształtek w Yjs (4.1)", () => {
  it("dwa telefony dodające różne pozycje i ceny scalają się bez strat", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const ya = createYPricing(a);
    const yb = createYPricing(b);
    ya.setLabor(addPricingItem({ items: [] }, "WC podwieszane", 350, "H-4"));
    yb.setLabor(addPricingItem({ items: [] }, "Wymiana baterii", 120, "H-4"));
    ya.setMaterial("kolano 16", 4.5);
    yb.setMaterial("trojnik 16", 6);
    sync(a, b);
    for (const y of [ya, yb]) {
      expect(y.labor().items.map((i) => i.name).sort()).toEqual(["WC podwieszane", "Wymiana baterii"]);
      expect(y.materials()).toEqual({ "kolano 16": 4.5, "trojnik 16": 6 });
    }
  });

  it("setLabor zachowuje się jak dawne setPricing: usuwa brakujące, dopisuje nowe", () => {
    const y = createYPricing(new Y.Doc());
    // Jawne czasy założenia: dwie pozycje dodane w tej samej milisekundzie sortowałyby się po losowym id.
    const two = { items: [{ ...addPricingItem({ items: [] }, "A", 10, "H-4").items[0], createdAt: 1 }, { ...addPricingItem({ items: [] }, "B", 20, "H-4").items[0], createdAt: 2 }] };
    y.setLabor(two);
    expect(y.labor().items.map((i) => i.name)).toEqual(["A", "B"]);
    y.setLabor({ items: two.items.filter((i) => i.name !== "A") });
    expect(y.labor().items.map((i) => i.name)).toEqual(["B"]);
    y.setLabor({ items: [] });
    expect(y.labor().items).toEqual([]);
  });

  it("cena kształtki: zła cena odrzucona, null usuwa, limit pozycji", () => {
    const y = createYPricing(new Y.Doc());
    expect(y.setMaterial("kolano", -1)).toBe(false);
    expect(y.setMaterial("kolano", 1e9)).toBe(false);
    expect(y.setMaterial("kolano", 3.456)).toBe(true);
    expect(y.materials().kolano).toBe(3.46);
    expect(y.setMaterial("kolano", null)).toBe(true);
    expect(y.materials()).toEqual({});
    for (let n = 0; n < 1000; n++) y.setMaterial(`k${n}`, 1);
    expect(y.setMaterial("nowa", 1)).toBe(false);
    expect(y.setMaterial("k5", 2)).toBe(true);
  });

  it("limit pozycji robocizny to 300; nadwyżka jest pomijana", () => {
    expect(PRICING_ITEMS_MAX).toBe(300);
    const y = createYPricing(new Y.Doc());
    let p = { items: [] as ReturnType<typeof addPricingItem>["items"] };
    for (let n = 0; n < 310; n++) p = addPricingItem(p, `Poz ${n}`, 1, "H-4");
    expect(p.items).toHaveLength(300);
    y.setLabor(p);
    expect(y.labor().items).toHaveLength(300);
  });

  it("śmieci w dokumencie (zła cena, brak nazwy) nie psują cennika", () => {
    const doc = new Y.Doc();
    const y = createYPricing(doc);
    const map = doc.getMap<unknown>("studyPricing");
    map.set("l\u0001x", { name: "", price: 5, pointType: "H-4", createdAt: 1 });
    map.set("l\u0001y", { name: "Dobra", price: 5, pointType: "H-4", createdAt: 2 });
    map.set("l\u0001z", { name: "Zła cena", price: -3, pointType: "H-4", createdAt: 3 });
    map.set("m\u0001kolano", "tanio");
    expect(y.labor().items.map((i) => i.name)).toEqual(["Dobra"]);
    expect(y.materials()).toEqual({});
  });

  it("mergeDump dodaje brakujące, nie nadpisuje i nie kasuje", () => {
    const y = createYPricing(new Y.Doc());
    y.setLabor(addPricingItem({ items: [] }, "Lokalna", 100, "H-4"));
    y.setMaterial("kolano", 5);
    const src = createYPricing(new Y.Doc());
    src.setLabor(addPricingItem({ items: [] }, "Z kopii", 200, "H-4"));
    src.setMaterial("kolano", 9);
    src.setMaterial("trojnik", 7);
    y.mergeDump(JSON.parse(JSON.stringify(src.dump())));
    expect(y.labor().items.map((i) => i.name).sort()).toEqual(["Lokalna", "Z kopii"]);
    expect(y.materials()).toEqual({ kolano: 5, trojnik: 7 });
    y.mergeDump(null);
    y.mergeDump({ labor: "x", materials: 5 });
    expect(y.labor().items).toHaveLength(2);
  });
});

describe("import starych cenników z localStorage (4.1)", () => {
  beforeEach(async () => {
    localStorage.clear();
    await yjsStore.resetForTests();
    setPricing({ items: [] });
    for (const k of Object.keys(getPrices())) setFittingPrice(k, null);
  });

  const legacy = {
    items: [
      { id: "p1", name: "WC podwieszane", price: 350, pointType: "H-4", createdAt: 1 },
      { id: "p2", name: "Wymiana baterii", price: 120.5, pointType: "H-4", createdAt: 2 },
    ],
  };

  it("przenosi robociznę i ceny kształtek do dokumentu i usuwa stare klucze", () => {
    localStorage.setItem(LEGACY_PRICING_KEY, JSON.stringify(legacy));
    localStorage.setItem(LEGACY_PRICES_KEY, JSON.stringify({ "kolano 16": 4.5, zla: -1 }));
    expect(importLegacyPricing()).toBe(true);
    expect(getPricing().items.map((i) => i.name)).toEqual(["WC podwieszane", "Wymiana baterii"]);
    expect(getPrices()).toEqual({ "kolano 16": 4.5 });
    expect(localStorage.getItem(LEGACY_PRICING_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_PRICES_KEY)).toBeNull();
  });

  it("drugi import nic nie robi, więc usunięta pozycja nie wraca", () => {
    localStorage.setItem(LEGACY_PRICING_KEY, JSON.stringify(legacy));
    importLegacyPricing();
    setPricing({ items: getPricing().items.filter((i) => i.name !== "WC podwieszane") });
    expect(importLegacyPricing()).toBe(false);
    expect(getPricing().items.map((i) => i.name)).toEqual(["Wymiana baterii"]);
  });

  it("ta sama pozycja zaimportowana na dwóch telefonach to jeden wpis (id z treści)", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const ya = createYPricing(a);
    const yb = createYPricing(b);
    // Dwa telefony, każdy z własnym id tej samej pozycji w starym cenniku.
    ya.mergeDump({ labor: [{ ...legacy.items[0], id: "telefon-A" }] }, true);
    yb.mergeDump({ labor: [{ ...legacy.items[0], id: "telefon-B" }, legacy.items[1]] }, true);
    sync(a, b);
    expect(ya.labor().items.map((i) => i.name).sort()).toEqual(["WC podwieszane", "Wymiana baterii"]);
    expect(legacyId(legacy.items[0])).toBe(legacyId({ ...legacy.items[0], name: "  wc PODWIESZANE" }));
  });

  it("uszkodzony stary zapis jest usuwany i nie wywraca startu; brak kluczy to brak importu", () => {
    expect(importLegacyPricing()).toBe(false);
    localStorage.setItem(LEGACY_PRICING_KEY, "{nie json");
    expect(importLegacyPricing()).toBe(false);
    expect(localStorage.getItem(LEGACY_PRICING_KEY)).toBeNull();
    expect(importLegacyPricing(null)).toBe(false);
  });

  it("zrzut zawiera robociznę i ceny dla kopii zapasowej", () => {
    setPricing(addPricingItem({ items: [] }, "Kran", 99, "H-4"));
    setFittingPrice("Kolano 16", 4.5);
    const d = pricingDump();
    expect(d.labor.map((i) => i.name)).toEqual(["Kran"]);
    expect(d.materials).toEqual({ "kolano 16": 4.5 });
  });
});

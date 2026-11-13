import { describe, expect, it } from "vitest";
import { itemsFromPoints, itemsFromUsage } from "./quoteFromSite";

const points = (...types: string[]) => types.map((type) => ({ type }));

describe("pozycje z punktów (4.4)", () => {
  it("jedna pozycja na typ: liczba punktów × stawka typu, a bez stawki typu — stawka domyślna", () => {
    const p = itemsFromPoints(points("umywalka", "umywalka", "wc-stelaz", "prysznic"), { pointRate: 100, typeRates: { umywalka: 150 } }, []);
    expect(p.items).toEqual([
      { kind: "labor", name: "Umywalka — punkt", qty: 2, unit: "pkt", price: 150 },
      { kind: "labor", name: "WC (stelaż) — punkt", qty: 1, unit: "pkt", price: 100 },
      { kind: "labor", name: "Prysznic — punkt", qty: 1, unit: "pkt", price: 100 },
    ]);
    expect(p.noPrice).toEqual([]);
  });

  it("typ bez żadnej stawki trafia do „bez stawki”, a nieznany typ liczy się jako „Inny”", () => {
    const p = itemsFromPoints(points("umywalka", "kocioł-nieznany"), { typeRates: { umywalka: 80 } }, []);
    expect(p.items.map((i) => i.name)).toEqual(["Umywalka — punkt"]);
    expect(p.noPrice).toEqual(["Inny"]);
  });

  it("nie dodaje drugi raz tego, co już jest w wycenie (bez ogonków i wielkości liter)", () => {
    const p = itemsFromPoints(points("zlew", "wanna"), { pointRate: 90, typeRates: {} }, [{ name: "ZLEW — punkt" }]);
    expect(p.items.map((i) => i.name)).toEqual(["Wanna — punkt"]);
    expect(p.existing).toEqual(["Zlew — punkt"]);
  });

  it("brak punktów daje pustą propozycję", () => {
    expect(itemsFromPoints([], { pointRate: 100, typeRates: {} }, [])).toEqual({ items: [], noPrice: [], existing: [] });
  });
});

describe("pozycje ze zużytego materiału (4.4)", () => {
  const usage = {
    total: [{ name: "Kolano 16", qty: 12 }, { name: "Trójnik 16", qty: 3 }, { name: "Dziwna kształtka", qty: 1 }],
    totalPipes: [{ name: "Rura PEX 16×2", cm: 1250 }, { name: "Rura bez ceny", cm: 300 }],
  };
  const prices = { "kolano 16": 4.5, "trojnik 16": 6, "rura pex 16×2": 3.2 };

  it("kształtki w sztukach, rury w metrach, każda z ceną z cennika", () => {
    const p = itemsFromUsage(usage, prices, []);
    expect(p.items).toEqual([
      { kind: "material", name: "Kolano 16", qty: 12, unit: "szt.", price: 4.5 },
      { kind: "material", name: "Trójnik 16", qty: 3, unit: "szt.", price: 6 },
      { kind: "material", name: "Rura PEX 16×2", qty: 12.5, unit: "m", price: 3.2 },
    ]);
    expect(p.noPrice).toEqual(["Dziwna kształtka", "Rura bez ceny"]);
  });

  it("pomija pozycje już obecne w wycenie, a pusty cennik nic nie dodaje", () => {
    const p = itemsFromUsage(usage, prices, [{ name: "kolano  16" }]);
    expect(p.items.map((i) => i.name)).toEqual(["Trójnik 16", "Rura PEX 16×2"]);
    expect(p.existing).toEqual(["Kolano 16"]);
    expect(itemsFromUsage(usage, {}, []).items).toEqual([]);
  });

  it("bardzo mała długość rury (1 cm) mieści się w ilości, a zerowa nie", () => {
    expect(itemsFromUsage({ total: [], totalPipes: [{ name: "Rura", cm: 1 }] }, { rura: 2 }, []).items[0]).toMatchObject({ qty: 0.01, unit: "m" });
    expect(itemsFromUsage({ total: [], totalPipes: [{ name: "Rura", cm: 0 }] }, { rura: 2 }, []).noPrice).toEqual(["Rura"]);
  });
});

import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { cleanVanEvent, cleanVanItem, parseVanQty, usedSince, vanStock, type VanItem } from "./van";
import { createYVan } from "./yVan";
import { wholesaleText } from "./order";

const kolano: VanItem = { id: "k", name: "Kolano 16", unit: "szt.", min: 10, at: 100, order: 0 };
const rura: VanItem = { id: "r", name: "Rura PEX 16×2", unit: "m", at: 100, order: 1 };
const e = (at: number, over: Record<string, unknown> = {}) => ({ at, fittings: [{ name: "kolano 16", qty: 4 }], pipes: [{ name: "Rura PEX 16×2", cm: 250 }], ...over });

describe("materiał w aucie — stan z historii (H1.3)", () => {
  it("inwentaryzacja + przyjęcia − zużycie „z auta” po niej; dostawa na budowę się nie liczy", () => {
    const events = [
      { id: "c1", item: "k", kind: "count" as const, qty: 20, at: 200 },
      { id: "i1", item: "k", kind: "in" as const, qty: 5, at: 300 },
      { id: "i0", item: "k", kind: "in" as const, qty: 99, at: 150 },
    ];
    const journal = [e(150), e(250), e(350, { supply: "site" }), e(400)];
    const s = vanStock(kolano, events, journal);
    expect(s.qty).toBe(20 + 5 - 4 - 4);
    expect(s.countedAt).toBe(200);
    expect(s.toBuy).toBe(0);
    expect(vanStock(kolano, [], journal).qty).toBe(-12);
    expect(vanStock(kolano, [], journal).toBuy).toBe(22);
  });

  it("rury liczone w metrach z centymetrów wpisu", () => {
    expect(usedSince(rura, [e(150), e(160)], 100)).toBe(5);
  });

  it("czyszczenie: zła jednostka → sztuki, przyjęcie 0 odpada, inwentaryzacja 0 zostaje", () => {
    expect(cleanVanItem({ name: " Kolano ", unit: "kg", at: 1 }, "x")).toMatchObject({ name: "Kolano", unit: "szt." });
    expect(cleanVanEvent({ kind: "in", qty: 0, at: 1 }, "x", "e")).toBeNull();
    expect(cleanVanEvent({ kind: "count", qty: 0, at: 1 }, "x", "e")).toMatchObject({ qty: 0 });
    expect(parseVanQty("2,5")).toBe(2.5);
  });

  it("Yjs: dwa telefony dopisują przyjęcia bez nadpisywania; usunięcie z „Cofnij”; ostatni wybór budowy", () => {
    const a = new Y.Doc(), b = new Y.Doc();
    const ya = createYVan(a), yb = createYVan(b);
    ya.saveItem(kolano);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    ya.addEvent({ id: "x", item: "k", kind: "in", qty: 3, at: 500 });
    yb.addEvent({ id: "y", item: "k", kind: "in", qty: 4, at: 600 });
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(vanStock(kolano, ya.get().events, []).qty).toBe(7);
    expect(vanStock(kolano, yb.get().events, []).qty).toBe(7);
    const removed = ya.removeItem("k")!;
    expect(ya.get().items).toHaveLength(0);
    ya.restoreItem(removed);
    expect(ya.get().events).toHaveLength(2);
    ya.setSiteSupply("lipowa", "site");
    expect(ya.get().siteSupply).toEqual({ lipowa: "site" });
    const other = createYVan(new Y.Doc());
    other.mergeDump(JSON.parse(JSON.stringify(ya.dump())));
    expect(other.get().events).toHaveLength(2);
  });

  it("lista do hurtowni: grupa „Do auta”", () => {
    expect(wholesaleText([], [{ name: "Kolano 16", qty: 6, unit: "szt." }]).split(String.fromCharCode(10))).toEqual(["Zamówienie do hurtowni", "", "Do auta:", "- Kolano 16: 6 szt."]);
  });
});

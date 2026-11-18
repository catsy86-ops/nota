import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYKits } from "./yKits";
import { createYVan } from "./yVan";
import { createYPricing } from "./yPricing";
import { createYStudy } from "./yStudy";
import { createYPoints } from "./yPoints";

// D1.1 (`docs/plan-migracje-yjs-2026-11-15.md`): pole nowszej wersji (`xFuture`) przeżywa zapis na tej wersji
// w zestawach, aucie, szablonach wyceny, danych szefa i własnych pytaniach.

const SEP = "\u0001";

describe("D1.1 Praca: nieznane pola przy edycji", () => {
  it("zestaw: zmiana nazwy zostawia pole", () => {
    const doc = new Y.Doc();
    const kits = createYKits(doc);
    const kit = { id: "k1", name: "WC", fittings: [{ name: "kolano 16", qty: 2 }], pipes: [] };
    expect(kits.save(kit)).toBe(true);
    const k = `k${SEP}k1`;
    doc.getMap("studyKits").set(k, { ...(doc.getMap("studyKits").get(k) as object), xFuture: 1 });
    expect(kits.save({ ...kit, name: "WC podwieszane" })).toBe(true);
    expect(doc.getMap("studyKits").get(k)).toMatchObject({ name: "WC podwieszane", xFuture: 1 });
  });

  it("auto: edycja pozycji zostawia pole", () => {
    const doc = new Y.Doc();
    const van = createYVan(doc);
    const item = { id: "i1", name: "Złączka", unit: "szt." as const, at: 1, order: 0 };
    expect(van.saveItem(item)).toBe(true);
    const k = `i${SEP}i1`;
    doc.getMap("studyVan").set(k, { ...(doc.getMap("studyVan").get(k) as object), xFuture: "a" });
    expect(van.saveItem({ ...item, name: "Złączka 16" })).toBe(true);
    expect(doc.getMap("studyVan").get(k)).toMatchObject({ name: "Złączka 16", xFuture: "a" });
  });

  it("szablon wyceny: ponowny zapis zostawia pole", () => {
    const doc = new Y.Doc();
    const pricing = createYPricing(doc);
    const t = { id: "t1", name: "Łazienka", items: [{ name: "Montaż WC", qty: 1, price: 300 }], createdAt: 1 };
    expect(pricing.saveTemplate(t as never)).toBe(true);
    const k = `t${SEP}t1`;
    doc.getMap("studyPricing").set(k, { ...(doc.getMap("studyPricing").get(k) as object), xFuture: true });
    expect(pricing.saveTemplate({ ...t, name: "Łazienka 2" } as never)).toBe(true);
    expect(doc.getMap("studyPricing").get(k)).toMatchObject({ name: "Łazienka 2", xFuture: true });
  });

  it("szef, grupa i własne pytanie: nadpisanie zostawia pole", () => {
    const doc = new Y.Doc();
    const s = createYStudy(doc);
    doc.getMap("studyMeta").set("boss", { name: "Jan", phone: "48600100200", xFuture: 2 });
    s.setBoss({ name: "Jan K.", phone: "48600100200" });
    expect(doc.getMap("studyMeta").get("boss")).toEqual({ name: "Jan K.", phone: "48600100200", xFuture: 2 });
    const q = { kind: "item" as const, id: "c-1", topic: "t", text: "Sprawdź spadek" };
    s.addCustom(q);
    doc.getMap("studyCustom").set("c-1", { ...q, xFuture: "z" });
    s.updateCustom({ ...q, text: "Sprawdź spadek rury" });
    expect(doc.getMap("studyCustom").get("c-1")).toEqual({ ...q, text: "Sprawdź spadek rury", xFuture: "z" });
  });
  it("pomieszczenie i punkt: zmiana nazwy i zapis punktu zostawiają pole", () => {
    const doc = new Y.Doc();
    const pts = createYPoints(doc);
    expect(pts.addRoom("s1", { id: "r1", name: "Łazienka", order: 0 })).toBe(true);
    const rk = `r${SEP}s1${SEP}r1`;
    doc.getMap("studyPoints").set(rk, { ...(doc.getMap("studyPoints").get(rk) as object), xFuture: 1 });
    pts.renameRoom("s1", "r1", "Łazienka górna");
    expect(doc.getMap("studyPoints").get(rk)).toMatchObject({ name: "Łazienka górna", xFuture: 1 });
    const point = { id: "p1", room: "r1", type: "umywalka", sides: [], steps: {}, order: 0 };
    expect(pts.savePoint("s1", point as never)).toBe(true);
    const pk = `p${SEP}s1${SEP}p1`;
    doc.getMap("studyPoints").set(pk, { ...(doc.getMap("studyPoints").get(pk) as object), xFuture: 2 });
    expect(pts.savePoint("s1", { ...point, height: 60 } as never)).toBe(true);
    expect(doc.getMap("studyPoints").get(pk)).toMatchObject({ height: 60, xFuture: 2 });
  });

  it("runda quizu: statystyka urządzenia i karta powtórki zostawiają pole", () => {
    const doc = new Y.Doc();
    const s = createYStudy(doc);
    doc.getMap("studyRounds").set("dev", { rounds: 1, best: 50, xFuture: "r" });
    doc.getMap("studyReview").set("q1", { reps: 1, interval: 1, ease: 2.5, due: "2026-11-18", last: "2026-11-17", lapses: 0, seen: 1, right: 1, xFuture: "c" });
    s.recordRound("dev", 80, "2026-11-18", [], [{ id: "q1", ok: true }]);
    expect(doc.getMap("studyRounds").get("dev")).toEqual({ rounds: 2, best: 80, xFuture: "r" });
    expect(doc.getMap("studyReview").get("q1")).toMatchObject({ last: "2026-11-18", xFuture: "c" });
  });
});

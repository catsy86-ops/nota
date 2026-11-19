import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { copyField, deriveField, mergeInto, objectsToFieldMaps, readRenamed, splitInto } from "./patterns";

const items = (doc: Y.Doc) => doc.getMap<unknown>("items");

/** Dwa urządzenia z tym samym stanem migrują niezależnie i wymieniają się — wynik musi być ten sam. */
function convergent(seed: (d: Y.Doc) => void, migrate: (d: Y.Doc) => void) {
  const a = new Y.Doc();
  seed(a);
  const b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  a.transact(() => migrate(a));
  b.transact(() => migrate(b));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  expect(a.toJSON()).toEqual(b.toJSON());
  return a;
}

describe("wzorce migracji (D2.5)", () => {
  it("zmiana nazwy pola: kopia, stare zostaje, nowe wygrywa przy odczycie, powtórka nic nie zmienia", () => {
    const doc = convergent((d) => { items(d).set("a", { kwota: 5 }); items(d).set("b", { kwota: 1, amount: 9 }); }, (d) => copyField(items(d), "kwota", "amount"));
    expect(items(doc).toJSON()).toEqual({ a: { kwota: 5, amount: 5 }, b: { kwota: 1, amount: 9 } });
    expect(copyField(items(doc), "kwota", "amount")).toBe(0);
    expect(readRenamed({ kwota: 3 }, "kwota", "amount")).toBe(3);
    expect(readRenamed({ kwota: 3, amount: 4 }, "kwota", "amount")).toBe(4);
  });

  it("zmiana jednostki: nowe pole ze starego, stare bez zmian", () => {
    const doc = convergent((d) => { items(d).set("a", { zl: 12.5 }); items(d).set("b", { zl: "x" }); },
      (d) => deriveField(items(d), "zl", "grosze", (v) => (typeof v === "number" ? Math.round(v * 100) : undefined)));
    expect(items(doc).toJSON()).toEqual({ a: { zl: 12.5, grosze: 1250 }, b: { zl: "x" } });
  });

  it("obiekt → Y.Map pól: identyfikatory z danych, źródło zostaje, równoległe migracje zbieżne", () => {
    const doc = convergent((d) => items(d).set("k1", { name: "Rura", qty: 2 }),
      (d) => objectsToFieldMaps(items(d), d.getMap("itemsV2")));
    const v2 = doc.getMap<Y.Map<unknown>>("itemsV2");
    expect(v2.get("k1")).toBeInstanceOf(Y.Map);
    expect(v2.get("k1")!.toJSON()).toEqual({ name: "Rura", qty: 2 });
    expect(items(doc).get("k1")).toEqual({ name: "Rura", qty: 2 });
    // Po migracji edycje różnych pól na dwóch urządzeniach się nie gubią.
    const b = new Y.Doc();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(doc));
    doc.getMap<Y.Map<unknown>>("itemsV2").get("k1")!.set("name", "Rura 16");
    b.getMap<Y.Map<unknown>>("itemsV2").get("k1")!.set("qty", 3);
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(b));
    expect(v2.get("k1")!.toJSON()).toEqual({ name: "Rura 16", qty: 3 });
  });

  it("podział i scalanie map bez usuwania źródeł", () => {
    const doc = convergent((d) => { items(d).set("a", { t: "x" }); items(d).set("b", { t: "y" }); d.getMap("other").set("a", { t: "z" }); d.getMap("other").set("c", 1); }, (d) => {
      splitInto(items(d), d.getMap("onlyX"), (v) => (v as { t: string }).t === "x");
      mergeInto([items(d), d.getMap("other")], d.getMap("all"));
    });
    expect(doc.getMap("onlyX").toJSON()).toEqual({ a: { t: "x" } });
    expect(doc.getMap("all").toJSON()).toEqual({ a: { t: "x" }, b: { t: "y" }, c: 1 });
    expect(items(doc).size).toBe(2);
  });
});

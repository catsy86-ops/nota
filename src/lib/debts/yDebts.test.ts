import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYDebts } from "./yDebts";
import type { DebtEntry } from "./model";

const entry = (id: string, over: Partial<DebtEntry> = {}): DebtEntry => ({
  id, person: "Anna", kind: "lent", amount: 1000, at: "2026-10-10", note: "", created: 1, ...over,
});

describe("createYDebts", () => {
  it("dwa urządzenia dopisujące różne pożyczki scalają się bez strat", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const da = createYDebts(a);
    const db = createYDebts(b);
    da.add(entry("x"));
    db.add(entry("y", { person: "Ola" }));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(da.get().map((e) => e.id).sort()).toEqual(["x", "y"]);
    expect(db.get().map((e) => e.id).sort()).toEqual(["x", "y"]);
  });

  it("usunięcie zwraca wpis do cofnięcia, a przywrócenie wraca z tym samym id", () => {
    const d = createYDebts(new Y.Doc());
    d.add(entry("x"));
    const removed = d.remove("x");
    expect(removed?.id).toBe("x");
    expect(d.get()).toHaveLength(0);
    d.restore(removed!);
    expect(d.get().map((e) => e.id)).toEqual(["x"]);
  });

  it("pomija śmieci wpisane przez peera i nie dodaje tego samego id dwa razy", () => {
    const doc = new Y.Doc();
    const d = createYDebts(doc);
    doc.getMap("debts").set("bad", { id: "bad", kind: "lent" });
    expect(d.add(entry("x"))).toBe(true);
    expect(d.add(entry("x"))).toBe(false);
    expect(d.get().map((e) => e.id)).toEqual(["x"]);
  });

  it("powiadamia subskrybentów przy zmianie", () => {
    const d = createYDebts(new Y.Doc());
    let calls = 0;
    d.subscribe(() => calls++);
    d.add(entry("x"));
    expect(calls).toBeGreaterThan(0);
  });
});

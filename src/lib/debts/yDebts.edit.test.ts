import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createYDebts } from "./yDebts";
import type { DebtEntry } from "./model";

const debt = (id: string, over: Partial<DebtEntry> = {}): DebtEntry =>
  ({ id, person: "Ania", kind: "lent", amount: 10_000, at: "2026-10-10", note: "", created: 1, ...over }) as DebtEntry;

describe("createYDebts — edycja i kopia", () => {
  it("replace zmienia wpis o tym samym id, a dla nieistniejącego zwraca false", () => {
    const y = createYDebts(new Y.Doc());
    y.add(debt("a"));
    expect(y.replace(debt("a", { amount: 15_000 }))).toBe(true);
    expect(y.get()[0].amount).toBe(15_000);
    expect(y.replace(debt("nie-ma"))).toBe(false);
    expect(y.get()).toHaveLength(1);
  });

  it("scalanie z kopii dodaje brakujące pożyczki i nie nadpisuje wpisu o tym samym id", () => {
    const y = createYDebts(new Y.Doc());
    y.add(debt("a", { amount: 9_900 }));
    y.mergeDump([debt("a", { amount: 1 }), debt("b", { person: "Marek" }), { id: "zepsuty" }]);
    const byId = Object.fromEntries(y.get().map((e) => [e.id, e]));
    expect(Object.keys(byId).sort()).toEqual(["a", "b"]);
    expect(byId.a.amount).toBe(9_900);
  });
});

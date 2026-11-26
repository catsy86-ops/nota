import { describe, expect, it } from "vitest";
import fc from "fast-check";
import * as Y from "yjs";
import { convergenceProperty, runScript, type ConvergenceDomain, type Step } from "./convergence";

/**
 * Z-17.9 §5: pomocnik zbieżności ma wykrywać błędy, a nie tylko świecić na zielono. Dział-atrapa (mapa wpisów
 * `{ id, v }`) w wersji poprawnej przechodzi, a trzy celowo zepsute wersje padają na właściwej własności:
 * projekcja bez rozstrzygnięcia kolejności → W1, pamięć podręczna budowana tylko ze zdarzeń → W2,
 * obserwator piszący przy odbiorze → W3.
 */

type Op = { k: "set"; id: string; v: number } | { k: "del"; id: string };
type Store = { map: Y.Map<{ id: string; v: number }>; doc: Y.Doc; cache?: Map<string, number> };

const ops = (device: number): fc.Arbitrary<Op> => fc.oneof(
  fc.record({ k: fc.constant("set" as const), id: fc.constantFrom("a", "b", `n${device}`), v: fc.integer({ min: 0, max: 3 }) }),
  fc.record({ k: fc.constant("del" as const), id: fc.constantFrom("a", "b") }),
);
const apply = (s: Store, op: Op) => {
  if (op.k === "set") s.map.set(op.id, { id: op.id, v: op.v });
  else s.map.delete(op.id);
};

const good: ConvergenceDomain<Store, Op> = {
  name: "atrapa",
  create: (doc) => ({ doc, map: doc.getMap("items") }),
  ops, apply,
  project: (s) => [...s.map.values()].sort((x, y) => (x.id < y.id ? -1 : 1)),
};

// W1: kolejność z iteracji `Y.Map` — zależy od kolejności odbioru.
const unsorted: ConvergenceDomain<Store, Op> = { ...good, name: "bez-kolejnosci", project: (s) => [...s.map.values()] };

// W2: projekcja z pamięci budowanej wyłącznie ze zdarzeń — świeżo otwarty magazyn ze stanu nie dostaje zdarzeń.
const eventCache: ConvergenceDomain<Store, Op> = {
  ...good,
  name: "pamiec-ze-zdarzen",
  create: (doc) => {
    const map = doc.getMap<{ id: string; v: number }>("items");
    const cache = new Map<string, number>();
    map.observe((e) => e.keysChanged.forEach((k) => { const x = map.get(k); if (x) cache.set(k, x.v); else cache.delete(k); }));
    return { doc, map, cache };
  },
  project: (s) => [...s.cache!].sort(([a], [b]) => (a < b ? -1 : 1)),
};

// W3: obserwator dopisuje znacznik przy każdym odbiorze (poza projekcją) — dwa urządzenia odbijałyby zmiany bez końca.
const writesOnReceive: ConvergenceDomain<Store, Op> = {
  ...good,
  name: "zapis-przy-odbiorze",
  create: (doc) => {
    const map = doc.getMap<{ id: string; v: number }>("items");
    doc.on("afterTransaction", (t) => { if (!t.local) doc.getMap("meta").set("seen", doc.clientID); });
    return { doc, map };
  },
};

const conflict: Step<Op>[] = [
  { k: "op", d: 0, op: { k: "set", id: "n0", v: 1 } },
  { k: "op", d: 1, op: { k: "set", id: "n1", v: 2 } },
];

describe("pomocnik zbieżności (Z-17.9 §5)", () => {
  it("poprawny dział przechodzi losowe przebiegi", () => {
    fc.assert(convergenceProperty(good), { numRuns: 100 });
  });

  it("projekcja bez kolejności — W1", () => {
    expect(runScript(unsorted, conflict)).toMatchObject({ ok: false, property: "W1" });
  });

  it("pamięć budowana tylko ze zdarzeń — W2", () => {
    expect(runScript(eventCache, conflict)).toMatchObject({ ok: false, property: "W2" });
  });

  it("zapis przy odbiorze — W3", () => {
    expect(runScript(writesOnReceive, conflict)).toMatchObject({ ok: false, property: "W3" });
  });

  it("losowy przebieg też łapie zepsutą kolejność", () => {
    let err: unknown;
    try { fc.assert(convergenceProperty(unsorted), { numRuns: 200 }); } catch (e) { err = e; }
    // fast-check 4: komunikat ma ziarno i skurczone kroki, a błąd z własności leży w `cause`.
    expect(String((err as Error | undefined)?.cause)).toMatch(/W1/);
  });
});

import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createYDebts } from "./yDebts";
import { cleanDebt, DEBT_ENTRY_V, type DebtEntry } from "./model";
import { pickExtra, toStored } from "@/lib/extraFields";

// Z-17.3 (`docs/plan-zgodnosc-i-obieg.md` §1.5): pole z nowszej wersji przeżywa każdą drogę zapisu (§1.1).

const raw = (id: string, over: Record<string, unknown> = {}) =>
  ({ id, person: "Ania", kind: "lent", amount: 10_000, at: "2026-10-10", note: "", created: 1, groupRef: "g-1", ...over });

function seeded() {
  const doc = new Y.Doc();
  const map = doc.getMap<unknown>("debts");
  map.set("a", raw("a"));
  map.set("b", raw("b"));
  return { y: createYDebts(doc), map };
}

const stored = (map: Y.Map<unknown>, id: string) => map.get(id) as Record<string, unknown>;

describe("nieznane pola wpisu długu", () => {
  it("odczyt odkłada je w `extra`", () => {
    const { y } = seeded();
    expect(y.get().find((e) => e.id === "a")?.extra).toEqual({ groupRef: "g-1" });
  });

  it("edycja (replace), zmiana nazwy (replaceMany), cofnięcie usunięcia (restore) — pole zostaje w mapie", () => {
    const { y, map } = seeded();
    const a = y.get().find((e) => e.id === "a")!;
    y.replace(cleanDebt({ ...a, amount: 20_000 })!);
    expect(stored(map, "a")).toMatchObject({ amount: 20_000, groupRef: "g-1" });
    expect(stored(map, "a")).not.toHaveProperty("extra");

    y.replaceMany(y.get().map((e) => ({ ...e, person: "Anna" })));
    expect(stored(map, "b")).toMatchObject({ person: "Anna", groupRef: "g-1" });

    const removed = y.remove("b")!;
    y.restore(removed);
    expect(stored(map, "b")).toMatchObject({ groupRef: "g-1" });
  });

  it("kopia: zrzut ma pole na wierzchu, scalenie do pustego dokumentu je zachowuje", () => {
    const { y } = seeded();
    const dump = JSON.parse(JSON.stringify(y.dump())) as Record<string, unknown>[];
    expect(dump[0]).toHaveProperty("groupRef", "g-1");
    expect(dump[0]).not.toHaveProperty("extra");
    const doc = new Y.Doc();
    createYDebts(doc).mergeDump(dump);
    expect(doc.getMap("debts").get("a")).toMatchObject({ groupRef: "g-1" });
  });

  it("znane pole nie jest nadpisywane przez `extra`", () => {
    const e = cleanDebt({ ...raw("a"), extra: { amount: 1, person: "X", ok: true } })!;
    expect(toStored(e)).toMatchObject({ amount: 10_000, person: "Ania", ok: true });
  });

  it("śmieci ponad limit nie przechodzą", () => {
    const junk: Record<string, unknown> = {
      __proto__x: 1, Upper: 1, "z-dash": 1, long: "x".repeat(201), obj: { a: 1 }, nested: [[1]], nan: Number.NaN,
      arr: Array.from({ length: 17 }, () => 1),
    };
    expect(pickExtra(junk, [])).toBeUndefined();
    const many = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(pickExtra(many, []) ?? {})).toHaveLength(8);
    const big = Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`k${i}`, "x".repeat(150)]));
    expect(pickExtra(big, [])).toBeUndefined();
  });

  it("`v` większe niż obsługiwane — wpis niewidoczny, ale zostaje i da się go usunąć", () => {
    const { y, map } = seeded();
    map.set("c", raw("c", { v: DEBT_ENTRY_V + 1 }));
    expect(y.get().map((e) => e.id).sort()).toEqual(["a", "b"]);
    expect(map.has("c")).toBe(true);
    expect(y.remove("c")).toBeNull();
    expect(map.has("c")).toBe(false);
    expect(cleanDebt(raw("d", { v: DEBT_ENTRY_V }))).toMatchObject({ v: DEBT_ENTRY_V });
  });
});

describe("R-18: „Cofnij” po zmianie nazwy", () => {
  it("przywraca tylko nazwę; kwota zmieniona w międzyczasie zostaje", async () => {
    const { restoreDebts, renamePeople } = await import("./store");
    const { yjsStore } = await import("@/lib/yjsStore");
    const y = createYDebts(yjsStore.doc);
    for (const e of y.get()) y.remove(e.id);
    y.add({ ...(raw("r1") as DebtEntry), person: "Ola" });
    const prev = renamePeople(["ola"], "Aleksandra")!;
    const cur = y.get().find((e) => e.id === "r1")!;
    y.replace({ ...cur, amount: 55_500 });
    restoreDebts(prev, "Aleksandra");
    expect(y.get().find((e) => e.id === "r1")).toMatchObject({ person: "Ola", amount: 55_500 });
  });
});

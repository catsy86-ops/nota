import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { applyKit, cleanKit, DEFAULT_KITS, kitSummary, type Kit } from "./kits";
import { createYKits } from "./yKits";
import { catalogFittings, catalogPipes, SYSTEMS } from "./catalog";
import { fittingKey } from "./fittings";

const kit = (over: Partial<Kit> = {}): Kit => ({
  id: "k1", name: "Umywalka", fittings: [{ name: "Kolano 16", qty: 2 }], pipes: [{ name: "Rura PEX 16×2", cm: 150 }], ...over,
});

describe("zestawy materiału (H1.2)", () => {
  it("cleanKit: bez nazwy albo bez pozycji → null; pozycje czyszczone", () => {
    expect(cleanKit(kit({ name: "  " }))).toBeNull();
    expect(cleanKit(kit({ fittings: [], pipes: [] }))).toBeNull();
    expect(cleanKit({ ...kit(), fittings: [{ name: "Kolano 16", qty: 0 }] })).toEqual({ ...kit(), fittings: [] });
    expect(cleanKit("x")).toBeNull();
  });

  it("applyKit: ta sama nazwa dokłada sztuki i centymetry, nowe pozycje na koniec", () => {
    const out = applyKit([{ name: "kolano 16", qty: 1 }, { name: "", qty: 1 }], [{ name: "Rura PEX 16×2", cm: 100 }], kit({ fittings: [{ name: "Kolano 16", qty: 2 }, { name: "Trójnik 16", qty: 1 }] }));
    expect(out.fittings).toEqual([{ name: "kolano 16", qty: 3 }, { name: "", qty: 1 }, { name: "Trójnik 16", qty: 1 }]);
    expect(out.pipes).toEqual([{ name: "Rura PEX 16×2", cm: 250 }]);
  });

  it("kitSummary: sztuki i metry", () => {
    expect(kitSummary(kit())).toBe("2 szt. · 1,5 m rur");
    expect(kitSummary(kit({ pipes: [] }))).toBe("2 szt.");
  });

  it("przykładowe zestawy używają nazw z katalogu (sumy i ceny pasują)", () => {
    const known = new Set(SYSTEMS.flatMap((s) => [...catalogPipes(s.id), ...s.sizes.flatMap((size) => catalogFittings(s.id, size))]).map(fittingKey));
    for (const k of DEFAULT_KITS) {
      expect(cleanKit(k)).toEqual(k);
      for (const n of [...k.fittings, ...k.pipes].map((x) => x.name)) expect(known.has(fittingKey(n)), n).toBe(true);
    }
  });
});

describe("zestawy w Yjs (H1.2)", () => {
  it("na start przykładowe; pierwsza zmiana przyjmuje je jako własne", () => {
    const s = createYKits(new Y.Doc());
    expect(s.get()).toMatchObject({ own: false });
    expect(s.get().kits.map((k) => k.id)).toEqual(DEFAULT_KITS.map((k) => k.id));
    expect(s.save(kit({ id: "k-moj" }))).toBe(true);
    expect(s.get().own).toBe(true);
    expect(s.get().kits.map((k) => k.id)).toEqual([...DEFAULT_KITS.map((k) => k.id), "k-moj"]);
    expect(s.remove("kit-wc")?.id).toBe("kit-wc");
    expect(s.get().kits.map((k) => k.id)).not.toContain("kit-wc");
  });

  it("dwa telefony zmieniające różne zestawy scalają się bez strat", () => {
    const a = new Y.Doc(), b = new Y.Doc();
    const ka = createYKits(a), kb = createYKits(b);
    ka.save(kit({ id: "ka", name: "A" }));
    kb.save(kit({ id: "kb", name: "B" }));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    const ids = (s: ReturnType<typeof createYKits>) => s.get().kits.map((k) => k.id).sort();
    expect(ids(ka)).toEqual(ids(kb));
    expect(ids(ka)).toEqual(expect.arrayContaining(["ka", "kb"]));
  });

  it("kopia: zrzut i scalenie bez nadpisywania istniejących", () => {
    const src = createYKits(new Y.Doc());
    src.save(kit({ id: "k-z-kopii", name: "Z kopii" }));
    const dst = createYKits(new Y.Doc());
    dst.save(kit({ id: "k-z-kopii", name: "Tutaj zmieniony" }));
    dst.mergeDump(JSON.parse(JSON.stringify(src.dump())));
    expect(dst.get().kits.find((k) => k.id === "k-z-kopii")?.name).toBe("Tutaj zmieniony");
    const empty = createYKits(new Y.Doc());
    empty.mergeDump(src.dump());
    expect(empty.get().kits.some((k) => k.id === "k-z-kopii")).toBe(true);
    // Przykładowa lista w kopii (own: false) nic nie zmienia.
    const fresh = createYKits(new Y.Doc());
    fresh.mergeDump(createYKits(new Y.Doc()).dump());
    expect(fresh.get().own).toBe(false);
  });
});

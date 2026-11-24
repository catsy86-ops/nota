import { beforeEach, describe, expect, it } from "vitest";
import { applySitePattern, cleanPatterns, patternFromSite, PATTERNS_MAX, removeSitePattern, saveSitePattern, sitePatternsStore, undoSitePattern, type SitePattern } from "./sitePatterns";
import { getSitePoints } from "./pointsStore";
import type { Room, WaterPoint } from "./points";

const room = (id: string, name: string, order: number): Room => ({ id, name, order });
const pt = (id: string, roomId: string, type: string, order: number): WaterPoint => ({ id, room: roomId, type, sides: [], steps: { montaz: 5 }, order });
const pattern = (id: string, name: string): SitePattern => ({ id, name, stages: [{ id: "woda", name: "Woda" }], rooms: [], created: 1 });

describe("patternFromSite", () => {
  it("etapy bez stanów, pomieszczenia i punkty w kolejności, bez kroków", () => {
    const p = patternFromSite(
      "Łazienka",
      { stages: [{ id: "woda", name: "Woda", done: 123 }, { id: "s-x", name: "Kotłownia" }] },
      { rooms: [room("r2", "Kuchnia", 2), room("r1", "Łazienka", 1)], points: [pt("b", "r1", "wc-stelaz", 2), pt("a", "r1", "umywalka", 1), pt("c", "r2", "zlew", 1)] },
      1000,
    )!;
    expect(p.stages).toEqual([{ id: "woda", name: "Woda" }, { id: "s-x", name: "Kotłownia" }]);
    expect(p.rooms).toEqual([{ name: "Łazienka", types: ["umywalka", "wc-stelaz"] }, { name: "Kuchnia", types: ["zlew"] }]);
  });

  it("pusta budowa nie daje wzorca", () => {
    expect(patternFromSite("Nic", {}, { rooms: [], points: [] }, 1)).toBeNull();
  });
});

describe("cleanPatterns", () => {
  it("odrzuca śmieci, nieznane rodzaje punktów i duplikaty id", () => {
    const r = cleanPatterns([
      null, { id: "a" }, { id: "b", name: "B", stages: [], rooms: [] },
      { id: "c", name: " C ", stages: [{ id: "woda", name: "Woda", done: 5 }], rooms: [{ name: "Łazienka", types: ["umywalka", "zly-typ", 7] }] },
      { id: "c", name: "duplikat", stages: [{ id: "woda", name: "Woda" }], rooms: [] },
    ]);
    expect(r).toEqual([{ id: "c", name: "C", stages: [{ id: "woda", name: "Woda" }], rooms: [{ name: "Łazienka", types: ["umywalka"] }], created: 0 }]);
  });
});

describe("magazyn wzorców", () => {
  beforeEach(() => sitePatternsStore.set([]));

  it("ta sama nazwa zastępuje na tym samym miejscu, „Cofnij” przywraca stary, usuwanie po id", () => {
    saveSitePattern(pattern("1", "Łazienka"));
    saveSitePattern(pattern("k", "Kotłownia"));
    const res = saveSitePattern(pattern("2", "łazienka"));
    expect(res).toEqual({ ok: true, replaced: expect.objectContaining({ id: "1" }) });
    expect(sitePatternsStore.get().map((p) => p.id)).toEqual(["2", "k"]);
    undoSitePattern("2", res.ok ? res.replaced : null);
    expect(sitePatternsStore.get().map((p) => p.id)).toEqual(["1", "k"]);
    removeSitePattern("1");
    expect(sitePatternsStore.get().map((p) => p.id)).toEqual(["k"]);
  });

  it("wzorzec na budowie zachowuje kolejność pomieszczeń i punktów", () => {
    applySitePattern("wzor-test", { stages: [], rooms: [{ name: "Łazienka", types: ["umywalka", "wc-stelaz"] }, { name: "Kuchnia", types: ["zlew"] }, { name: "Kotłownia", types: [] }] });
    const { rooms, points } = getSitePoints("wzor-test");
    expect([...rooms].sort((a, b) => a.order - b.order).map((r) => r.name)).toEqual(["Łazienka", "Kuchnia", "Kotłownia"]);
    const bath = rooms.find((r) => r.name === "Łazienka")!;
    expect(points.filter((p) => p.room === bath.id).sort((a, b) => a.order - b.order).map((p) => p.type)).toEqual(["umywalka", "wc-stelaz"]);
  });

  it("pełna lista odmawia zapisu", () => {
    for (let i = 0; i < PATTERNS_MAX; i++) saveSitePattern(pattern(`p${i}`, `W${i}`));
    expect(saveSitePattern(pattern("nowy", "Nowy"))).toEqual({ ok: false });
    expect(saveSitePattern(pattern("zm", "W3")).ok).toBe(true);
  });
});

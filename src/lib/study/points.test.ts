import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { cleanPoint, newPoint, pendingAt, pointStage, pointsProgress, POINT_TYPES, toggleStep, type WaterPoint } from "./points";
import { createYPoints } from "./yPoints";
import { HEIGHTS } from "./content";

const pt = (over: Partial<WaterPoint> = {}): WaterPoint => ({ id: "p1", room: "r1", type: "umywalka", sides: ["z", "c", "k"], height: 58, steps: {}, order: 1, ...over });

describe("punkty w pomieszczeniach (H2.1)", () => {
  it("wysokości typów są tylko z tabeli G-HEAT", () => {
    const g = new Set(HEIGHTS.map((h) => h.water));
    for (const t of POINT_TYPES) if (t.height !== null) expect(g.has(t.height), t.label).toBe(true);
    expect(newPoint("a", "r", "zlew", 0)).toMatchObject({ sides: ["z", "c", "k"], height: 48 });
    expect(newPoint("a", "r", "zmywarka", 0).height).toBeUndefined();
  });

  it("toggleStep: zaznacza do kratki włącznie, cofnięcie zdejmuje ją i późniejsze; daty zostają", () => {
    let p = toggleStep(pt(), 1, 100);
    expect(p.steps).toEqual({ podejscie: 100, proba: 100 });
    p = toggleStep(p, 2, 200);
    expect(p.steps).toEqual({ podejscie: 100, proba: 100, montaz: 200 });
    expect(pointStage(p)).toBe(3);
    p = toggleStep(p, 1, 300);
    expect(p.steps).toEqual({ podejscie: 100 });
    p = toggleStep(p, 0, 400);
    expect(p.steps).toEqual({});
  });

  it("cleanPoint: kroki bez dziur, strony w kolejności, zły typ → „Inny”, wysokość w zakresie", () => {
    expect(cleanPoint({ ...pt(), steps: { proba: 5 } })!.steps).toEqual({});
    expect(cleanPoint({ ...pt(), sides: ["k", "x", "z"] })!.sides).toEqual(["z", "k"]);
    expect(cleanPoint({ ...pt(), type: "?" })!.type).toBe("inny");
    expect(cleanPoint({ ...pt(), height: 999 })!.height).toBe(300);
    expect(cleanPoint({ ...pt(), room: "" })).toBeNull();
  });

  it("postęp: gotowe = po białym montażu; do podejścia = bez kroków", () => {
    const list = [pt({ id: "a", steps: { podejscie: 1, proba: 1, montaz: 1 } }), pt({ id: "b", steps: { podejscie: 1 } }), pt({ id: "c" }), pt({ id: "d" })];
    expect(pointsProgress(list)).toEqual({ done: 1, total: 4 });
    expect(pendingAt(list, "podejscie")).toBe(2);
    expect(pendingAt(list, "proba")).toBe(1);
  });
});

describe("punkty w Yjs (H2.1)", () => {
  const room = { id: "r1", name: "Łazienka", order: 1 };

  it("pomieszczenie z punktami, odhaczenie, usunięcie pomieszczenia zabiera punkty", () => {
    const s = createYPoints(new Y.Doc());
    expect(s.addRoom("site", room, [pt()])).toBe(true);
    expect(s.get("site").points).toHaveLength(1);
    s.savePoint("site", toggleStep(s.get("site").points[0], 0, 5));
    expect(pointStage(s.get("site").points[0])).toBe(1);
    expect(s.get("inna").rooms).toEqual([]);
    expect(s.removeRoom("site", "r1")?.points).toHaveLength(1);
    expect(s.get("site")).toEqual({ rooms: [], points: [] });
  });

  it("dwa telefony odhaczające różne punkty scalają się bez strat", () => {
    const a = new Y.Doc(), b = new Y.Doc();
    const sa = createYPoints(a), sb = createYPoints(b);
    sa.addRoom("site", room, [pt({ id: "p1" }), pt({ id: "p2" })]);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    sa.savePoint("site", toggleStep(sa.get("site").points[0], 0, 1));
    sb.savePoint("site", toggleStep(sb.get("site").points[1], 1, 2));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    expect(sa.get("site").points.map(pointStage)).toEqual([1, 2]);
    expect(sb.get("site").points.map(pointStage)).toEqual([1, 2]);
  });

  it("punkt bez pomieszczenia nie jest pokazywany; kopia scala bez nadpisywania", () => {
    const s = createYPoints(new Y.Doc());
    expect(s.savePoint("site", pt())).toBe(false);
    s.addRoom("site", room, [pt()]);
    const dump = JSON.parse(JSON.stringify(s.dump()));
    const t = createYPoints(new Y.Doc());
    t.addRoom("site", room, [pt({ steps: { podejscie: 9 } })]);
    t.mergeDump(dump);
    expect(pointStage(t.get("site").points[0])).toBe(1);
    const empty = createYPoints(new Y.Doc());
    empty.mergeDump(dump);
    expect(empty.get("site").points).toHaveLength(1);
  });
});

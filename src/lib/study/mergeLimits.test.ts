import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createYVan } from "./yVan";
import { createYPoints } from "./yPoints";
import { newPoint, POINTS_MAX, ROOMS_MAX } from "./points";

// D4/D5 (audyt 2026-11-11): scalanie kopii nie zapisuje osieroconych zdarzeń i punktów ani nie przekracza limitów.
describe("mergeDump: osierocone dane i limity", () => {
  it("auto: zdarzenia pozycji, której nie ma, nie wchodzą do dokumentu", () => {
    const y = createYVan(new Y.Doc());
    y.mergeDump({
      items: [{ id: "k", name: "Kolano", unit: "szt.", at: 100, order: 0 }],
      events: [{ id: "e1", item: "k", kind: "count", qty: 5, at: 200 }, { id: "e2", item: "brak", kind: "count", qty: 9, at: 200 }],
    });
    const doc = y.dump();
    expect(doc.events.map((e) => e.id)).toEqual(["e1"]);
  });

  it("punkty: bez pomieszczenia odpadają, a liczba pomieszczeń i punktów jest ograniczona", () => {
    const y = createYPoints(new Y.Doc());
    const rooms = Array.from({ length: ROOMS_MAX + 10 }, (_, i) => ({ id: `r${i}`, name: `Pok ${i}`, order: i }));
    const points = [newPoint("ok", "r0", "umywalka", 0), newPoint("sierota", "nie-ma", "wc", 1), ...Array.from({ length: POINTS_MAX + 20 }, (_, i) => newPoint(`p${i}`, "r0", "zlew", i))];
    y.mergeDump({ sites: { s1: { rooms, points } } });
    const got = y.get("s1");
    expect(got.rooms.length).toBe(ROOMS_MAX);
    expect(got.points.some((p) => p.id === "sierota")).toBe(false);
    expect(got.points.length).toBeLessThanOrEqual(POINTS_MAX);
  });
});

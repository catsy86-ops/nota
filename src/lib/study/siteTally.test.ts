import { describe, expect, it } from "vitest";
import type { JournalEntry } from "./yStudy";
import { siteTally } from "./siteTally";

const entry = (id: string, at: number, fittings: { name: string; qty: number }[]): JournalEntry =>
  ({ id, at, kind: "ok", topic: null, text: "montaż", site: "Lipowa 5", siteId: "s1", checked: [], images: [], fittings }) as JournalEntry;

describe("siteTally — liczniki na górze karty budowy", () => {
  it("bez listy etapów liczy domyślne, bez braków i kształtek same zera", () => {
    const t = siteTally({ id: "s1" }, []);
    expect(t.stages.done).toBe(0);
    expect(t.stages.total).toBeGreaterThan(0);
    expect([t.missing, t.ordered, t.order]).toEqual([0, 0, 0]);
  });

  it("braki dzielą się na „brakuje” i „w drodze”, dostarczone się nie liczą", () => {
    const shortages = [
      { id: "a", text: "klej", qty: "", status: "missing", at: 1 },
      { id: "b", text: "kolano", qty: "", status: "missing", at: 2 },
      { id: "c", text: "rura", qty: "", status: "ordered", at: 3 },
      { id: "d", text: "zawór", qty: "", status: "delivered", at: 4 },
    ] as const;
    const t = siteTally({ id: "s1", shortages: shortages.map((s) => ({ ...s })) }, []);
    expect([t.missing, t.ordered]).toEqual([2, 1]);
  });

  it("zamówienie liczy pozycje kształtek od ostatniego zamówienia", () => {
    const journal = [
      entry("x", 1000, [{ name: "kolano 16", qty: 4 }]),
      entry("y", 3000, [{ name: "kolano 16", qty: 2 }, { name: "trójnik 20", qty: 1 }]),
    ];
    expect(siteTally({ id: "s1" }, journal).order).toBe(2);
    expect(siteTally({ id: "s1", orderedAt: 2000 }, journal).order).toBe(2);
    expect(siteTally({ id: "s1", orderedAt: 5000 }, journal).order).toBe(0);
  });
});

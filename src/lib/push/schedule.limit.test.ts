import { describe, expect, it } from "vitest";
import { buildPushSchedulePlan, PUSH_MAX_ITEMS } from "./schedule";

const NOW = new Date(2026, 9, 14, 12, 0).getTime();
const HOUR = 3600_000;

const note = (i: number) =>
  ({ id: `n${i}`, title: `T${i}`, content: "", reminder: NOW + (i + 1) * HOUR, reminderRepeat: "none", locked: false }) as never;

describe("limit harmonogramu push", () => {
  it("bez przekroczenia limitu nic nie odpada", () => {
    const plan = buildPushSchedulePlan({ now: NOW, notes: [note(0), note(1)] });
    expect(plan).toEqual({ items: expect.any(Array), total: 2, dropped: 0 });
    expect(plan.items).toHaveLength(2);
  });

  it("nad limitem odpada najpóźniejsze przypomnienie z notatek i liczba się zgadza", () => {
    const notes = Array.from({ length: PUSH_MAX_ITEMS + 1 }, (_, i) => note(i));
    const plan = buildPushSchedulePlan({ now: NOW, notes });
    expect(plan.items).toHaveLength(PUSH_MAX_ITEMS);
    expect(plan.total).toBe(PUSH_MAX_ITEMS + 1);
    expect(plan.dropped).toBe(1);
    expect(plan.items.some((i) => i.key.endsWith("n200") || i.title === "T200")).toBe(false);
  });

  it("pierwszeństwo mają notatki: serwis z Praca przepada, gdy notatki zajmują cały limit", () => {
    const notes = Array.from({ length: PUSH_MAX_ITEMS }, (_, i) => note(i));
    const sites = {
      s: { name: "Lipowa", service: [{ id: "c1", text: "przegląd", at: 0, due: "2026-10-14" }] },
    } as never;
    const plan = buildPushSchedulePlan({ now: NOW - 3 * HOUR, notes, sites });
    expect(plan.items.every((i) => !i.key.startsWith("v:"))).toBe(true);
    expect(plan.dropped).toBeGreaterThan(0);
  });
});

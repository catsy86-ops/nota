import { describe, expect, it } from "vitest";
import { DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA, type ShiftData } from "./model";
import { leaveBalance } from "./leave";
import { createYShifts } from "./yShifts";
import * as Y from "yjs";

const base = (over: Partial<ShiftData>): ShiftData => ({ ...EMPTY_SHIFT_DATA, types: DEFAULT_SHIFT_TYPES, leaveDays: 20, ...over });
const today = new Date(2026, 9, 25);
const leaveType = DEFAULT_SHIFT_TYPES.find((t) => t.kind === "absence" && /urlop/i.test(t.name))!;

describe("urlop w godzinach (3.3, art. 154² KP)", () => {
  it("system podstawowy nie ma licznika w godzinach", () => {
    expect(leaveBalance(base({ days: { "2026-10-06": { type: leaveType.id } } }), 2026, today).hours).toBeUndefined();
  });

  it("system równoważny: dzień urlopu zjada godziny zmiany, którą zastąpił", () => {
    // 12-godzinna zmiana zamieniona na urlop: zapis przy przypisaniu urlopu.
    const long = { ...DEFAULT_SHIFT_TYPES[0], id: "long", name: "Długa", start: "06:00", end: "18:00" };
    const data = base({ workSystem: "equivalent", types: [...DEFAULT_SHIFT_TYPES, long], days: { "2026-10-06": { type: "long" } } });
    const ready = createYShifts(new Y.Doc());
    ready.replaceAll(data);
    ready.setDayShift("2026-10-06", leaveType.id);
    const stored = ready.get().days["2026-10-06"];
    expect(stored?.plannedMin).toBe(12 * 60);
    const h = leaveBalance(ready.get(), 2026, today).hours!;
    expect(h.used).toBe(12 * 60);
    expect(h.allowance).toBe(20 * 8 * 60);
  });

  it("stary wpis urlopu bez plannedMin liczy się jako 8 h × etat", () => {
    const data = base({ workSystem: "equivalent", fte: 0.5, days: { "2026-10-06": { type: leaveType.id } } });
    expect(leaveBalance(data, 2026, today).hours!.used).toBe(4 * 60);
  });
});

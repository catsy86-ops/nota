import { describe, expect, it } from "vitest";
import { DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA, type ShiftData } from "./model";
import { timeOffBalance } from "./timeOff";

const leave = DEFAULT_SHIFT_TYPES.find((t) => t.kind === "absence" && /urlop/i.test(t.name))!;

// 8 h + 2 h nadgodziny w październiku → 120 min do odbioru.
const base = (over: Partial<ShiftData>): ShiftData => ({
  ...EMPTY_SHIFT_DATA,
  types: DEFAULT_SHIFT_TYPES,
  days: { "2026-10-05": { type: "d", extraMin: 120 } },
  ...over,
});

describe("odbiór nadgodzin w okresie (3.2, art. 151² KP)", () => {
  it("odbiór 1:1 zjada nadgodziny godzina za godzinę", () => {
    const data = base({ days: { "2026-10-05": { type: "d", extraMin: 120 }, "2026-10-08": { type: leave.id, timeOff: 1, plannedMin: 120 } } });
    expect(timeOffBalance(data, 2026, 9)).toEqual({ owedMin: 120, takenMin: 120, remainingMin: 0 });
  });

  it("odbiór 1:1,5 zużywa mniej nadgodzin, ale zbyt długi odbiór daje saldo ujemne", () => {
    const data = base({ days: { "2026-10-05": { type: "d", extraMin: 120 }, "2026-10-08": { type: leave.id, timeOff: 1.5, plannedMin: 480 } } });
    expect(timeOffBalance(data, 2026, 9)).toEqual({ owedMin: 120, takenMin: 320, remainingMin: -200 });
  });

  it("dzień bez odbioru nie zmienia salda, a stary wpis bez plannedMin liczy 8 h × etat", () => {
    expect(timeOffBalance(base({}), 2026, 9).takenMin).toBe(0);
    const data = base({ days: { "2026-10-05": { type: "d", extraMin: 120 }, "2026-10-08": { type: leave.id, timeOff: 1 } } });
    expect(timeOffBalance(data, 2026, 9).takenMin).toBe(480);
  });
});

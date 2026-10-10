import { describe, it, expect } from "vitest";
import { allTodayTasksDone, shouldRewardDay, localDayKey } from "./dayDone";

const item = (checked: boolean) => ({ id: Math.random().toString(), text: "x", checked });

describe("dayDone", () => {
  it("brak zadań nie jest ukończeniem", () => {
    expect(allTodayTasksDone([])).toBe(false);
    expect(allTodayTasksDone([{ checklist: [] }, {}])).toBe(false);
  });
  it("wymaga odhaczenia wszystkich pozycji ze wszystkich notatek", () => {
    expect(allTodayTasksDone([{ checklist: [item(true)] }, { checklist: [item(true), item(false)] }])).toBe(false);
    expect(allTodayTasksDone([{ checklist: [item(true)] }, { checklist: [item(true)] }, {}])).toBe(true);
  });
  it("nagroda raz na dzień", () => {
    const today = localDayKey(new Date(2026, 9, 10));
    expect(today).toBe("2026-10-10");
    expect(shouldRewardDay(null, today)).toBe(true);
    expect(shouldRewardDay("2026-10-09", today)).toBe(true);
    expect(shouldRewardDay(today, today)).toBe(false);
  });
});

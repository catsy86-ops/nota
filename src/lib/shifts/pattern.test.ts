import { describe, expect, it } from "vitest";
import { addDaysKey, applyPattern, dayDiff, patternOverlap } from "./pattern";
import type { DayEntry } from "./model";

const types = (days: Record<string, DayEntry>) => Object.fromEntries(Object.entries(days).map(([k, v]) => [k, v.type]));

describe("addDaysKey / dayDiff", () => {
  it("przechodzi przez koniec miesiąca i roku", () => {
    expect(addDaysKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("liczy dni między datami, także przez luty i zmianę czasu", () => {
    expect(dayDiff("2026-02-27", "2026-03-01")).toBe(2);
    expect(dayDiff("2026-10-01", "2026-10-01")).toBe(0);
    expect(dayDiff("2026-10-05", "2026-10-01")).toBe(-4);
    // 25.10.2026 to dzień zmiany czasu — różnica wciąż po dniach.
    expect(dayDiff("2026-10-24", "2026-10-26")).toBe(2);
  });
});

describe("applyPattern — kotwica", () => {
  const steps = ["D", "N", null];

  it("bez kotwicy zachowuje dotychczasowe zachowanie (faza od dnia startu)", () => {
    const out = types(applyPattern({}, steps, "2026-10-01", 4));
    expect(out).toEqual({ "2026-10-01": "D", "2026-10-02": "N", "2026-10-04": "D" });
  });

  it("kotwica wcześniej niż start: faza liczona od kotwicy, nie od startu", () => {
    // Kotwica 30.09 = krok 1 („D”). 01.10 to krok 2 („N”), 02.10 to „–” (czyści), 03.10 znów „D”.
    const out = types(applyPattern({}, steps, "2026-10-01", 3, "2026-09-30"));
    expect(out).toEqual({ "2026-10-01": "N", "2026-10-03": "D" });
  });

  it("nakładanie w dwóch częściach z tą samą kotwicą daje to samo co jednym ciągiem", () => {
    const anchor = "2026-10-01";
    const once = applyPattern({}, steps, anchor, 9, anchor);
    const part1 = applyPattern({}, steps, anchor, 4, anchor);
    const both = applyPattern(part1, steps, "2026-10-05", 5, anchor);
    expect(types(both)).toEqual(types(once));
  });
});

describe("cykl nie zjada urlopu, L4 ani notatek", () => {
  const work = { type: "d" };
  const leave = { type: "u" };
  const noted = { type: "d", note: "zastępstwo" };
  const days = { "2026-10-01": leave, "2026-10-02": noted, "2026-10-03": work };
  const steps = ["n"];
  const isProtected = (e: { type: string; note?: string }) => e.type === "u" || !!e.note;

  it("bez pomijania nadpisuje wszystko w zakresie", () => {
    const next = applyPattern(days, steps, "2026-10-01", 3, "2026-10-01");
    expect(next["2026-10-01"]).toEqual({ type: "n" });
    expect(next["2026-10-02"]).toEqual({ type: "n" });
  });

  it("z pomijaniem zostawia chronione dni i nakłada resztę", () => {
    const next = applyPattern(days, steps, "2026-10-01", 3, "2026-10-01", isProtected);
    expect(next["2026-10-01"]).toBe(leave);
    expect(next["2026-10-02"]).toBe(noted);
    expect(next["2026-10-03"]).toEqual({ type: "n" });
  });

  it("patternOverlap liczy dokładnie te dni, które zostałyby zmienione", () => {
    const kinds: Record<string, string> = { u: "leave" };
    const classify = (e: { type: string; note?: string }) => (kinds[e.type] as "leave" | "note" | undefined) ?? (e.note ? "note" : undefined);
    expect(patternOverlap(days, steps, "2026-10-01", 3, "2026-10-01", classify)).toEqual({ leave: 1, note: 1 });
  });
});

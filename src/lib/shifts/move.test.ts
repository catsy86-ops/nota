import { describe, expect, it } from "vitest";
import type { DayEntry } from "./model";
import { dayKeyCommand, planPaste, planTransfer, planWeekCopy, transferredEntry } from "./move";
import { addDaysToKey, startOfWeekKey, weekKeys, weekRangeLabel } from "../week";

const TODAY = "2026-10-07";
const day = (extra: Partial<DayEntry> = {}): DayEntry => ({ type: "d", ...extra });

describe("granice tygodnia", () => {
  it("poniedziałek tygodnia dla każdego dnia", () => {
    expect(startOfWeekKey("2026-10-07")).toBe("2026-10-05"); // środa
    expect(startOfWeekKey("2026-10-05")).toBe("2026-10-05"); // poniedziałek
    expect(startOfWeekKey("2026-10-11")).toBe("2026-10-05"); // niedziela
  });
  it("tydzień przechodzi przez przełom miesiąca i roku", () => {
    expect(weekKeys("2026-09-30")).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(weekKeys("2026-12-31")[6]).toBe("2027-01-03");
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToKey("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("zmiana czasu nie przesuwa dni", () => {
    expect(addDaysToKey("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDaysToKey("2026-03-28", 2)).toBe("2026-03-30");
  });
});

describe("weekRangeLabel", () => {
  it("w obrębie miesiąca, przez miesiąc i przez rok", () => {
    expect(weekRangeLabel("2026-10-05")).toBe("5–11 października 2026");
    expect(weekRangeLabel("2026-09-28")).toBe("28 września – 4 października 2026");
    expect(weekRangeLabel("2026-12-28")).toBe("28 grudnia 2026 – 3 stycznia 2027");
  });
});

describe("planPaste", () => {
  it("wkleja wpis albo nic, gdy dzień ma już taki sam", () => {
    expect(planPaste({}, day({ note: "a" }), "2026-10-12", TODAY)).toEqual({ "2026-10-12": { type: "d", note: "a" } });
    expect(planPaste({ "2026-10-12": day() }, day(), "2026-10-12", TODAY)).toBeNull();
  });
});

describe("planTransfer", () => {
  it("przenosi wpis i czyści źródło", () => {
    const days = { "2026-10-10": day({ note: "x", extraMin: 30 }) };
    expect(planTransfer(days, "2026-10-10", "2026-10-12", "move", TODAY)).toEqual({
      "2026-10-10": null,
      "2026-10-12": { type: "d", note: "x", extraMin: 30 },
    });
  });
  it("kopiuje bez ruszania źródła", () => {
    const days = { "2026-10-10": day() };
    expect(planTransfer(days, "2026-10-10", "2026-10-11", "copy", TODAY)).toEqual({ "2026-10-11": { type: "d" } });
  });
  it("nic nie robi dla pustego źródła, tego samego dnia i identycznej kopii", () => {
    expect(planTransfer({}, "2026-10-10", "2026-10-11", "move", TODAY)).toBeNull();
    expect(planTransfer({ "2026-10-10": day() }, "2026-10-10", "2026-10-10", "move", TODAY)).toBeNull();
    expect(planTransfer({ "2026-10-10": day(), "2026-10-11": day() }, "2026-10-10", "2026-10-11", "copy", TODAY)).toBeNull();
  });
  it("zastępuje wpis w dniu docelowym", () => {
    const days = { "2026-10-10": day(), "2026-10-11": { type: "n", note: "stara" } };
    expect(planTransfer(days, "2026-10-10", "2026-10-11", "move", TODAY)?.["2026-10-11"]).toEqual({ type: "d" });
  });
  it("działa przez przełom roku", () => {
    const days = { "2026-12-31": day() };
    expect(planTransfer(days, "2026-12-31", "2027-01-01", "move", TODAY)).toEqual({ "2026-12-31": null, "2027-01-01": { type: "d" } });
  });
});

describe("transferredEntry", () => {
  const hours = { start: "06:00", end: "14:00", breakMin: 0 };
  it("gubi znaczniki dnia, zostawia godziny tylko na dzień z przeszłości", () => {
    const e = day({ offSchedule: true, inLieu: true, hours });
    expect(transferredEntry(e, "2026-10-01", TODAY)).toEqual({ type: "d", hours });
    expect(transferredEntry(e, "2026-10-20", TODAY)).toEqual({ type: "d" });
  });
});

describe("planWeekCopy", () => {
  it("kopiuje wpisy na następny tydzień i liczy nadpisania", () => {
    const days: Record<string, DayEntry> = {
      "2026-10-05": day(),
      "2026-10-07": day({ note: "a" }),
      "2026-10-12": { type: "n" }, // pn następnego tygodnia — zostanie zastąpiony
      "2026-10-13": day(), // wt następnego tygodnia, źródło puste — nietknięty
    };
    const plan = planWeekCopy(days, "2026-10-09", TODAY);
    expect(plan.changes).toEqual({ "2026-10-12": { type: "d" }, "2026-10-14": { type: "d", note: "a" } });
    expect(plan.copied).toBe(2);
    expect(plan.overwritten).toBe(1);
  });
  it("identyczne dni nie liczą się jako nadpisane", () => {
    const days = { "2026-10-05": day(), "2026-10-12": day() };
    expect(planWeekCopy(days, "2026-10-05", TODAY)).toEqual({ changes: {}, copied: 0, overwritten: 0 });
  });
  it("przełom miesiąca i roku", () => {
    const plan = planWeekCopy({ "2026-12-28": day(), "2027-01-03": day() }, "2026-12-30", TODAY);
    expect(Object.keys(plan.changes).sort()).toEqual(["2027-01-04", "2027-01-10"]);
  });
});

describe("dayKeyCommand", () => {
  const k = (key: string, mods: Partial<Record<"shiftKey" | "altKey" | "ctrlKey" | "metaKey", boolean>> = {}) =>
    ({ key, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...mods });
  it("Shift+strzałki przenoszą, z Alt kopiują", () => {
    expect(dayKeyCommand(k("ArrowRight", { shiftKey: true }), 7)).toEqual({ kind: "transfer", deltaDays: 1, mode: "move" });
    expect(dayKeyCommand(k("ArrowUp", { shiftKey: true }), 7)).toEqual({ kind: "transfer", deltaDays: -7, mode: "move" });
    expect(dayKeyCommand(k("ArrowDown", { shiftKey: true, altKey: true }), 1)).toEqual({ kind: "transfer", deltaDays: 1, mode: "copy" });
  });
  it("Ctrl/⌘ C i V", () => {
    expect(dayKeyCommand(k("c", { ctrlKey: true }), 7)).toEqual({ kind: "copyEntry" });
    expect(dayKeyCommand(k("V", { metaKey: true }), 7)).toEqual({ kind: "paste" });
  });
  it("zwykłe strzałki i inne klawisze nie są poleceniami", () => {
    expect(dayKeyCommand(k("ArrowRight"), 7)).toBeNull();
    expect(dayKeyCommand(k("a", { ctrlKey: true }), 7)).toBeNull();
    expect(dayKeyCommand(k("Home", { shiftKey: true }), 7)).toBeNull();
  });
});

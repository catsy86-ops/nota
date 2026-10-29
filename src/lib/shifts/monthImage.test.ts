import { describe, it, expect } from "vitest";
import { type ShiftData } from "./model";
import { formatMinutesHM, mergeMonthLegend, monthImageLayout } from "./monthImage";
import { TEST_SHIFT_TYPES, TEST_EMPTY_SHIFT_DATA } from "./testShiftTypes";

// Październik 2026 zaczyna się w czwartek (poniedziałek pierwszy → 3 puste komórki na początku).
const OCT = 9;
const NOV = 10;
const data: ShiftData = {
  ...TEST_EMPTY_SHIFT_DATA,
  types: TEST_SHIFT_TYPES,
  days: { "2026-10-05": { type: "d" }, "2026-10-06": { type: "u" } },
};
// Środek miesiąca, żeby „dziś” nie zależało od tego, kiedy test biegnie.
const MID_OCT = new Date(2026, OCT, 15);

describe("monthImageLayout", () => {
  it("siatka zaczyna się od poniedziałku: październik 2026 ma 3 puste komórki przed 1.", () => {
    const l = monthImageLayout(data, 2026, OCT, MID_OCT);
    expect(l.weeks[0]).toEqual([
      { day: null, label: "", color: null, today: false },
      { day: null, label: "", color: null, today: false },
      { day: null, label: "", color: null, today: false },
      { day: 1, label: "", color: null, today: false },
      { day: 2, label: "", color: null, today: false },
      { day: 3, label: "", color: null, today: false },
      { day: 4, label: "", color: null, today: false },
    ]);
    expect(l.weeks).toHaveLength(5);
    expect(l.weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("dzień z rodzajem zmiany dostaje skrót i kolor tego rodzaju", () => {
    const l = monthImageLayout(data, 2026, OCT, MID_OCT);
    const cell = l.weeks.flat().find((c) => c.day === 5);
    expect(cell).toEqual({ day: 5, label: "D", color: TEST_SHIFT_TYPES[0].color, today: false });
    expect(l.weeks.flat().find((c) => c.day === 6)?.label).toBe("U");
  });

  it("dzień bez wpisu ma pustą etykietę i brak koloru", () => {
    const l = monthImageLayout(data, 2026, OCT, MID_OCT);
    expect(l.weeks.flat().find((c) => c.day === 20)).toEqual({ day: 20, label: "", color: null, today: false });
  });

  it("tytuł po polsku z wielkiej litery, a podsumowanie liczy dni pracy i nieobecności", () => {
    const l = monthImageLayout(data, 2026, OCT, MID_OCT);
    expect(l.title).toBe("Październik 2026");
    expect(l.footer.some((line) => line === "Dni w pracy: 1")).toBe(true);
    expect(l.footer.some((line) => line.startsWith("Dni nieobecności: 1"))).toBe(true);
  });

  it("znacznik „dziś” tylko na dzisiejszej dacie w tym miesiącu", () => {
    const l = monthImageLayout(data, 2026, OCT, MID_OCT);
    const todays = l.weeks.flat().filter((c) => c.today);
    expect(todays.map((c) => c.day)).toEqual([15]);
  });

  it("w innym miesiącu nie ma znacznika „dziś”", () => {
    const l = monthImageLayout(data, 2026, NOV, MID_OCT);
    expect(l.weeks.flat().some((c) => c.today)).toBe(false);
  });

  it("legenda: tylko rodzaje, które wystąpiły w miesiącu, w kolejności grafiku", () => {
    const l = monthImageLayout(data, 2026, OCT, MID_OCT);
    // Dni 5 i 6 mają rodzaje „d” i „u”; legenda ma dokładnie je, w kolejności z `types`.
    const used = TEST_SHIFT_TYPES.filter((t) => ["d", "u"].includes(t.id));
    expect(l.legend).toEqual(used.map((t) => ({ short: t.short, name: t.name, color: t.color })));
    expect(monthImageLayout(data, 2026, NOV, MID_OCT).legend).toEqual([]);
  });
});

describe("mergeMonthLegend", () => {
  it("łączy legendy miesięcy bez powtórek, w kolejności pierwszego wystąpienia", () => {
    const a = monthImageLayout(data, 2026, OCT, MID_OCT);
    const b = { ...monthImageLayout(data, 2026, NOV, MID_OCT), legend: [a.legend[1], { short: "X", name: "Inny", color: "#000000" }] };
    expect(mergeMonthLegend([a, b]).map((i) => i.short)).toEqual([a.legend[0].short, a.legend[1].short, "X"]);
  });
});

describe("formatMinutesHM", () => {
  it("godziny i minuty z dopełnieniem zera", () => {
    expect(formatMinutesHM(125)).toBe("2 h 05 min");
    expect(formatMinutesHM(0)).toBe("0 h 00 min");
  });
});

import { describe, it, expect } from "vitest";
import { type ShiftData } from "./model";
import { formatMinutesHM, monthImageLayout } from "./monthImage";
import { TEST_SHIFT_TYPES, TEST_EMPTY_SHIFT_DATA } from "./testShiftTypes";

// Październik 2026 zaczyna się w czwartek (poniedziałek pierwszy → 3 puste komórki na początku).
const OCT = 9;
const data: ShiftData = {
  ...TEST_EMPTY_SHIFT_DATA,
  types: TEST_SHIFT_TYPES,
  days: { "2026-10-05": { type: "d" }, "2026-10-06": { type: "u" } },
};

describe("monthImageLayout", () => {
  it("siatka zaczyna się od poniedziałku: październik 2026 ma 3 puste komórki przed 1.", () => {
    const l = monthImageLayout(data, 2026, OCT);
    expect(l.weeks[0]).toEqual([
      { day: null, label: "", color: null },
      { day: null, label: "", color: null },
      { day: null, label: "", color: null },
      { day: 1, label: "", color: null },
      { day: 2, label: "", color: null },
      { day: 3, label: "", color: null },
      { day: 4, label: "", color: null },
    ]);
    expect(l.weeks).toHaveLength(5);
    expect(l.weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("dzień z rodzajem zmiany dostaje skrót i kolor tego rodzaju", () => {
    const l = monthImageLayout(data, 2026, OCT);
    const cell = l.weeks.flat().find((c) => c.day === 5);
    expect(cell).toEqual({ day: 5, label: "D", color: TEST_SHIFT_TYPES[0].color });
    expect(l.weeks.flat().find((c) => c.day === 6)?.label).toBe("U");
  });

  it("dzień bez wpisu ma pustą etykietę i brak koloru", () => {
    const l = monthImageLayout(data, 2026, OCT);
    expect(l.weeks.flat().find((c) => c.day === 20)).toEqual({ day: 20, label: "", color: null });
  });

  it("tytuł po polsku z wielkiej litery, a podsumowanie liczy dni pracy i nieobecności", () => {
    const l = monthImageLayout(data, 2026, OCT);
    expect(l.title).toBe("Październik 2026");
    expect(l.footer.some((line) => line === "Dni w pracy: 1")).toBe(true);
    expect(l.footer.some((line) => line.startsWith("Dni nieobecności: 1"))).toBe(true);
  });
});

describe("formatMinutesHM", () => {
  it("godziny i minuty z dopełnieniem zera", () => {
    expect(formatMinutesHM(125)).toBe("2 h 05 min");
    expect(formatMinutesHM(0)).toBe("0 h 00 min");
  });
});

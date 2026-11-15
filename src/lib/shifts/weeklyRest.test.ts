import { describe, expect, it } from "vitest";
import { type ShiftData } from "./model";
import { weeklyRestShort } from "./summary";
import { TEST_SHIFT_TYPES, TEST_EMPTY_SHIFT_DATA } from "./testShiftTypes";

const withDays = (days: Record<string, { type: string; extraMin?: number }>, patch: Partial<ShiftData> = {}): ShiftData => ({ ...TEST_EMPTY_SHIFT_DATA, types: TEST_SHIFT_TYPES, days, ...patch });
const range = (month: string, from: number, to: number) => {
  const days: Record<string, { type: string }> = {};
  for (let d = from; d <= to; d++) days[`${month}-${String(d).padStart(2, "0")}`] = { type: "d" };
  return days;
};

// Zmiana „d” to 6:00–14:00 (8 h). Październik 2026 zaczyna się w czwartek, więc tygodnie
// okresu miesięcznego to 1–7, 8–14, 15–21, 22–28 (art. 128 § 3 pkt 2 KP).
describe("odpoczynek tygodniowy 35 h (art. 133 KP)", () => {
  it("dwie zmiany w tygodniu zostawiają ponad 35 h ciągłego odpoczynku", () => {
    expect(weeklyRestShort(withDays({ "2026-10-05": { type: "d" }, "2026-10-06": { type: "d" } }), "2026-10-")).toEqual([]);
  });

  it("zmiany każdego dnia tygodnia okresu: najdłuższa przerwa to 16 h, tydzień jest oznaczony", () => {
    expect(weeklyRestShort(withDays(range("2026-10", 8, 14)), "2026-10-")).toEqual([{ weekStart: "2026-10-08", restMinutes: 16 * 60 }]);
  });

  it("tydzień liczy się od początku okresu, nie od poniedziałku", () => {
    // Pn–nd 5–11.10 to siedem dni z rzędu, ale w dwóch tygodniach okresu: w 1–7 wolne 1–4, w 8–14 wolne 12–14.
    expect(weeklyRestShort(withDays(range("2026-10", 5, 11)), "2026-10-")).toEqual([]);
  });

  it("wolne sprzed początku tygodnia nie liczy się do jego odpoczynku", () => {
    // Listopad 2026 zaczyna się w niedzielę: tydzień 8–14.11 w całości przepracowany, mimo wolnego 1–7.11.
    expect(weeklyRestShort(withDays(range("2026-11", 8, 14)), "2026-11-")).toEqual([{ weekStart: "2026-11-08", restMinutes: 16 * 60 }]);
  });

  it("okres kwartalny: tygodnie biegną od pierwszego dnia okresu", () => {
    // Kwartał od października: tydzień 29.10–4.11 przechodzi przez granicę miesięcy.
    const days = { ...range("2026-10", 29, 31), ...range("2026-11", 1, 4) };
    const data = withDays(days, { settlementMonths: 3, settlementStart: 9 });
    expect(weeklyRestShort(data, "2026-11-")).toEqual([{ weekStart: "2026-10-29", restMinutes: 16 * 60 }]);
  });

  it("tydzień bez zmian w tym miesiącu nie jest oznaczany", () => {
    expect(weeklyRestShort(withDays({ "2026-09-28": { type: "d" } }), "2026-10-")).toEqual([]);
  });
});

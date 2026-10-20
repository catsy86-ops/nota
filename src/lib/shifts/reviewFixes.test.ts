import { describe, it, expect } from "vitest";
import { cleanBonus, DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA, type ShiftData } from "./model";
import { isScheduleId } from "./schedules";
import { monthSummary } from "./summary";

// Przegląd 2026-10-20: M5 (id grafiku z kopii), L13 (zaokrąglenie premii), M6 (stawka dodatku okresowego).
describe("id grafiku z kopii (M5)", () => {
  it("przepuszcza tylko format nadawany przez createSchedule", () => {
    expect(isScheduleId("s-1f2e3d4c-aaaa-bbbb-cccc-000011112222")).toBe(true);
    expect(isScheduleId("main")).toBe(false);
    expect(isScheduleId("s-x")).toBe(false);
    expect(isScheduleId("s-../../etc")).toBe(false);
    expect(isScheduleId("")).toBe(false);
  });
});

describe("kwota premii (L13)", () => {
  it("0,004 zł to nie premia; 0,005 zł zaokrągla się do 0,01 zł", () => {
    expect(cleanBonus({ id: "b", month: "2026-10", name: "x", amount: 0.004 })).toBeNull();
    expect(cleanBonus({ id: "b", month: "2026-10", name: "x", amount: 0.005 })?.amount).toBe(0.01);
  });
});

describe("dodatek za nadgodziny okresowe (M6)", () => {
  it("przy rodzajach z własną stawką dodatek nie zależy od ogólnej stawki", () => {
    // Ta sama liczba godzin i nadgodzin, różne stawki ogólne — dodatek okresowy ma iść za zarobkiem z godzin.
    const days: ShiftData["days"] = {};
    for (let d = 1; d <= 22; d++) days[`2026-10-${String(d).padStart(2, "0")}`] = { type: "p" };
    const type = { ...DEFAULT_SHIFT_TYPES[1], id: "p", rate: 40 };
    const base = { ...EMPTY_SHIFT_DATA, types: [type], days, settlementMonths: 1 as const };
    const low = monthSummary({ ...base, hourlyRate: 10 }, 2026, 9);
    const high = monthSummary({ ...base, hourlyRate: 90 }, 2026, 9);
    // Stawka rodzaju (40) wygrywa z ogólną — wynik nie może się zmienić od ogólnej stawki.
    expect(high.earnings).toBe(low.earnings);
  });
});

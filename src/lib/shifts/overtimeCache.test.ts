import { describe, it, expect } from "vitest";
import { DEFAULT_SHIFT_TYPES, EMPTY_SHIFT_DATA, monthSummary, type ShiftData } from "./index";

const eight = DEFAULT_SHIFT_TYPES.find((t) => t.id === "e")!;
const data = (patch: Partial<ShiftData>): ShiftData => ({ ...EMPTY_SHIFT_DATA, ...patch });
// Popołudniówka 14–22 — tylko na potrzeby testu doby (nie jest już domyślna).
const afternoon = { ...eight, id: "p", start: "14:00", end: "22:00" };

// G3.1: nadgodziny dobowe liczone raz na obiekt danych (WeakMap w `summary.ts`).
describe("pamięć nadgodzin dobowych (G3.1)", () => {
  it("wynik dla każdego miesiąca roku jest taki sam przy drugim liczeniu", () => {
    const d = data({ types: [afternoon, eight], days: { "2026-10-05": { type: "p" }, "2026-10-06": { type: "e" } } });
    const first = Array.from({ length: 12 }, (_, m) => monthSummary(d, 2026, m));
    const again = Array.from({ length: 12 }, (_, m) => monthSummary(d, 2026, m));
    expect(again).toEqual(first);
  });

  it("nowy obiekt danych dostaje świeże liczenie, nie stary wynik", () => {
    const morning = { ...eight, id: "m", start: "06:00", end: "14:00" };
    const base = data({ types: [afternoon, morning], days: { "2026-10-05": { type: "p" } } });
    expect(monthSummary(base, 2026, 9).dailyOvertimeMinutes).toBe(0);
    // Ranna zmiana następnego dnia mieści się w dobie popołudniówki: 8 h nadgodzin.
    const next = data({ ...base, days: { ...base.days, "2026-10-06": { type: "m" } } });
    expect(monthSummary(next, 2026, 9).dailyOvertimeMinutes).toBe(8 * 60);
  });
});

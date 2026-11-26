import { describe, expect, it } from "vitest";
import { monthSummary } from "./summary";
import { nightRateFor } from "./nightAllowance";
import { isNormDay } from "./holidays";
import { TEST_EMPTY_SHIFT_DATA } from "./testShiftTypes";
import type { DayEntry, ShiftData, ShiftType } from "./model";

/**
 * Z-1.T: przypadki wzorcowe z całych miesięcy, policzone ręcznie (zlecenie Fable, zadanie 1). Wymiary 2026:
 * styczeń 160 h (22 dni robocze − 1.01 i 6.01), luty 160 h (20), marzec 176 h (22), kwiecień 168 h (22 − 6.04).
 */
const H = 60;
const data = (patch: Partial<ShiftData>): ShiftData => ({ ...TEST_EMPTY_SHIFT_DATA, ...patch });
const TWELVE: ShiftType = { id: "x12", name: "12 h", short: "12", color: "#0ea5e9", start: "07:00", end: "19:00", breakMin: 0, kind: "work" };

/** Dni robocze (`YYYY-MM-DD`) miesiąca `month` (0–11) w kolejności. */
function normDays(year: number, month: number): string[] {
  const out: string[] = [];
  for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (isNormDay(key)) out.push(key);
  }
  return out;
}
const on = (keys: string[], type: string): Record<string, DayEntry> => Object.fromEntries(keys.map((k) => [k, { type }]));

describe("Grafik — miesiące wzorcowe (Z-1.T)", () => {
  it("równoważny, 12 h: 14 zmian w lutym 2026 = 168 h przy wymiarze 160 h → 8 h nadgodzin 100%, bez dobowych", () => {
    const s = monthSummary(data({ types: [...TEST_EMPTY_SHIFT_DATA.types, TWELVE], workSystem: "equivalent", hourlyRate: 30, days: on(normDays(2026, 1).slice(0, 14), "x12") }), 2026, 1);
    expect(s.minutes).toBe(168 * H);
    expect(s.normMinutes).toBe(160 * H);
    expect(s.dailyOvertimeMinutes).toBe(0);
    expect(s.overtimeMinutes).toBe(8 * H);
    expect(s.overtime100Minutes).toBe(8 * H);
    // 168 h × 30 zł = 5040 zł; dodatek 100% za 8 h po średniej stawce okresu (30 zł) = 240 zł.
    expect([s.basePay, s.overtimePremium100, s.earnings]).toEqual([5040, 240, 5280]);
  });

  it("ten sam grafik w systemie podstawowym: 4 h ponad 8 h w każdej z 14 dób to nadgodziny dobowe, normy okresu nie przekracza", () => {
    const s = monthSummary(data({ types: [...TEST_EMPTY_SHIFT_DATA.types, TWELVE], hourlyRate: 30, days: on(normDays(2026, 1).slice(0, 14), "x12") }), 2026, 1);
    expect(s.dailyOvertimeMinutes).toBe(14 * 4 * H);
    // Godziny dobowe nie liczą się drugi raz: 168 − 56 = 112 h ≤ 160 h.
    expect(s.overtimeMinutes).toBe(14 * 4 * H);
  });

  it("stawka dodatku nocnego dzieli przez wymiar nominalny (160 h), nie przez godziny z grafiku (168 h)", () => {
    const s = monthSummary(data({ workSystem: "equivalent", days: {} }), 2026, 1);
    expect(nightRateFor(2026, 1, 0)).toBe(6.01); // 20% × 4806 zł ÷ 160 h = 6,0075 zł
    expect(nightRateFor(2026, 1, 0)).toBe(Math.round(0.2 * 4806 / (s.normMinutes / H) * 100) / 100);
    expect(nightRateFor(2026, 1, 0)).not.toBe(Math.round(0.2 * 4806 / 168 * 100) / 100);
  });

  it.each([[0.5, 80], [0.75, 120]])("niepełny etat %s: wymiar lutego %i h, godziny ponad niego do 160 h są ponadwymiarowe", (fte, normH) => {
    // 12 dni po 8 h = 96 h.
    const s = monthSummary(data({ fte, days: on(normDays(2026, 1).slice(0, 12), "d") }), 2026, 1);
    expect(s.normMinutes).toBe(normH * H);
    expect(s.extraTimeMinutes).toBe(Math.max(0, 96 - normH) * H);
    expect(s.overtimeMinutes).toBe(0);
  });

  it.each([[0.5], [0.75]])("niepełny etat %s: stawka nocna taka jak przy pełnym etacie (luty 6,01, lipiec 5,22, styczeń 2027 6,51)", () => {
    // Minimalne wynagrodzenie i wymiar maleją w tej samej proporcji — `nightRateFor` celowo nie zna etatu.
    expect([nightRateFor(2026, 1, 0), nightRateFor(2026, 6, 0), nightRateFor(2027, 0, 0)]).toEqual([6.01, 5.22, 6.51]);
  });

  it("okres 4 miesiące (styczeń–kwiecień 2026): norma 664 h, nadgodziny okresowe dopiero w kwietniu", () => {
    const days = { ...on([0, 1, 2, 3].flatMap((m) => normDays(2026, m)), "d"), "2026-01-10": { type: "d" } }; // + sobota 10.01
    const d = data({ settlementMonths: 4, settlementStart: 0, hourlyRate: 30, days });
    const jan = monthSummary(d, 2026, 0);
    const apr = monthSummary(d, 2026, 3);
    expect(jan.period?.normMinutes).toBe(664 * H);
    expect([jan.normMinutes, monthSummary(d, 2026, 2).normMinutes, apr.normMinutes]).toEqual([160 * H, 176 * H, 168 * H]);
    expect(jan.overtimeMinutes).toBe(0);
    expect(jan.period?.isLast).toBe(false);
    expect(apr.period?.isLast).toBe(true);
    expect(apr.overtimeMinutes).toBe(8 * H);
    expect(apr.overtime100Minutes).toBe(8 * H);
  });
});

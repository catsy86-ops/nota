import { describe, it, expect } from "vitest";
import { axisPercent, retimedAt, weekAxisHours } from "./weekAxis";

describe("weekAxisHours", () => {
  it("bez zmian i terminów: domyślny zakres 7–21", () => {
    expect(weekAxisHours([{ pieces: [], minutes: [] }])).toEqual({ from: 7, to: 21 });
  });

  it("zakres obejmuje najwcześniejszy i najpóźniejszy termin całego tygodnia", () => {
    const days = [
      { pieces: [], minutes: [5 * 60 + 30] },
      { pieces: [{ from: 6 * 60, to: 14 * 60, work: true }], minutes: [22 * 60 + 15] },
    ];
    expect(weekAxisHours(days)).toEqual({ from: 5, to: 23 });
  });
});

describe("axisPercent", () => {
  it("początek zakresu to 0 %, jego koniec to 100 %", () => {
    expect(axisPercent(7 * 60, 7, 21)).toBe(0);
    expect(axisPercent(21 * 60, 7, 21)).toBe(100);
  });

  it("połowa zakresu to 50 %", () => {
    expect(axisPercent(14 * 60, 7, 21)).toBe(50);
  });
});

describe("retimedAt", () => {
  it("zachowuje minutę i ustawia dzień oraz godzinę", () => {
    const ts = retimedAt(new Date(2026, 9, 14), 16, 30)!;
    const d = new Date(ts);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 14, 16, 30]);
  });
});

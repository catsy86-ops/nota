import { describe, it, expect } from "vitest";
import { getNextReminderTime, seriesDay } from "./reminderRepeat";

describe("getNextReminderTime", () => {
  const base = new Date(2026, 0, 15, 9, 30).getTime(); // 15 Jan 2026, 09:30

  it("advances by one day for 'daily', keeping the time", () => {
    const next = new Date(getNextReminderTime(base, "daily"));
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(30);
  });

  it("advances by seven days for 'weekly'", () => {
    const next = new Date(getNextReminderTime(base, "weekly"));
    expect(next.getDate()).toBe(22);
    expect(next.getMonth()).toBe(0);
  });

  it("advances by one month for 'monthly'", () => {
    const next = new Date(getNextReminderTime(base, "monthly"));
    expect(next.getMonth()).toBe(1);
    expect(next.getDate()).toBe(15);
  });

  it("returns the same timestamp for 'none'", () => {
    expect(getNextReminderTime(base, "none")).toBe(base);
  });

  it("rolls over month/year boundaries correctly", () => {
    const dec31 = new Date(2026, 11, 31, 8, 0).getTime();
    const next = new Date(getNextReminderTime(dec31, "daily"));
    expect(next.getFullYear()).toBe(2027);
    expect(next.getMonth()).toBe(0);
    expect(next.getDate()).toBe(1);
  });
});

describe("seria miesięczna na końcu miesiąca", () => {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 30).getTime();
  const key = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

  it("31 stycznia → 28 lutego (zwykły rok) i 29 lutego (przestępny)", () => {
    expect(key(getNextReminderTime(at(2026, 1, 31), "monthly"))).toBe("2026-2-28");
    expect(key(getNextReminderTime(at(2028, 1, 31), "monthly"))).toBe("2028-2-29");
  });

  it("z dniem serii wraca z 28 lutego na 31 marca, 30. na 30.", () => {
    expect(key(getNextReminderTime(at(2026, 2, 28), "monthly", 31))).toBe("2026-3-31");
    expect(key(getNextReminderTime(at(2026, 2, 28), "monthly", 30))).toBe("2026-3-30");
    expect(key(getNextReminderTime(at(2026, 3, 31), "monthly", 31))).toBe("2026-4-30");
  });

  it("zachowuje godzinę i przechodzi przez koniec roku", () => {
    const next = new Date(getNextReminderTime(at(2026, 12, 31), "monthly"));
    expect(key(next.getTime())).toBe("2027-1-31");
    expect(next.getHours()).toBe(9);
    expect(next.getMinutes()).toBe(30);
  });

  it("seriesDay: pole z notatki, a bez niego dzień zapisanego terminu", () => {
    expect(seriesDay({ reminder: at(2026, 2, 28), reminderDay: 31 })).toBe(31);
    expect(seriesDay({ reminder: at(2026, 1, 31) })).toBe(31);
    expect(seriesDay({ reminder: null })).toBeUndefined();
  });
});

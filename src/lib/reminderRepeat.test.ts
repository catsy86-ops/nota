import { describe, it, expect } from "vitest";
import { getNextReminderTime } from "./reminderRepeat";

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

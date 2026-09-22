import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getTodayRange, getWeekRange, isToday, isThisWeek } from "./dateRanges";
import type { Note } from "@/hooks/useNotes";

function makeNote(overrides: Partial<Pick<Note, "createdAt" | "updatedAt">> = {}) {
  return { createdAt: 0, updatedAt: 0, ...overrides };
}

describe("dateRanges", () => {
  beforeEach(() => {
    // 2026-03-10 12:00:00 local time — a Tuesday.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getTodayRange", () => {
    it("spans from local midnight to 23:59:59.999 of the current day", () => {
      const { start, end } = getTodayRange();
      expect(new Date(start)).toEqual(new Date(2026, 2, 10, 0, 0, 0, 0));
      expect(new Date(end)).toEqual(new Date(2026, 2, 10, 23, 59, 59, 999));
    });
  });

  describe("getWeekRange", () => {
    it("spans the rolling 7-day window ending today", () => {
      const { start, end } = getWeekRange();
      expect(new Date(start)).toEqual(new Date(2026, 2, 4, 0, 0, 0, 0));
      expect(new Date(end)).toEqual(new Date(2026, 2, 10, 23, 59, 59, 999));
    });
  });

  describe("isToday", () => {
    it("is true when createdAt falls within today", () => {
      const note = makeNote({ createdAt: new Date(2026, 2, 10, 8, 0, 0).getTime() });
      expect(isToday(note)).toBe(true);
    });

    it("is true when updatedAt falls within today even if createdAt doesn't", () => {
      const note = makeNote({
        createdAt: new Date(2026, 2, 1).getTime(),
        updatedAt: new Date(2026, 2, 10, 9, 0, 0).getTime(),
      });
      expect(isToday(note)).toBe(true);
    });

    it("is false for a note from yesterday", () => {
      const note = makeNote({
        createdAt: new Date(2026, 2, 9, 23, 0, 0).getTime(),
        updatedAt: new Date(2026, 2, 9, 23, 0, 0).getTime(),
      });
      expect(isToday(note)).toBe(false);
    });
  });

  describe("isThisWeek", () => {
    it("is true for a note created 6 days ago", () => {
      const note = makeNote({ createdAt: new Date(2026, 2, 4, 10, 0, 0).getTime() });
      expect(isThisWeek(note)).toBe(true);
    });

    it("is false for a note created 7 days ago (outside the rolling window)", () => {
      const note = makeNote({ createdAt: new Date(2026, 2, 3, 23, 59, 0).getTime() });
      expect(isThisWeek(note)).toBe(false);
    });

    it("is true for a note created today", () => {
      const note = makeNote({ createdAt: new Date(2026, 2, 10, 1, 0, 0).getTime() });
      expect(isThisWeek(note)).toBe(true);
    });
  });
});

import { describe, it, expect } from "vitest";
import { computeDailyActivityCounts, computeStreak, activityLastNDays, parseDayKey } from "./achievements";
import type { Note } from "@/hooks/useNotes";

const DAY = 24 * 60 * 60 * 1000;

function noteAt(ts: number): Note {
  return {
    id: crypto.randomUUID(),
    title: "t",
    content: "",
    color: "default",
    pinned: false,
    archived: false,
    trashed: false,
    trashedAt: null,
    labels: [],
    reminder: null,
    priority: "none",
    images: [],
    checklist: [],
    folderId: null,
    order: 0,
    createdAt: ts,
    updatedAt: ts,
  } as Note;
}

describe("computeDailyActivityCounts", () => {
  it("counts one entry per note per distinct day", () => {
    const now = Date.now();
    const notes = [noteAt(now), noteAt(now)];
    const counts = computeDailyActivityCounts(notes, []);
    expect(counts.size).toBe(1);
    expect([...counts.values()][0]).toBe(2);
  });
});

describe("computeStreak", () => {
  it("is 0 when there is no activity today or yesterday", () => {
    const key = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const days = new Set([key(Date.now() - 5 * DAY)]);
    expect(computeStreak(days).current).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const key = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const now = Date.now();
    const days = new Set([key(now), key(now - DAY), key(now - 2 * DAY)]);
    const streak = computeStreak(days);
    expect(streak.current).toBe(3);
    expect(streak.longest).toBeGreaterThanOrEqual(3);
  });

  it("still counts today's streak when today has no activity yet but yesterday does", () => {
    const key = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const now = Date.now();
    const days = new Set([key(now - DAY), key(now - 2 * DAY)]);
    expect(computeStreak(days).current).toBe(2);
  });
});

describe("activityLastNDays", () => {
  it("returns N entries ending today with zero-filled gaps", () => {
    const counts = new Map<string, number>();
    const result = activityLastNDays(counts, 7);
    expect(result).toHaveLength(7);
    expect(result.every((r) => r.count === 0)).toBe(true);
    const todayKey = result[6].date;
    expect(parseDayKey(todayKey).toDateString()).toBe(new Date().toDateString());
  });

  it("reflects provided counts on matching days", () => {
    const now = Date.now();
    const d = new Date(now);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const counts = new Map([[key, 3]]);
    const result = activityLastNDays(counts, 3);
    expect(result[result.length - 1].count).toBe(3);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOverdueBadge, applyAppBadge } from "./useOverdueBadge";
import { formatBadgeTitle, setBadgeEnabled, BADGE_KEY } from "@/lib/overdueBadge";
import { countOverdue } from "@/lib/reminderAgenda";
import type { Note } from "@/hooks/useNotes";

const NOW = new Date("2026-10-10T10:00:00").getTime();
const note = (id: string, reminder: number | null): Note => ({
  id, title: id, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0,
});

describe("formatBadgeTitle", () => {
  it("prefixes the count only when positive", () => {
    expect(formatBadgeTitle("NOTKI", 3)).toBe("(3) NOTKI");
    expect(formatBadgeTitle("NOTKI", 0)).toBe("NOTKI");
    expect(formatBadgeTitle("NOTKI", -2)).toBe("NOTKI");
  });
  it("caps large counts", () => {
    expect(formatBadgeTitle("NOTKI", 250)).toBe("(99+) NOTKI");
  });
});

describe("countOverdue", () => {
  it("counts only reminders in the past", () => {
    expect(countOverdue([note("a", NOW - 1), note("b", NOW + 1), note("c", null)], NOW)).toBe(1);
  });
});

describe("applyAppBadge", () => {
  it("sets and clears, tolerating missing or throwing APIs", () => {
    const setAppBadge = vi.fn().mockResolvedValue(undefined);
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    applyAppBadge(2, { setAppBadge, clearAppBadge } as unknown as Navigator);
    expect(setAppBadge).toHaveBeenCalledWith(2);
    applyAppBadge(0, { setAppBadge, clearAppBadge } as unknown as Navigator);
    expect(clearAppBadge).toHaveBeenCalled();
    expect(() => applyAppBadge(1, {} as Navigator)).not.toThrow();
    expect(() => applyAppBadge(1, { setAppBadge: () => { throw new Error("x"); } } as unknown as Navigator)).not.toThrow();
    expect(() => applyAppBadge(1, { setAppBadge: () => Promise.reject(new Error("x")) } as unknown as Navigator)).not.toThrow();
  });
});

describe("useOverdueBadge", () => {
  const setAppBadge = vi.fn().mockResolvedValue(undefined);
  const clearAppBadge = vi.fn().mockResolvedValue(undefined);
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.removeItem(BADGE_KEY);
    setBadgeEnabled(true);
    setAppBadge.mockClear();
    clearAppBadge.mockClear();
    Object.assign(navigator, { setAppBadge, clearAppBadge });
    document.title = "NOTKI";
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes the count to the tab title and app badge", () => {
    const { result } = renderHook(() => useOverdueBadge([note("a", NOW - 1000), note("b", NOW - 5), note("c", NOW + 9999)]));
    expect(result.current).toBe(2);
    expect(document.title).toBe("(2) NOTKI");
    expect(setAppBadge).toHaveBeenLastCalledWith(2);
  });

  it("restores the plain title and clears the badge at zero", () => {
    const { result } = renderHook(() => useOverdueBadge([note("a", NOW + 1000)]));
    expect(result.current).toBe(0);
    expect(document.title).toBe("NOTKI");
    expect(clearAppBadge).toHaveBeenCalled();
  });

  it("picks up a reminder that becomes overdue without the list changing", () => {
    const notes = [note("a", NOW + 10_000)];
    renderHook(() => useOverdueBadge(notes));
    expect(document.title).toBe("NOTKI");
    act(() => { vi.advanceTimersByTime(40_000); });
    expect(document.title).toBe("(1) NOTKI");
  });

  it("does nothing when the toggle is off", () => {
    setBadgeEnabled(false);
    renderHook(() => useOverdueBadge([note("a", NOW - 1)]));
    expect(document.title).toBe("NOTKI");
    expect(setAppBadge).not.toHaveBeenCalled();
  });
});

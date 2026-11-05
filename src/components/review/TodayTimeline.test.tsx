import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Note } from "@/hooks/useNotes";

const shiftsState = vi.hoisted(() => ({ data: { types: [] as unknown[], days: {} as Record<string, unknown> } }));

vi.mock("@/lib/shifts", () => ({ useShifts: () => shiftsState.data }));

import { TodayTimeline, TODAY_TIMELINE_KEY } from "./TodayTimeline";
import { localDayKey } from "@/lib/dayDone";

function noteAt(id: string, title: string, at: number): Note {
  return { id, title, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null, labels: [], reminder: at, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: at, updatedAt: at };
}

function todayAt(h: number, m = 0): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
}

beforeEach(() => localStorage.removeItem(TODAY_TIMELINE_KEY));

afterEach(() => {
  cleanup();
  shiftsState.data = { types: [], days: {} };
});

describe("TodayTimeline", () => {
  it("pusty dzień — bez zmiany i terminów — nie pokazuje osi", () => {
    render(<TodayTimeline notes={[]} onOpen={() => {}} />);
    expect(screen.queryByTestId("today-timeline")).toBeNull();
  });

  it("dzisiejszy termin w godzinach: licznik i klik otwiera notatkę", () => {
    const onOpen = vi.fn();
    render(<TodayTimeline notes={[noteAt("a", "Odbiór instalacji", todayAt(15, 30))]} onOpen={onOpen} />);
    expect(screen.getByTestId("today-timeline").textContent).toContain("1 w godzinach");
    fireEvent.click(screen.getByRole("button", { name: /Odbiór instalacji/ }));
    expect(onOpen).toHaveBeenCalledWith("a");
  });

  it("zmiana z Grafiku wystarcza, żeby oś była widoczna", () => {
    shiftsState.data = {
      types: [{ id: "r", name: "Ranna", short: "R", color: "amber", start: "06:00", end: "14:00", breakMin: 0 }],
      days: { [localDayKey()]: { type: "r" } },
    };
    render(<TodayTimeline notes={[]} onOpen={() => {}} />);
    expect(screen.getByTestId("today-timeline").textContent).toContain("bez terminów");
  });

  it("zwinięcie zapamiętuje urządzenie", () => {
    render(<TodayTimeline notes={[noteAt("a", "Termin", todayAt(10))]} onOpen={() => {}} />);
    const toggle = screen.getByRole("button", { name: /Oś dnia/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(localStorage.getItem(TODAY_TIMELINE_KEY)).toBe("0");
    cleanup();
    render(<TodayTimeline notes={[noteAt("a", "Termin", todayAt(10))]} onOpen={() => {}} />);
    expect(screen.getByRole("button", { name: /Oś dnia/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("notatka w koszu nie trafia na oś", () => {
    render(<TodayTimeline notes={[{ ...noteAt("a", "Stary", todayAt(9)), trashed: true }]} onOpen={() => {}} />);
    expect(screen.queryByTestId("today-timeline")).toBeNull();
  });
});

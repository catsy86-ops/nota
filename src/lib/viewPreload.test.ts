import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/calendar/ReminderCalendarView", () => ({ ReminderCalendarView: () => null }));
vi.mock("@/components/shifts/ShiftsView", () => ({ ShiftsView: () => null }));
vi.mock("@/components/study/StudyView", () => ({ default: () => null }));

import { isLazyView, loadShiftsView, preloadView } from "./viewPreload";

describe("viewPreload", () => {
  it("rozpoznaje tylko widoki ładowane leniwie", () => {
    expect(isLazyView("calendar")).toBe(true);
    expect(isLazyView("shifts")).toBe(true);
    expect(isLazyView("study")).toBe(true);
    expect(isLazyView("notes")).toBe(false);
    expect(isLazyView("trash")).toBe(false);
  });

  it("wstępne ładowanie i lazy() dzielą jedną obietnicę", async () => {
    preloadView("shifts");
    const a = loadShiftsView();
    const b = loadShiftsView();
    expect(a).toBe(b);
    expect((await a).ShiftsView).toBeTypeOf("function");
  });

  it("widok spoza listy nic nie pobiera i nie rzuca", () => {
    expect(() => preloadView("notes")).not.toThrow();
  });
});

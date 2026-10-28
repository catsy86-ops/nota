import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const shiftsState = vi.hoisted(() => ({ ready: true, data: { types: [] as unknown[], days: {} as Record<string, unknown> }, current: null as unknown, next: null as unknown }));

vi.mock("@/lib/shifts", () => ({
  useShifts: () => shiftsState.data,
  useShiftsReady: () => shiftsState.ready,
}));

// Czas zmiany (G2.1) liczy hook; tu podajemy gotowy wynik.
vi.mock("@/lib/shifts/useShiftNow", () => ({
  useShiftNow: () => ({ now: new Date(), current: shiftsState.current, next: shiftsState.next, ended: null }),
}));

import { TodayShiftCard } from "./TodayShiftCard";
import { localDayKey } from "@/lib/dayDone";

afterEach(() => {
  cleanup();
  shiftsState.ready = true;
  shiftsState.data = { types: [], days: {} };
  shiftsState.current = null;
  shiftsState.next = null;
});

describe("TodayShiftCard", () => {
  it("bez wpisu na dziś mówi, że nie ma zmiany", () => {
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    expect(screen.getByTestId("today-shift").textContent).toContain("Dziś nie ma zmiany w grafiku.");
  });

  it("pokazuje nazwę i godziny zmiany z dzisiejszego dnia", () => {
    shiftsState.data = {
      types: [{ id: "r", name: "Ranna", short: "R", color: "amber", start: "06:00", end: "14:00", breakMin: 0 }],
      days: { [localDayKey()]: { type: "r" } },
    };
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    expect(screen.getByTestId("today-shift").textContent).toContain("Ranna, 06:00–14:00");
  });

  it("zaplanowana zmiana z usuniętym rodzajem nie znika bez śladu", () => {
    shiftsState.data = { types: [], days: { [localDayKey()]: { type: "zniknął" } } };
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    expect(screen.getByTestId("today-shift").textContent).toContain("rodzaj usunięty");
  });

  it("przed wczytaniem Grafiku nie udaje brak zmiany", () => {
    shiftsState.ready = false;
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    expect(screen.getByTestId("today-shift").textContent).toContain("Grafik się wczytuje");
  });

  it("przyciski wywołują podane akcje", () => {
    let shifts = 0;
    let daily = 0;
    render(<TodayShiftCard onOpenShifts={() => shifts++} onDailyNote={() => daily++} />);
    screen.getByRole("button", { name: /Grafik/ }).click();
    screen.getByRole("button", { name: /Notatka dnia/ }).click();
    expect([shifts, daily]).toEqual([1, 1]);
  });
});

describe("TodayShiftCard — czas zmiany (G2.1)", () => {
  it("trwająca zmiana pokazuje, do kiedy trwa", () => {
    shiftsState.current = { start: new Date(2026, 9, 27, 8, 0), end: new Date(2026, 9, 27, 16, 0) };
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    expect(screen.getByTestId("today-timing").textContent).toBe("Trwa teraz, do 16:00");
    expect(Number(screen.getByRole("progressbar", { name: "Postęp zmiany" }).getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(0);
  });

  it("bez zmiany teraz pokazuje najbliższą", () => {
    shiftsState.next = { start: new Date(Date.now() + 3 * 3600_000) };
    render(<TodayShiftCard onOpenShifts={() => {}} onDailyNote={() => {}} />);
    expect(screen.getByTestId("today-timing").textContent).toMatch(/^Zaczynasz za .*, o \d\d:\d\d$/);
  });
});

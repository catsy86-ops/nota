import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { localDayKey } from "@/lib/dayDone";

const shiftsState = vi.hoisted(() => ({ ready: true, data: { types: [] as unknown[], days: {} as Record<string, unknown> }, current: null as unknown, next: null as unknown }));

vi.mock("@/lib/shifts", () => ({
  useShifts: () => shiftsState.data,
  useShiftsReady: () => shiftsState.ready,
}));
vi.mock("@/lib/shifts/useShiftNow", () => ({
  useShiftNow: () => ({ now: new Date(), current: shiftsState.current, next: shiftsState.next, ended: null }),
}));

import WidgetShiftLine from "./WidgetShiftLine";

afterEach(() => {
  cleanup();
  shiftsState.ready = true;
  shiftsState.data = { types: [], days: {} };
  shiftsState.current = null;
  shiftsState.next = null;
});

describe("WidgetShiftLine (widżet 4.5)", () => {
  it("bez zmiany dziś mówi to jednym zdaniem", () => {
    render(<WidgetShiftLine />);
    expect(screen.getByTestId("widget-shift").textContent).toContain("Dziś nie ma zmiany");
  });

  it("zmiana z rodzajem i godzinami, z czasem do startu", () => {
    shiftsState.data = {
      types: [{ id: "r", name: "R", start: "06:00", end: "14:00" }],
      days: { [localDayKey(new Date())]: { type: "r" } },
    };
    shiftsState.next = { start: new Date(Date.now() + 2 * 3600_000 + 600_000) };
    render(<WidgetShiftLine />);
    const text = screen.getByTestId("widget-shift").textContent ?? "";
    expect(text).toContain("R 06:00–14:00");
    expect(text).toMatch(/za 2 godz/);
  });

  it("nic nie pokazuje, dopóki Grafik się nie wczyta", () => {
    shiftsState.ready = false;
    const { container } = render(<WidgetShiftLine />);
    expect(container.textContent).toBe("");
  });
});

import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const presetsNow = vi.fn(() => [{ label: "Po dzisiejszej zmianie", at: new Date(2026, 9, 27, 14) }]);
vi.mock("@/lib/reminderShiftPresets", () => ({ currentShiftPresets: presetsNow }));

import { useShiftPresets } from "./useShiftPresets";

describe("useShiftPresets (Plan-nowy 1.5)", () => {
  it("najpierw pusta lista, po doczytaniu modułu presety z aktywnego grafiku", async () => {
    const now = new Date(2026, 9, 27, 9);
    const { result } = renderHook(() => useShiftPresets(now));
    expect(result.current).toEqual([]);
    await waitFor(() => expect(result.current.map((p) => p.label)).toEqual(["Po dzisiejszej zmianie"]));
    expect(presetsNow).toHaveBeenCalledWith(now);
  });

  it("drugi picker dostaje presety od razu, bez czekania", () => {
    const { result } = renderHook(() => useShiftPresets(new Date(2026, 9, 27, 9)));
    expect(result.current).toHaveLength(1);
  });
});

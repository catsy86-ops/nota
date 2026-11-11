import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const set = vi.hoisted(() => vi.fn());
vi.mock("@/lib/shifts", () => ({ setDayEntry: set, formatDuration: (m: number) => `${m} min` }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/undoToast", () => ({ toastWithUndo: vi.fn() }));
vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }));

import { finishShiftNow } from "./finishNow";

const occ = (endAt: number) => ({ dayKey: "2026-10-01", entry: { type: "b" }, end: new Date(endAt) }) as never;

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 11, 18, 0)); set.mockClear(); });
afterEach(() => vi.useRealTimers());

describe("finishShiftNow: zakres (S8)", () => {
  it("zmiana sprzed tygodnia (link z adresu) nie zapisuje tysięcy minut nadgodzin", () => {
    finishShiftNow(occ(new Date(2026, 10, 4, 17, 0).getTime()));
    expect(set).not.toHaveBeenCalled();
  });

  it("zwykłe zakończenie godzinę po planie zapisuje +60 min", () => {
    finishShiftNow(occ(new Date(2026, 10, 11, 17, 0).getTime()));
    expect(set).toHaveBeenCalledWith("2026-10-01", expect.objectContaining({ extraMin: 60 }));
  });
});

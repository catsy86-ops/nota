import { describe, expect, it } from "vitest";
import { presetOf, presetRange } from "./reportPresets";

describe("okresy raportu", () => {
  it("poprzedni miesiąc to cały miesiąc kalendarzowy, także przez nowy rok i luty", () => {
    expect(presetRange("prev-month", "2026-10-24")).toEqual(["2026-09-01", "2026-09-30"]);
    expect(presetRange("prev-month", "2026-01-01")).toEqual(["2025-12-01", "2025-12-31"]);
    expect(presetRange("prev-month", "2028-03-15")).toEqual(["2028-02-01", "2028-02-29"]);
  });

  it("pozostałe presety bez zmian", () => {
    expect(presetRange("today", "2026-10-24")).toEqual(["2026-10-24", "2026-10-24"]);
    expect(presetRange("yesterday", "2026-10-01")).toEqual(["2026-09-30", "2026-09-30"]);
    expect(presetRange("week", "2026-10-24")).toEqual(["2026-10-18", "2026-10-24"]);
    expect(presetRange("month", "2026-10-24")).toEqual(["2026-10-01", "2026-10-24"]);
  });

  it("rozpoznaje preset po zakresie, inny zakres to „Wybierz”", () => {
    expect(presetOf("2026-09-01", "2026-09-30", "2026-10-24")).toBe("prev-month");
    expect(presetOf("2026-10-01", "2026-10-24", "2026-10-24")).toBe("month");
    expect(presetOf("2026-09-02", "2026-09-30", "2026-10-24")).toBe("custom");
  });
});

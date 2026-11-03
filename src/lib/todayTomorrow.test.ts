import { describe, it, expect } from "vitest";
import { countRemindersOn, isTomorrowPreviewTime, tomorrowLine } from "./todayTomorrow";
import type { ShiftType } from "@/lib/shifts/model";

const types: ShiftType[] = [
  { id: "r", name: "Ranna", short: "R", color: "#f59e0b", start: "06:00", end: "14:00", breakMin: 30 },
  { id: "u", name: "Urlop", short: "U", color: "#10b981", start: "08:00", end: "16:00", breakMin: 0, kind: "absence" },
] as ShiftType[];

describe("podgląd jutra na Dziś (2.2)", () => {
  it("pora: od godziny przypomnienia o Grafiku, bez niej od 18:00", () => {
    expect(isTomorrowPreviewTime(new Date(2026, 10, 3, 17, 59), null)).toBe(false);
    expect(isTomorrowPreviewTime(new Date(2026, 10, 3, 18, 0), null)).toBe(true);
    expect(isTomorrowPreviewTime(new Date(2026, 10, 3, 19, 30), "20:00")).toBe(false);
    expect(isTomorrowPreviewTime(new Date(2026, 10, 3, 20, 0), "20:00")).toBe(true);
  });

  it("tekst: skrót z godzinami (godziny dnia wygrywają), nieobecność, wolne i odmiana terminów", () => {
    expect(tomorrowLine({ type: "r" }, types, 2)).toBe("Jutro: R 06:00–14:00 · 2 terminy");
    expect(tomorrowLine({ type: "r", hours: { start: "07:00", end: "15:00", breakMin: 30 } }, types, 0)).toBe("Jutro: R 07:00–15:00");
    expect(tomorrowLine({ type: "u" }, types, 1)).toBe("Jutro: Urlop · 1 termin");
    expect(tomorrowLine(undefined, types, 5)).toBe("Jutro: wolne · 5 terminów");
  });

  it("terminy jutra: tylko w granicach dnia, bez kosza", () => {
    const tomorrow = new Date(2026, 10, 4);
    const at = (h: number, d = 4) => new Date(2026, 10, d, h).getTime();
    expect(countRemindersOn([
      { reminder: at(0) }, { reminder: at(23) }, { reminder: at(9), trashed: true },
      { reminder: at(9, 5) }, { reminder: at(23, 3) }, { reminder: null },
    ], tomorrow)).toBe(2);
  });
});

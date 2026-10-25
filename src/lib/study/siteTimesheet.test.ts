import { describe, expect, it } from "vitest";
import { EMPTY_SHIFT_DATA, type ShiftData } from "@/lib/shifts/model";
import { buildSiteTimesheetCsv } from "./siteTimesheet";
import type { JournalEntry } from "./yStudy";

const work = { id: "d", name: "Dzień", short: "D", color: "#000", start: "06:00", end: "14:00", breakMin: 0, kind: "work" as const };
const day = new Date(2026, 9, 5, 12).getTime();
const entry = { id: "e", at: day, kind: "ok", topic: null, text: "Montaż", site: "Lipowa", checked: [], images: [] } as unknown as JournalEntry;

describe("godziny na budowach CSV (2.6)", () => {
  const shifts: ShiftData = { ...EMPTY_SHIFT_DATA, types: [work], days: { "2026-10-05": { type: "d" } }, hourlyRate: 50 };

  it("dzień z jedną budową: godziny i koszt w wierszu, podsumowanie i stawka", () => {
    const csv = buildSiteTimesheetCsv({ shifts, sites: {}, journal: [entry], year: 2026, month: 9 });
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("2026-10-05;Lipowa;8,00;400,00");
    expect(csv).toContain("Razem;8,00;400,00");
    expect(csv).toContain("Stawka (zł/h);50,00");
  });

  it("bez stawki koszt zostaje 0 i stawka oznaczona jako nieustawiona", () => {
    const csv = buildSiteTimesheetCsv({ shifts: { ...shifts, hourlyRate: 0 }, sites: {}, journal: [entry], year: 2026, month: 9 });
    expect(csv).toContain("Stawka (zł/h);nie ustawiona");
  });

  it("dzień bez zmiany nie daje wierszy dnia", () => {
    const csv = buildSiteTimesheetCsv({ shifts: { ...shifts, days: {} }, sites: {}, journal: [entry], year: 2026, month: 9 });
    expect(csv).not.toContain("2026-10-05");
  });
});

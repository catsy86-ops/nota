import { describe, expect, it } from "vitest";
import { EMPTY_SHIFT_DATA, type ShiftData } from "./model";
import { buildTimesheetCsv } from "./timesheet";

const data: ShiftData = {
  ...EMPTY_SHIFT_DATA,
  days: {
    "2026-10-05": { type: "d", extraMin: 30, note: "=SUMA(A1)" },
    "2026-10-06": { type: "u" },
    "2026-09-30": { type: "p" },
  },
};

describe("buildTimesheetCsv", () => {
  const csv = buildTimesheetCsv(data, 2026, 9);
  const lines = csv.replace("\uFEFF", "").trim().split("\r\n");

  it("zaczyna się od BOM i nagłówka, pomija inne miesiące", () => {
    expect(csv.startsWith("\uFEFFData;Zmiana")).toBe(true);
    expect(csv).not.toContain("2026-09-30");
  });

  it("liczy godziny zmiany z odchyleniem i neutralizuje formułę w notatce", () => {
    const row = lines.find((l) => l.startsWith("2026-10-05"))!;
    expect(row).toContain("Dzień;06:00;14:00;0;8,50");
    expect(row).toContain("'=SUMA(A1)");
  });

  it("nieobecność nie ma godzin pracy", () => {
    expect(lines.find((l) => l.startsWith("2026-10-06"))).toMatch(/^2026-10-06;Urlop;;;;;;;/);
  });
});

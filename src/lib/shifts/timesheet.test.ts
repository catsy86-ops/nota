import { describe, expect, it } from "vitest";
import { type ShiftData } from "./model";
import { buildTimesheetCsv } from "./timesheet";
import { TEST_SHIFT_TYPES, TEST_EMPTY_SHIFT_DATA } from "./testShiftTypes";

const data: ShiftData = {
  ...TEST_EMPTY_SHIFT_DATA,
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
    expect(row).toContain("Dzień;06:00;14:30;14:00;0;8,50");
    expect(row).toContain("'=SUMA(A1)");
  });

  it("„Do” to faktyczny koniec, a zmiana przez północ zawija się do doby", () => {
    const late = { ...TEST_SHIFT_TYPES[0], id: "x", name: "Późna", start: "16:00", end: "23:30" };
    const wrapped = buildTimesheetCsv({ ...data, types: [...data.types, late], days: { "2026-10-07": { type: "x", extraMin: 45 } } }, 2026, 9)
      .split("\r\n").find((l) => l.startsWith("2026-10-07"))!;
    expect(wrapped).toContain(";16:00;00:15;23:30;");
  });

  it("nieobecność nie ma godzin pracy", () => {
    expect(lines.find((l) => l.startsWith("2026-10-06"))).toMatch(/^2026-10-06;Urlop;;;;;;;/);
  });
});

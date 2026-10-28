import { describe, expect, it } from "vitest";
import type { ShiftData } from "./model";
import { parseSemicolonCsv, planShiftsFromCsv } from "./csvShifts";
import { buildTimesheetCsv } from "./timesheet";
import { TEST_EMPTY_SHIFT_DATA, TEST_SHIFT_TYPES } from "./testShiftTypes";

const data: ShiftData = {
  ...TEST_EMPTY_SHIFT_DATA,
  days: {
    "2026-10-05": { type: "d", extraMin: 30, note: "=SUMA(A1)" },
    "2026-10-06": { type: "u" },
    "2026-10-07": { type: "n", note: "Cytat \"w cudzysłowie\"; średnik" },
    "2026-09-30": { type: "p" },
  },
};

describe("parseSemicolonCsv", () => {
  it("czyta cudzysłowy z podwójnymi cudzysłowami, średniki i CRLF, pomija BOM", () => {
    const rows = parseSemicolonCsv("﻿a;\"b;\"\"c\"\"\";d\r\n1;2;3\r\n");
    expect(rows).toEqual([["a", 'b;"c"', "d"], ["1", "2", "3"]]);
  });
});

describe("planShiftsFromCsv (odwrotność karty czasu)", () => {
  it("odtwarza wpisy miesiąca z eksportu: rodzaj, odchylenie i notatkę", () => {
    const csv = buildTimesheetCsv(data, 2026, 9);
    const plan = planShiftsFromCsv(csv, { days: {}, types: TEST_SHIFT_TYPES });
    expect(plan).not.toBeNull();
    expect(plan!.changes).toEqual({
      "2026-10-05": { type: "d", extraMin: 30, note: "=SUMA(A1)" },
      "2026-10-06": { type: "u" },
      "2026-10-07": { type: "n", note: "Cytat \"w cudzysłowie\"; średnik" },
    });
    expect(plan!.unreadable).toBe(0);
    expect(plan!.preview.map((p) => [p.key, p.typeName])).toEqual([
      ["2026-10-05", "Dzień"],
      ["2026-10-06", "Urlop"],
      ["2026-10-07", "Noc"],
    ]);
  });

  it("dzień już zajęty zostaje i trafia do podglądu jako pominięty", () => {
    const csv = buildTimesheetCsv(data, 2026, 9);
    const plan = planShiftsFromCsv(csv, { days: { "2026-10-06": { type: "p" } }, types: TEST_SHIFT_TYPES });
    expect(plan!.changes["2026-10-06"]).toBeUndefined();
    expect(plan!.skippedFilled).toBe(1);
    expect(plan!.preview.find((p) => p.key === "2026-10-06")?.status).toBe("filled");
  });

  it("nieznana nazwa zmiany to nieczytelny wiersz, a wiersz bez daty jest pomijany", () => {
    const csv = "Data;Zmiana;Odchylenie (min)\r\n2026-10-05;Nieistniejąca;0\r\n2026-10-06;Dzień;0\r\n\r\nPrzepracowane (h);8,00\r\n";
    const plan = planShiftsFromCsv(csv, { days: {}, types: TEST_SHIFT_TYPES });
    expect(plan!.unreadable).toBe(1);
    expect(plan!.imported).toBe(1);
  });

  it("plik bez nagłówka Grafiku to null, nie pusty plan", () => {
    expect(planShiftsFromCsv("a;b\r\n1;2\r\n", { days: {}, types: TEST_SHIFT_TYPES })).toBeNull();
  });
});

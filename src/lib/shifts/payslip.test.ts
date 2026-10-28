import { describe, expect, it } from "vitest";
import { comparePayslip } from "./payslip";
import { cleanPaidGross } from "./model";

describe("comparePayslip (B5)", () => {
  it("bez wpisanej wypłaty nie ma porównania", () => {
    expect(comparePayslip(6000, 0, { nightMinutes: 0, absenceDays: 0 })).toBeNull();
  });

  it("wypłata niższa: różnica ujemna, podpowiedzi o nocnych i urlopie", () => {
    const c = comparePayslip(6000, 5800, { nightMinutes: 120, absenceDays: 2 });
    expect(c).toMatchObject({ diff: -200, percent: -3.3 });
    expect(c!.hints).toHaveLength(3);
    expect(c!.hints[0]).toContain("nocne");
  });

  it("zgodne w granicy tolerancji: bez podpowiedzi", () => {
    const c = comparePayslip(6000, 6000.5, { nightMinutes: 0, absenceDays: 0 });
    expect(c!.hints).toEqual([]);
  });

  it("wypłata wyższa: podpowiedź o premii, której nie ma w grafiku", () => {
    const c = comparePayslip(6000, 6400, { nightMinutes: 0, absenceDays: 0 });
    expect(c).toMatchObject({ diff: 400, percent: 6.7 });
    expect(c!.hints[0]).toContain("premia");
  });

  it("szacunek 0 nie dzieli przez zero", () => {
    expect(comparePayslip(0, 300, { nightMinutes: 0, absenceDays: 0 })).toMatchObject({ percent: 0, diff: 300 });
  });
});

describe("cleanPaidGross", () => {
  it("zostawia tylko poprawne miesiące z dodatnią kwotą", () => {
    expect(cleanPaidGross({ "2026-10": 6740.004, "2026-13": 1, "2026-09": 0, "2026-08": -5, "2026-07": "x", bad: 5 })).toEqual({ "2026-10": 6740 });
    expect(cleanPaidGross(null)).toEqual({});
  });
});

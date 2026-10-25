import { describe, expect, it } from "vitest";
import { parseReportParam, reportParam } from "./reportLink";

// Adres raportu z przypomnienia: `dzis`, `dzis-wszystkie`, `tydzien`, `tydzien-wszystkie` (Etap 5 § 5.6).
describe("reportLink: parametr raportu", () => {
  it("koduje i odczytuje wszystkie cztery warianty", () => {
    for (const range of ["day", "week"] as const) {
      for (const allSites of [false, true]) {
        expect(parseReportParam(reportParam({ range, allSites }))).toEqual({ range, allSites });
      }
    }
  });

  it("zakresy mapują się na nazwy z adresu", () => {
    expect(reportParam({ range: "day", allSites: false })).toBe("dzis");
    expect(reportParam({ range: "week", allSites: true })).toBe("tydzien-wszystkie");
  });
});

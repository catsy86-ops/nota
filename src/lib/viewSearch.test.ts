import { describe, expect, it } from "vitest";
import { viewHasSearch } from "./viewSearch";

describe("viewHasSearch", () => {
  it("widoki Grafik, Kalendarz, Praca, Długi i Ćwiczenia nie mają pola szukania", () => {
    for (const v of ["shifts", "calendar", "study", "debts", "cwiczenia"] as const) {
      expect(viewHasSearch(v)).toBe(false);
    }
  });
  it("Notatki i pozostałe listy mają pole szukania", () => {
    for (const v of ["notes", "today", "archive", "trash", "inbox"] as const) {
      expect(viewHasSearch(v)).toBe(true);
    }
  });
});

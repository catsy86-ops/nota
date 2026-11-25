import { describe, expect, it } from "vitest";
import { MERGE_SECTIONS, SHIFTS_SECTION, STUDY_SECTION } from "@/lib/backup/sections";
import { restoreScope } from "@/lib/backup/merge";

const all = { versions: true, settings: true, achievements: true, shifts: true, study: true };

describe("restoreScope (P6, Z-18.3)", () => {
  it("zastąpione: notatki zawsze, Grafik i Praca tylko gdy są w pliku i zaznaczone", () => {
    expect(restoreScope({}, all).replaced).toEqual(["notatki", "foldery", "etykiety"]);
    expect(restoreScope({ shifts: "{}", study: "{}" }, all).replaced).toEqual(["notatki", "foldery", "etykiety", SHIFTS_SECTION, STUDY_SECTION]);
    expect(restoreScope({ shifts: "{}", study: "{}" }, { ...all, shifts: false, study: false }).replaced).toHaveLength(3);
  });

  it("uzupełnione: każda sekcja MERGE_SECTIONS obecna w pliku", () => {
    const backup = Object.fromEntries(MERGE_SECTIONS.map((s) => [s.key, "{}"]));
    expect(restoreScope(backup, all).merged).toEqual(MERGE_SECTIONS.map((s) => s.label));
    expect(restoreScope({ debts: "{}" }, all).merged).toEqual(["Długi"]);
  });
});

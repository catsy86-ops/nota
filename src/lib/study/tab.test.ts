import { beforeEach, describe, expect, it } from "vitest";
import { readStudyTab, STUDY_TAB_KEY, studyTabGroup, writeStudyTab } from "./tab";

describe("zakładka działu Praca", () => {
  beforeEach(() => localStorage.removeItem(STUDY_TAB_KEY));

  it("bez zapisu: telefon — Budowa, komputer — Quiz", () => {
    expect(readStudyTab(true)).toBe("site");
    expect(readStudyTab(false)).toBe("quiz");
  });

  it("zapamiętuje znane zakładki, ignoruje śmieci", () => {
    writeStudyTab("board");
    expect(readStudyTab(true)).toBe("board");
    writeStudyTab("x");
    expect(readStudyTab(false)).toBe("board");
    localStorage.setItem(STUDY_TAB_KEY, "zła");
    expect(readStudyTab(false)).toBe("quiz");
  });

  it("Plany to zakładka Pracy i też się zapamiętują", () => {
    writeStudyTab("plans");
    expect(readStudyTab(true)).toBe("plans");
  });

  it("zakładka „site” się zapamiętuje, a Quiz, Tablica i Lista należą do grupy Nauka", () => {
    writeStudyTab("site");
    expect(readStudyTab(false)).toBe("site");
    expect(["quiz", "board", "list"].map(studyTabGroup)).toEqual(["learn", "learn", "learn"]);
    expect(["site", "journal", "plans"].map(studyTabGroup)).toEqual(["site", "journal", "plans"]);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { readStudyTab, STUDY_TAB_KEY, writeStudyTab } from "./tab";

describe("zakładka działu Praca", () => {
  beforeEach(() => localStorage.removeItem(STUDY_TAB_KEY));

  it("bez zapisu: telefon — Dziennik, komputer — Quiz", () => {
    expect(readStudyTab(true)).toBe("journal");
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
});

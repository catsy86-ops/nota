import { beforeEach, describe, expect, it } from "vitest";
import { clientUrl, CLIENT_PARAM, CLIENTS_TAB_VALUE, readStudyTab, STUDY_TAB_KEY, STUDY_TAB_PARAM, studyTabGroup, writeStudyTab } from "./tab";

describe("zakładka działu Praca", () => {
  beforeEach(() => localStorage.removeItem(STUDY_TAB_KEY));

  it("adres klienta niesie zakładkę i id (kodowane), a zakładka Klienci się zapamiętuje", () => {
    const url = new URL(clientUrl("cl-a b/1"), "http://x");
    expect(url.pathname).toBe("/praca");
    expect(url.searchParams.get(STUDY_TAB_PARAM)).toBe(CLIENTS_TAB_VALUE);
    expect(url.searchParams.get(CLIENT_PARAM)).toBe("cl-a b/1");
    writeStudyTab("clients");
    expect(readStudyTab(false)).toBe("clients");
  });

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
    expect(["site", "journal", "plans", "clients"].map(studyTabGroup)).toEqual(["site", "journal", "plans", "clients"]);
  });
});

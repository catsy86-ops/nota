import { beforeEach, describe, expect, it } from "vitest";
import { GUIDES_SEEN_KEY, guideSeen, markGuideSeen, shouldAutoShow, tourSteps, WORK_STEPS, type Interest } from "./guides";

describe("samouczek: karty i stan „widziane”", () => {
  beforeEach(() => localStorage.clear());

  it("karty: Notatki zawsze, wybrane działy w stałej kolejności, kopia na końcu", () => {
    const ids = (s: Interest[]) => tourSteps(new Set(s)).map((x) => x.id);
    expect(ids([])).toEqual(["capture", "search", "safe", "sync"]);
    expect(ids(["work", "today"])).toEqual(["capture", "search", "safe", "today", "terms", "work", "sync"]);
    expect(ids(["today", "shifts", "work"])).toHaveLength(8);
  });

  it("id kart są unikalne (klucze kropek i animacji)", () => {
    const all = [...tourSteps(new Set(["today", "shifts", "work"])), ...WORK_STEPS].map((s) => s.id);
    expect(new Set(all).size).toBe(all.length);
  });

  it("widziane: zapis per przewodnik, śmieci w pamięci nie psują", () => {
    expect(guideSeen("work")).toBe(false);
    markGuideSeen("work");
    expect(guideSeen("work")).toBe(true);
    expect(guideSeen("shifts-hint")).toBe(false);
    localStorage.setItem(GUIDES_SEEN_KEY, "nie json");
    expect(guideSeen("work")).toBe(false);
    markGuideSeen("shifts-hint");
    expect(guideSeen("shifts-hint")).toBe(true);
  });

  it("w testach automatycznych bez wymuszenia nie pokazuje się sam", () => {
    expect(shouldAutoShow("work", { webdriver: true, forced: false })).toBe(false);
    expect(shouldAutoShow("work", { webdriver: true, forced: true })).toBe(true);
    expect(shouldAutoShow("work", { webdriver: false, forced: false })).toBe(true);
    markGuideSeen("work");
    expect(shouldAutoShow("work", { webdriver: false, forced: false })).toBe(false);
  });
});

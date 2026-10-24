import { describe, it, expect } from "vitest";
import { findPeriodNote, isoWeek, periodKey, periodTitle } from "./periodNote";
import { safePeriodKey } from "./safeProjection";
import type { Note } from "@/hooks/useNotes";

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const note = (id: string, extra: Partial<Note> = {}): Note => ({
  id, title: id, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0,
  ...extra,
});

describe("isoWeek", () => {
  it("liczy tydzień ISO, także na granicy roku", () => {
    expect(isoWeek(at(2026, 1, 1))).toEqual({ year: 2026, week: 1 });
    // 2025-12-29 to poniedziałek tygodnia 1 roku 2026.
    expect(isoWeek(at(2025, 12, 29))).toEqual({ year: 2026, week: 1 });
    // 2024-12-30 to poniedziałek tygodnia 1 roku 2025.
    expect(isoWeek(at(2024, 12, 30))).toEqual({ year: 2025, week: 1 });
    // 2026-12-31 to czwartek — jeszcze rok 2026, tydzień 53 nie istnieje, więc to tydzień 53 roku 2026.
    expect(isoWeek(at(2026, 12, 31))).toEqual({ year: 2026, week: 53 });
  });

  it("poniedziałek i niedziela tego samego tygodnia dają ten sam numer", () => {
    expect(isoWeek(at(2026, 10, 19))).toEqual(isoWeek(at(2026, 10, 25)));
    expect(isoWeek(at(2026, 10, 26))).toEqual({ year: 2026, week: 44 });
  });
});

describe("periodKey", () => {
  it("tydzień to YYYY-Www, miesiąc to YYYY-MM", () => {
    expect(periodKey("week", at(2026, 10, 24))).toBe("2026-W43");
    expect(periodKey("week", at(2026, 1, 1))).toBe("2026-W01");
    expect(periodKey("month", at(2026, 10, 24))).toBe("2026-10");
    expect(periodKey("month", at(2026, 1, 31, 23, 59))).toBe("2026-01");
  });
});

describe("periodTitle", () => {
  it("tytuł tygodnia z numerem, miesiąca z wielką literą", () => {
    expect(periodTitle("week", at(2026, 10, 24))).toBe("Tydzień 43 · 2026");
    expect(periodTitle("month", at(2026, 10, 24))).toBe("Październik 2026");
  });
});

describe("findPeriodNote", () => {
  it("wybiera notatkę okresu po periodKey, a nie po tytule", () => {
    const notes = [
      note("tytul", { title: "2026-10", createdAt: 1 }),
      note("miesiac", { periodKey: "2026-10", createdAt: 5 }),
    ];
    expect(findPeriodNote(notes, "2026-10")?.id).toBe("miesiac");
  });

  it("pomija kosz, a przy duplikacie wygrywa starsza", () => {
    const notes = [
      note("kosz", { periodKey: "2026-W43", trashed: true, createdAt: 1 }),
      note("nowa", { periodKey: "2026-W43", createdAt: 9 }),
      note("stara", { periodKey: "2026-W43", createdAt: 3 }),
    ];
    expect(findPeriodNote(notes, "2026-W43")?.id).toBe("stara");
    expect(findPeriodNote(notes, "2026-W44")).toBeUndefined();
  });
});

describe("safePeriodKey", () => {
  it("przepuszcza tylko poprawne klucze", () => {
    expect(safePeriodKey("2026-W43")).toBe("2026-W43");
    expect(safePeriodKey("2026-10")).toBe("2026-10");
    expect(safePeriodKey("2026-10-24")).toBeUndefined();
    expect(safePeriodKey("<script>")).toBeUndefined();
    expect(safePeriodKey(42)).toBeUndefined();
  });
});

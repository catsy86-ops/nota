import { describe, it, expect } from "vitest";
import { appendTimestamp, dailyKey, findDailyNote } from "./dailyNote";
import type { Note } from "@/hooks/useNotes";

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const note = (id: string, extra: Partial<Note> = {}): Note => ({
  id, title: id, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0,
  ...extra,
});

describe("dailyKey", () => {
  it("uses the local date, with a new key right after midnight", () => {
    expect(dailyKey(at(2026, 9, 8, 23, 59))).toBe("2026-09-08");
    expect(dailyKey(at(2026, 9, 9, 0, 0))).toBe("2026-09-09");
  });
});

describe("findDailyNote", () => {
  it("matches by dailyDate, not by title", () => {
    const notes = [
      note("same-title", { title: "poniedziałek, 28 września" }),
      note("daily", { title: "zmieniony tytuł", dailyDate: "2026-09-28" }),
      note("yesterday", { dailyDate: "2026-09-27" }),
    ];
    expect(findDailyNote(notes, "2026-09-28")?.id).toBe("daily");
    expect(findDailyNote(notes, "2026-09-29")).toBeUndefined();
  });

  it("skips trashed notes but keeps archived ones", () => {
    expect(findDailyNote([note("t", { dailyDate: "2026-09-28", trashed: true })], "2026-09-28")).toBeUndefined();
    expect(findDailyNote([note("a", { dailyDate: "2026-09-28", archived: true })], "2026-09-28")?.id).toBe("a");
  });

  it("picks the oldest when two devices created one offline", () => {
    const notes = [
      note("newer", { dailyDate: "2026-09-28", createdAt: 200 }),
      note("older", { dailyDate: "2026-09-28", createdAt: 100 }),
    ];
    expect(findDailyNote(notes, "2026-09-28")?.id).toBe("older");
    expect(findDailyNote(notes.slice().reverse(), "2026-09-28")?.id).toBe("older");
  });
});

describe("appendTimestamp", () => {
  const t = at(2026, 9, 28, 9, 5);

  it("appends the time after a blank line", () => {
    expect(appendTimestamp("Rano kawa.\n", t)).toBe("Rano kawa.\n\n**09:05** ");
  });

  it("starts an empty note with the time", () => {
    expect(appendTimestamp("", t)).toBe("**09:05** ");
  });

  it("does not repeat the same minute", () => {
    const once = appendTimestamp("Rano kawa.", t);
    expect(appendTimestamp(once, t)).toBe(once);
  });
});

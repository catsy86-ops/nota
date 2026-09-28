import { describe, it, expect } from "vitest";
import { groupReminders, snoozeTimes } from "./reminderAgenda";
import type { Note } from "@/hooks/useNotes";

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const note = (id: string, reminder: number | null, updatedAt = 0): Note => ({
  id, title: id, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt,
});

const NOW = at(2026, 9, 28, 12);

describe("groupReminders", () => {
  it("groups by due date and sorts by reminder, ignoring edit time", () => {
    const groups = groupReminders([
      note("pozniej", at(2026, 11, 1), 999),
      note("jutro", at(2026, 9, 29, 8), 1),
      note("zalegle", at(2026, 9, 1), 5),
      note("dzis-wieczorem", at(2026, 9, 28, 20)),
      note("zalegle-dzis-rano", at(2026, 9, 28, 8)),
      note("bez-terminu", null),
    ], NOW);
    expect(groups.map((g) => [g.key, g.notes.map((n) => n.id)])).toEqual([
      ["overdue", ["zalegle", "zalegle-dzis-rano"]],
      ["today", ["dzis-wieczorem"]],
      ["week", ["jutro"]],
      ["later", ["pozniej"]],
    ]);
  });

  it("puts the end of the 7th day into the week group and skips empty groups", () => {
    const groups = groupReminders([note("d7", at(2026, 10, 5, 23, 30)), note("d8", at(2026, 10, 6, 0, 1))], NOW);
    expect(groups.map((g) => [g.key, g.notes.map((n) => n.id)])).toEqual([["week", ["d7"]], ["later", ["d8"]]]);
  });
});

describe("snoozeTimes", () => {
  it("gives +10 minutes and tomorrow at 9:00", () => {
    const { in10min, tomorrow9 } = snoozeTimes(at(2026, 9, 30, 23, 55));
    expect(in10min).toBe(at(2026, 10, 1, 0, 5));
    expect(tomorrow9).toBe(at(2026, 10, 1, 9, 0));
  });
});

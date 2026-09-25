import { describe, it, expect, beforeEach, vi } from "vitest";
import { useFilteredNotes } from "./useFilteredNotes";
import type { Note, Folder } from "@/hooks/useNotes";
import type { ViewPrefs } from "@/lib/viewPrefs";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: overrides.id || "1",
    title: "Tytuł",
    content: "Treść",
    color: "default",
    pinned: false,
    archived: false,
    trashed: false,
    trashedAt: null,
    labels: [],
    reminder: null,
    priority: "none",
    images: [],
    checklist: [],
    folderId: null,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const basePrefs: ViewPrefs = {
  density: "cozy",
  layout: "masonry",
  columns: 0,
  autoColumns: true,
  sortKey: "updated",
  sortDir: "desc",
  filterColor: "all",
  filterLabel: "all",
  filterHasReminder: false,
  filterPriority: "all",
  defaultNoteColor: "default",
  spellcheck: true,
  autosaveSeconds: 0,
  autoExportDays: 7,
  backupReminderDays: 0,
  todayReminderHours: 0,
  todayReminderTime: "",
  weekReminderTime: "",
  weekReminderDay: 1,
  showReadingTime: true,
  showBacklinks: true,
};

const folders: Folder[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0));
});

describe("useFilteredNotes", () => {
  it("splits pinned notes from others and sorts by updatedAt desc by default", () => {
    const notes = [
      makeNote({ id: "old", updatedAt: 1 }),
      makeNote({ id: "new", updatedAt: 2 }),
      makeNote({ id: "pinned", pinned: true, updatedAt: 0 }),
    ];
    const { pinned, others } = useFilteredNotes({
      notes, archivedNotes: [], trashedNotes: [], folders, view: "notes",
      activeLabel: null, activeFolder: null, search: "", prefs: basePrefs,
    });
    expect(pinned.map((n) => n.id)).toEqual(["pinned"]);
    expect(others.map((n) => n.id)).toEqual(["new", "old"]);
  });

  it("filters by label only in the 'label' view", () => {
    const notes = [makeNote({ id: "a", labels: ["dom"] }), makeNote({ id: "b", labels: [] })];
    const { displayNotes } = useFilteredNotes({
      notes, archivedNotes: [], trashedNotes: [], folders, view: "label",
      activeLabel: "dom", activeFolder: null, search: "", prefs: basePrefs,
    });
    expect(displayNotes.map((n) => n.id)).toEqual(["a"]);
  });

  it("filters to notes with a reminder in the 'reminders' view", () => {
    const notes = [makeNote({ id: "with", reminder: 123 }), makeNote({ id: "without" })];
    const { displayNotes } = useFilteredNotes({
      notes, archivedNotes: [], trashedNotes: [], folders, view: "reminders",
      activeLabel: null, activeFolder: null, search: "", prefs: basePrefs,
    });
    expect(displayNotes.map((n) => n.id)).toEqual(["with"]);
  });

  it("filters to today's notes in the 'today' view", () => {
    const notes = [
      makeNote({ id: "today", createdAt: new Date(2026, 2, 10, 8).getTime() }),
      makeNote({ id: "yesterday", createdAt: new Date(2026, 2, 9, 8).getTime() }),
    ];
    const { displayNotes } = useFilteredNotes({
      notes, archivedNotes: [], trashedNotes: [], folders, view: "today",
      activeLabel: null, activeFolder: null, search: "", prefs: basePrefs,
    });
    expect(displayNotes.map((n) => n.id)).toEqual(["today"]);
  });

  it("uses trashedNotes as-is for the 'trash' view, ignoring pin/prefs filters", () => {
    const trashedNotes = [makeNote({ id: "t1", pinned: true, color: "coral" })];
    const { pinned, others, displayNotes } = useFilteredNotes({
      notes: [], archivedNotes: [], trashedNotes, folders, view: "trash",
      activeLabel: null, activeFolder: null, search: "",
      prefs: { ...basePrefs, filterColor: "sky" }, // would exclude coral outside trash
    });
    expect(pinned).toEqual([]);
    expect(others.map((n) => n.id)).toEqual(["t1"]);
    expect(displayNotes.map((n) => n.id)).toEqual(["t1"]);
  });

  it("applies the color filter pref outside of trash view", () => {
    const notes = [makeNote({ id: "coral", color: "coral" }), makeNote({ id: "sky", color: "sky" })];
    const { displayNotes } = useFilteredNotes({
      notes, archivedNotes: [], trashedNotes: [], folders, view: "notes",
      activeLabel: null, activeFolder: null, search: "", prefs: { ...basePrefs, filterColor: "sky" },
    });
    expect(displayNotes.map((n) => n.id)).toEqual(["sky"]);
  });

  it("sorts by title ascending when configured", () => {
    const notes = [makeNote({ id: "b", title: "Banan" }), makeNote({ id: "a", title: "Ananas" })];
    const { displayNotes } = useFilteredNotes({
      notes, archivedNotes: [], trashedNotes: [], folders, view: "notes",
      activeLabel: null, activeFolder: null, search: "",
      prefs: { ...basePrefs, sortKey: "title", sortDir: "asc" },
    });
    expect(displayNotes.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("sorts by manually dragged order when sortKey is 'manual', ignoring updatedAt", () => {
    const notes = [
      makeNote({ id: "third", order: 2, updatedAt: 100 }),
      makeNote({ id: "first", order: 0, updatedAt: 1 }),
      makeNote({ id: "second", order: 1, updatedAt: 50 }),
    ];
    const { displayNotes } = useFilteredNotes({
      notes, archivedNotes: [], trashedNotes: [], folders, view: "notes",
      activeLabel: null, activeFolder: null, search: "",
      prefs: { ...basePrefs, sortKey: "manual", sortDir: "desc" },
    });
    expect(displayNotes.map((n) => n.id)).toEqual(["first", "second", "third"]);
  });

  it("manual order stays ascending regardless of sortDir (direction doesn't apply to hand-dragged order)", () => {
    const notes = [
      makeNote({ id: "first", order: 0 }),
      makeNote({ id: "second", order: 1 }),
    ];
    const { displayNotes } = useFilteredNotes({
      notes, archivedNotes: [], trashedNotes: [], folders, view: "notes",
      activeLabel: null, activeFolder: null, search: "",
      prefs: { ...basePrefs, sortKey: "manual", sortDir: "asc" },
    });
    expect(displayNotes.map((n) => n.id)).toEqual(["first", "second"]);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { loadAll, saveNotesIDB, saveLabelsIDB, saveFoldersIDB, clearAllStorage } from "./notesStore";
import type { Note, Folder } from "@/hooks/useNotes";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "1",
    title: "Tytuł",
    content: "Treść",
    color: "default",
    pinned: false,
    archived: false,
    trashed: false,
    trashedAt: null,
    labels: [],
    reminder: null,
    images: [],
    checklist: [],
    folderId: null,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

beforeEach(async () => {
  localStorage.clear();
  await clearAllStorage();
});

describe("loadAll", () => {
  it("returns empty collections when nothing was ever stored", async () => {
    const snapshot = await loadAll();
    expect(snapshot).toEqual({ notes: [], labels: [], folders: [] });
  });

  it("migrates notes/labels/folders from localStorage into IndexedDB on first load", async () => {
    const note = makeNote();
    const folder: Folder = { id: "f1", name: "Praca", color: "default", emoji: null, parentId: null, order: 0, createdAt: 0 };
    localStorage.setItem("kaczy-notes-data", JSON.stringify([note]));
    localStorage.setItem("kaczy-notes-labels", JSON.stringify(["praca"]));
    localStorage.setItem("kaczy-notes-folders", JSON.stringify([folder]));

    const snapshot = await loadAll();
    expect(snapshot.notes).toEqual([note]);
    expect(snapshot.labels).toEqual(["praca"]);
    expect(snapshot.folders).toEqual([folder]);

    // The large notes blob is dropped from localStorage after migration to free quota.
    expect(localStorage.getItem("kaczy-notes-data")).toBeNull();
  });

  it("only migrates once, even if localStorage keys are later restored", async () => {
    localStorage.setItem("kaczy-notes-data", JSON.stringify([makeNote()]));
    await loadAll();

    // Simulate leftover/re-added localStorage data after migration already ran.
    localStorage.setItem("kaczy-notes-data", JSON.stringify([makeNote({ id: "2" })]));
    const snapshot = await loadAll();
    // Still just the originally-migrated note; second localStorage write is ignored.
    expect(snapshot.notes.map((n) => n.id)).toEqual(["1"]);
  });

  it("reflects writes made via saveNotesIDB/saveLabelsIDB/saveFoldersIDB", async () => {
    await loadAll(); // trigger migration/flag so subsequent loads read straight from IDB
    const note = makeNote({ id: "2" });
    await saveNotesIDB([note]);
    await saveLabelsIDB(["dom"]);
    await saveFoldersIDB([]);

    const snapshot = await loadAll();
    expect(snapshot.notes).toEqual([note]);
    expect(snapshot.labels).toEqual(["dom"]);
  });
});

describe("clearAllStorage", () => {
  it("removes everything from both IndexedDB and localStorage", async () => {
    await saveNotesIDB([makeNote()]);
    localStorage.setItem("kaczy-notes-data", "[]");

    await clearAllStorage();

    const snapshot = await loadAll();
    expect(snapshot).toEqual({ notes: [], labels: [], folders: [] });
    expect(localStorage.getItem("kaczy-notes-data")).toBeNull();
  });
});

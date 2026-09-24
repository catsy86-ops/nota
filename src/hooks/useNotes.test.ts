import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNotes, type Note } from "./useNotes";
import { clearAllStorage, saveNotesIDB } from "@/lib/notesStore";
import { yjsStore, createYjsStore } from "@/lib/yjsStore";

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

beforeEach(async () => {
  localStorage.clear();
  await clearAllStorage();
  await yjsStore.resetForTests();
});

describe("useNotes — CRUD", () => {
  it("adds, updates and deletes a note", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toEqual([]));

    act(() => result.current.addNote("Zakupy", "Mleko"));
    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0].title).toBe("Zakupy");

    const id = result.current.notes[0].id;
    act(() => result.current.updateNote(id, { title: "Zakupy 2" }));
    expect(result.current.notes[0].title).toBe("Zakupy 2");

    act(() => result.current.deleteNote(id));
    expect(result.current.notes).toEqual([]);
  });

  it("moves a note to trash and can restore it", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toEqual([]));

    act(() => result.current.addNote("A", ""));
    const id = result.current.notes[0].id;

    act(() => result.current.trashNote(id));
    expect(result.current.notes).toEqual([]);
    expect(result.current.trashedNotes).toHaveLength(1);

    act(() => result.current.restoreFromTrash(id));
    expect(result.current.notes).toHaveLength(1);
    expect(result.current.trashedNotes).toEqual([]);
  });
});

describe("useNotes — persistence", () => {
  it("persists changes so a fresh store reading the same IndexedDB database sees them", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toEqual([]));

    act(() => result.current.addNote("Persisted", ""));
    const id = result.current.notes[0].id;

    // Simulate a page reload: an independent store instance pointed at the
    // same y-indexeddb database should see the note without any extra wiring.
    const reopened = createYjsStore("kaczy-yjs-v1");
    await reopened.ready();
    await waitFor(() => {
      expect(reopened.projectNotes().map((n) => n.id)).toContain(id);
    });
  });
});

describe("useNotes — hydration / migration", () => {
  it("migrates legacy localStorage notes into IndexedDB on first hydration", async () => {
    localStorage.setItem("kaczy-notes-data", JSON.stringify([makeNote({ id: "legacy", title: "Stara notatka" })]));

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.notes.map((n) => n.id)).toContain("legacy");
    });
  });

  it("hydrates notes already stored in the legacy IndexedDB store", async () => {
    await saveNotesIDB([makeNote({ id: "idb-note", title: "Z bazy" })]);

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.notes.map((n) => n.id)).toContain("idb-note");
    });
  });
});

describe("useNotes — trash auto-cleanup", () => {
  it("removes notes trashed more than 30 days ago", async () => {
    const THIRTY_ONE_DAYS_AGO = Date.now() - 31 * 24 * 60 * 60 * 1000;
    await saveNotesIDB([
      makeNote({ id: "old-trash", trashed: true, trashedAt: THIRTY_ONE_DAYS_AGO }),
      makeNote({ id: "kept", title: "Zostaje" }),
    ]);

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.notes.map((n) => n.id)).toContain("kept");
    });
    await waitFor(() => {
      expect(result.current.trashedNotes.map((n) => n.id)).not.toContain("old-trash");
    });
  });

  it("keeps notes trashed less than 30 days ago", async () => {
    const YESTERDAY = Date.now() - 24 * 60 * 60 * 1000;
    await saveNotesIDB([makeNote({ id: "recent-trash", trashed: true, trashedAt: YESTERDAY })]);

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.trashedNotes.map((n) => n.id)).toContain("recent-trash");
    });
  });
});

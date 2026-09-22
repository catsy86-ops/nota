import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNotes, type Note } from "./useNotes";
import { loadAll, clearAllStorage, saveNotesIDB } from "@/lib/notesStore";
import { enqueue, getQueue, clearQueue } from "@/lib/offlineQueue";

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
  clearQueue();
  await clearAllStorage();
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

  it("persists changes to IndexedDB", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toEqual([]));

    act(() => result.current.addNote("Persisted", ""));

    await waitFor(async () => {
      const snap = await loadAll();
      expect(snap.notes.map((n) => n.title)).toEqual(["Persisted"]);
    });
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

describe("useNotes — hydration / migration", () => {
  it("migrates legacy localStorage notes into IndexedDB on first hydration", async () => {
    localStorage.setItem("kaczy-notes-data", JSON.stringify([makeNote({ id: "legacy", title: "Stara notatka" })]));

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.notes.map((n) => n.id)).toContain("legacy");
    });
  });

  it("hydrates notes already stored in IndexedDB", async () => {
    await saveNotesIDB([makeNote({ id: "idb-note", title: "Z bazy" })]);

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.notes.map((n) => n.id)).toContain("idb-note");
    });
  });
});

describe("useNotes — offline queue replay", () => {
  it("replays a queued upsert that never made it to IndexedDB and confirms it", async () => {
    const queuedNote = makeNote({ id: "queued", title: "Z kolejki offline" });
    enqueue({ type: "upsert", noteId: queuedNote.id, note: queuedNote });
    expect(getQueue()).toHaveLength(1);

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.notes.map((n) => n.id)).toContain("queued");
    });

    // The replayed state is flushed straight back into IDB and the queue confirmed.
    await waitFor(() => expect(getQueue()).toHaveLength(0));
    const snap = await loadAll();
    expect(snap.notes.map((n) => n.id)).toContain("queued");
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

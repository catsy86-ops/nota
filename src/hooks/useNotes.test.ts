import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNotes, whenNotesReady, TRASH_PURGE_GRACE_MS, type Note } from "./useNotes";
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

describe("useNotes — wymiana porcjami (Z-16.2)", () => {
  it("rzut notatek nie liczy się po każdej porcji, tylko raz po końcu wymiany", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toEqual([]));
    // Pierwszy rzut po `ready()` hooka ma się odbyć przed wymianą.
    await act(async () => { await yjsStore.ready(); await new Promise((r) => setTimeout(r, 0)); });
    const real = yjsStore.projectNotes;
    let duringBulk = 0;
    let after = 0;
    const spy = vi.spyOn(yjsStore, "projectNotes").mockImplementation(() => {
      if (yjsStore.isBulkWriting()) duringBulk++; else after++;
      return real();
    });
    let chunks = 0;
    try {
      await act(async () => {
        await yjsStore.replaceAllChunked(Array.from({ length: 8 }, (_, i) => makeNote({ id: `k${i}` })), [], ["kopia"], [], {
          budgetMs: 0, onProgress: () => { chunks++; },
        });
      });
    } finally {
      spy.mockRestore();
    }
    expect(chunks).toBeGreaterThan(1);
    expect(duringBulk).toBe(0);
    expect(after).toBe(1);
    expect(result.current.notes).toHaveLength(8);
    expect(result.current.allLabels).toContain("kopia");
  });
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
    // Czyszczenie czeka krótką karencję (przywrócenie z drugiego urządzenia zdąży dojść).
    await waitFor(() => {
      expect(result.current.trashedNotes.map((n) => n.id)).not.toContain("old-trash");
    }, { timeout: 8000 });
  }, 15000);

  it("nie usuwa notatki ze znacznikiem kosza z przyszłości (przestawiony zegar)", async () => {
    const FUTURE = Date.now() + 400 * 24 * 60 * 60 * 1000;
    await saveNotesIDB([makeNote({ id: "future-trash", trashed: true, trashedAt: FUTURE })]);

    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.trashedNotes.map((n) => n.id)).toContain("future-trash"));
    await new Promise((r) => setTimeout(r, TRASH_PURGE_GRACE_MS + 500));
    expect(result.current.trashedNotes.map((n) => n.id)).toContain("future-trash");
  }, 15000);

  it("keeps notes trashed less than 30 days ago", async () => {
    const YESTERDAY = Date.now() - 24 * 60 * 60 * 1000;
    await saveNotesIDB([makeNote({ id: "recent-trash", trashed: true, trashedAt: YESTERDAY })]);

    const { result } = renderHook(() => useNotes());

    await waitFor(() => {
      expect(result.current.trashedNotes.map((n) => n.id)).toContain("recent-trash");
    });
  });
});

describe("useNotes — stabilne referencje", () => {
  it("editing one note keeps the other note objects and folders untouched", async () => {
    const { result } = renderHook(() => useNotes());
    // Po wczytaniu bazy następuje jednorazowa pełna projekcja — porównujemy dopiero po niej.
    await act(() => whenNotesReady());
    let a = "", b = "";
    act(() => {
      a = result.current.addNote("A", "a");
      b = result.current.addNote("B", "b");
    });
    await waitFor(() => expect(result.current.notes).toHaveLength(2));
    const before = result.current;
    const noteB = before.notes.find((n) => n.id === b);

    act(() => result.current.updateNote(a, { title: "A2" }));
    await waitFor(() => expect(result.current.notes.find((n) => n.id === a)?.title).toBe("A2"));

    expect(result.current.notes.find((n) => n.id === b)).toBe(noteB);
    expect(result.current.folders).toBe(before.folders);
    expect(result.current.addNote).toBe(before.addNote);
  });

  it("a folder change does not create a new notes array", async () => {
    const { result } = renderHook(() => useNotes());
    act(() => { result.current.addNote("A", "a"); });
    await waitFor(() => expect(result.current.notes).toHaveLength(1));
    const notes = result.current.notes;
    act(() => { result.current.addFolder("Praca"); });
    await waitFor(() => expect(result.current.folders).toHaveLength(1));
    expect(result.current.notes).toBe(notes);
  });
});

describe("useNotes — podstrony", () => {
  async function setup() {
    const hook = renderHook(() => useNotes());
    await waitFor(() => expect(hook.result.current.notes).toEqual([]));
    let parent = "";
    let child = "";
    let grand = "";
    act(() => { parent = hook.result.current.addNote("Rodzic", ""); });
    act(() => { child = hook.result.current.addSubpage(parent)!; });
    act(() => { grand = hook.result.current.addSubpage(child)!; });
    return { ...hook, parent, child, grand };
  }

  it("addSubpage tworzy notatkę pod rodzicem i odmawia dla nieistniejącego rodzica", async () => {
    const { result, parent, child } = await setup();
    expect(result.current.notes.find((n) => n.id === child)?.parentId).toBe(parent);
    expect(result.current.addSubpage("nie-ma")).toBeNull();
  });

  it("setParent odrzuca cykl i pozwala wrócić na poziom główny", async () => {
    const { result, parent, child, grand } = await setup();
    let ok = true;
    act(() => { ok = result.current.setParent(parent, grand); });
    expect(ok).toBe(false);
    act(() => { ok = result.current.setParent(grand, null); });
    expect(ok).toBe(true);
    expect(result.current.notes.find((n) => n.id === grand)?.parentId).toBeUndefined();
    expect(result.current.notes.find((n) => n.id === child)?.parentId).toBe(parent);
  });

  it("kosz bierze całą gałąź, a przywrócenie tylko to, co poszło razem", async () => {
    const { result, parent, child, grand } = await setup();
    // Wnuk trafia do kosza wcześniej, osobno — nie wraca z rodzicem.
    act(() => result.current.trashNote(grand));
    const grandAt = result.current.trashedNotes.find((n) => n.id === grand)!.trashedAt;
    await new Promise((r) => setTimeout(r, 5));

    act(() => result.current.trashNote(parent));
    expect(result.current.trashedNotes.map((n) => n.id).sort()).toEqual([parent, child, grand].sort());
    expect(result.current.notes).toEqual([]);

    act(() => result.current.restoreFromTrash(parent));
    expect(result.current.notes.map((n) => n.id).sort()).toEqual([parent, child].sort());
    expect(result.current.trashedNotes.map((n) => n.id)).toEqual([grand]);
    expect(result.current.trashedNotes[0].trashedAt).toBe(grandAt);
  });
});

describe("useNotes — odłożenie terminu serii (Z-8.1)", () => {
  const at = (day: number, h: number, min = 0) => new Date(2026, 5, day, h, min).getTime();

  it("odłożenie zostawia godzinę serii 8:00, a krok serii wraca na jutro 8:00", async () => {
    const { nextOccurrence } = await import("@/lib/reminderRepeat");
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toEqual([]));
    let id = "";
    act(() => { id = result.current.addNote("Leki", "", "default", [], at(10, 8)); });
    act(() => result.current.updateNote(id, { reminderRepeat: "daily" }));
    expect(result.current.notes[0].reminderTime).toBe(480);

    act(() => result.current.updateNote(id, { reminder: at(10, 8, 10), reminderBase: at(10, 8), reminderDay: 10 }));
    const snoozed = result.current.notes[0];
    expect(snoozed.reminder).toBe(at(10, 8, 10));
    expect(snoozed.reminderTime).toBe(480);

    const next = nextOccurrence(snoozed, snoozed.reminder as number);
    expect(next).toBe(at(11, 8));
    act(() => result.current.updateNote(id, { reminder: next, reminderBase: undefined, reminderDay: 11 }));
    expect(result.current.notes[0].reminder).toBe(at(11, 8));
    expect(result.current.notes[0].reminderTime).toBe(480);
  });

  it("cofnięcie odłożenia przywraca termin i godzinę sprzed odłożenia", async () => {
    const { result } = renderHook(() => useNotes());
    await waitFor(() => expect(result.current.notes).toEqual([]));
    let id = "";
    act(() => { id = result.current.addNote("Leki", "", "default", [], at(10, 8)); });
    act(() => result.current.updateNote(id, { reminderRepeat: "daily" }));
    const before = result.current.notes[0];

    act(() => result.current.updateNote(id, { reminder: at(10, 8, 10), reminderBase: at(10, 8), reminderDay: 10 }));
    act(() => result.current.updateNote(id, { reminder: before.reminder, reminderBase: before.reminderBase, reminderDay: before.reminderDay }));
    const after = result.current.notes[0];
    expect(after.reminder).toBe(at(10, 8));
    expect(after.reminderBase).toBeUndefined();
    expect(after.reminderTime).toBe(480);
  });
});

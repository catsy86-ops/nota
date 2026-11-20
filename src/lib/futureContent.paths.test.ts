import { describe, it, expect, beforeEach } from "vitest";
import { createYjsStore } from "@/lib/yjsStore";
import type { Note } from "@/lib/types/note";

// Które ścieżki zapisu zachowują klucz `futureContent` (pola treści z nowszej wersji po zdjęciu blokady).
// Testy opisują OBECNE zachowanie; „gubi … (do decyzji)” = ścieżka traci pole.

const FUTURE = JSON.stringify({ futureField: { a: [1, 2] } });

function makeNote(over: Partial<Note> = {}): Note {
  return {
    id: "n1", title: "Tytuł", content: "Treść", color: "default", pinned: false, archived: false, trashed: false,
    trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
    order: 0, createdAt: 1_000, updatedAt: 1_000, ...over,
  };
}

function withFuture() {
  const store = createYjsStore(`fc-${crypto.randomUUID()}`);
  store.upsertNote(makeNote());
  expect(store.lockNote("n1", "v2.fake")).toBe(true);
  expect(store.unlockNote("n1", { title: "Tytuł", content: "Treść", checklist: [], labels: [] }, FUTURE)).toBe(true);
  expect(store.getFutureContent("n1")).toBe(FUTURE);
  return store;
}

beforeEach(() => { localStorage.clear(); });

describe("futureContent — ścieżki zapisu", () => {
  it("patchNote (edycja) zachowuje futureContent", () => {
    const store = withFuture();
    store.patchNote("n1", { content: "po edycji", title: "Nowy" });
    expect(store.getFutureContent("n1")).toBe(FUTURE);
  });

  it("upsertNote gubi futureContent (do decyzji)", () => {
    const store = withFuture();
    const n = store.projectNotes().find((x) => x.id === "n1")!;
    store.upsertNote({ ...n, title: "Nadpisany" });
    expect(store.getFutureContent("n1")).toBeNull();
  });

  it("projekcja Note nie niesie futureContent", () => {
    const store = withFuture();
    const n = store.projectNotes().find((x) => x.id === "n1")!;
    expect(JSON.stringify(n)).not.toContain("futureField");
  });

  it("duplikat (useNotes.duplicateNote: projekcja + upsertNote) gubi futureContent w kopii (do decyzji)", () => {
    const store = withFuture();
    const n = store.projectNotes().find((x) => x.id === "n1")!;
    store.upsertNote({ ...n, id: "kopia", title: "Tytuł (kopia)" });
    expect(store.getFutureContent("kopia")).toBeNull();
    expect(store.getFutureContent("n1")).toBe(FUTURE); // oryginał bez zmian
  });

  it("kopia zapasowa JSON (projectNotes → replaceAll) gubi futureContent (do decyzji)", () => {
    const store = withFuture();
    const backupNotes = JSON.parse(JSON.stringify(store.projectNotes())) as Note[];
    const target = createYjsStore(`fc-${crypto.randomUUID()}`);
    target.replaceAll(backupNotes, [], [], []);
    expect(target.getFutureContent("n1")).toBeNull();
    // replaceAll w tym samym dokumencie też odbudowuje notatki z projekcji
    store.replaceAll(backupNotes, [], [], []);
    expect(store.getFutureContent("n1")).toBeNull();
  });

  it("kopia dzienna / synchronizacja (cały Y.Doc: encodeSyncState → mergeSyncState) zachowuje futureContent", () => {
    const store = withFuture();
    const target = createYjsStore(`fc-${crypto.randomUUID()}`);
    target.mergeSyncState(store.encodeSyncState());
    expect(target.getFutureContent("n1")).toBe(FUTURE);
  });

  it("ponowna blokada (lockNote) usuwa jawną kopię futureContent", () => {
    const store = withFuture();
    store.lockNote("n1", "v2.fake2");
    expect(store.getFutureContent("n1")).toBeNull();
  });
});

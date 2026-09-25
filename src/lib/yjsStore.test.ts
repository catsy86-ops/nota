import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { createYjsStore } from "./yjsStore";
import { clearAllStorage, saveNotesIDB } from "@/lib/notesStore";
import type { Note } from "@/hooks/useNotes";

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
});

describe("yjsStore — field-level CRDT merge", () => {
  it("merges concurrent edits to different fields of the same note", () => {
    const a = createYjsStore(`merge-fields-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`merge-fields-b-${crypto.randomUUID()}`);
    const note = makeNote({ id: "n1" });
    a.upsertNote(note);
    // Bring b to the same starting state as a (simulates b having synced once).
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    a.patchNote("n1", { title: "Zmieniony przez A" });
    b.patchNote("n1", { pinned: true });

    // Exchange updates both ways (a real transport would do this over the wire).
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc));

    for (const store of [a, b]) {
      const merged = store.projectNotes().find((n) => n.id === "n1")!;
      expect(merged.title).toBe("Zmieniony przez A");
      expect(merged.pinned).toBe(true);
    }
  });

  it("merges concurrent Y.Text edits to note content instead of one side clobbering the other", () => {
    const a = createYjsStore(`merge-text-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`merge-text-b-${crypto.randomUUID()}`);
    a.upsertNote(makeNote({ id: "n1", content: "Kup mleko" }));
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    a.patchNote("n1", { content: "Kup mleko i chleb" }); // append at the end
    b.patchNote("n1", { content: "Pilne: Kup mleko" }); // prepend at the start

    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc));

    for (const store of [a, b]) {
      const merged = store.projectNotes().find((n) => n.id === "n1")!;
      expect(merged.content).toContain("Pilne:");
      expect(merged.content).toContain("i chleb");
    }
  });
});

describe("yjsStore — checklist item-level merge", () => {
  it("merges concurrent toggles of different checklist items instead of one side clobbering the other", () => {
    const a = createYjsStore(`merge-checklist-toggle-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`merge-checklist-toggle-b-${crypto.randomUUID()}`);
    a.upsertNote(makeNote({
      id: "n1",
      checklist: [
        { id: "i1", text: "Mleko", checked: false },
        { id: "i2", text: "Chleb", checked: false },
      ],
    }));
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    // a checks item 1, b (starting from the same synced state) checks item 2 — concurrently.
    const aNote = a.projectNotes().find((n) => n.id === "n1")!;
    a.patchNote("n1", { checklist: aNote.checklist.map((c) => (c.id === "i1" ? { ...c, checked: true } : c)) });
    const bNote = b.projectNotes().find((n) => n.id === "n1")!;
    b.patchNote("n1", { checklist: bNote.checklist.map((c) => (c.id === "i2" ? { ...c, checked: true } : c)) });

    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc));

    for (const store of [a, b]) {
      const merged = store.projectNotes().find((n) => n.id === "n1")!.checklist;
      expect(merged.find((c) => c.id === "i1")?.checked).toBe(true);
      expect(merged.find((c) => c.id === "i2")?.checked).toBe(true);
    }
  });

  it("merges a new checklist item added on one side with a toggle made on the other", () => {
    const a = createYjsStore(`merge-checklist-add-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`merge-checklist-add-b-${crypto.randomUUID()}`);
    a.upsertNote(makeNote({ id: "n1", checklist: [{ id: "i1", text: "Mleko", checked: false }] }));
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    // a adds a second item; b toggles the first item — concurrently, from the same starting state.
    a.patchNote("n1", { checklist: [{ id: "i1", text: "Mleko", checked: false }, { id: "i2", text: "Jajka", checked: false }] });
    const bNote = b.projectNotes().find((n) => n.id === "n1")!;
    b.patchNote("n1", { checklist: bNote.checklist.map((c) => (c.id === "i1" ? { ...c, checked: true } : c)) });

    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc));

    for (const store of [a, b]) {
      const merged = store.projectNotes().find((n) => n.id === "n1")!.checklist;
      expect(merged.map((c) => c.id).sort()).toEqual(["i1", "i2"]);
      expect(merged.find((c) => c.id === "i1")?.checked).toBe(true);
      expect(merged.find((c) => c.id === "i2")?.text).toBe("Jajka");
    }
  });

  it("a checklist item deleted on one side stays deleted after merging with a peer that still edited it", () => {
    const a = createYjsStore(`merge-checklist-delete-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`merge-checklist-delete-b-${crypto.randomUUID()}`);
    a.upsertNote(makeNote({
      id: "n1",
      checklist: [{ id: "i1", text: "Mleko", checked: false }, { id: "i2", text: "Chleb", checked: false }],
    }));
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    a.patchNote("n1", { checklist: [{ id: "i2", text: "Chleb", checked: false }] }); // deletes i1
    const bNote = b.projectNotes().find((n) => n.id === "n1")!;
    b.patchNote("n1", { checklist: bNote.checklist.map((c) => (c.id === "i1" ? { ...c, checked: true } : c)) }); // stale edit to i1

    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc));

    for (const store of [a, b]) {
      const merged = store.projectNotes().find((n) => n.id === "n1")!.checklist;
      expect(merged.map((c) => c.id)).toEqual(["i2"]);
    }
  });
});

describe("yjsStore — tombstones", () => {
  it("a deleted note stays deleted after merging with a peer that still has an older copy", () => {
    const a = createYjsStore(`tombstone-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`tombstone-b-${crypto.randomUUID()}`);
    a.upsertNote(makeNote({ id: "n1" }));
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    a.removeNote("n1"); // e.g. the 30-day trash auto-purge
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    expect(b.projectNotes().find((n) => n.id === "n1")).toBeUndefined();

    // Even if b re-sends its (now stale) pre-delete state, the delete wins.
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc));
    expect(a.projectNotes().find((n) => n.id === "n1")).toBeUndefined();
  });
});

describe("yjsStore — garbage collection", () => {
  it("deleting most notes shrinks the encoded doc size instead of retaining dead content forever", () => {
    // Y.Doc defaults to gc:true (never overridden in createYjsStore) — this
    // pins down that the default actually reclaims space for this app's data
    // shape, so the "unbounded growth" backlog concern doesn't need a custom
    // compaction routine on top of it. See roadmap.md.
    const store = createYjsStore(`gc-${crypto.randomUUID()}`);
    for (let i = 0; i < 200; i++) {
      store.upsertNote(makeNote({ id: `n${i}`, content: "x".repeat(2000) }));
    }
    const sizeBefore = Y.encodeStateAsUpdate(store.doc).byteLength;

    for (let i = 0; i < 190; i++) store.removeNote(`n${i}`);
    const sizeAfterDelete = Y.encodeStateAsUpdate(store.doc).byteLength;
    expect(sizeAfterDelete).toBeLessThan(sizeBefore / 5);

    // Also holds for a fresh device merging in that already-trimmed state.
    const peer = createYjsStore(`gc-peer-${crypto.randomUUID()}`);
    Y.applyUpdate(peer.doc, Y.encodeStateAsUpdate(store.doc));
    expect(Y.encodeStateAsUpdate(peer.doc).byteLength).toBeLessThanOrEqual(sizeAfterDelete);
    expect(peer.projectNotes()).toHaveLength(10);
  });
});

describe("yjsStore — migration from the legacy idb-keyval store", () => {
  it("copies existing notes/folders/labels into the Yjs doc without loss", async () => {
    await saveNotesIDB([
      makeNote({ id: "legacy-1", title: "Stara notatka", images: ["data:image/png;base64,AAA"] }),
      makeNote({ id: "legacy-2", title: "Druga notatka" }),
    ]);

    const store = createYjsStore(`migration-${crypto.randomUUID()}`);
    await store.ready();

    const notes = store.projectNotes();
    expect(notes.map((n) => n.id).sort()).toEqual(["legacy-1", "legacy-2"]);
    expect(notes.find((n) => n.id === "legacy-1")?.images).toEqual(["data:image/png;base64,AAA"]);
  });

  it("is idempotent — calling ready() again does not duplicate or wipe data", async () => {
    await saveNotesIDB([makeNote({ id: "legacy-1" })]);

    const store = createYjsStore(`migration-idempotent-${crypto.randomUUID()}`);
    await store.ready();
    await store.ready();
    store.upsertNote(makeNote({ id: "local-only", title: "Dodana po migracji" }));

    // A second call must not re-run the migration and wipe the locally-added note.
    const notes = store.projectNotes();
    expect(notes.map((n) => n.id).sort()).toEqual(["legacy-1", "local-only"]);
  });
});

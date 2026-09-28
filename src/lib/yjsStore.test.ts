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

  it("zapis z otwartej sesji edycji nie kasuje tekstu dopisanego przez peera w jej trakcie (P0 #1)", () => {
    const a = createYjsStore(`edit-session-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`edit-session-b-${crypto.randomUUID()}`);
    a.upsertNote(makeNote({ id: "n1", content: "Notatki ze spotkania." }));
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    // A otwiera edytor, B w tym czasie dopisuje zdanie, które dociera do A.
    const draftStart = a.beginTextEdit("n1");
    expect(draftStart).toBe("Notatki ze spotkania.");
    const peer = b.projectNotes()[0].content + " Ustalenie od peera.";
    b.patchNote("n1", { content: peer });
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc));

    // A zapisuje szkic, który zdania peera nie zawiera — dwa razy (autosave).
    a.patchNote("n1", { content: "Notatki ze spotkania. Moja uwaga." });
    a.patchNote("n1", { content: "Notatki ze spotkania. Moja uwaga, poprawiona." });
    a.endTextEdit("n1");
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    for (const store of [a, b]) {
      const content = store.projectNotes()[0].content;
      expect(content).toContain("Ustalenie od peera.");
      expect(content).toContain("Moja uwaga, poprawiona.");
      expect(content.match(/Moja uwaga/g)).toHaveLength(1);
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

describe("yjsStore — lokalne obrazy poza dokumentem (P0 #10)", () => {
  it("setImagesLocal powiadamia UI, ale nie zapisuje nic do Y.Doc", () => {
    const store = createYjsStore(`local-images-${crypto.randomUUID()}`);
    store.upsertNote(makeNote({ id: "n1" }));
    let docUpdates = 0;
    store.doc.on("update", () => { docUpdates++; });
    let notified = 0;
    const off = store.onLocalChange(() => { notified++; });

    store.setImagesLocal("n1", ["data:image/png;base64,AAAA"]);

    expect(docUpdates).toBe(0);
    expect(notified).toBe(1);
    expect(store.getLocalImages("n1")).toEqual(["data:image/png;base64,AAAA"]);
    expect(store.notesMap.get("n1")!.has("_imgSyncTick")).toBe(false);
    off();
  });
});

describe("yjsStore — obrazy per notatka (P0 #11)", () => {
  it("zmiana obrazów jednej notatki zapisuje tylko jej klucz", async () => {
    const idb = await import("idb-keyval");
    const store = createYjsStore(`images-per-note-${crypto.randomUUID()}`);
    await store.ready();
    const a = `a-${crypto.randomUUID()}`;
    const b = `b-${crypto.randomUUID()}`;
    store.upsertNote(makeNote({ id: a, images: ["data:a"] }));
    store.upsertNote(makeNote({ id: b, images: ["data:b"] }));
    await store.flushImagesForTests();

    await idb.set(`kaczy.images.v2:${b}`, ["znacznik"]); // gdyby b został przepisany, znacznik by zniknął
    store.patchNote(a, { images: ["data:a", "data:a2"] });
    await store.flushImagesForTests();

    expect(await idb.get(`kaczy.images.v2:${a}`)).toEqual(["data:a", "data:a2"]);
    expect(await idb.get(`kaczy.images.v2:${b}`)).toEqual(["znacznik"]);

    store.removeNote(a);
    await store.flushImagesForTests();
    expect(await idb.get(`kaczy.images.v2:${a}`)).toBeUndefined();
  });

  it("migruje stary słownik obrazów do kluczy per notatka i usuwa stary klucz", async () => {
    const idb = await import("idb-keyval");
    const id = `legacy-${crypto.randomUUID()}`;
    await idb.set("kaczy.images.v1", { [id]: ["data:old"] });

    const store = createYjsStore(`images-migrate-${crypto.randomUUID()}`);
    await store.ready();

    expect(store.getLocalImages(id)).toEqual(["data:old"]);
    expect(await idb.get(`kaczy.images.v2:${id}`)).toEqual(["data:old"]);
    expect(await idb.get("kaczy.images.v1")).toBeUndefined();
  });
});

describe("yjsStore — inkrementalna projekcja", () => {
  it("keeps object identity of untouched notes and rebuilds only the changed one", () => {
    const s = createYjsStore(`proj-${crypto.randomUUID()}`);
    s.upsertNote(makeNote({ id: "a" }));
    s.upsertNote(makeNote({ id: "b" }));
    const first = s.projectNotes();
    s.patchNote("a", { title: "Nowy" });
    const second = s.projectNotes();
    const byId = (list: Note[], id: string) => list.find((n) => n.id === id)!;
    expect(byId(second, "b")).toBe(byId(first, "b"));
    expect(byId(second, "a")).not.toBe(byId(first, "a"));
    expect(byId(second, "a").title).toBe("Nowy");
  });

  it("sees nested edits (content, checklist) and remote updates", () => {
    const a = createYjsStore(`proj-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`proj-b-${crypto.randomUUID()}`);
    a.upsertNote(makeNote({ id: "n", checklist: [{ id: "c", text: "x", checked: false }] }));
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    const before = b.projectNotes()[0];

    a.patchNote("n", { content: "Treść peera", checklist: [{ id: "c", text: "x", checked: true }] });
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    const after = b.projectNotes()[0];
    expect(after).not.toBe(before);
    expect(after.content).toBe("Treść peera");
    expect(after.checklist[0].checked).toBe(true);
  });

  it("drops deleted notes and refreshes a note when only its local images change", () => {
    const s = createYjsStore(`proj-img-${crypto.randomUUID()}`);
    s.upsertNote(makeNote({ id: "a" }));
    s.upsertNote(makeNote({ id: "b" }));
    const before = s.projectNotes().find((n) => n.id === "a")!;
    s.setImagesLocal("a", ["data:image/png;base64,AA"]);
    s.removeNote("b");
    const after = s.projectNotes();
    expect(after.map((n) => n.id)).toEqual(["a"]);
    expect(after[0]).not.toBe(before);
    expect(after[0].images).toHaveLength(1);
  });
});

describe("yjsStore — tekst peera na żywo w otwartym edytorze", () => {
  function pair() {
    const a = createYjsStore(`live-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`live-b-${crypto.randomUUID()}`);
    a.upsertNote(makeNote({ id: "n", content: "Ala ma kota" }));
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    return { a, b };
  }

  it("merges the unsaved draft with the peer's text and keeps the caret at the same character", () => {
    const { a, b } = pair();
    b.beginTextEdit("n");
    // Lokalnie: dopisane na końcu, karetka za „kota!”.
    const draft = "Ala ma kota!";
    // Peer wstawia słowo na początku.
    a.patchNote("n", { content: "Dziś Ala ma kota" });
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    const res = b.rebaseTextEdit("n", draft, [draft.length, draft.length])!;
    expect(res.text).toBe("Dziś Ala ma kota!");
    expect(res.selection).toEqual([res.text.length, res.text.length]);
    // Kolejny zapis w tej sesji nie dubluje ani nie kasuje tekstu peera.
    b.patchNote("n", { content: res.text + " I psa." });
    expect(b.projectNotes()[0].content).toBe("Dziś Ala ma kota! I psa.");
  });

  it("moves the caret back when the character it followed was deleted by the peer", () => {
    const { a, b } = pair();
    b.beginTextEdit("n");
    a.patchNote("n", { content: "Ala" });
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    const res = b.rebaseTextEdit("n", "Ala ma kota", [11, 11])!;
    expect(res.text).toBe("Ala");
    expect(res.selection).toEqual([3, 3]);
  });

  it("notifies only about remote changes, not local ones", () => {
    const { a, b } = pair();
    let calls = 0;
    const off = b.onRemoteTextChange("n", () => calls++);
    b.patchNote("n", { content: "lokalnie" });
    expect(calls).toBe(0);
    a.patchNote("n", { content: "zdalnie" });
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    expect(calls).toBe(1);
    off();
  });

  it("returns null without an open session", () => {
    const { b } = pair();
    expect(b.rebaseTextEdit("n", "x", [0, 0])).toBeNull();
  });
});

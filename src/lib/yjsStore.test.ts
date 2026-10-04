import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { createYjsStore } from "./yjsStore";
import { clearAllStorage, saveNotesIDB } from "@/lib/notesStore";
import { createImageStore, imageStore as defaultImageStore, isImageRef } from "@/lib/imageStore";
import { hashImage } from "@/lib/imageHash";
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

  it("keeps dailyDate through upsert, patch and sync, and omits it on ordinary notes", () => {
    const a = createYjsStore(`daily-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`daily-b-${crypto.randomUUID()}`);
    a.upsertNote(makeNote({ id: "d1", dailyDate: "2026-09-28" }));
    a.upsertNote(makeNote({ id: "plain" }));
    a.patchNote("plain", { dailyDate: "2026-09-29" });
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    const byId = new Map(b.projectNotes().map((n) => [n.id, n]));
    expect(byId.get("d1")?.dailyDate).toBe("2026-09-28");
    expect(byId.get("plain")?.dailyDate).toBe("2026-09-29");
    expect("dailyDate" in a.projectNotes().find((n) => n.id === "d1")!).toBe(true);
    a.upsertNote(makeNote({ id: "other" }));
    expect("dailyDate" in a.projectNotes().find((n) => n.id === "other")!).toBe(false);
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
      makeNote({ id: "legacy-1", title: "Stara notatka", images: ["data:image/png;base64,AAAA"] }),
      makeNote({ id: "legacy-2", title: "Druga notatka" }),
    ]);

    const store = createYjsStore(`migration-${crypto.randomUUID()}`);
    await store.ready();

    const notes = store.projectNotes();
    expect(notes.map((n) => n.id).sort()).toEqual(["legacy-1", "legacy-2"]);
    const [ref] = notes.find((n) => n.id === "legacy-1")!.images;
    expect(isImageRef(ref)).toBe(true);
    expect(await defaultImageStore.getDataUrl(ref)).toBe("data:image/png;base64,AAAA");
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

describe("yjsStore — obrazy w content-addressed store", () => {
  const PNG = "data:image/png;base64,iVBORw0KGgo=";
  const GIF = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
  const freshImages = () => createImageStore(`yjs-images-${crypto.randomUUID()}`);

  it("keeps only the ref list in the doc and projects it as note.images", async () => {
    const images = freshImages();
    const store = createYjsStore(`refs-${crypto.randomUUID()}`, images);
    const ref = await images.putDataUrl(PNG);
    store.upsertNote(makeNote({ id: "n1", images: [ref] }));
    expect(store.notesMap.get("n1")!.get("imageHashes")).toEqual([ref]);
    expect(store.projectNotes()[0].images).toEqual([ref]);
    expect(store.referencedImages()).toEqual(new Set([ref]));
  });

  it("never writes a data URL into the doc", () => {
    const store = createYjsStore(`no-data-url-${crypto.randomUUID()}`, freshImages());
    const ref = "a".repeat(64);
    store.upsertNote(makeNote({ id: "n1", images: [ref, PNG] }));
    store.patchNote("n1", { images: [PNG, ref] });
    expect(JSON.stringify(Y.encodeStateAsUpdate(store.doc))).not.toContain("base64");
    expect(store.projectNotes()[0].images).toEqual([ref]);
  });

  it("a peer's image change reaches the projection (the manifest is the only source)", () => {
    const a = createYjsStore(`peer-img-a-${crypto.randomUUID()}`, freshImages());
    const b = createYjsStore(`peer-img-b-${crypto.randomUUID()}`, freshImages());
    a.upsertNote(makeNote({ id: "n", images: ["a".repeat(64), "b".repeat(64)] }));
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    a.patchNote("n", { images: ["b".repeat(64)] });
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    expect(b.projectNotes()[0].images).toEqual(["b".repeat(64)]);
  });

  it("migrates per-note data URLs into the store, rewrites FNV manifests and deletes old keys", async () => {
    const idb = await import("idb-keyval");
    const name = `images-migrate-${crypto.randomUUID()}`;
    // Stan sprzed migracji: dokument z manifestem FNV + bajty pod kaczy.images.v2:<id>.
    const before = createYjsStore(name, freshImages());
    await before.ready();
    const unknownFnv = hashImage("data:image/png;base64,TEGO-NIE-MA");
    before.upsertNote(makeNote({ id: "n1" }));
    before.upsertNote(makeNote({ id: "n2" }));
    before.notesMap.get("n1")!.set("imageHashes", [hashImage(PNG), unknownFnv]);
    before.notesMap.get("n2")!.delete("imageHashes"); // notatka sprzed manifestu
    await idb.set("kaczy.images.v2:n1", [PNG]);
    await idb.set("kaczy.images.v1", { n2: [GIF] });
    const update = Y.encodeStateAsUpdate(before.doc);

    const images = freshImages();
    const store = createYjsStore(`${name}-after`, images);
    Y.applyUpdate(store.doc, update);
    await store.ready();

    const byId = (id: string) => store.projectNotes().find((n) => n.id === id)!;
    const pngRef = await images.putDataUrl(PNG);
    const gifRef = await images.putDataUrl(GIF);
    expect(byId("n1").images).toEqual([pngRef, unknownFnv]);
    expect(byId("n2").images).toEqual([gifRef]);
    expect(byId("n1").updatedAt).toBe(0);
    expect(await images.getDataUrl(pngRef)).toBe(PNG);
    expect(await idb.get("kaczy.images.v2:n1")).toBeUndefined();
    expect(await idb.get("kaczy.images.v1")).toBeUndefined();
  });

  it("keeps the old image keys when the store cannot save (migration retries on next start)", async () => {
    const idb = await import("idb-keyval");
    const images = freshImages();
    images.ingest = async () => { throw new Error("QuotaExceededError"); };
    await idb.set("kaczy.images.v2:n1", [PNG]);
    const store = createYjsStore(`images-migrate-fail-${crypto.randomUUID()}`, images);
    await store.ready();
    expect(await idb.get("kaczy.images.v2:n1")).toEqual([PNG]);
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

  it("drops deleted notes and refreshes a note when only its images change", () => {
    const s = createYjsStore(`proj-img-${crypto.randomUUID()}`);
    s.upsertNote(makeNote({ id: "a" }));
    s.upsertNote(makeNote({ id: "b" }));
    const before = s.projectNotes().find((n) => n.id === "a")!;
    s.patchNote("a", { images: ["c".repeat(64)] });
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

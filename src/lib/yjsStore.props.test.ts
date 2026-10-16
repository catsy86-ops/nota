import { describe, it, expect, beforeEach } from "vitest";
import * as Y from "yjs";
import { createYjsStore } from "./yjsStore";
import { clearAllStorage } from "@/lib/notesStore";
import type { Note } from "@/hooks/useNotes";
import type { PropDef } from "@/lib/noteProps";

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

const client: PropDef = { id: "k", name: "Klient", type: "text", order: 0 };
const amount: PropDef = { id: "a", name: "Kwota", type: "number", order: 1 };

beforeEach(async () => {
  localStorage.clear();
  await clearAllStorage();
});

describe("yjsStore — właściwości notatek", () => {
  it("zapisuje i odczytuje wartości, a notatka bez właściwości nie dostaje pola", () => {
    const store = createYjsStore(`props-basic-${crypto.randomUUID()}`);
    store.upsertNote(makeNote({ id: "n1", props: { k: "Jan", a: 12.5 } }));
    store.upsertNote(makeNote({ id: "n2" }));

    expect(store.projectNotes().find((n) => n.id === "n1")?.props).toEqual({ k: "Jan", a: 12.5 });
    expect(store.projectNotes().find((n) => n.id === "n2")).not.toHaveProperty("props");
  });

  it("patch zmienia tylko różne klucze i kasuje usunięte", () => {
    const store = createYjsStore(`props-patch-${crypto.randomUUID()}`);
    store.upsertNote(makeNote({ id: "n1", props: { k: "Jan", a: 1 } }));
    store.patchNote("n1", { props: { k: "Jan", a: 2 } });
    expect(store.projectNotes()[0].props).toEqual({ k: "Jan", a: 2 });

    store.patchNote("n1", { props: {} });
    expect(store.projectNotes()[0]).not.toHaveProperty("props");
  });

  it("równoległa edycja różnych właściwości tej samej notatki się łączy", () => {
    const a = createYjsStore(`props-merge-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`props-merge-b-${crypto.randomUUID()}`);
    a.upsertNote(makeNote({ id: "n1", props: { k: "Jan", a: 1 } }));
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    a.patchNote("n1", { props: { k: "Anna", a: 1 } });
    b.patchNote("n1", { props: { k: "Jan", a: 9 } });
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc));

    // Ten sam klucz zmieniony w obu → jedna z wartości wygrywa, ale druga właściwość nie ginie.
    const merged = a.projectNotes()[0].props!;
    expect(merged).toEqual(b.projectNotes()[0].props);
    expect(typeof merged.k).toBe("string");
    expect(merged.a === 1 || merged.a === 9).toBe(true);
  });

  it("notatka prywatna nie dostaje właściwości (nie ma ich w szyfrogramie)", () => {
    const store = createYjsStore(`props-locked-${crypto.randomUUID()}`);
    store.upsertNote(makeNote({ id: "n1", locked: true, vault: "v1.iv.ct", title: "", content: "", labels: [], images: [], checklist: [] }));
    store.patchNote("n1", { props: { k: "Tajne" } });

    const note = store.projectNotes()[0];
    expect(note.locked).toBe(true);
    expect(note).not.toHaveProperty("props");
  });

  it("definicje: zapis, sortowanie po kolejności i pominięcie uszkodzonego wpisu", () => {
    const store = createYjsStore(`props-defs-${crypto.randomUUID()}`);
    store.upsertPropDef(amount);
    store.upsertPropDef(client);
    store.propDefsMap.set("zepsute", new Y.Map<unknown>([["name", ""], ["type", "xxx"]]) as never);

    expect(store.projectPropDefs().map((d) => d.id)).toEqual(["k", "a"]);
  });

  it("zmiana nazwy definicji nie rusza wartości", () => {
    const store = createYjsStore(`props-rename-${crypto.randomUUID()}`);
    store.upsertPropDef(client);
    store.upsertNote(makeNote({ id: "n1", props: { k: "Jan" } }));
    store.upsertPropDef({ ...client, name: "Zleceniodawca" });

    expect(store.projectPropDefs()[0].name).toBe("Zleceniodawca");
    expect(store.projectNotes()[0].props).toEqual({ k: "Jan" });
  });

  it("usunięcie definicji kasuje jej wartości we wszystkich notatkach", () => {
    const store = createYjsStore(`props-delete-${crypto.randomUUID()}`);
    store.upsertPropDef(client);
    store.upsertPropDef(amount);
    store.upsertNote(makeNote({ id: "n1", props: { k: "Jan", a: 3 } }));
    store.upsertNote(makeNote({ id: "n2", props: { k: "Anna" } }));

    store.deletePropDef("k");

    expect(store.projectPropDefs().map((d) => d.id)).toEqual(["a"]);
    expect(store.projectNotes().find((n) => n.id === "n1")?.props).toEqual({ a: 3 });
    expect(store.projectNotes().find((n) => n.id === "n2")).not.toHaveProperty("props");
  });

  it("replaceAll przywraca definicje z kopii, a bez nich czyści", () => {
    const store = createYjsStore(`props-replace-${crypto.randomUUID()}`);
    store.upsertPropDef(client);
    store.replaceAll([makeNote({ id: "n1", props: { k: "Jan" } })], [], [], [amount]);

    expect(store.projectPropDefs().map((d) => d.id)).toEqual(["a"]);
    expect(store.projectNotes()[0].props).toEqual({ k: "Jan" });

    store.replaceAll([makeNote({ id: "n1" })], [], []);
    expect(store.projectPropDefs()).toEqual([]);
  });

  it("definicje przechodzą przez synchronizację dokumentu", () => {
    const a = createYjsStore(`props-sync-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`props-sync-b-${crypto.randomUUID()}`);
    a.upsertPropDef(amount);
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    expect(b.projectPropDefs()).toEqual([amount]);
  });
});

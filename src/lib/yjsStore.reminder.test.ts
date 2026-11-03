import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createYjsStore } from "./yjsStore";
import type { Note } from "@/hooks/useNotes";

const note = (over: Partial<Note>): Note =>
  ({
    id: "r1", title: "T", content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
    labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0,
    ...over,
  }) as Note;

const triple = (n: Note) => ({ reminder: n.reminder, repeat: n.reminderRepeat, day: n.reminderDay, until: n.reminderRepeatUntil });

describe("przypomnienie jako jeden zapis (reminderSpec)", () => {
  it("równoległe zmiany terminu i powtarzania na dwóch urządzeniach dają jedną spójną całość", () => {
    const a = createYjsStore(`rem-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`rem-b-${crypto.randomUUID()}`);
    a.upsertNote(note({ reminder: 1000, reminderRepeat: "monthly", reminderDay: 31 }));
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    // A: nowy termin z innym dniem serii. B: zmiana tylko powtarzania (bez wiedzy o zmianie A).
    a.patchNote("r1", { reminder: 2000, reminderDay: 5 });
    b.patchNote("r1", { reminderRepeat: "daily" });

    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc));

    const fromA = triple(a.projectNotes().find((n) => n.id === "r1")!);
    const fromB = triple(b.projectNotes().find((n) => n.id === "r1")!);
    expect(fromA).toEqual(fromB);
    // Wynik to dokładnie jedna z dwóch całości, nigdy mieszanka (nowy termin ze starym dniem serii).
    const whole = [
      { reminder: 2000, repeat: "monthly", day: 5, until: undefined },
      { reminder: 1000, repeat: "daily", day: 31, until: undefined },
    ];
    expect(whole).toContainEqual(fromA);
  });
});

describe("przypomnienie na cały dzień (reminderAllDay w reminderSpec)", () => {
  it("flaga zapisuje się, wraca po synchronizacji i gaśnie przy zmianie na zwykły termin", () => {
    const a = createYjsStore(`allday-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`allday-b-${crypto.randomUUID()}`);
    a.upsertNote(note({ reminder: 1000 }));
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    a.patchNote("r1", { reminder: 2000, reminderAllDay: true });
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    expect(b.projectNotes().find((n) => n.id === "r1")?.reminderAllDay).toBe(true);

    b.patchNote("r1", { reminder: 3000, reminderAllDay: undefined });
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(b.doc));
    expect(a.projectNotes().find((n) => n.id === "r1")?.reminderAllDay).toBeUndefined();
  });

  it("odłożone wystąpienie (reminderBase) wraca po synchronizacji i gaśnie przy zwykłym terminie", () => {
    const a = createYjsStore(`rem-base-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`rem-base-b-${crypto.randomUUID()}`);
    a.upsertNote(note({ reminder: 1000, reminderRepeat: "daily" }));
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));

    a.patchNote("r1", { reminder: 1500, reminderBase: 1000 });
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    expect(b.projectNotes().find((n) => n.id === "r1")?.reminderBase).toBe(1000);

    a.patchNote("r1", { reminder: 3000 });
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    expect(b.projectNotes().find((n) => n.id === "r1")?.reminderBase).toBeUndefined();
  });
});

describe("wcześniejsze przypomnienie (reminderLead w reminderSpec, T 3.2)", () => {
  it("zapisuje się tylko w reminderSpec, wraca po synchronizacji, zostaje przy zmianie terminu i gaśnie z terminem", () => {
    const a = createYjsStore(`lead-a-${crypto.randomUUID()}`);
    const b = createYjsStore(`lead-b-${crypto.randomUUID()}`);
    a.upsertNote(note({ reminder: 1000, reminderLead: 60 }));
    expect(a.doc.getMap("notes").get("r1")).toBeInstanceOf(Y.Map);
    expect((a.doc.getMap("notes").get("r1") as Y.Map<unknown>).has("reminderLead")).toBe(false);
    Y.applyUpdate(b.doc, Y.encodeStateAsUpdate(a.doc));
    expect(b.projectNotes().find((n) => n.id === "r1")!.reminderLead).toBe(60);

    a.patchNote("r1", { reminder: 2000 });
    expect(a.projectNotes().find((n) => n.id === "r1")!.reminderLead).toBe(60);
    a.patchNote("r1", { reminder: null });
    expect(a.projectNotes().find((n) => n.id === "r1")!.reminderLead).toBeUndefined();
  });
});

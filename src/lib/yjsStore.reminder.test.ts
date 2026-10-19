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

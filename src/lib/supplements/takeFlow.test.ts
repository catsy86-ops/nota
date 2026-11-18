import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { createYSupplements } from "./ySupplements";
import { setTaken, takenFromReminder, type TakeDeps } from "./takeFlow";
import { logKey, type Supplement } from "./model";
import { localDayKey } from "@/lib/dayDone";
import { addDaysToKey } from "@/lib/week";
import type { Note } from "@/lib/types/note";

// C1.4 (`docs/plan-zgodnosc-i-obieg.md` §2.4): odhaczenie odżywki ↔ „Gotowe” na jej przypomnieniu.

const NOW = new Date(2026, 10, 18, 9, 0).getTime();
const TODAY = localDayKey(new Date(NOW));
const AT_8 = new Date(2026, 10, 18, 8, 0).getTime();

const sup: Supplement = { id: "s1", name: "Magnez", dose: "", when: "rano", created: 1, reminderNoteId: "n1" };

const reminderNote = (over: Partial<Note> = {}): Note => ({
  id: "n1", title: "Magnez", content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: ["ćwiczenia"], reminder: AT_8, reminderRepeat: "daily", reminderDay: 18, priority: "none", images: [], checklist: [],
  folderId: null, order: 0, createdAt: 1, updatedAt: 1, ...over,
});

/** Jeden „telefon”: dokument z odżywkami i notatką w `Y.Map` (żeby transakcja obejmowała oba zapisy). */
function phone(doc = new Y.Doc(), note: Note | null = reminderNote()) {
  const ys = createYSupplements(doc);
  if (!ys.get().length) ys.add(sup);
  const notes = doc.getMap<Note>("testNotes");
  if (note && !notes.has(note.id)) notes.set(note.id, note);
  const deps: TakeDeps = {
    getNote: (id) => notes.get(id),
    updateNote: (id, patch) => { const n = notes.get(id); if (n) notes.set(id, { ...n, ...patch }); },
    transact: (fn) => doc.transact(fn),
    now: () => NOW,
    supplements: () => ys.get(),
    isTaken: (day, id) => ys.getTaken().has(logKey(day, id)),
    markTaken: (day, id, on) => ys.setTaken(day, id, on),
  };
  return { doc, ys, notes, deps };
}

const sync = (a: Y.Doc, b: Y.Doc) => {
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
};

describe("setTaken", () => {
  it("odhaczenie dziś: klucz i termin na jutro w jednej transakcji; drugie wywołanie nic nie zmienia", () => {
    const p = phone();
    let txs = 0;
    p.doc.on("afterTransaction", () => { txs++; });
    expect(setTaken(p.deps, sup, TODAY, true).changed).toBe(true);
    expect(txs).toBe(1);
    expect(p.ys.getTaken().has(logKey(TODAY, "s1"))).toBe(true);
    const moved = p.notes.get("n1")!.reminder!;
    expect(moved).toBeGreaterThan(AT_8);
    expect(setTaken(p.deps, sup, TODAY, true).changed).toBe(false);
    expect(p.notes.get("n1")!.reminder).toBe(moved);
  });

  it("dwa telefony odhaczają naraz — jeden klucz i ten sam termin", () => {
    const a = phone();
    const b = phone(new Y.Doc());
    sync(a.doc, b.doc);
    setTaken(a.deps, sup, TODAY, true);
    setTaken(b.deps, sup, TODAY, true);
    sync(a.doc, b.doc);
    expect([...a.ys.getTaken()]).toEqual([logKey(TODAY, "s1")]);
    expect(a.notes.get("n1")!.reminder).toBe(b.notes.get("n1")!.reminder);
    expect(a.notes.get("n1")!.reminder).toBeGreaterThan(AT_8);
  });

  it("zdjęcie odhaczenia nie rusza notatki; inny dzień niż dziś nie rusza notatki", () => {
    const p = phone();
    setTaken(p.deps, sup, TODAY, true);
    const after = p.notes.get("n1")!.reminder;
    setTaken(p.deps, sup, TODAY, false);
    expect(p.ys.getTaken().size).toBe(0);
    expect(p.notes.get("n1")!.reminder).toBe(after);
    const q = phone();
    setTaken(q.deps, sup, addDaysToKey(TODAY, -1), true);
    expect(q.notes.get("n1")!.reminder).toBe(AT_8);
  });

  it("brak notatki, kosz, reguła inna niż dzienna — odhaczenie zapisane, termin bez zmian", () => {
    expect(setTaken(phone(undefined, null).deps, sup, TODAY, true).changed).toBe(true);
    for (const over of [{ trashed: true }, { reminderRepeat: "weekly" as const }]) {
      const p = phone(undefined, reminderNote(over));
      setTaken(p.deps, sup, TODAY, true);
      expect(p.ys.getTaken().size).toBe(1);
      expect(p.notes.get("n1")!.reminder).toBe(AT_8);
    }
  });

  it("notatka prywatna — pola terminu są jawne, łatka działa bez skarbca", () => {
    const p = phone(undefined, reminderNote({ locked: true, vault: "tok", title: "" }));
    setTaken(p.deps, sup, TODAY, true);
    expect(p.notes.get("n1")!.reminder).toBeGreaterThan(AT_8);
  });

  it("„Cofnij” cofa tylko własne zmiany", () => {
    const p = phone();
    const r = setTaken(p.deps, sup, TODAY, true);
    r.undo();
    expect(p.ys.getTaken().size).toBe(0);
    expect(p.notes.get("n1")!.reminder).toBe(AT_8);
    // Klucz był już wcześniej — cofnięcie drugiego odhaczenia go nie zdejmuje.
    const q = phone();
    q.ys.setTaken(TODAY, "s1", true);
    setTaken(q.deps, sup, TODAY, true).undo();
    expect(q.ys.getTaken().has(logKey(TODAY, "s1"))).toBe(true);
  });
});

describe("takenFromReminder", () => {
  it("„Gotowe” odhacza dziś; drugie wywołanie nic; notatki nie rusza", () => {
    const p = phone();
    expect(takenFromReminder(p.deps, "n1", AT_8).changed).toBe(true);
    expect(p.ys.getTaken().has(logKey(TODAY, "s1"))).toBe(true);
    expect(p.notes.get("n1")!.reminder).toBe(AT_8);
    expect(takenFromReminder(p.deps, "n1", AT_8).changed).toBe(false);
  });

  it("wczorajsze wystąpienie po północy — odhacza wczoraj; starsze — nie", () => {
    const p = phone();
    const yesterday = new Date(2026, 10, 17, 23, 58).getTime();
    takenFromReminder(p.deps, "n1", yesterday);
    expect(p.ys.getTaken().has(logKey(addDaysToKey(TODAY, -1), "s1"))).toBe(true);
    expect(takenFromReminder(p.deps, "n1", new Date(2026, 10, 15, 8).getTime()).changed).toBe(false);
  });

  it("notatka bez odżywki — nic; cofnięcie zdejmuje dodany klucz", () => {
    const p = phone();
    expect(takenFromReminder(p.deps, "inna", AT_8).changed).toBe(false);
    takenFromReminder(p.deps, "n1", AT_8).undo();
    expect(p.ys.getTaken().size).toBe(0);
  });
});

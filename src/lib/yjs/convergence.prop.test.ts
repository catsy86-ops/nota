import { describe, expect, it } from "vitest";
import fc from "fast-check";
import * as Y from "yjs";
import { applyChecklistDiff, applyTextDiff, plainChecklistFromY, plainFromYNote, yNoteFromPlain, type YNote } from "./codec";
import type { ChecklistItem, Note } from "@/lib/types/note";

/**
 * A4.5: dwa urządzenia zaczynają od tego samego dokumentu, każde robi losowe zmiany tymi samymi funkcjami co magazyn
 * (`yNoteFromPlain`, `applyTextDiff`, `applyChecklistDiff`, pola proste, usunięcie), potem wymieniają aktualizacje
 * w obie strony. Projekcja (`plainFromYNote`) musi wyjść identyczna — kolejność scalania nie może zmieniać notatek.
 */

const base = (id: string, over: Partial<Note> = {}): Note => ({
  id, title: id, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 1, updatedAt: 1, ...over,
} as Note);

const IDS = ["a", "b", "c"] as const;
const word = fc.string({ maxLength: 12 });

type Op =
  | { k: "title"; id: string; v: string }
  | { k: "content"; id: string; v: string }
  | { k: "pinned"; id: string; v: boolean }
  | { k: "labels"; id: string; v: string[] }
  | { k: "checklist"; id: string; v: { text: string; checked: boolean }[] }
  | { k: "trash"; id: string }
  | { k: "delete"; id: string }
  | { k: "create"; id: string; title: string };

const opArb = (side: "x" | "y"): fc.Arbitrary<Op> => fc.oneof(
  fc.record({ k: fc.constant("title" as const), id: fc.constantFrom(...IDS), v: word }),
  fc.record({ k: fc.constant("content" as const), id: fc.constantFrom(...IDS), v: fc.string({ maxLength: 40 }) }),
  fc.record({ k: fc.constant("pinned" as const), id: fc.constantFrom(...IDS), v: fc.boolean() }),
  fc.record({ k: fc.constant("labels" as const), id: fc.constantFrom(...IDS), v: fc.array(fc.constantFrom("dom", "praca", "pilne"), { maxLength: 3 }) }),
  fc.record({ k: fc.constant("checklist" as const), id: fc.constantFrom(...IDS), v: fc.array(fc.record({ text: word, checked: fc.boolean() }), { maxLength: 4 }) }),
  fc.record({ k: fc.constant("trash" as const), id: fc.constantFrom(...IDS) }),
  fc.record({ k: fc.constant("delete" as const), id: fc.constantFrom(...IDS) }),
  // Nowa notatka ma id z urządzenia — dwa urządzenia nie tworzą tego samego id (jak `crypto.randomUUID`).
  fc.record({ k: fc.constant("create" as const), id: fc.constantFrom("n1", "n2").map((n) => `${side}-${n}`), title: word }),
);

function apply(doc: Y.Doc, op: Op, i: number): void {
  const notes = doc.getMap<YNote>("notes");
  doc.transact(() => {
    if (op.k === "create") { if (!notes.has(op.id)) notes.set(op.id, yNoteFromPlain(base(op.id, { title: op.title }))); return; }
    const y = notes.get(op.id);
    if (!y) return;
    switch (op.k) {
      case "title": y.set("title", op.v); break;
      case "content": { const t = y.get("content"); if (t instanceof Y.Text) applyTextDiff(t, op.v); break; }
      case "pinned": y.set("pinned", op.v); break;
      case "labels": y.set("labels", op.v); break;
      case "checklist": {
        // Id pozycji jak w aplikacji: istniejące zostają, nowe dostają unikalne id tego urządzenia.
        const prev = plainChecklistFromY(y.get("checklist"));
        const next: ChecklistItem[] = op.v.map((c, j) => ({ id: prev[j]?.id ?? `${doc.clientID}-${i}-${j}`, text: c.text, checked: c.checked }));
        applyChecklistDiff(y, next);
        break;
      }
      case "trash": y.set("trashed", true); y.set("trashedAt", 1000 + i); break;
      case "delete": notes.delete(op.id); break;
    }
  });
}

function projection(doc: Y.Doc): Record<string, Note> {
  const out: Record<string, Note> = {};
  doc.getMap<YNote>("notes").forEach((y, id) => { out[id] = plainFromYNote(id, y); });
  return out;
}

describe("scalanie dokumentów Yjs (A4.5)", () => {
  it("losowe zmiany na dwóch urządzeniach, scalone w obie strony, dają tę samą projekcję notatek", () => {
    fc.assert(fc.property(fc.array(opArb("x"), { maxLength: 12 }), fc.array(opArb("y"), { maxLength: 12 }), (opsX, opsY) => {
      const start = new Y.Doc();
      start.transact(() => { for (const id of IDS) start.getMap<YNote>("notes").set(id, yNoteFromPlain(base(id, { content: `tekst ${id}` }))); });
      const seed = Y.encodeStateAsUpdate(start);
      const x = new Y.Doc(); Y.applyUpdate(x, seed);
      const y = new Y.Doc(); Y.applyUpdate(y, seed);
      opsX.forEach((op, i) => apply(x, op, i));
      opsY.forEach((op, i) => apply(y, op, i));
      // Wymiana w obie strony, w różnej kolejności.
      const fromX = Y.encodeStateAsUpdate(x, Y.encodeStateVector(y));
      const fromY = Y.encodeStateAsUpdate(y, Y.encodeStateVector(x));
      Y.applyUpdate(y, fromX);
      Y.applyUpdate(x, fromY);
      expect(projection(x)).toEqual(projection(y));
    }), { numRuns: 200 });
  });

  it("ta sama aktualizacja zastosowana dwa razy niczego nie zmienia (idempotencja)", () => {
    fc.assert(fc.property(fc.array(opArb("x"), { maxLength: 12 }), (ops) => {
      const a = new Y.Doc();
      a.transact(() => { for (const id of IDS) a.getMap<YNote>("notes").set(id, yNoteFromPlain(base(id))); });
      ops.forEach((op, i) => apply(a, op, i));
      const upd = Y.encodeStateAsUpdate(a);
      const b = new Y.Doc();
      Y.applyUpdate(b, upd);
      const once = projection(b);
      Y.applyUpdate(b, upd);
      expect(projection(b)).toEqual(once);
    }), { numRuns: 100 });
  });
});

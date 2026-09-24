import { describe, it, expect, beforeEach } from "vitest";
import {
  enqueue,
  confirmUpTo,
  clearQueue,
  getQueue,
  applyQueue,
  pendingCount,
  enqueueDiff,
  getLastSyncAt,
  noteLabel,
} from "./offlineQueue";
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
    images: [],
    checklist: [],
    folderId: null,
    order: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("enqueue / getQueue", () => {
  it("starts empty", () => {
    expect(getQueue()).toEqual([]);
    expect(pendingCount()).toBe(0);
  });

  it("appends an op with an increasing sequence number", () => {
    const note = makeNote();
    const seq1 = enqueue({ type: "upsert", noteId: "1", note });
    const seq2 = enqueue({ type: "delete", noteId: "1" });
    expect(seq2).toBeGreaterThan(seq1);
    expect(getQueue()).toHaveLength(2);
  });
});

describe("confirmUpTo", () => {
  it("drops confirmed ops and keeps the rest", () => {
    const note = makeNote();
    const seq1 = enqueue({ type: "upsert", noteId: "1", note });
    enqueue({ type: "upsert", noteId: "2", note: makeNote({ id: "2" }) });
    confirmUpTo(seq1);
    const remaining = getQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].noteId).toBe("2");
  });

  it("clears the queue and records lastSyncAt once everything is confirmed", () => {
    const note = makeNote();
    const seq = enqueue({ type: "upsert", noteId: "1", note });
    expect(getLastSyncAt()).toBeNull();
    confirmUpTo(seq);
    expect(getQueue()).toEqual([]);
    expect(getLastSyncAt()).not.toBeNull();
  });

  it("does nothing when the queue is already empty", () => {
    expect(() => confirmUpTo(999)).not.toThrow();
    expect(getQueue()).toEqual([]);
  });
});

describe("clearQueue", () => {
  it("empties the queue and stamps lastSyncAt", () => {
    enqueue({ type: "delete", noteId: "1" });
    clearQueue();
    expect(getQueue()).toEqual([]);
    expect(getLastSyncAt()).not.toBeNull();
  });
});

describe("applyQueue", () => {
  it("replays upserts and deletes on top of a base snapshot", () => {
    const base = [makeNote({ id: "1", title: "Stara" })];
    const ops = [
      { seq: 1, ts: 0, type: "upsert" as const, noteId: "1", note: makeNote({ id: "1", title: "Nowa" }) },
      { seq: 2, ts: 0, type: "upsert" as const, noteId: "2", note: makeNote({ id: "2", title: "Druga" }) },
    ];
    const result = applyQueue(base, ops);
    expect(result.find((n) => n.id === "1")?.title).toBe("Nowa");
    expect(result.find((n) => n.id === "2")?.title).toBe("Druga");
  });

  it("removes notes deleted by a queued op", () => {
    const base = [makeNote({ id: "1" }), makeNote({ id: "2" })];
    const ops = [{ seq: 1, ts: 0, type: "delete" as const, noteId: "1" }];
    const result = applyQueue(base, ops);
    expect(result.map((n) => n.id)).toEqual(["2"]);
  });

  it("applies a patch op onto an existing note without touching other fields", () => {
    const base = [makeNote({ id: "1", title: "Original", pinned: false })];
    const ops = [{ seq: 1, ts: 0, type: "patch" as const, noteId: "1", patch: { pinned: true } }];
    const result = applyQueue(base, ops);
    expect(result[0].pinned).toBe(true);
    expect(result[0].title).toBe("Original");
  });

  it("keeps already-persisted images when a queued upsert has none (slimmed by quota)", () => {
    const base = [makeNote({ id: "1", images: ["data:img1"] })];
    const ops = [{ seq: 1, ts: 0, type: "upsert" as const, noteId: "1", note: makeNote({ id: "1", images: [] }) }];
    const result = applyQueue(base, ops);
    expect(result[0].images).toEqual(["data:img1"]);
  });

  it("returns the base unchanged when there are no ops", () => {
    const base = [makeNote({ id: "1" })];
    expect(applyQueue(base, [])).toBe(base);
  });
});

describe("enqueueDiff", () => {
  it("queues upserts for changed notes and deletes for removed ones", () => {
    const prev = [makeNote({ id: "1", title: "A" }), makeNote({ id: "2", title: "B" })];
    const next = [makeNote({ id: "1", title: "A changed" })];
    enqueueDiff(prev, next);
    const queue = getQueue();
    expect(queue).toHaveLength(2);
    expect(queue.some((op) => op.type === "upsert" && op.noteId === "1")).toBe(true);
    expect(queue.some((op) => op.type === "delete" && op.noteId === "2")).toBe(true);
  });

  it("queues nothing when nothing changed", () => {
    const notes = [makeNote({ id: "1" })];
    enqueueDiff(notes, notes);
    expect(getQueue()).toEqual([]);
  });
});

describe("noteLabel", () => {
  it("uses the title when present", () => {
    expect(noteLabel(makeNote({ title: "Zakupy" }))).toBe("Zakupy");
  });

  it("falls back to content when title is empty", () => {
    expect(noteLabel(makeNote({ title: "", content: "kup mleko" }))).toBe("kup mleko");
  });

  it("falls back to a default label when both are empty", () => {
    expect(noteLabel(makeNote({ title: "", content: "" }))).toBe("Notatka bez tytułu");
  });

  it("truncates long titles to 40 characters", () => {
    const long = "a".repeat(60);
    expect(noteLabel(makeNote({ title: long }))).toBe(`${"a".repeat(40)}…`);
  });
});

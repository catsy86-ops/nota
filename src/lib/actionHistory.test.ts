import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  pushAction,
  undoAction,
  undoLastAction,
  canUndo,
  clearActions,
  registerUndoHandlers,
  relativeTime,
  getActionHistorySnapshot,
} from "./actionHistory";

// actionHistory.ts keeps a module-level singleton store; reset it between tests.
beforeEach(() => {
  clearActions();
  localStorage.clear();
});

describe("pushAction / undoAction", () => {
  it("adds a new entry that can be undone via its closure", () => {
    const undo = vi.fn();
    pushAction({ kind: "trash", label: "Zakupy", count: 1, noteIds: ["n1"], undo });

    const [entry] = getActionHistorySnapshot();
    expect(entry.label).toBe("Zakupy");
    expect(entry.undone).toBe(false);
    expect(canUndo(entry)).toBe(true);

    const ok = undoAction(entry.id);
    expect(ok).toBe(true);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(getActionHistorySnapshot()[0].undone).toBe(true);
  });

  it("returns false when undoing an already-undone entry", () => {
    const undo = vi.fn();
    pushAction({ kind: "archive", label: "Notatka", count: 1, noteIds: ["n1"], undo });
    const [entry] = getActionHistorySnapshot();
    undoAction(entry.id);
    expect(undoAction(entry.id)).toBe(false);
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("returns false for an unknown entry id", () => {
    expect(undoAction("does-not-exist")).toBe(false);
  });

  it("falls back to a registered handler when the in-memory closure is gone (e.g. after reload)", () => {
    const fallback = vi.fn();
    registerUndoHandlers({ trash: fallback });
    // Simulate a reload: push an entry with no `undo` closure, only noteIds.
    pushAction({ kind: "trash", label: "Po restarcie", count: 2, noteIds: ["a", "b"] });
    const [entry] = getActionHistorySnapshot();
    expect(canUndo(entry)).toBe(true);

    expect(undoAction(entry.id)).toBe(true);
    expect(fallback).toHaveBeenCalledWith(["a", "b"]);
  });

  it("cannot undo an entry with no closure and no matching handler", () => {
    pushAction({ kind: "archive", label: "Bez handlera", count: 1, noteIds: ["x"] });
    const [entry] = getActionHistorySnapshot();
    // No handler registered for "archive" in this test.
    expect(canUndo(entry)).toBe(false);
    expect(undoAction(entry.id)).toBe(false);
  });
});

describe("undoLastAction", () => {
  it("undoes the most recent undoable entry and reports its kind/label", () => {
    pushAction({ kind: "trash", label: "Pierwsza", count: 1, noteIds: ["1"], undo: vi.fn() });
    pushAction({ kind: "archive", label: "Druga", count: 1, noteIds: ["2"], undo: vi.fn() });

    const result = undoLastAction();
    expect(result).toEqual({ label: "Druga", kind: "archive" });
  });

  it("returns null when there is nothing left to undo", () => {
    expect(undoLastAction()).toBeNull();
  });

  it("skips already-undone entries and undoes the next most recent one", () => {
    pushAction({ kind: "trash", label: "Starsza", count: 1, noteIds: ["1"], undo: vi.fn() });
    pushAction({ kind: "archive", label: "Nowsza", count: 1, noteIds: ["2"], undo: vi.fn() });
    undoLastAction(); // undoes "Nowsza"
    const result = undoLastAction();
    expect(result?.label).toBe("Starsza");
  });
});

describe("clearActions", () => {
  it("empties the history", () => {
    pushAction({ kind: "trash", label: "A", count: 1, noteIds: ["1"] });
    clearActions();
    expect(getActionHistorySnapshot()).toEqual([]);
  });
});

describe("relativeTime", () => {
  it("formats sub-10s as 'przed chwilą'", () => {
    expect(relativeTime(1000, 6_000)).toBe("przed chwilą");
  });

  it("formats seconds", () => {
    expect(relativeTime(0, 30_000)).toBe("30 s temu");
  });

  it("formats minutes", () => {
    expect(relativeTime(0, 5 * 60_000)).toBe("5 min temu");
  });

  it("formats hours", () => {
    expect(relativeTime(0, 3 * 60 * 60_000)).toBe("3 godz. temu");
  });

  it("formats days", () => {
    expect(relativeTime(0, 2 * 24 * 60 * 60_000)).toBe("2 dni temu");
  });
});

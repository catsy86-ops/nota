import { describe, it, expect } from "vitest";
import { searchNotes } from "./searchNotes";
import type { Note } from "@/hooks/useNotes";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "1",
    title: "",
    content: "",
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

describe("searchNotes", () => {
  it("returns all notes unchanged for an empty query", () => {
    const notes = [makeNote({ id: "a" }), makeNote({ id: "b" })];
    expect(searchNotes(notes, "")).toBe(notes);
    expect(searchNotes(notes, "   ")).toBe(notes);
  });

  it("fuzzy-matches free text against title/content/labels", () => {
    const notes = [
      makeNote({ id: "a", title: "Lista zakupów" }),
      makeNote({ id: "b", title: "Plan podróży" }),
    ];
    const result = searchNotes(notes, "zakup");
    expect(result.map((n) => n.id)).toEqual(["a"]);
  });

  it("filters by label:<name> operator (all labels required, case-insensitive)", () => {
    const notes = [
      makeNote({ id: "a", labels: ["dom", "pilne"] }),
      makeNote({ id: "b", labels: ["dom"] }),
      makeNote({ id: "c", labels: [] }),
    ];
    expect(searchNotes(notes, "label:DOM label:pilne").map((n) => n.id)).toEqual(["a"]);
  });

  it("filters by color:<name> operator", () => {
    const notes = [
      makeNote({ id: "a", color: "mint" }),
      makeNote({ id: "b", color: "coral" }),
    ];
    expect(searchNotes(notes, "color:coral").map((n) => n.id)).toEqual(["b"]);
  });

  it("filters by has:reminder / has:checklist / has:image", () => {
    const notes = [
      makeNote({ id: "with-reminder", reminder: Date.now() }),
      makeNote({ id: "with-checklist", checklist: [{ id: "c1", text: "x", checked: false }] }),
      makeNote({ id: "with-image", images: ["data:image/png;base64,AAA"] }),
      makeNote({ id: "plain" }),
    ];
    expect(searchNotes(notes, "has:reminder").map((n) => n.id)).toEqual(["with-reminder"]);
    expect(searchNotes(notes, "has:checklist").map((n) => n.id)).toEqual(["with-checklist"]);
    expect(searchNotes(notes, "has:image").map((n) => n.id)).toEqual(["with-image"]);
  });

  it("combines operators with free text", () => {
    const notes = [
      makeNote({ id: "a", title: "Zakupy", labels: ["dom"] }),
      makeNote({ id: "b", title: "Zakupy", labels: ["praca"] }),
    ];
    expect(searchNotes(notes, "label:dom zakup").map((n) => n.id)).toEqual(["a"]);
  });

  it("returns the filtered pool unchanged when only operators are given (no free text)", () => {
    const notes = [makeNote({ id: "a", color: "mint" }), makeNote({ id: "b", color: "coral" })];
    expect(searchNotes(notes, "color:mint").map((n) => n.id)).toEqual(["a"]);
  });
});

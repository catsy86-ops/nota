import { describe, it, expect } from "vitest";
import { notesDiffer, describeDifference } from "./noteSync";
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

describe("notesDiffer", () => {
  it("returns false for identical notes", () => {
    const a = makeNote();
    const b = makeNote();
    expect(notesDiffer(a, b)).toBe(false);
  });

  it("returns false when only untracked fields differ (e.g. updatedAt)", () => {
    const a = makeNote({ updatedAt: 1 });
    const b = makeNote({ updatedAt: 2 });
    expect(notesDiffer(a, b)).toBe(false);
  });

  it("returns true when title differs", () => {
    const a = makeNote({ title: "A" });
    const b = makeNote({ title: "B" });
    expect(notesDiffer(a, b)).toBe(true);
  });

  it("returns true when checklist differs", () => {
    const a = makeNote({ checklist: [] });
    const b = makeNote({ checklist: [{ id: "x", text: "zrób to", checked: false }] });
    expect(notesDiffer(a, b)).toBe(true);
  });

  it("returns true when labels differ", () => {
    const a = makeNote({ labels: ["praca"] });
    const b = makeNote({ labels: ["dom"] });
    expect(notesDiffer(a, b)).toBe(true);
  });
});

describe("describeDifference", () => {
  it("returns an empty list for identical notes", () => {
    expect(describeDifference(makeNote(), makeNote())).toEqual([]);
  });

  it("lists each differing field by its Polish label", () => {
    const local = makeNote({ title: "A", pinned: true });
    const remote = makeNote({ title: "B", pinned: false });
    const diff = describeDifference(local, remote);
    expect(diff).toContain("tytuł");
    expect(diff).toContain("przypięcie");
    expect(diff).toHaveLength(2);
  });

  it("detects checklist and label differences", () => {
    const local = makeNote({ checklist: [{ id: "x", text: "a", checked: false }] });
    const remote = makeNote({ checklist: [], labels: ["nowa"] });
    const diff = describeDifference(local, remote);
    expect(diff).toContain("lista zadań");
    expect(diff).toContain("etykiety");
  });
});

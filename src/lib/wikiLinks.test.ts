import { describe, it, expect } from "vitest";
import { extractWikiLinks, findBacklinks, resolveWikiTarget } from "./wikiLinks";
import type { Note } from "@/hooks/useNotes";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "1",
    title: "Tytuł",
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

describe("extractWikiLinks", () => {
  it("extracts titles referenced via [[Title]] syntax, lowercased", () => {
    expect(extractWikiLinks("Zobacz [[Zakupy]] i [[Plan dnia]]")).toEqual(["zakupy", "plan dnia"]);
  });

  it("deduplicates repeated references", () => {
    expect(extractWikiLinks("[[Zakupy]] ... [[zakupy]] ... [[ZAKUPY]]")).toEqual(["zakupy"]);
  });

  it("returns an empty array when there are no links", () => {
    expect(extractWikiLinks("Zwykła treść bez linków")).toEqual([]);
  });

  it("ignores empty [[ ]] brackets", () => {
    expect(extractWikiLinks("Puste [[   ]] nawiasy")).toEqual([]);
  });

  it("does not leak regex state between calls (module-level global regex)", () => {
    // Guards against a stateful /g RegExp.exec bug: calling this repeatedly
    // must always scan from the start, not resume from a previous lastIndex.
    for (let i = 0; i < 3; i++) {
      expect(extractWikiLinks("[[A]] middle [[B]]")).toEqual(["a", "b"]);
    }
  });
});

describe("findBacklinks", () => {
  it("finds notes that link to this note's title, excluding itself", () => {
    const target = makeNote({ id: "t", title: "Zakupy" });
    const linker = makeNote({ id: "l", title: "Lista", content: "Patrz [[Zakupy]]" });
    const selfLinker = makeNote({ id: "t", title: "Zakupy", content: "[[Zakupy]] self-link" });
    const unrelated = makeNote({ id: "u", title: "Coś innego", content: "brak linków" });

    expect(findBacklinks(target, [target, linker, selfLinker, unrelated])).toEqual([linker]);
  });

  it("returns an empty array for a note with no title", () => {
    const target = makeNote({ id: "t", title: "" });
    const other = makeNote({ id: "o", content: "[[x]]" });
    expect(findBacklinks(target, [target, other])).toEqual([]);
  });

  it("matches case-insensitively", () => {
    const target = makeNote({ id: "t", title: "ZAKUPY" });
    const linker = makeNote({ id: "l", content: "[[zakupy]]" });
    expect(findBacklinks(target, [target, linker])).toEqual([linker]);
  });
});

describe("resolveWikiTarget", () => {
  it("finds a note by title, case-insensitively and trimmed", () => {
    const note = makeNote({ id: "n1", title: "Plan Dnia" });
    expect(resolveWikiTarget("  plan dnia  ", [note])).toBe(note);
  });

  it("returns undefined when no note matches", () => {
    const note = makeNote({ id: "n1", title: "Plan Dnia" });
    expect(resolveWikiTarget("nieznana notatka", [note])).toBeUndefined();
  });
});

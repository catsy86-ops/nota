import { describe, it, expect } from "vitest";
import {
  extractWikiLinks, resolveWikiTarget,
  buildWikiIndex, backlinksOf, wikiQueryAt, suggestWikiTitles, completeWikiLink,
} from "./wikiLinks";
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

describe("buildWikiIndex / backlinksOf", () => {
  const notes = [
    makeNote({ id: "a", title: "Zakupy", updatedAt: 1 }),
    makeNote({ id: "b", title: "Lista", content: "Patrz [[zakupy]] i [[Zakupy]]", updatedAt: 3 }),
    makeNote({ id: "c", title: "ZAKUPY", content: "[[Zakupy]]", updatedAt: 2 }),
    makeNote({ id: "d", title: "  ", content: "[[Lista]]" }),
  ];
  const index = buildWikiIndex(notes);

  it("lists titles newest first, without case duplicates or blanks", () => {
    expect(index.titles).toEqual(["Lista", "ZAKUPY"]);
  });

  it("gives each linking note once and skips the note itself", () => {
    expect(backlinksOf(notes[0], index)).toEqual([{ id: "b", title: "Lista" }, { id: "c", title: "ZAKUPY" }]);
    expect(backlinksOf(notes[2], index)).toEqual([{ id: "b", title: "Lista" }]);
    expect(backlinksOf(notes[1], index)).toEqual([{ id: "d", title: "" }]);
    expect(backlinksOf(notes[3], index)).toEqual([]);
  });
});

describe("wikiQueryAt", () => {
  it("finds an open [[ before the caret", () => {
    const text = "Zobacz [[Zak";
    expect(wikiQueryAt(text, text.length)).toEqual({ start: 7, query: "Zak" });
    expect(wikiQueryAt("[[", 2)).toEqual({ start: 0, query: "" });
  });

  it("ignores closed links, new lines and text without [[", () => {
    expect(wikiQueryAt("[[Zakupy]] dalej", 16)).toBeNull();
    expect(wikiQueryAt("[[Zak\nupy", 9)).toBeNull();
    expect(wikiQueryAt("zwykły tekst", 5)).toBeNull();
  });

  it("works between the brackets inserted by the toolbar", () => {
    expect(wikiQueryAt("x [[]] y", 4)).toEqual({ start: 2, query: "" });
  });
});

describe("suggestWikiTitles", () => {
  const titles = ["Plan dnia", "Zakupy na weekend", "Dzienny plan", "Zakupy"];

  it("ranks prefix, then word start, then anywhere, keeping recency order within a rank", () => {
    expect(suggestWikiTitles("pla", titles)).toEqual(["Plan dnia", "Dzienny plan"]);
    expect(suggestWikiTitles("zak", titles)).toEqual(["Zakupy na weekend", "Zakupy"]);
    expect(suggestWikiTitles("ken", titles)).toEqual(["Zakupy na weekend"]);
  });

  it("shows the most recent titles for an empty query and skips the current note", () => {
    expect(suggestWikiTitles("", titles, "plan DNIA", 2)).toEqual(["Zakupy na weekend", "Dzienny plan"]);
  });
});

describe("completeWikiLink", () => {
  it("replaces the typed query with the full link and puts the caret after it", () => {
    const text = "Zobacz [[zak i dalej";
    const q = wikiQueryAt(text, 12)!;
    expect(completeWikiLink(text, q, 12, "Zakupy")).toEqual({ text: "Zobacz [[Zakupy]] i dalej", caret: 17 });
  });

  it("swallows the closing ]] inserted by the toolbar instead of doubling it", () => {
    const text = "x [[]] y";
    const q = wikiQueryAt(text, 4)!;
    expect(completeWikiLink(text, q, 4, "Plan")).toEqual({ text: "x [[Plan]] y", caret: 10 });
  });
});

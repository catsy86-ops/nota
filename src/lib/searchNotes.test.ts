import { describe, it, expect, beforeAll, vi } from "vitest";
import { searchNotes, loadSearchIndex } from "./searchNotes";
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

describe("searchNotes — checklisty", () => {
  it("znajduje notatkę po treści pozycji checklisty", () => {
    const notes = [
      makeNote({ id: "a", title: "Zakupy", checklist: [{ id: "i1", text: "kupić baterie", checked: false }] }),
      makeNote({ id: "b", title: "Inne" }),
    ];
    expect(searchNotes(notes, "baterie").map((n) => n.id)).toEqual(["a"]);
  });
});

describe("searchNotes — indeks z cache", () => {
  const all = [
    makeNote({ id: "a", title: "Zakupy tygodniowe", folderId: "f1" }),
    makeNote({ id: "b", title: "Zakupy na imprezę", folderId: "f2" }),
    makeNote({ id: "c", title: "Plan podróży" }),
    makeNote({ id: "d", title: "Zakupy prywatne", locked: true }),
  ];

  it("wynik z podzbioru = trafienia z całości zawężone do podzbioru", () => {
    const subset = all.filter((n) => n.folderId === "f1");
    expect(searchNotes(subset, "zakupy", {}, all).map((n) => n.id)).toEqual(["a"]);
    expect(searchNotes(subset, "zakupy").map((n) => n.id)).toEqual(["a"]);
  });

  it("kolejne zapytania na tej samej tablicy dają te same wyniki co świeży indeks", () => {
    const first = searchNotes(all, "zakupy").map((n) => n.id);
    const again = searchNotes(all, "zakupy").map((n) => n.id);
    expect(again).toEqual(first);
    expect(searchNotes(all, "plan").map((n) => n.id)).toEqual(["c"]);
  });

  it("zmieniona tablica nie korzysta ze starego indeksu", () => {
    const next = [...all, makeNote({ id: "e", title: "Zakupy nowe" })];
    expect(searchNotes(next, "nowe").map((n) => n.id)).toContain("e");
    expect(searchNotes(all, "nowe").map((n) => n.id)).not.toContain("e");
  });

  it("notatki prywatne nigdy nie trafiają do wyników", () => {
    expect(searchNotes(all, "prywatne").map((n) => n.id)).not.toContain("d");
  });
});

describe("searchNotes — diakrytyki i wiele słów", () => {
  const notes = [
    makeNote({ id: "a", title: "Żółta kartka", content: "kupić mleko i chleb" }),
    makeNote({ id: "b", title: "Mleko", content: "sklep na rogu" }),
    makeNote({ id: "c", title: "Plan", content: "chleb" }),
  ];

  it("znajduje bez ogonków", () => {
    expect(searchNotes(notes, "zolta").map((n) => n.id)).toEqual(["a"]);
  });

  it("wymaga wszystkich słów, niezależnie od kolejności", () => {
    expect(searchNotes(notes, "mleko kupić").map((n) => n.id)).toEqual(["a"]);
    expect(searchNotes(notes, "kupic mleko").map((n) => n.id)).toEqual(["a"]);
    expect(searchNotes(notes, "chleb mleko").map((n) => n.id)).toEqual(["a"]);
  });
});

// Fuse ładuje się osobno — reszta testów sprawdza wyszukiwanie rozmyte, więc czeka na bibliotekę.
beforeAll(() => loadSearchIndex());

describe("przed wczytaniem Fuse", () => {
  it("dopasowuje dokładnie (bez ogonków i wielkości liter), z pominięciem notatek prywatnych", async () => {
    vi.resetModules();
    const fresh = await import("./searchNotes");
    const notes = [
      makeNote({ id: "a", title: "Żółta kartka" }),
      makeNote({ id: "b", title: "Zielona", checklist: [{ id: "x", text: "kupić żółtą farbę", checked: false }] as Note["checklist"] }),
      makeNote({ id: "c", title: "zolta", locked: true }),
    ];
    expect(fresh.searchNotes(notes, "zolt").map((n) => n.id)).toEqual(["a", "b"]);
    expect(fresh.searchNotes(notes, "zolat")).toEqual([]);
  });
});

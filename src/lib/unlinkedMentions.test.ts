import { describe, expect, it } from "vitest";
import type { Note } from "@/hooks/useNotes";
import { findMention, findUnlinkedMentions, linkFirstMention } from "./unlinkedMentions";

function note(id: string, title: string, content: string, extra: Partial<Note> = {}): Note {
  return { id, title, content, color: "default", pinned: false, archived: false, trashed: false, trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0, ...extra } as Note;
}

describe("linkFirstMention", () => {
  it("zamienia pierwsze wystąpienie, bez rozróżniania wielkości liter", () => {
    expect(linkFirstMention("Kupić zakupy i znów Zakupy", "zakupy")).toBe("Kupić [[zakupy]] i znów Zakupy");
    expect(linkFirstMention("Dziś Zakupy", "zakupy")).toBe("Dziś [[Zakupy]]");
  });
  it("respektuje granice słów, także dla polskich liter", () => {
    expect(linkFirstMention("żółwie", "żółw")).toBeNull();
    expect(linkFirstMention("mój żółw śpi", "żółw")).toBe("mój [[żółw]] śpi");
    expect(linkFirstMention("zakupy_x i zakupy2", "zakupy")).toBeNull();
    expect(linkFirstMention("Łódź, Łódź.", "Łódź")).toBe("[[Łódź]], Łódź.");
  });
  it("traktuje znaki regexu w tytule dosłownie", () => {
    expect(linkFirstMention("zobacz C++ (wersja 1.0) dziś", "C++ (wersja 1.0)")).toBe("zobacz [[C++ (wersja 1.0)]] dziś");
    expect(linkFirstMention("abc", "a.c")).toBeNull();
  });
  it("pomija wystąpienia w [[...]] i bierze następne", () => {
    expect(linkFirstMention("[[Plan]] i Plan", "Plan")).toBe("[[Plan]] i [[Plan]]");
    expect(findMention("tylko [[Plan]]", "Plan")).toBeNull();
  });
  it("pomija kod w linii i w blokach", () => {
    expect(findMention("`Plan` tu", "Plan")).toBeNull();
    expect(findMention("```\nPlan\n```", "Plan")).toBeNull();
    expect(linkFirstMention("```\nPlan\n```\nPlan", "Plan")).toBe("```\nPlan\n```\n[[Plan]]");
  });
  it("odrzuca tytuły krótsze niż 3 znaki", () => {
    expect(linkFirstMention("to jest do", "do")).toBeNull();
  });
});

describe("findUnlinkedMentions", () => {
  const target = note("t", "Zakupy", "");
  it("znajduje notatki ze wzmianką bez linku", () => {
    const notes = [
      target,
      note("a", "A", "Pamiętaj o zakupy jutro"),
      note("b", "B", "Już mam [[Zakupy]] i zakupy"),
      note("c", "C", "nic tu nie ma"),
      note("d", "D", "zakupy", { trashed: true }),
      note("e", "Zakupy", "zakupy zakupy"),
    ];
    const res = findUnlinkedMentions(target, notes);
    expect(res.map((r) => r.id)).toEqual(["a"]);
    expect(res[0].match).toBe("zakupy");
  });
  it("nic nie zwraca dla krótkiego tytułu", () => {
    expect(findUnlinkedMentions(note("x", "ab", ""), [note("a", "A", "ab ab")])).toEqual([]);
  });
});

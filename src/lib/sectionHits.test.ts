import { describe, expect, it } from "vitest";
import type { Note } from "@/hooks/useNotes";
import { sectionHits } from "@/lib/sectionHits";

function note(id: string, title: string, content: string, extra: Partial<Note> = {}): Note {
  return { id, title, content, labels: [], ...extra } as Note;
}

describe("sectionHits", () => {
  const a = note("a", "Budowa", "# Fundament\n\nBeton i zbrojenie\n\n## Ściany działowe\n\nGips ^gips\n\n- płyta ^plyta");

  it("pusty tekst zwraca brak trafień", () => {
    expect(sectionHits([a], "")).toEqual([]);
    expect(sectionHits([a], "   ")).toEqual([]);
  });

  it("znajduje nagłówek bez wielkości liter i ogonków", () => {
    const hits = sectionHits([a], "scian");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ kind: "heading", target: "Ściany działowe", note: a });
  });

  it("znajduje blok po treści i zwraca cel ^id", () => {
    const hits = sectionHits([a], "gips");
    expect(hits).toEqual([expect.objectContaining({ kind: "block", target: "^gips", text: "Gips" })]);
  });

  it("znajduje blok po samym id", () => {
    expect(sectionHits([a], "plyta")).toEqual([expect.objectContaining({ kind: "block", target: "^plyta", text: "płyta" })]);
  });

  it("wymaga wszystkich słów (AND) w jednej linii", () => {
    expect(sectionHits([a], "beton gips")).toEqual([]);
    expect(sectionHits([a], "beton zbrojenie")).toHaveLength(0);
  });

  it("pomija operatory i zostawia wolny tekst", () => {
    const labelled = note("b", "Budowa", "## Ściany działowe", { labels: ["dom"] });
    expect(sectionHits([labelled], "etykieta:dom scian")).toHaveLength(1);
    expect(sectionHits([labelled], "etykieta:praca scian")).toHaveLength(0);
    expect(sectionHits([labelled], "etykieta:dom")).toHaveLength(0);
  });

  it("pomija notatki zablokowane", () => {
    expect(sectionHits([note("p", "P", "## Tajne\n", { locked: true })], "tajne")).toEqual([]);
  });

  it("tnie wynik do limitu", () => {
    const many = note("m", "M", Array.from({ length: 10 }, (_, i) => `## Punkt ${i}`).join("\n"));
    expect(sectionHits([many], "punkt", {}, 3)).toHaveLength(3);
  });
});

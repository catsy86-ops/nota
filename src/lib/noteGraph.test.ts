import { describe, expect, it } from "vitest";
import type { Note } from "@/hooks/useNotes";
import { buildGraph, forceLayout, GRAPH_NODE_LIMIT } from "./noteGraph";

function note(id: string, title: string, content = "", extra: Partial<Note> = {}): Note {
  return { id, title, content, color: "default", pinned: false, archived: false, trashed: false, trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0, ...extra } as Note;
}

describe("buildGraph", () => {
  it("tworzy węzły tylko z notatek z linkiem i liczy powiązania", () => {
    const g = buildGraph([
      note("a", "Alfa", "patrz [[Beta]] i [[gamma]]"),
      note("b", "Beta", "wraca do [[Alfa]]"),
      note("c", "Gamma"),
      note("d", "Samotna"),
    ]);
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c"]);
    expect(g.edges).toHaveLength(2);
    expect(g.nodes.find((n) => n.id === "a")?.degree).toBe(2);
    expect(g.truncated).toBe(false);
  });
  it("ignoruje linki do siebie, nieistniejące cele i kosz", () => {
    const g = buildGraph([
      note("a", "Alfa", "[[Alfa]] [[Nie ma]] [[Kosz]]"),
      note("t", "Kosz", "", { trashed: true }),
    ]);
    expect(g.nodes).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
  });
  it("tnie do limitu, zostawiając najbardziej powiązane", () => {
    const hub = note("hub", "Hub", Array.from({ length: 10 }, (_, i) => `[[N${i}]]`).join(" "));
    const leaves = Array.from({ length: 10 }, (_, i) => note(`n${i}`, `N${i}`));
    const g = buildGraph([hub, ...leaves], 4);
    expect(g.nodes).toHaveLength(4);
    expect(g.nodes[0].id).toBe("hub");
    expect(g.total).toBe(11);
    expect(g.truncated).toBe(true);
    expect(GRAPH_NODE_LIMIT).toBe(150);
  });
});

describe("forceLayout", () => {
  it("daje skończone współrzędne w ramce i jest deterministyczny", () => {
    const notes = [note("a", "A", "[[B]] [[C]]"), note("b", "B", "[[C]]"), note("c", "C"), note("d", "D", "[[A]]")];
    const g = buildGraph(notes);
    const l1 = forceLayout(g.nodes, g.edges, 1000, 600);
    const l2 = forceLayout(g.nodes, g.edges, 1000, 600);
    for (const n of g.nodes) {
      const p = l1.get(n.id)!;
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1000);
      expect(p.y).toBeLessThanOrEqual(600);
      expect(l2.get(n.id)).toEqual(p);
    }
  });
});

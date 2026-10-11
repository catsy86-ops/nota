import { describe, it, expect } from "vitest";
import type { Note } from "@/hooks/useNotes";
import { ancestorsOf, buildSubpageIndex, canSetParent, childrenOf, descendantIds, parentIdOf } from "./subpages";

function n(id: string, parentId?: string, extra: Partial<Note> = {}): Note {
  return {
    id, title: `T-${id}`, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
    labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
    createdAt: 1, updatedAt: 1, ...(parentId ? { parentId } : {}), ...extra,
  };
}
const byId = (notes: Note[]) => new Map(notes.map((x) => [x.id, x] as const));

describe("drzewo podstron", () => {
  const notes = [n("a"), n("b", "a"), n("c", "b"), n("d", "a"), n("x")];

  it("parentIdOf: brak, nieistniejący rodzic i wskazanie na siebie dają null", () => {
    const m = byId([n("a"), n("b", "ghost"), n("c", "c"), n("d", "a")]);
    expect(parentIdOf(m.get("a")!, m)).toBeNull();
    expect(parentIdOf(m.get("b")!, m)).toBeNull();
    expect(parentIdOf(m.get("c")!, m)).toBeNull();
    expect(parentIdOf(m.get("d")!, m)).toBe("a");
  });

  it("ancestorsOf: od korzenia do rodzica", () => {
    expect(ancestorsOf("c", byId(notes))).toEqual(["a", "b"]);
    expect(ancestorsOf("a", byId(notes))).toEqual([]);
  });

  it("descendantIds i childrenOf", () => {
    expect(descendantIds("a", notes).sort()).toEqual(["b", "c", "d"]);
    expect(childrenOf("a", notes).map((x) => x.id).sort()).toEqual(["b", "d"]);
    expect(descendantIds("x", notes)).toEqual([]);
  });

  it("cykl od peera nie zapętla ani łańcucha przodków, ani potomków", () => {
    const cyc = [n("a", "b"), n("b", "a"), n("c", "b")];
    expect(ancestorsOf("c", byId(cyc))).toEqual(["a", "b"]);
    expect(descendantIds("a", cyc).sort()).toEqual(["b", "c"]);
  });

  it("canSetParent: nie na siebie, nie na potomka, tylko na istniejącą notatkę", () => {
    expect(canSetParent("a", "a", notes)).toBe(false);
    expect(canSetParent("a", "c", notes)).toBe(false);
    expect(canSetParent("c", "a", notes)).toBe(true);
    expect(canSetParent("c", "ghost", notes)).toBe(false);
    expect(canSetParent("c", null, notes)).toBe(true);
  });

  it("buildSubpageIndex: rodzic i liczba podstron, bez podstron z kosza", () => {
    const idx = buildSubpageIndex([n("a"), n("b", "a"), n("c", "a", { trashed: true, trashedAt: 5 }), n("x")]);
    expect(idx.get("a")).toEqual({ parentId: null, parentTitle: "", childCount: 1 });
    expect(idx.get("b")).toEqual({ parentId: "a", parentTitle: "T-a", childCount: 0 });
    expect(idx.has("x")).toBe(false);
  });
});

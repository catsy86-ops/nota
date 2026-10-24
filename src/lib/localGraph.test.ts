import { describe, expect, it } from "vitest";
import type { Note } from "@/hooks/useNotes";
import { localGraph } from "./noteGraph";

function note(id: string, title: string, content = "", extra: Partial<Note> = {}): Note {
  return { id, title, content, color: "default", pinned: false, archived: false, trashed: false, trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0, ...extra } as Note;
}

// Łańcuch A → B → C → D oraz E, który linkuje do A.
const chain = () => [
  note("a", "Alfa", "[[Beta]]"),
  note("b", "Beta", "[[Gamma]]"),
  note("c", "Gamma", "[[Delta]]"),
  note("d", "Delta"),
  note("e", "Epsilon", "[[Alfa]]"),
];

describe("localGraph", () => {
  it("zostawia sąsiadów do dwóch kroków, a dalsze węzły odcina", () => {
    const g = localGraph(chain(), "a");
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "c", "e"]);
    expect(g.nodes[0].id).toBe("a");
    expect(g.edges).toHaveLength(3);
  });

  it("depth 1 bierze tylko bezpośrednich sąsiadów", () => {
    const g = localGraph(chain(), "a", { depth: 1 });
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["a", "b", "e"]);
  });

  it("notatka bez połączeń zostaje sama, bez krawędzi", () => {
    const g = localGraph([note("x", "Iks")], "x");
    expect(g.nodes.map((n) => n.id)).toEqual(["x"]);
    expect(g.edges).toHaveLength(0);
  });

  it("nieznana, usunięta albo prywatna notatka daje pusty graf", () => {
    const notes = [note("a", "Alfa", "[[Beta]]"), note("t", "Kosz", "", { trashed: true }), note("p", "Sekret", "[[Alfa]]", { locked: true } as Partial<Note>)];
    expect(localGraph(notes, "nie-ma").nodes).toHaveLength(0);
    expect(localGraph(notes, "t").nodes).toHaveLength(0);
    expect(localGraph(notes, "p").nodes).toHaveLength(0);
    // Prywatna notatka nie wnosi krawędzi do grafu notatki jawnej.
    expect(localGraph(notes, "a").nodes.map((n) => n.id)).toEqual(["a"]);
  });

  it("filtr etykiety zostawia pasujące sąsiady, środek zawsze zostaje", () => {
    const notes = chain().map((n) => (n.id === "b" ? { ...n, labels: ["praca/projekt"] } : n));
    // B pasuje do „praca” (dziecko filtra), C nie ma etykiety, więc odpada.
    const g = localGraph(notes, "a", { label: "praca" });
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    const none = localGraph(notes, "a", { label: "dom" });
    expect(none.nodes.map((n) => n.id)).toEqual(["a"]);
  });

  it("filtr folderu liczy się po id folderów podanych przez wywołującego", () => {
    const notes = chain().map((n) => (n.id === "c" ? { ...n, folderId: "f1" } : n));
    const g = localGraph(notes, "a", { folderIds: new Set(["f1"]) });
    // C jest w folderze, więc zostaje; B nie ma folderu, więc przerywa ścieżkę do C.
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["a"]);
    // Z środka B widać C (w folderze), D nie należy do folderu.
    const fromB = localGraph(notes, "b", { folderIds: new Set(["f1"]) });
    expect(fromB.nodes.map((n) => n.id).sort()).toEqual(["b", "c"]);
  });

  it("przy limicie zostawia środek i najbliższych", () => {
    // B (krok 1, dwa linki) przed E (krok 1, jeden link); C jest w kroku 2 i odpada.
    const g = localGraph(chain(), "a", {}, 2);
    expect(g.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(g.truncated).toBe(true);
    expect(g.total).toBe(4);
  });

  it("rozwiązuje linki po aliasie", () => {
    const notes = [note("a", "Alfa", "[[Kot]]"), note("b", "Beta", "", { aliases: ["Kot"] })];
    const g = localGraph(notes, "a");
    expect(g.edges).toEqual([{ a: "a", b: "b" }]);
  });
});

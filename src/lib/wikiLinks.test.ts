import { describe, it, expect } from "vitest";
import {
  extractWikiLinks, resolveWikiTarget,
  renameLinkTargets, buildWikiIndex, backlinksOf, wikiQueryAt, suggestWikiTitles, completeWikiLink, splitWikiTarget, cleanAliases,
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

describe("renameLinkTargets", () => {
  it("przepina linki niezależnie od wielkości liter i spacji", () => {
    expect(renameLinkTargets("Zobacz [[Plan]] i [[ plan ]] oraz [[Inny]]", "Plan", "Plan 2")).toBe("Zobacz [[Plan 2]] i [[Plan 2]] oraz [[Inny]]");
  });

  it("zwraca tę samą treść, gdy nic nie linkuje", () => {
    const text = "bez linków [Plan]";
    expect(renameLinkTargets(text, "Plan", "Nowy")).toBe(text);
    expect(renameLinkTargets("[[A]]", "", "B")).toBe("[[A]]");
  });
});

describe("[[tytuł#nagłówek]]", () => {
  it("splitWikiTarget rozdziela tytuł i nagłówek", () => {
    expect(splitWikiTarget("Plan")).toEqual({ title: "Plan", heading: null, display: null });
    expect(splitWikiTarget(" Plan # Etap 2 ")).toEqual({ title: "Plan", heading: "Etap 2", display: null });
    expect(splitWikiTarget("Plan#")).toEqual({ title: "Plan", heading: null, display: null });
    expect(splitWikiTarget("#Etap")).toEqual({ title: "", heading: "Etap", display: null });
  });

  it("[[cel|tekst]]: cel prowadzi, tekst tylko wyświetla się", () => {
    expect(splitWikiTarget("Plan|Plan budowy")).toEqual({ title: "Plan", heading: null, display: "Plan budowy" });
    expect(splitWikiTarget("Plan#Etap 2|etap")).toEqual({ title: "Plan", heading: "Etap 2", display: "etap" });
    // Pusty tekst po `|` nie jest etykietą — pokazujemy cel.
    expect(splitWikiTarget("Plan|  ")).toEqual({ title: "Plan", heading: null, display: null });
  });

  it("extractWikiLinks liczy link do nagłówka jako link do notatki", () => {
    expect(extractWikiLinks("[[Plan#Etap 2]] i [[plan]] oraz [[Inna]]")).toEqual(["plan", "inna"]);
  });

  it("renameLinkTargets zachowuje nagłówek", () => {
    expect(renameLinkTargets("Zob. [[Plan#Etap 2]] i [[Plan]]", "plan", "Harmonogram"))
      .toBe("Zob. [[Harmonogram#Etap 2]] i [[Harmonogram]]");
  });
});

describe("aliasy notatek", () => {
  const withAlias: Note = makeNote({ id: "a", title: "Projekt łazienki", aliases: ["łazienka", "PL"] });
  const plain: Note = makeNote({ id: "b", title: "Łazienka" });

  it("link po aliasie trafia w notatkę", () => {
    expect(resolveWikiTarget("PL", [withAlias])?.id).toBe("a");
    expect(resolveWikiTarget("łazienka", [withAlias])?.id).toBe("a");
  });

  it("tytuł wygrywa z aliasem, więc alias nie przesłania istniejącej notatki", () => {
    expect(resolveWikiTarget("Łazienka", [withAlias, plain])?.id).toBe("b");
  });

  it("aliasy są w podpowiedziach po tytułach, bez duplikatów", () => {
    const idx = buildWikiIndex([withAlias, { ...plain, aliases: ["PL"] }]);
    // Tytuły najpierw, potem aliasy; alias równy tytułowi (łazienka) nie dubluje się.
    expect(idx.titles.map((t) => t.toLowerCase())).toEqual(["projekt łazienki", "łazienka", "pl"]);
  });

  it("notatki linkujące po aliasie są wsteczne linkami do notatki", () => {
    const linker = makeNote({ id: "c", title: "Notatka dnia", content: "Zobacz [[PL]] i [[Projekt łazienki]]." });
    const idx = buildWikiIndex([withAlias, linker]);
    expect(backlinksOf(withAlias, idx).map((r) => r.id)).toEqual(["c"]);
  });

  it("starsze notatki bez aliasów działają jak dotąd", () => {
    expect(resolveWikiTarget("Łazienka", [plain])?.id).toBe("b");
    expect(resolveWikiTarget("nic", [plain])).toBeUndefined();
  });
});

describe("cleanAliases", () => {
  it("przycina, odrzuca puste i duplikaty bez względu na wielkość liter", () => {
    expect(cleanAliases(["  łazienka ", "", "Łazienka", "PL", "pl"], "Projekt")).toEqual(["łazienka", "PL"]);
  });

  it("odrzuca alias równy tytułowi notatki", () => {
    expect(cleanAliases(["projekt", "Projekt łazienki"], "Projekt")).toEqual(["Projekt łazienki"]);
  });

  it("pilnuje limitów długości i liczby", () => {
    expect(cleanAliases(["x".repeat(201), "ok"], "T")).toEqual(["ok"]);
    const many = Array.from({ length: 30 }, (_, i) => `a${i}`);
    expect(cleanAliases(many, "T")).toHaveLength(20);
  });
});

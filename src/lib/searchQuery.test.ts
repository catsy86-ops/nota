import { describe, it, expect } from "vitest";
import { parseSearchQuery, matchesClauses, highlightTokens, type MatchNote } from "./searchQuery";
import { suggestOperators, applySuggestion } from "./searchSuggest";
import { addFilter, renameFilter, removeFilter, sanitizeFilters } from "./savedFilters";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

function note(over: Partial<MatchNote> = {}): MatchNote {
  return { labels: [], color: "default", folderId: null, reminder: null, images: [], checklist: [], pinned: false, updatedAt: NOW, ...over };
}

describe("parseSearchQuery", () => {
  it("rozpoznaje operatory i zostawia resztę jako tekst", () => {
    const p = parseSearchQuery("etykieta:praca ma:przypomnienie raport kwartalny");
    expect(p.clauses).toEqual([{ type: "label", value: "praca" }, { type: "reminder" }]);
    expect(p.text).toBe("raport kwartalny");
  });

  it("obsługuje cudzysłowy w wartości i w tekście", () => {
    const p = parseSearchQuery('etykieta:"moja praca" folder:"Dom i ogród" "plan dnia"');
    expect(p.clauses).toEqual([{ type: "label", value: "moja praca" }, { type: "folder", value: "Dom i ogród" }]);
    expect(p.text).toBe("plan dnia");
  });

  it("wielokrotne operatory są łączone (AND)", () => {
    const p = parseSearchQuery("etykieta:a etykieta:b przypięte");
    expect(p.clauses).toHaveLength(3);
    const n = note({ labels: ["a", "b"], pinned: true });
    expect(matchesClauses(n, p.clauses)).toBe(true);
    expect(matchesClauses(note({ labels: ["a"], pinned: true }), p.clauses)).toBe(false);
  });

  it("nieznany operator i nieznana wartość to zwykły tekst", () => {
    expect(parseSearchQuery("kolor2:x").text).toBe("kolor2:x");
    expect(parseSearchQuery("ma:skrzydła").text).toBe("ma:skrzydła");
    expect(parseSearchQuery("starsze:wczoraj").clauses).toEqual([]);
    expect(parseSearchQuery("etykieta:").text).toBe("etykieta:");
  });

  it("ignoruje wielkość liter i ogonki", () => {
    expect(parseSearchQuery("ETYKIETA:Praca PRZYPIĘTE Przypiete").clauses.map((c) => c.type)).toEqual(["label", "pinned", "pinned"]);
  });

  it("starsze/nowsze: dni, tygodnie, miesiące", () => {
    expect(parseSearchQuery("starsze:30d nowsze:2t").clauses).toEqual([{ type: "older", days: 30 }, { type: "newer", days: 14 }]);
    expect(parseSearchQuery("nowsze:3").clauses).toEqual([{ type: "newer", days: 3 }]);
  });

  it("zachowuje stare operatory has: i label:", () => {
    expect(parseSearchQuery("has:reminder has:image label:x color:coral").clauses.map((c) => c.type))
      .toEqual(["reminder", "image", "label", "color"]);
  });
});

describe("matchesClauses", () => {
  const folders = [
    { id: "f1", name: "Praca", parentId: null },
    { id: "f2", name: "Projekty", parentId: "f1" },
    { id: "f3", name: "Dom", parentId: null },
  ];
  const ctx = { folders, now: NOW };
  const test = (q: string, n: MatchNote) => matchesClauses(n, parseSearchQuery(q).clauses, ctx);

  it("folder: obejmuje podfoldery", () => {
    expect(test("folder:praca", note({ folderId: "f2" }))).toBe(true);
    expect(test("folder:dom", note({ folderId: "f2" }))).toBe(false);
    expect(test("folder:nie-ma", note({ folderId: "f1" }))).toBe(false);
  });

  it("przypomnienia, obrazy, listy", () => {
    expect(test("ma:przypomnienie", note({ reminder: NOW }))).toBe(true);
    expect(test("brak:przypomnienia", note({ reminder: NOW }))).toBe(false);
    expect(test("brak:przypomnienia", note())).toBe(true);
    expect(test("ma:obraz", note({ images: ["h"] }))).toBe(true);
    expect(test("lista:otwarte", note({ checklist: [{ checked: true }] }))).toBe(false);
    expect(test("lista:otwarte", note({ checklist: [{ checked: true }, { checked: false }] }))).toBe(true);
  });

  it("starsze / nowsze liczą od updatedAt", () => {
    const old = note({ updatedAt: NOW - 40 * DAY });
    expect(test("starsze:30d", old)).toBe(true);
    expect(test("nowsze:30d", old)).toBe(false);
    expect(test("nowsze:7d", note({ updatedAt: NOW - DAY }))).toBe(true);
  });
});

describe("suggestOperators", () => {
  const ctx = { labels: ["praca", "moja praca", "dom"], folders: ["Projekty", "Dom"] };
  it("po etykieta: podaje istniejące etykiety", () => {
    const r = suggestOperators("raport etykieta:pr", ctx);
    expect(r.items.map((i) => i.label)).toEqual(["praca", "moja praca"]);
    expect(applySuggestion("raport etykieta:pr", r.from, r.items[1])).toBe('raport etykieta:"moja praca" ');
  });
  it("po folder: podaje foldery", () => {
    expect(suggestOperators("folder:", ctx).items.map((i) => i.label)).toEqual(["Projekty", "Dom"]);
  });
  it("podpowiada operatory po pierwszych literach", () => {
    expect(suggestOperators("br", ctx).items.map((i) => i.label)).toEqual(["brak:przypomnienia", "brak:etykiety", "brak:folderu"]);
    expect(suggestOperators("zakupy ", ctx).items).toEqual([]);
  });
});

describe("savedFilters", () => {
  it("dodaje, zmienia nazwę i usuwa", () => {
    let l = addFilter([], "  Pilne  ", " etykieta:pilne ", "1");
    expect(l).toEqual([{ id: "1", name: "Pilne", query: "etykieta:pilne" }]);
    l = renameFilter(l, "1", "Bardzo pilne");
    expect(l[0].name).toBe("Bardzo pilne");
    expect(renameFilter(l, "1", "  ")).toBe(l);
    expect(removeFilter(l, "1")).toEqual([]);
  });
  it("odrzuca puste nazwy/zapytania i śmieci z localStorage", () => {
    expect(addFilter([], "", "x", "1")).toEqual([]);
    expect(addFilter([], "x", "  ", "1")).toEqual([]);
    expect(sanitizeFilters([{ id: "a", name: "n", query: "q" }, { id: 1 }, null, { id: "a", name: "dup", query: "q" }])).toHaveLength(1);
    expect(sanitizeFilters("zepsute")).toEqual([]);
  });
});

describe("highlightTokens", () => {
  it("pomija operatory, także polskie, i krótkie słowa", () => {
    expect(highlightTokens("etykieta:praca mleko ma:obraz a")).toEqual(["mleko"]);
    expect(highlightTokens("label:x przypięte kupić mleko")).toEqual(["kupić", "mleko"]);
    expect(highlightTokens("")).toEqual([]);
    expect(highlightTokens(undefined)).toEqual([]);
  });
});

describe("operatory: priorytet, załącznik, brak etykiety/folderu, negacja", () => {
  const base: MatchNote = { labels: [], color: "default", folderId: null, reminder: null, pinned: false, updatedAt: 0 };
  const test = (q: string, note: Partial<MatchNote>) => matchesClauses({ ...base, ...note }, parseSearchQuery(q).clauses);

  it("priorytet i załącznik", () => {
    expect(test("priorytet:wysoki", { priority: "high" })).toBe(true);
    expect(test("priorytet:wysoki", { priority: "low" })).toBe(false);
    expect(test("ma:załącznik", { attachments: [{}] })).toBe(true);
    expect(test("ma:zalacznik", {})).toBe(false);
  });

  it("brak etykiety i folderu", () => {
    expect(test("brak:etykiety", {})).toBe(true);
    expect(test("brak:etykiety", { labels: ["x"] })).toBe(false);
    expect(test("brak:folderu", { folderId: "f" })).toBe(false);
  });

  it("negacja odwraca operator, a zwykły tekst z minusem zostaje tekstem", () => {
    expect(test("-etykieta:praca", { labels: ["praca"] })).toBe(false);
    expect(test("-etykieta:praca", { labels: ["dom"] })).toBe(true);
    expect(parseSearchQuery("-kot").text).toBe("-kot");
  });
});

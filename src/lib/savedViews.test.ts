import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { mergeViewsDump, projectViews, sanitizeView, viewFromCurrent, viewSummary } from "./savedViews";
import { getViewPrefs } from "./viewPrefs";

describe("zapisane widoki", () => {
  it("widok z bieżącego stanu zachowuje źródło, zapytanie i układ", () => {
    const prefs = { ...getViewPrefs(), layout: "table" as const, sortKey: "title" as const, sortDir: "asc" as const, groupBy: "label" as const };
    const v = viewFromCurrent("v1", " Budowa ", { kind: "label", label: "budowa" }, " beton ", prefs, 10)!;
    expect(v).toMatchObject({ name: "Budowa", source: { kind: "label", label: "budowa" }, query: "beton", layout: "table", sortKey: "title", sortDir: "asc", groupBy: "label" });
    expect(viewSummary(v)).toBe("Tabela · #budowa · beton");
  });

  it("wpis od peera: śmieci wracają do domyślnych, bez nazwy — odrzucony", () => {
    expect(sanitizeView("x", { name: "" })).toBeNull();
    expect(sanitizeView("x", "tekst")).toBeNull();
    const v = sanitizeView("x", { name: "A", layout: "<img>", sortKey: "prop:../../", groupBy: "zle", source: { kind: "folder" }, filterColor: 5 })!;
    expect(v).toMatchObject({ layout: "masonry", sortKey: "updated", groupBy: "none", source: { kind: "all" }, filterColor: "all" });
    expect(sanitizeView("x", { name: "A", sortKey: "prop:abc-1" })!.sortKey).toBe("prop:abc-1");
  });

  it("mapa Yjs: kolejność według utworzenia, uszkodzone pominięte", () => {
    const doc = new Y.Doc();
    const map = doc.getMap<unknown>("views");
    map.set("b", { name: "Drugi", createdAt: 2 });
    map.set("a", { name: "Pierwszy", createdAt: 1 });
    map.set("z", { name: "" });
    expect(projectViews(map).map((v) => v.name)).toEqual(["Pierwszy", "Drugi"]);
  });

  it("kopia zapasowa: scalanie przyjmuje poprawne wpisy, odrzuca bez nazwy i nie-tablicę", () => {
    expect(mergeViewsDump("nie tablica")).toBe(0);
    const n = mergeViewsDump([
      { id: "kopia-1", name: "Z kopii", source: { kind: "all" }, query: "beton", layout: "table", sortKey: "updated", sortDir: "desc", groupBy: "none", filterColor: "all", filterLabel: "all", filterHasReminder: false, filterPriority: "all", createdAt: 5 },
      { id: "zly", name: "" },
    ]);
    expect(n).toBe(1);
  });

  it("widoczne kolumny: zapisane z widoku i wracają z wpisu; uszkodzone klucze odpadają", () => {
    const v = sanitizeView("k", { name: "Tabela", tableHidden: ["labels", 5, "x".repeat(200)] })!;
    expect(v.tableHidden).toEqual(["labels"]);
    expect(sanitizeView("k2", { name: "Bez" })!.tableHidden).toEqual([]);
  });
});

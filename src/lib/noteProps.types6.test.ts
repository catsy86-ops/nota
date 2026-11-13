import { describe, expect, it } from "vitest";
import {
  cleanNoteProps, cleanPropDef, comparePropsForSort, filledPropEntries, formatPropValue, makePropDef, parsePropInput, propDisplayText, propValueFor,
  type PropDef,
} from "./noteProps";
import { matchesClauses, parseSearchQuery } from "./searchQuery";

// Plan Notatek 6.1: tak/nie, odnośnik, wiele wyborów, „Utworzono” i „Zmieniono”.
const chk: PropDef = { id: "c", name: "Zapłacone", type: "checkbox", order: 0 };
const url: PropDef = { id: "u", name: "Strona", type: "url", order: 1 };
const multi: PropDef = { id: "m", name: "Tagi", type: "multi", options: ["pilne", "dom", "praca"], order: 2 };
const created: PropDef = { id: "cr", name: "Utworzono", type: "created", order: 3 };
const updated: PropDef = { id: "up", name: "Zmieniono", type: "updated", order: 4 };
const times = { createdAt: Date.UTC(2026, 0, 5, 12), updatedAt: Date.UTC(2026, 10, 12, 12) };

describe("checkbox", () => {
  it("tak zapisuje 1, nie i puste czyszczą, bzdura jest niepoprawna", () => {
    expect(parsePropInput(chk, "Tak")).toBe(1);
    expect(parsePropInput(chk, "1")).toBe(1);
    expect(parsePropInput(chk, "nie")).toBeNull();
    expect(parsePropInput(chk, "")).toBeNull();
    expect(parsePropInput(chk, "może")).toBeUndefined();
  });
  it("wartość z dokumentu: tylko 1 jest zaznaczeniem; pokazuje się jako „Tak”", () => {
    expect(propValueFor(chk, { c: 1 })).toBe(1);
    expect(propValueFor(chk, { c: 0 })).toBeUndefined();
    expect(formatPropValue(chk, { c: 1 })).toBe("Tak");
    expect(formatPropValue(chk, {})).toBe("");
  });
});

describe("url", () => {
  it("przyjmuje http(s) i gołą domenę (dostaje https), odrzuca niebezpieczne schematy", () => {
    expect(parsePropInput(url, "https://example.com/a")).toBe("https://example.com/a");
    expect(parsePropInput(url, "example.com/x")).toBe("https://example.com/x");
    expect(parsePropInput(url, "javascript:alert(1)")).toBeUndefined();
    expect(parsePropInput(url, "data:text/html,x")).toBeUndefined();
    expect(parsePropInput(url, "zwykły tekst")).toBeUndefined();
  });
  it("wartość z dokumentu z niebezpiecznym schematem jest pusta", () => {
    expect(propValueFor(url, { u: "javascript:alert(1)" })).toBeUndefined();
  });
});

describe("multi", () => {
  it("zapisuje wybrane opcje w kolejności opcji pola, a nieznana opcja unieważnia wpis", () => {
    expect(parsePropInput(multi, "praca, pilne")).toBe("pilne\npraca");
    expect(parsePropInput(multi, "pilne, nieznana")).toBeUndefined();
    expect(parsePropInput(multi, "")).toBeNull();
  });
  it("pokazuje po przecinku; opcja usunięta z pola znika z wyniku", () => {
    expect(propDisplayText(multi, "pilne\npraca")).toBe("pilne, praca");
    expect(propValueFor(multi, { m: "pilne\nusunięta" })).toBe("pilne");
    expect(propValueFor(multi, { m: "usunięta" })).toBeUndefined();
  });
  it("definicja czyści opcje z przecinków i nowych linii", () => {
    const def = cleanPropDef({ id: "x", name: "T", type: "multi", options: ["a, b", "c\nd"], order: 0 });
    expect(def?.options).toEqual(["a b", "c d"]);
    expect(makePropDef([], "Tagi", "multi", ["x", "y"])?.options).toEqual(["x", "y"]);
  });
  it("pole bez opcji (typ tekst) nie niesie opcji", () => {
    expect(cleanPropDef({ id: "x", name: "T", type: "text", options: ["a"], order: 0 })?.options).toBeUndefined();
  });
  it("cleanNoteProps trzyma długą wartość wielu wyborów", () => {
    const long = Array.from({ length: 20 }, (_, i) => `opcja-${String(i).padStart(2, "0")}-`.padEnd(40, "x")).join("\n");
    expect(cleanNoteProps({ m: long }).m).toBe(long);
  });
});

describe("created / updated", () => {
  it("wartość idzie z notatki, nie z props, i jest tylko do odczytu", () => {
    expect(propValueFor(created, { cr: "podsunięte" }, times)).toBe(times.createdAt);
    expect(propValueFor(updated, undefined, times)).toBe(times.updatedAt);
    expect(propValueFor(created, undefined)).toBeUndefined();
    expect(parsePropInput(created, "2026-01-01")).toBeUndefined();
    expect(formatPropValue(created, undefined, times)).toMatch(/2026/);
  });
  it("eksport pomija pola tylko do odczytu", () => {
    expect(filledPropEntries([chk, created, updated], { c: 1 })).toEqual([["Zapłacone", "Tak"]]);
  });
  it("sortowanie po dacie utworzenia z dwóch notatek", () => {
    expect(comparePropsForSort(created, undefined, undefined, 1, { createdAt: 1 }, { createdAt: 2 })).toBeLessThan(0);
    expect(comparePropsForSort(created, undefined, undefined, -1, { createdAt: 1 }, { createdAt: 2 })).toBeGreaterThan(0);
  });
});

describe("zapytania pole:", () => {
  const note = { labels: [], color: "default", folderId: null, reminder: null, pinned: false, updatedAt: times.updatedAt, createdAt: times.createdAt, title: "x", content: "", props: { m: "pilne\npraca", c: 1 } };
  const defs = [chk, multi, created];
  const match = (q: string) => matchesClauses(note, parseSearchQuery(q).clauses, { propDefs: defs });
  it("pole:Zapłacone, pole:Tagi=praca, pole:Utworzono>2026-01-01", () => {
    expect(match("pole:Zapłacone")).toBe(true);
    expect(match("pole:Tagi=praca")).toBe(true);
    expect(match("pole:Tagi=dom")).toBe(false);
    expect(match("pole:Utworzono>2026-01-01")).toBe(true);
    expect(match("pole:Utworzono<2026-01-01")).toBe(false);
  });
});

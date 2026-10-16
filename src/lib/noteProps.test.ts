import { describe, expect, it } from "vitest";
import {
  cleanNoteProps,
  comparePropsForSort,
  filledPropEntries,
  type NoteProps,
  cleanPropDef,
  cleanPropDefs,
  formatPropValue,
  makePropDef,
  parsePropInput,
  propNameTaken,
  propValueFor,
  PROP_LIMITS,
  type PropDef,
} from "./noteProps";

const num: PropDef = { id: "n", name: "Kwota", type: "number", order: 0 };
const date: PropDef = { id: "d", name: "Termin", type: "date", order: 1 };
const sel: PropDef = { id: "s", name: "Status", type: "select", options: ["Nowe", "Gotowe"], order: 2 };
const txt: PropDef = { id: "t", name: "Klient", type: "text", order: 3 };

describe("parsePropInput", () => {
  it("pusty tekst czyści pole", () => {
    expect(parsePropInput(txt, "   ")).toBeNull();
  });

  it("liczba akceptuje przecinek dziesiętny", () => {
    expect(parsePropInput(num, "12,5")).toBe(12.5);
    expect(parsePropInput(num, " -3 ")).toBe(-3);
  });

  it("niepoprawna liczba zwraca undefined (bez zmiany)", () => {
    expect(parsePropInput(num, "12zł")).toBeUndefined();
    expect(parsePropInput(num, "1e5")).toBeUndefined();
    expect(parsePropInput(num, "9".repeat(20))).toBeUndefined();
  });

  it("data musi być prawdziwą datą ISO", () => {
    expect(parsePropInput(date, "2026-02-28")).toBe("2026-02-28");
    expect(parsePropInput(date, "2026-02-29")).toBeUndefined();
    expect(parsePropInput(date, "2024-02-29")).toBe("2024-02-29");
    expect(parsePropInput(date, "28.02.2026")).toBeUndefined();
  });

  it("wybór przyjmuje tylko dozwolone opcje", () => {
    expect(parsePropInput(sel, "Gotowe")).toBe("Gotowe");
    expect(parsePropInput(sel, "Inne")).toBeUndefined();
  });

  it("tekst przycina spacje i odrzuca zbyt długi", () => {
    expect(parsePropInput(txt, "  Jan  ")).toBe("Jan");
    expect(parsePropInput(txt, "x".repeat(PROP_LIMITS.text + 1))).toBeUndefined();
  });
});

describe("cleanNoteProps", () => {
  it("zostawia tylko poprawne skalary", () => {
    expect(cleanNoteProps({ a: "tekst", b: 3, c: NaN, d: null, e: { x: 1 }, f: Infinity })).toEqual({ a: "tekst", b: 3 });
  });

  it("nie przyjmuje tablic ani wartości spoza obiektu", () => {
    expect(cleanNoteProps(["x"])).toEqual({});
    expect(cleanNoteProps("zepsute")).toEqual({});
    expect(cleanNoteProps(undefined)).toEqual({});
  });

  it("ogranicza liczbę kluczy", () => {
    const raw: Record<string, number> = {};
    for (let i = 0; i < PROP_LIMITS.defs + 10; i++) raw[`k${i}`] = i;
    expect(Object.keys(cleanNoteProps(raw))).toHaveLength(PROP_LIMITS.defs);
  });
});

describe("propValueFor / formatPropValue", () => {
  it("wartość nie zgodna z typem definicji traktuje jak pustą", () => {
    expect(propValueFor(num, { n: "tekst" })).toBeUndefined();
    expect(formatPropValue(num, { n: "tekst" })).toBe("");
  });

  it("wybór spoza opcji (po edycji listy) nie pokazuje się", () => {
    expect(formatPropValue(sel, { s: "Usunięte" })).toBe("");
    expect(formatPropValue(sel, { s: "Nowe" })).toBe("Nowe");
  });

  it("liczba pokazuje się z polskim przecinkiem", () => {
    expect(formatPropValue(num, { n: 12.5 })).toBe("12,5");
    expect(formatPropValue(txt, { t: "1.5" })).toBe("1.5");
  });

  it("brak właściwości daje pusty napis", () => {
    expect(formatPropValue(txt, undefined)).toBe("");
  });
});

describe("cleanPropDef / cleanPropDefs", () => {
  it("odrzuca definicję bez nazwy, id lub z nieznanym typem", () => {
    expect(cleanPropDef({ id: "x", name: "  ", type: "text", order: 0 })).toBeNull();
    expect(cleanPropDef({ id: "", name: "A", type: "text", order: 0 })).toBeNull();
    expect(cleanPropDef({ id: "x", name: "A", type: "checkbox", order: 0 })).toBeNull();
  });

  it("czyści opcje wyboru: bez pustych, duplikatów i nadmiaru", () => {
    const def = cleanPropDef({ id: "s", name: "S", type: "select", options: [" A ", "", "A", 5, "B"], order: 0 });
    expect(def?.options).toEqual(["A", "B"]);
  });

  it("opcje nie są przechowywane dla innych typów", () => {
    const def = cleanPropDef({ id: "t", name: "T", type: "text", options: ["A"], order: 0 });
    expect(def).not.toHaveProperty("options");
  });

  it("lista bez duplikatów id i posortowana po kolejności", () => {
    const list = cleanPropDefs([
      { id: "b", name: "B", type: "text", order: 2 },
      { id: "a", name: "A", type: "text", order: 1 },
      { id: "a", name: "A2", type: "text", order: 9 },
    ]);
    expect(list.map((d) => d.id)).toEqual(["a", "b"]);
    expect(list[0].name).toBe("A");
  });

  it("nie-tablica daje pustą listę", () => {
    expect(cleanPropDefs({ id: "x" })).toEqual([]);
  });
});

describe("propNameTaken / makePropDef", () => {
  it("nazwa jest zajęta bez względu na wielkość liter, z wyjątkiem własnego id", () => {
    expect(propNameTaken([txt], " klient ")).toBe(true);
    expect(propNameTaken([txt], "klient", txt.id)).toBe(false);
    expect(propNameTaken([txt], "Adres")).toBe(false);
  });

  it("nowa definicja dostaje kolejność za ostatnią", () => {
    const def = makePropDef([num, sel], "Adres", "text", [], "new");
    expect(def).toMatchObject({ id: "new", name: "Adres", type: "text", order: 3 });
  });

  it("nazwa pusta → brak definicji", () => {
    expect(makePropDef([], "   ", "text")).toBeNull();
  });

  it("opcje są brane tylko dla wyboru", () => {
    expect(makePropDef([], "X", "text", ["A"], "id")).not.toHaveProperty("options");
    expect(makePropDef([], "X", "select", ["A"], "id")?.options).toEqual(["A"]);
  });

  it("filledPropEntries: kolejność pól, pominięte puste, liczba z przecinkiem", () => {
    const defs: PropDef[] = [
      { id: "b", name: "Druga", type: "text", order: 1 },
      { id: "a", name: "Pierwsza", type: "number", order: 0 },
      { id: "c", name: "Pusta", type: "date", order: 2 },
    ];
    expect(filledPropEntries(defs, { a: 3.5, b: "tekst" })).toEqual([["Pierwsza", "3,5"], ["Druga", "tekst"]]);
    expect(filledPropEntries(defs, undefined)).toEqual([]);
  });

  it("comparePropsForSort: puste zawsze na końcu, liczby jak liczby, tekst z polskim porządkiem", () => {
    const num: PropDef = { id: "n", name: "Cena", type: "number", order: 0 };
    const txt: PropDef = { id: "t", name: "Nazwa", type: "text", order: 1 };
    const rows: { id: string; p: NoteProps }[] = [{ id: "a", p: { n: 10 } }, { id: "b", p: { n: 9 } }, { id: "c", p: {} }];
    const byNum = (dir: 1 | -1) => [...rows].sort((x, y) => comparePropsForSort(num, x.p, y.p, dir)).map((r) => r.id);
    expect(byNum(1)).toEqual(["b", "a", "c"]);
    expect(byNum(-1)).toEqual(["a", "b", "c"]);
    const names: { id: string; p: NoteProps }[] = [{ id: "x", p: { t: "Żółw" } }, { id: "y", p: { t: "zebra" } }, { id: "z", p: { t: "Ala" } }, { id: "e", p: {} }];
    expect([...names].sort((x, y) => comparePropsForSort(txt, x.p, y.p, 1)).map((r) => r.id)).toEqual(["z", "y", "x", "e"]);
    expect([...names].sort((x, y) => comparePropsForSort(txt, x.p, y.p, -1)).map((r) => r.id)).toEqual(["x", "y", "z", "e"]);
  });
});

import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { cleanTemplate, planInsert, templateFromJob, TEMPLATES_MAX, type QuoteTemplate } from "./quoteTemplates";
import { createYPricing } from "./yPricing";
import { QUOTE_ITEMS_MAX, type QuoteItem } from "./jobs";

const item = (id: string, over: Partial<QuoteItem> = {}): QuoteItem => ({ id, kind: "labor", name: `Poz ${id}`, qty: 1, unit: "usł.", price: 100, order: 0, ...over });
const tpl = (id: string, over: Partial<QuoteTemplate> = {}): QuoteTemplate =>
  ({ id, name: "Łazienka", items: [{ kind: "labor", name: "Montaż", qty: 1, unit: "usł.", price: 100 }], createdAt: 1, ...over });

describe("cleanTemplate", () => {
  it("odrzuca szablon bez nazwy, bez id albo bez poprawnej pozycji", () => {
    expect(cleanTemplate(null, "a")).toBeNull();
    expect(cleanTemplate(tpl("a", { name: "  " }), "a")).toBeNull();
    expect(cleanTemplate(tpl("a"), "")).toBeNull();
    expect(cleanTemplate({ name: "X", items: [{ kind: "labor", name: "", qty: 1, price: 1 }, "śmieć"] }, "a")).toBeNull();
    expect(cleanTemplate({ name: "X", items: "nie tablica" }, "a")).toBeNull();
  });

  it("zostawia poprawne pozycje, odrzuca złe, czyści nazwę, marża tylko poprawna", () => {
    const t = cleanTemplate({ name: " Łazienka\u0007 — biały  montaż ", margin: 15, createdAt: 5,
      items: [{ kind: "material", name: "Bateria", qty: 2, unit: "szt.", price: 250 }, { kind: "labor", name: "", qty: 1, price: 1 }, { kind: "labor", name: "Montaż", qty: 0, price: 1 }] }, "a");
    expect(t).toEqual({ id: "a", name: "Łazienka — biały montaż", margin: 15, createdAt: 5, items: [{ kind: "material", name: "Bateria", qty: 2, unit: "szt.", price: 250 }] });
    expect(cleanTemplate({ ...tpl("a"), margin: 900 }, "a")?.margin).toBeUndefined();
  });

  it("limit pozycji szablonu i długość nazwy", () => {
    const many = Array.from({ length: QUOTE_ITEMS_MAX + 10 }, (_, n) => ({ kind: "labor", name: `P${n}`, qty: 1, unit: "szt.", price: 1 }));
    expect(cleanTemplate({ name: "x".repeat(200), items: many }, "a")).toMatchObject({ name: "x".repeat(60), items: expect.any(Array) });
    expect(cleanTemplate({ name: "x", items: many }, "a")?.items).toHaveLength(QUOTE_ITEMS_MAX);
  });
});

describe("templateFromJob i planInsert", () => {
  it("migawka bierze pozycje w kolejności wyceny, bez id, i marżę", () => {
    const t = templateFromJob({ margin: 20, items: [item("b", { order: 2, name: "Drugi" }), item("a", { order: 1, name: "Pierwszy" })] }, "Szablon", "qt-1", 7)!;
    expect(t.items.map((i) => i.name)).toEqual(["Pierwszy", "Drugi"]);
    expect(t.margin).toBe(20);
    expect(t.createdAt).toBe(7);
    expect(Object.keys(t.items[0]).sort()).toEqual(["kind", "name", "price", "qty", "unit"]);
    expect(templateFromJob({ items: [] }, "Pusty", "qt-2", 1)).toBeNull();
    expect(templateFromJob({ items: [item("a")] }, "  ", "qt-3", 1)).toBeNull();
  });

  it("wstawienie dopisuje za istniejącymi pozycjami z nowymi id; marża tylko gdy wycena jej nie ma", () => {
    const t = tpl("t", { margin: 10, items: [{ kind: "labor", name: "A", qty: 1, unit: "usł.", price: 1 }, { kind: "material", name: "B", qty: 2, unit: "szt.", price: 2 }] });
    let n = 0;
    const plan = planInsert(t, { items: [item("x", { order: 4 })] }, () => `new-${++n}`);
    expect(plan.items.map((i) => [i.id, i.order, i.name])).toEqual([["new-1", 5, "A"], ["new-2", 6, "B"]]);
    expect(plan.skipped).toBe(0);
    expect(plan.margin).toBe(10);
    expect(planInsert(t, { margin: 25, items: [] }, () => "n").margin).toBeUndefined();
  });

  it("limit pozycji wyceny: nadmiar jest pomijany i policzony", () => {
    const full = Array.from({ length: QUOTE_ITEMS_MAX - 1 }, (_, n) => item(`i${n}`, { order: n }));
    const t = tpl("t", { items: [{ kind: "labor", name: "A", qty: 1, unit: "usł.", price: 1 }, { kind: "labor", name: "B", qty: 1, unit: "usł.", price: 1 }] });
    const plan = planInsert(t, { items: full }, () => "n");
    expect(plan.items).toHaveLength(1);
    expect(plan.skipped).toBe(1);
    expect(planInsert(t, { items: [...full, item("last")] }, () => "n").items).toEqual([]);
  });
});

describe("szablony w Yjs (yPricing)", () => {
  it("dwa telefony zapisujące różne szablony scalają się bez strat; usunięcie i cofnięcie", () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    const ya = createYPricing(a);
    const yb = createYPricing(b);
    expect(ya.saveTemplate(tpl("1", { name: "Łazienka" }))).toBe(true);
    expect(yb.saveTemplate(tpl("2", { name: "Kuchnia", createdAt: 2 }))).toBe(true);
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    expect(ya.templates().map((t) => t.name)).toEqual(["Łazienka", "Kuchnia"]);
    const removed = ya.removeTemplate("1")!;
    expect(ya.templates().map((t) => t.name)).toEqual(["Kuchnia"]);
    ya.saveTemplate(removed);
    expect(ya.templates()).toHaveLength(2);
    expect(ya.removeTemplate("nie ma")).toBeNull();
  });

  it("zły szablon i pełna lista są odrzucane; nadpisanie istniejącego id działa także przy pełnej liście", () => {
    const y = createYPricing(new Y.Doc());
    expect(y.saveTemplate(tpl("x", { name: "" }))).toBe(false);
    for (let n = 0; n < TEMPLATES_MAX; n++) expect(y.saveTemplate(tpl(`t${n}`, { createdAt: n + 1 }))).toBe(true);
    expect(y.saveTemplate(tpl("nowy"))).toBe(false);
    expect(y.saveTemplate(tpl("t3", { name: "Zmieniony" }))).toBe(true);
    expect(y.templates().find((t) => t.id === "t3")?.name).toBe("Zmieniony");
  });

  it("zrzut zawiera szablony, scalanie dodaje brakujące i niczego nie nadpisuje", () => {
    const src = createYPricing(new Y.Doc());
    src.saveTemplate(tpl("1", { name: "Z kopii" }));
    src.saveTemplate(tpl("2", { name: "Tylko w kopii", createdAt: 2 }));
    const dump = JSON.parse(JSON.stringify(src.dump()));
    const dst = createYPricing(new Y.Doc());
    dst.saveTemplate(tpl("1", { name: "Lokalny" }));
    dst.mergeDump(dump);
    expect(dst.templates().map((t) => t.name)).toEqual(["Lokalny", "Tylko w kopii"]);
  });
});

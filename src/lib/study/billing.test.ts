import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { billingSummary, cleanModes, money, parseAmount, pointRateFor, stagesTotal, type SiteBilling } from "./billing";
import { createYBilling } from "./yBilling";

const bill = (over: Partial<SiteBilling> = {}): SiteBilling => ({ modes: ["hours"], typeRates: {}, stageAmounts: {}, ...over });

describe("sposób rozliczenia (H3.1)", () => {
  it("parseAmount: przecinek, spacje, „zł”; pusty = usuń; zły = undefined", () => {
    expect(parseAmount("1 250,50")).toBe(1250.5);
    expect(parseAmount("8 000 zł")).toBe(8000);
    expect(parseAmount("150,")).toBe(150);
    expect(parseAmount("  ")).toBeNull();
    expect(parseAmount("12,345")).toBeUndefined();
    expect(parseAmount("abc")).toBeUndefined();
    expect(parseAmount("0")).toBeUndefined();
    expect(parseAmount("99999999")).toBeUndefined();
  });

  it("cleanModes: stała kolejność, bez nieznanych i powtórzeń", () => {
    expect(cleanModes(["lump", "x", "hours", "lump"])).toEqual(["hours", "lump"]);
    expect(cleanModes([])).toEqual([]);
    expect(cleanModes("hours")).toBeUndefined();
  });

  it("stawka typu wygrywa z domyślną; bez obu — brak stawki (H-4)", () => {
    const b = bill({ pointRate: 150, typeRates: { "wc-stelaz": 250 } });
    expect(pointRateFor(b, "wc-stelaz")).toBe(250);
    expect(pointRateFor(b, "umywalka")).toBe(150);
    expect(pointRateFor(bill(), "umywalka")).toBeUndefined();
  });

  it("linia w nagłówku łączy sposoby", () => {
    expect(billingSummary(bill(), 45)).toBe("Godziny 45 zł/h");
    expect(billingSummary(bill({ modes: ["points", "lump"], pointRate: 150, lump: 5000, stageAmounts: { a: 1500, b: 1500 } })))
      .toBe("Od punktu 150 zł · Ryczałt 8000 zł");
    expect(money(12500)).toBe("12 500 zł");
    expect(money(1250.5)).toBe("1250,50 zł");
    expect(billingSummary(bill({ modes: [] }))).toBe("nie wybrano");
    expect(stagesTotal(bill({ stageAmounts: { a: 0.1, b: 0.2 } }))).toBeCloseTo(0.3);
  });
});

describe("rozliczenie w Yjs (H3.1)", () => {
  it("budowa bez zapisu: same godziny; zapis i usunięcie stawek", () => {
    const s = createYBilling(new Y.Doc());
    expect(s.get("site")).toEqual(bill());
    s.setModes("site", ["points", "hours"]);
    expect(s.setPointRate("site", null, 150)).toBe(true);
    expect(s.setPointRate("site", "wc-stelaz", 250.555)).toBe(true);
    expect(s.setPointRate("site", null, -5)).toBe(false);
    s.setLump("site", 8000);
    s.setStageAmount("site", "podejscia", 2000);
    expect(s.get("site")).toEqual({ modes: ["hours", "points"], pointRate: 150, typeRates: { "wc-stelaz": 250.56 }, lump: 8000, stageAmounts: { podejscia: 2000 } });
    s.setLump("site", null);
    s.setPointRate("site", "wc-stelaz", null);
    expect(s.get("site").typeRates).toEqual({});
    expect(s.get("site").lump).toBeUndefined();
    expect(s.get("inna")).toEqual(bill());
  });

  it("get zwraca ten sam obiekt do następnej zmiany", () => {
    const s = createYBilling(new Y.Doc());
    const a = s.get("site");
    expect(s.get("site")).toBe(a);
    s.setLump("site", 100);
    expect(s.get("site")).not.toBe(a);
  });

  it("dwa telefony zmieniające różne stawki scalają się bez strat", () => {
    const a = new Y.Doc(), b = new Y.Doc();
    const sa = createYBilling(a), sb = createYBilling(b);
    sa.setPointRate("site", null, 150);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    sa.setPointRate("site", "wc-stelaz", 250);
    sb.setStageAmount("site", "proba", 1200);
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    for (const s of [sa, sb]) expect(s.get("site")).toMatchObject({ pointRate: 150, typeRates: { "wc-stelaz": 250 }, stageAmounts: { proba: 1200 } });
  });

  it("kopia scala bez nadpisywania; śmieci w kopii są pomijane", () => {
    const s = createYBilling(new Y.Doc());
    s.setModes("site", ["lump"]);
    s.setLump("site", 8000);
    s.setStageAmount("site", "proba", 1200);
    const dump = JSON.parse(JSON.stringify(s.dump()));
    const t = createYBilling(new Y.Doc());
    t.setLump("site", 9000);
    t.mergeDump(dump);
    expect(t.get("site")).toEqual({ modes: ["lump"], lump: 9000, typeRates: {}, stageAmounts: { proba: 1200 } });
    const u = createYBilling(new Y.Doc());
    u.mergeDump({ sites: { site: { modes: "x", lump: "dużo", typeRates: { a: -1 }, stageAmounts: null } } });
    expect(u.get("site")).toEqual(bill());
  });
});

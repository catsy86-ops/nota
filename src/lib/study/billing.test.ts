import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { billingCsv, billingStatement, billingSummary, billingText, cleanModes, cleanPayment, money, parseAmount, pointRateFor, stagesTotal, type BillingInput, type SiteBilling } from "./billing";
import { createYBilling } from "./yBilling";

const bill = (over: Partial<SiteBilling> = {}): SiteBilling => ({ modes: ["hours"], typeRates: {}, stageAmounts: {}, payments: [], ...over });

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
    expect(s.get("site")).toEqual({ modes: ["hours", "points"], pointRate: 150, typeRates: { "wc-stelaz": 250.56 }, lump: 8000, stageAmounts: { podejscia: 2000 }, payments: [] });
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
    expect(t.get("site")).toEqual({ modes: ["lump"], lump: 9000, typeRates: {}, stageAmounts: { proba: 1200 }, payments: [] });
    const u = createYBilling(new Y.Doc());
    u.mergeDump({ sites: { site: { modes: "x", lump: "dużo", typeRates: { a: -1 }, stageAmounts: null } } });
    expect(u.get("site")).toEqual(bill());
  });
});

const input = (over: Partial<BillingInput> = {}): BillingInput => ({
  billing: bill(), minutes: 0, unsplit: 0, points: [], stages: [], typeLabel: (id) => id.toUpperCase(), ...over,
});
const done = (type: string, n: number, isDone = true) => Array.from({ length: n }, () => ({ type, done: isDone }));

describe("należności (H3.2)", () => {
  it.each([
    { name: "godziny × stawka", over: { rate: 45, minutes: 600 }, accrued: 450, lines: ["10 h × 45 zł/h"] },
    { name: "godziny bez stawki — ostrzeżenie, 0 zł", over: { minutes: 90 }, accrued: 0, lines: [], warn: "Brak stawki godzinowej — 1,5 h bez kwoty" },
    { name: "gotowe punkty: stawka typu i domyślna; niegotowe nie liczone",
      over: { billing: bill({ modes: ["points"], pointRate: 150, typeRates: { wc: 250 } }), points: [...done("umyw", 3), ...done("wc", 2), ...done("umyw", 1, false)] },
      accrued: 950, lines: ["3 × 150 zł", "2 × 250 zł"], warn: "Punkty przed białym montażem (jeszcze nie liczone): 1" },
    { name: "punkty bez żadnej stawki", over: { billing: bill({ modes: ["points"] }), points: done("umyw", 2) }, accrued: 0, lines: [], warn: "Gotowe punkty bez stawki: 2" },
    { name: "ryczałt za całość i odhaczony etap; nieodhaczony nie liczony",
      over: { billing: bill({ modes: ["lump"], lump: 8000, stageAmounts: { a: 1500, b: 1000 } }),
        stages: [{ id: "a", name: "Woda", done: new Date(2026, 9, 20).getTime() }, { id: "b", name: "Odbiór" }] },
      accrued: 9500, lines: ["umówiona kwota", "etap odhaczony 20.10.2026"] },
    { name: "wyłączony sposób się nie liczy", over: { billing: bill({ modes: ["lump"], lump: 100 }), rate: 45, minutes: 600 }, accrued: 100, lines: ["umówiona kwota"] },
    { name: "łączone: ryczałt + godziny; dni bez podziału", over: { billing: bill({ modes: ["hours", "lump"], lump: 5000 }), rate: 50, minutes: 150, unsplit: 2 },
      accrued: 5125, lines: ["2,5 h × 50 zł/h", "umówiona kwota"], warn: "Dni z kilkoma budowami bez podziału godzin: 2" },
  ])("$name", ({ over, accrued, lines, warn }) => {
    const st = billingStatement(input(over));
    expect(st.accrued).toBe(accrued);
    expect(st.lines.map((l) => l.detail)).toEqual(lines);
    if (warn) expect(st.warnings).toContain(warn);
  });

  it("wpłaty od najstarszej, zostało = naliczone − otrzymane; nadpłata ujemna", () => {
    const payments = [{ id: "b", day: "2026-10-20", amount: 2000 }, { id: "a", day: "2026-10-01", amount: 1000.1, note: "zaliczka" }];
    const st = billingStatement(input({ billing: bill({ modes: ["lump"], lump: 5000, payments }) }));
    expect(st.payments.map((p) => p.id)).toEqual(["a", "b"]);
    expect([st.paid, st.due]).toEqual([3000.1, 1999.9]);
    expect(billingStatement(input({ billing: bill({ modes: ["lump"], lump: 500, payments }) })).due).toBe(-2500.1);
  });

  it("grosze bez błędów zmiennoprzecinkowych", () => {
    const st = billingStatement(input({ billing: bill({ modes: ["points"], pointRate: 0.1 }), points: done("x", 3) }));
    expect(st.accrued).toBe(0.3);
  });

  it("tekst do WhatsAppa i CSV", () => {
    const st = billingStatement(input({ billing: bill({ modes: ["lump"], lump: 8000, payments: [{ id: "a", day: "2026-10-01", amount: 3000, note: "=zaliczka" }] }) }));
    const text = billingText("Lipowa 5", st, "2026-10-22");
    expect(text).toContain("*Rozliczenie — Lipowa 5*\nstan na 22.10.2026");
    expect(text).toContain("• Ryczałt za budowę: umówiona kwota = 8000 zł");
    expect(text).toContain("• 01.10.2026: 3000 zł (=zaliczka)");
    expect(text).toContain("*Zostało do zapłaty: 5000 zł*");
    const csv = billingCsv(st);
    expect(csv.startsWith("﻿Rodzaj;Pozycja;Szczegóły;Kwota (zł)\r\n")).toBe(true);
    expect(csv).toContain("Otrzymane;2026-10-01;'=zaliczka;3000");
    expect(csv).toContain("Razem;Zostało do zapłaty;;5000");
  });

  it("cleanPayment: zły dzień, kwota, za długa notatka", () => {
    expect(cleanPayment({ day: "2026-10-1", amount: 5 }, "a")).toBeNull();
    expect(cleanPayment({ day: "2026-10-01", amount: 0 }, "a")).toBeNull();
    expect(cleanPayment({ day: "2026-10-01", amount: 5, note: "  xy  ".repeat(40) }, "a")?.note?.length).toBe(80);
  });

  it("wpłaty w Yjs: dodanie, usunięcie, scalanie dwóch telefonów i kopia", () => {
    const a = new Y.Doc(), b = new Y.Doc();
    const sa = createYBilling(a), sb = createYBilling(b);
    expect(sa.addPayment("site", { id: "p1", day: "2026-10-01", amount: 1000 })).toBe(true);
    expect(sa.addPayment("site", { id: "p2", day: "zły", amount: 1000 })).toBe(false);
    sb.addPayment("site", { id: "p3", day: "2026-09-30", amount: 500, note: "gotówka" });
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    Y.applyUpdate(a, Y.encodeStateAsUpdate(b));
    for (const s of [sa, sb]) expect(s.get("site").payments.map((p) => p.id)).toEqual(["p3", "p1"]);
    sa.removePayment("site", "p3");
    expect(sa.get("site").payments).toEqual([{ id: "p1", day: "2026-10-01", amount: 1000 }]);
    const t = createYBilling(new Y.Doc());
    t.mergeDump(JSON.parse(JSON.stringify(sb.dump())));
    t.mergeDump({ sites: { site: { payments: [{ id: "x", day: "nie", amount: 5 }, null] } } });
    expect(t.get("site").payments.map((p) => p.id)).toEqual(["p3", "p1"]);
  });
});

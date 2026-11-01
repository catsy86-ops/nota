import { describe, expect, it } from "vitest";
import { buildSummary, shortageItems } from "./summary";
import { csvCell, summaryCsv, summaryFileName } from "./csv";
import type { DetectedSymbol, MaterialItem, PipeRoute } from "./model";

const route = (id: string, len: number, over: Partial<PipeRoute> = {}): PipeRoute => ({ id, system: "cold", diameterMm: 16, pts: [0, 0, len, 0], source: "manual", verified: true, at: 1, ...over });
const sym = (id: string, over: Partial<DetectedSymbol> = {}): DetectedSymbol => ({ id, type: "elbow", x: 0, y: 0, system: "cold", manual: false, verified: true, at: 1, ...over });
const cal = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, meters: 1, at: 1 }; // 1 m = 100 px
const item: MaterialItem = { id: "i1", category: "armatura", description: "Zawór kulowy 1/2\"", quantity: 3, unit: "szt", verified: true, at: 1 };

describe("zestawienie materiałów (faza 7)", () => {
  it("grupuje rury po instalacji i średnicy, osobno potwierdzone, szacunkowe i do weryfikacji", () => {
    const s = buildSummary({
      routes: [route("a", 500), route("b", 250), route("c", 300, { diameterMm: 20 }), route("d", 1000, { estimate: true }), route("e", 700, { verified: false }), route("f", 200, { system: "hot" })],
      symbols: [], items: [], calibration: cal,
    });
    expect(s.pipes.confirmed.map((r) => [r.system, r.diameterMm, r.meters, r.routeIds])).toEqual([
      ["cold", 16, 7.5, ["a", "b"]], ["cold", 20, 3, ["c"]], ["hot", 16, 2, ["f"]],
    ]);
    expect(s.pipes.estimated.map((r) => r.meters)).toEqual([10]);
    expect(s.pipes.unverified.map((r) => r.routeIds)).toEqual([["e"]]);
    expect(s.pipes.noScale).toEqual([]);
  });

  it("bez skali: tylko piksele, metry null — nigdy wymyślone", () => {
    const s = buildSummary({ routes: [route("a", 500)], symbols: [], items: [], calibration: null });
    expect(s.hasScale).toBe(false);
    expect(s.pipes.noScale).toEqual([expect.objectContaining({ meters: null, pixels: 500 })]);
    expect(s.pipes.confirmed).toEqual([]);
    expect(shortageItems(s)).toEqual([]);
  });

  it("symbole: zatwierdzone w sztukach, niezatwierdzone osobno", () => {
    const s = buildSummary({ routes: [], symbols: [sym("1"), sym("2"), sym("3", { verified: false }), sym("4", { type: "tee" })], items: [], calibration: cal });
    expect(s.symbols.verified.map((r) => [r.type, r.count])).toEqual([["elbow", 2], ["tee", 1]]);
    expect(s.symbols.unverified.map((r) => [r.type, r.count])).toEqual([["elbow", 1]]);
  });

  it("do braków w Pracy idą tylko pozycje pewne: potwierdzone rury, zatwierdzone symbole i pozycje", () => {
    const s = buildSummary({
      routes: [route("a", 1234), route("d", 1000, { estimate: true }), route("e", 700, { verified: false })],
      symbols: [sym("1"), sym("2", { verified: false })], items: [item, { ...item, id: "i2", verified: false }], calibration: cal,
    });
    expect(shortageItems(s)).toEqual([
      { text: "Rura ZW Ø16", qty: "12,34 m" },
      { text: "Kolano ZW", qty: "1 szt." },
      { text: "Zawór kulowy 1/2\"", qty: "3 szt." },
    ]);
  });
});

describe("CSV zestawienia", () => {
  it("średnik, BOM, CRLF, przecinek dziesiętny", () => {
    const csv = summaryCsv(buildSummary({ routes: [route("a", 1234)], symbols: [], items: [], calibration: cal }), "Parter");
    expect(csv.startsWith("\uFEFFAnaliza;Parter\r\n")).toBe(true);
    expect(csv).toContain("Rury — pomiar potwierdzony;Rura ZW Ø16;Zimna woda;16;12,34;m;1 tras\r\n");
  });

  it("bez skali: jednostka px i uwaga", () => {
    const csv = summaryCsv(buildSummary({ routes: [route("a", 500)], symbols: [], items: [], calibration: null }), "P");
    expect(csv).toContain(";500;px;1 tras, plan bez skali — długość w pikselach");
  });

  it("ochrona przed formułami i cudzysłowy", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+48 600")).toBe("'+48 600");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("a;b")).toBe("\"a;b\"");
    expect(csvCell(2.5)).toBe("2,5");
    expect(summaryFileName("Dom: parter/łazienka")).toBe("Zestawienie - Dom parter łazienka.csv");
  });
});

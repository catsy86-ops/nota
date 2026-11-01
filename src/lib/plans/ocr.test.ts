import { describe, expect, it } from "vitest";
import { interpretOcrText, normalizeOcrText, parseDiameter, parseSymbolCode, parseSystemCode } from "./diameters";
import { dedupeWords, tileGrid, tileToImage } from "./tiles";
import { suggestDiameters } from "./assign";
import type { DetectedText } from "./model";

describe("średnice z opisów planu", () => {
  it("Ø, ø, ⌀, φ i DN — pewne", () => {
    for (const s of ["Ø16", "ø16", "⌀ 16", "φ16", "Ø 16 ZW"]) expect(parseDiameter(s)).toEqual({ mm: 16, form: "Ø", confidence: 1 });
    expect(parseDiameter("DN25")).toEqual({ mm: 25, form: "DN", confidence: 1 });
    expect(parseDiameter("dn 110")).toEqual({ mm: 110, form: "DN", confidence: 1 });
    expect(parseDiameter("Ø20,5")?.mm).toBe(20.5);
  });

  it("wymiar rury 16x2 i 110×3,2", () => {
    expect(parseDiameter("PE-X 16x2")).toEqual({ mm: 16, form: "dim", confidence: 0.85 });
    expect(parseDiameter("PVC 110×3,2")?.mm).toBe(110);
  });

  it("typowe błędy OCR (0, O, @ zamiast Ø) — tylko typowe średnice, z niższą pewnością", () => {
    expect(parseDiameter("016")).toEqual({ mm: 16, form: "guess", confidence: 0.6 });
    expect(parseDiameter("O20 CWU")).toEqual({ mm: 20, form: "guess", confidence: 0.6 });
    expect(parseDiameter("@32")?.mm).toBe(32);
    // 017 nie jest typową średnicą, a zwykłe liczby (wymiary pokoju, numery) to nie średnice.
    expect(parseDiameter("017")).toBeNull();
    expect(parseDiameter("2,45")).toBeNull();
    expect(parseDiameter("Pokój 12")).toBeNull();
  });

  it("normalizacja znaków", () => {
    expect(normalizeOcrText("  ⌀16  ×  2 ")).toBe("Ø16 x 2");
  });

  it("oznaczenia instalacji i punktów poboru", () => {
    expect(parseSystemCode("ZW")).toBe("cold");
    expect(parseSystemCode("Ø16 CWU")).toBe("hot");
    expect(parseSystemCode("C")).toBe("hot");
    expect(parseSystemCode("Ciąg C2")).toBeNull();
    expect(parseSystemCode("ZCO 20")).toBe("heating");
    expect(parseSystemCode("KAN 110")).toBe("sewage");
    expect(parseSymbolCode("WC")).toBe("outlet");
    expect(parseSymbolCode("Umywalka")).toBe("outlet");
    expect(interpretOcrText("Salon")).toBeNull();
    expect(interpretOcrText("Ø16 ZW")).toMatchObject({ diameter: { mm: 16 }, system: "cold" });
  });
});

describe("kafle OCR", () => {
  it("siatka pokrywa obraz z zakładką i nie wychodzi poza krawędź", () => {
    const tiles = tileGrid(5000, 1000, 2048, 144);
    expect(tiles.map((t) => t.x)).toEqual([0, 1904, 2952]);
    expect(tiles.every((t) => t.x + t.w <= 5000 && t.y + t.h <= 1000)).toBe(true);
    expect(tileGrid(800, 600)).toEqual([{ x: 0, y: 0, w: 800, h: 600 }]);
  });

  it("prostokąt z kafla kopii roboczej → piksele oryginału", () => {
    expect(tileToImage({ x: 1904, y: 0, w: 2048, h: 1000 }, { x: 10, y: 20, w: 30, h: 8 }, 2)).toEqual({ x: 3828, y: 40, w: 60, h: 16 });
  });

  it("słowo z zakładki zostaje raz — pewniejsze", () => {
    const words = [
      { text: "Ø16", confidence: 0.9, box: { x: 100, y: 100, w: 40, h: 12 } },
      { text: "Ø1", confidence: 0.5, box: { x: 100, y: 100, w: 30, h: 12 } },
      { text: "ZW", confidence: 0.8, box: { x: 300, y: 100, w: 20, h: 12 } },
    ];
    expect(dedupeWords(words).map((w) => w.text).sort()).toEqual(["ZW", "Ø16"]);
  });
});

describe("podpowiedź średnicy dla trasy", () => {
  const text = (id: string, t: string, x: number, y: number, verified = true): DetectedText => ({ id, raw: t, text: t, box: [x, y, 40, 12], confidence: 0.9, verified, at: 1 });

  it("najbliższy opis ze średnicą w promieniu; dalsze i bez średnicy pomija", () => {
    const route = { pts: [0, 0, 1000, 0] };
    const s = suggestDiameters(route, [text("a", "Ø16", 480, -20), text("b", "Ø20", 100, 300), text("c", "Salon", 500, -10), text("d", "DN25", 700, 30, false)], 60);
    expect(s.map((x) => [x.textId, x.mm])).toEqual([["a", 16], ["d", 25]]);
    expect(s[1].confidence).toBe(0.9);
  });
});

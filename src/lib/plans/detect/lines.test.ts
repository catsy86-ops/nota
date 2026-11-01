import { describe, expect, it } from "vitest";
import { colorMask, detectLines, hexToRgb, rgbToHex, simplify, skeletonize } from "./lines";

/** Białe płótno RGBA z prostymi „rysunkami” w kolorze. */
function canvas(w: number, h: number) {
  const px = new Uint8ClampedArray(w * h * 4).fill(255);
  const rect = (x0: number, y0: number, x1: number, y1: number, [r, g, b]: [number, number, number]) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = (y * w + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; }
  };
  return { px, rect };
}

const BLUE: [number, number, number] = [21, 101, 192];
const BLACK: [number, number, number] = [20, 20, 20];

describe("propozycje tras po kolorze (faza 5)", () => {
  it("kolory: hex ↔ rgb", () => {
    expect(hexToRgb("#1565c0")).toEqual([21, 101, 192]);
    expect(rgbToHex(21, 101, 192)).toBe("#1565c0");
    expect(hexToRgb("zły")).toBeNull();
  });

  it("maska bierze odcień rury, a nie czarną ścianę ani biel", () => {
    const { px, rect } = canvas(20, 10);
    rect(0, 2, 19, 3, BLUE);
    rect(0, 7, 19, 8, BLACK);
    // Jaśniejszy brzeg linii (antyaliasing) też należy do rury.
    rect(0, 4, 19, 4, [120, 160, 220]);
    const m = colorMask(px, 20, 10, "#1565c0", 0.25);
    const row = (y: number) => [...m.slice(y * 20, y * 20 + 20)].every(Boolean);
    expect([row(2), row(3), row(4), row(7), row(0)]).toEqual([true, true, true, false, false]);
  });

  it("szkielet grubej linii ma grubość 1 px", () => {
    const { px, rect } = canvas(40, 12);
    rect(2, 4, 37, 8, BLUE);
    const skel = skeletonize(colorMask(px, 40, 12, "#1565c0", 0.25), 40, 12);
    for (let x = 8; x < 32; x++) {
      let n = 0;
      for (let y = 0; y < 12; y++) n += skel[y * 40 + x];
      expect(n).toBe(1);
    }
  });

  it("rura w kształcie L: jedna propozycja z narożnikiem, długość jak na rysunku; ściana i opis odpadają", () => {
    const w = 300, h = 220;
    const { px, rect } = canvas(w, h);
    rect(20, 30, 260, 33, BLUE); // poziomo 240 px
    rect(257, 30, 260, 190, BLUE); // pionowo 160 px
    rect(10, 205, 290, 208, BLACK); // ściana w innym kolorze
    rect(40, 120, 70, 122, BLUE); // „litera” niebieskiego opisu w ramce
    const found = detectLines(px, w, h, { color: "#1565c0", tolerance: 0.25, minLength: 20, ignore: [{ x: 30, y: 110, w: 50, h: 20 }] });
    expect(found).toHaveLength(1);
    const [route] = found;
    expect(route.length).toBeGreaterThan(370);
    expect(route.length).toBeLessThan(420);
    // Łamana uproszczona do kilku punktów (początek, narożnik, koniec).
    expect(route.pts.length / 2).toBeLessThanOrEqual(5);
    expect(route.confidence).toBeGreaterThan(0.5);
  });

  it("krótkie kreski poniżej progu odpadają", () => {
    const { px, rect } = canvas(100, 40);
    rect(10, 10, 20, 12, BLUE);
    expect(detectLines(px, 100, 40, { color: "#1565c0", tolerance: 0.25, minLength: 30 })).toEqual([]);
  });

  it("upraszczanie zostawia narożniki, usuwa punkty na prostej", () => {
    expect(simplify([0, 0, 5, 0, 10, 0, 10, 5, 10, 10], 0.5)).toEqual([0, 0, 10, 0, 10, 10]);
  });
});

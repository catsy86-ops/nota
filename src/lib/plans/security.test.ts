import { describe, expect, it } from "vitest";
import { mayLeaveDevice, sizeCappedRefsIn } from "./planRefs";
import { checkStoredPlanImage } from "./imageSniff";
import { cleanPlanImage } from "./model";
import { joinPolylines } from "./detect/lines";

const png = (w: number, h: number, size = 100) => {
  const b = new Uint8Array(Math.max(size, 33));
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b.buffer;
};

describe("Plany — poprawki po przeglądzie bezpieczeństwa", () => {
  it("W1: bajty spod klucza planu ponad 2 MB nie wychodzą z urządzenia, niezależnie od rozmiaru w danych", () => {
    const plan = new Set(["a".repeat(64)]);
    expect(mayLeaveDevice("a".repeat(64), 1_000_000, plan)).toBe(true);
    expect(mayLeaveDevice("a".repeat(64), 5_000_000, plan)).toBe(false);
    // Zwykłe zdjęcie spoza planów — tylko limit peera.
    expect(mayLeaveDevice("b".repeat(64), 5_000_000, plan)).toBe(true);
    expect(mayLeaveDevice("b".repeat(64), 25 * 1024 * 1024, plan)).toBe(false);
  });

  it("podpis klienta (P2.4) też ma limit 2 MB: obca karta nie wymusi wysłania dużego pliku", () => {
    const sig = "c".repeat(64);
    const maps: Record<string, Map<string, unknown>> = {
      studySites: new Map([["s1", { signature: { image: sig, name: "Jan", at: 1 } }]]),
    };
    const doc = { getMap: (name: string) => maps[name] ?? new Map() };
    const capped = sizeCappedRefsIn(doc);
    expect(capped.has(sig)).toBe(true);
    expect(mayLeaveDevice(sig, 50_000, capped)).toBe(true);
    expect(mayLeaveDevice(sig, 5_000_000, capped)).toBe(false);
  });

  it("W2: zapisane bajty sprawdzane przed dekodowaniem — bomba, zły typ i niezgodne wymiary odpadają", () => {
    expect(checkStoredPlanImage(png(1600, 900), { w: 1600, h: 900 })).toMatchObject({ w: 1600, h: 900 });
    // Obrót EXIF: przeglądarka zamienia boki — też pasuje.
    expect(checkStoredPlanImage(png(900, 1600), { w: 1600, h: 900 })).not.toBeNull();
    // Mały plik, który rozpakowałby się do 50 000 × 50 000 px.
    expect(checkStoredPlanImage(png(50_000, 50_000), { w: 50_000, h: 50_000 })).toBeNull();
    expect(checkStoredPlanImage(png(1600, 900), { w: 800, h: 450 })).toBeNull();
    expect(checkStoredPlanImage(new TextEncoder().encode("<svg onload=alert(1)>").buffer as ArrayBuffer)).toBeNull();
    expect(cleanPlanImage({ ref: "a".repeat(64), type: "image/png", size: 1, w: 12_000, h: 12_000 })).toBeUndefined();
  });

  it("D1: łączenie odcinków jest liniowe — 10 000 kawałków rury w ułamku sekundy", () => {
    const pieces = Array.from({ length: 10_000 }, (_, i) => ({ pts: [i * 10, 0, i * 10 + 9, 0], length: 9, confidence: 0.5 }));
    // Pomieszana kolejność: łączenie nie może zależeć od tego, że kawałki leżą po kolei.
    pieces.sort((a, b) => ((a.pts[0] * 7919) % 10007) - ((b.pts[0] * 7919) % 10007));
    const t0 = performance.now();
    const joined = joinPolylines(pieces, 2);
    expect(performance.now() - t0).toBeLessThan(1500);
    expect(joined).toHaveLength(1);
    expect(joined[0].length).toBeCloseTo(99_999, 0);
  });
});

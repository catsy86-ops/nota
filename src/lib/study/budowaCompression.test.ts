import { describe, it, expect } from "vitest";
import {
  compressBudowa,
  decompressBudowa,
  compressionRatio,
} from "./budowaCompression";

describe("budowaCompression", () => {
  const testData = JSON.stringify({
    id: "site-123",
    name: "Lipowa 5",
    address: "ul. Lipowa 5, Warszawa",
    entries: Array(100).fill({
      text: "Przeprowadzono inspekcję kanalizacji, brak wycieku. Temperatura 22°C.",
      createdAt: 1699680000000,
      images: ["img1", "img2", "img3"],
    }),
  });

  it("compressBudowa: tworzy blob typu application/budowa-compressed", async () => {
    const blob = await compressBudowa(testData);
    expect(blob.type).toBe("application/budowa-compressed");
  });

  it("compressBudowa: zmniejsza rozmiar dla dużych danych", async () => {
    const blob = await compressBudowa(testData);
    const compressedSize = blob.size;
    const originalSize = new Blob([testData]).size;

    expect(compressedSize).toBeLessThan(originalSize);
  });

  it("decompressBudowa: odczytuje skompresowane dane", async () => {
    const blob = await compressBudowa(testData);
    const decompressed = await decompressBudowa(blob);
    expect(decompressed).toBe(testData);
  });

  it("decompressBudowa: obsługuje stary format v1 (JSON bez kompreji)", async () => {
    const blob = new Blob([testData], { type: "application/json" });
    const decompressed = await decompressBudowa(blob);
    expect(decompressed).toBe(testData);
  });

  it("decompressBudowa: zwraca null dla uszkodzonych danych", async () => {
    const corrupt = new Blob([new Uint8Array([0xff, 0xff, 0xff])]);
    const result = await decompressBudowa(corrupt);
    expect(result).toBeNull();
  });

  it("compressionRatio: oblicza procent oszczędności", () => {
    const ratio = compressionRatio(1000, 400);
    expect(ratio).toBe(60); // 60% mniejszy
  });

  it("compressionRatio: zwraca 0 dla równych rozmiarów", () => {
    const ratio = compressionRatio(1000, 1000);
    expect(ratio).toBe(0);
  });

  it("compressionRatio: zwraca 0 dla oryginalnego rozmiaru 0", () => {
    const ratio = compressionRatio(0, 100);
    expect(ratio).toBe(0);
  });

  it("roundtrip: kompresja + dekompresja zwraca oryginalne dane", async () => {
    const data1 = "test data 1";
    const data2 = "a".repeat(1000); // duży blok powtórzony

    for (const data of [data1, data2]) {
      const blob = await compressBudowa(data);
      const decompressed = await decompressBudowa(blob);
      expect(decompressed).toBe(data);
    }
  });
});

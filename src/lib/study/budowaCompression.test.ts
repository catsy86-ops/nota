import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import {
  compressBudowa,
  decompressBudowa,
  compressionRatio,
} from "./budowaCompression";

describe("budowaCompression", () => {
  // jsdom nie ma Blob.stream()/arrayBuffer() — używamy natywnego Blob z Node.
  beforeAll(() => { vi.stubGlobal("Blob", NodeBlob); });
  afterAll(() => { vi.unstubAllGlobals(); });

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
    const corrupt = new Blob([new Uint8Array([0x42, 0x44, 0x57, 0xff, 0xff, 0xff])]);
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

  it("decompressBudowa: odrzuca bombę gzip i zły nagłówek", async () => {
    const big = await compressBudowa("x".repeat(1000));
    const bytes = new Uint8Array(await big.arrayBuffer());
    // metadane zaniżają rozmiar → rozpakowanie przekracza deklarację
    const meta = JSON.stringify({ version: 2, timestamp: 1, originalSize: 10 });
    const mb = new TextEncoder().encode(meta);
    const metaEnd = 5 + new DataView(bytes.buffer, bytes.byteOffset).getUint16(3, true);
    const forged = new Uint8Array(5 + mb.length + (bytes.length - metaEnd));
    forged.set(bytes.subarray(0, 3), 0);
    new DataView(forged.buffer).setUint16(3, mb.length, true);
    forged.set(mb, 5);
    forged.set(bytes.subarray(metaEnd), 5 + mb.length);
    expect(await decompressBudowa(new NodeBlob([forged]) as unknown as Blob)).toBeNull();
    // obcięty nagłówek
    expect(await decompressBudowa(new NodeBlob([bytes.subarray(0, 4)]) as unknown as Blob)).toBeNull();
  });
});

describe("budowaCompression — limity (T28)", () => {
  beforeAll(() => { vi.stubGlobal("Blob", NodeBlob); });
  afterAll(() => { vi.unstubAllGlobals(); });
  it("prawdziwa bomba: nagłówek zgodny z rozmiarem, ale dane ponad limit po rozpakowaniu → null", async () => {
    const { DECOMPRESSED_MAX_BYTES } = await import("./budowaCompression");
    const bomb = await compressBudowa("x".repeat(DECOMPRESSED_MAX_BYTES + 1000));
    expect(bomb.size).toBeLessThan(1_000_000); // kilkadziesiąt MB powtórzeń mieści się w kilkudziesięciu KB
    expect(await decompressBudowa(bomb)).toBeNull();
  }, 30_000);

  it("zwykły JSON (format v1, bez nagłówka) wczytuje się bez zmian", async () => {
    const json = JSON.stringify({ v: 1, a: "zażółć" });
    expect(await decompressBudowa(new Blob([json]))).toBe(json);
  });

  it("próg kompresji jest zdefiniowany na 1 MB (mniejsze paczki zostają JSON-em)", async () => {
    const { COMPRESS_MIN_BYTES } = await import("./budowaCompression");
    expect(COMPRESS_MIN_BYTES).toBe(1_000_000);
  });
});


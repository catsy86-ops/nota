import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanCode, hasBarcodeDetector, resetBarcodeDetectorForTests, scanBarcode } from "./barcode";

const video = (readyState = 4) => ({ readyState }) as unknown as HTMLVideoElement;

beforeEach(() => resetBarcodeDetectorForTests());
afterEach(() => { delete (window as { BarcodeDetector?: unknown }).BarcodeDetector; vi.restoreAllMocks(); });

describe("barcode", () => {
  it("cleanCode: czyści znaki sterujące i spacje, ucina do 64 znaków", () => {
    expect(cleanCode("  5901234567890\n")).toBe("5901234567890");
    expect(cleanCode("A\u0000B\tC")).toBe("A B C");
    expect(cleanCode("x".repeat(200))).toHaveLength(64);
  });

  it("bez BarcodeDetector: brak wsparcia i null ze skanowania", async () => {
    expect(hasBarcodeDetector()).toBe(false);
    expect(await scanBarcode(video())).toBeNull();
  });

  it("zwraca pierwszy niepusty kod, prosi tylko o obsługiwane formaty i używa jednego detektora", async () => {
    const ctor = vi.fn(function (this: { detect: unknown }) { this.detect = vi.fn().mockResolvedValue([{ rawValue: "  ", format: "ean_13" }, { rawValue: " 5901234567890 ", format: "ean_13" }]); });
    (ctor as unknown as { getSupportedFormats: () => Promise<string[]> }).getSupportedFormats = async () => ["ean_13", "qr_code", "aztec"];
    (window as { BarcodeDetector?: unknown }).BarcodeDetector = ctor;
    expect(hasBarcodeDetector()).toBe(true);
    expect(await scanBarcode(video())).toBe("5901234567890");
    expect(await scanBarcode(video())).toBe("5901234567890");
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(ctor).toHaveBeenCalledWith({ formats: ["ean_13", "qr_code"] });
  });

  it("wideo bez klatki i błąd detektora dają null, nie wyjątek", async () => {
    const ctor = vi.fn(function (this: { detect: unknown }) { this.detect = vi.fn().mockRejectedValue(new Error("boom")); });
    (window as { BarcodeDetector?: unknown }).BarcodeDetector = ctor;
    expect(await scanBarcode(video(0))).toBeNull(); // readyState < 2: kamera jeszcze nie wystartowała
    expect(await scanBarcode(video())).toBeNull();
  });
});

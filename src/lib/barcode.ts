/**
 * Skaner kodów QR i kreskowych (EAN z opakowania kształtki, numer seryjny, QR naklejki). B3.5.
 * Natywny `BarcodeDetector` (Chrome na Androidzie); bez niego okno skanera pokazuje wpis ręczny.
 */
import { safeLine } from "@/lib/safeText";

interface BarcodeDetectorOptions {
  formats?: string[];
}

interface BarcodeDetectionResult {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorLike {
  detect(image: ImageBitmapSource): Promise<BarcodeDetectionResult[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: BarcodeDetectorOptions): BarcodeDetectorLike;
  getSupportedFormats?(): Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

/** Formaty, o które prosimy (przecięte z tym, co przeglądarka umie). EAN/UPC to kody z opakowań. */
export const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"] as const;
export const CODE_MAX = 64;

export const hasBarcodeDetector = (): boolean => typeof window !== "undefined" && "BarcodeDetector" in window;

/** Kod z dowolnego wejścia (skan, wpis ręczny): bez znaków sterujących i spacji na brzegach, najwyżej 64 znaki. */
export const cleanCode = (raw: string): string => safeLine(raw).slice(0, CODE_MAX);

let detector: BarcodeDetectorLike | null = null;

async function getDetector(): Promise<BarcodeDetectorLike | null> {
  if (typeof window === "undefined" || !window.BarcodeDetector) return null;
  if (detector) return detector;
  let formats: string[] = [...BARCODE_FORMATS];
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats?.();
    if (supported?.length) formats = formats.filter((f) => supported.includes(f));
  } catch { /* zostają wszystkie formaty — detektor sam pominie nieobsługiwane */ }
  detector = new window.BarcodeDetector({ formats });
  return detector;
}

/** Skanuje bieżącą klatkę podglądu kamery; zwraca pierwszy znaleziony kod albo `null`. */
export async function scanBarcode(video: HTMLVideoElement): Promise<string | null> {
  try {
    const d = await getDetector();
    if (!d || video.readyState < 2) return null;
    const found = await d.detect(video);
    for (const r of found) { const code = cleanCode(r.rawValue ?? ""); if (code) return code; }
    return null;
  } catch {
    return null;
  }
}

/** Żąda dostępu do kamery z tyłu; `null` = odmowa albo brak kamery. */
export async function requestCamera(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch {
    return null;
  }
}

/** Tylko do testów: zapomina utworzony detektor (podmiana `window.BarcodeDetector`). */
export const resetBarcodeDetectorForTests = () => { detector = null; };

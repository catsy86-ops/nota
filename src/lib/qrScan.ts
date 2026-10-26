import { CODE_ALPHABET, CODE_LENGTH, normalizeCode } from "@/lib/yjsSync";

/** Minimalny kształt `BarcodeDetector` (Chrome na Androidzie); w TypeScript-ie lib.dom go nie ma. */
interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

export function barcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === "function" ? ctor : null;
}

/**
 * Tekst z kodu QR (sam kod albo link `?pair=…`) → kod grupy; `null`, gdy to nie wygląda na kod grupy.
 * Inaczej niż przy wklejaniu: tu cały odczytany tekst musi być kodem, bo skaner nie ma wycinać „zdania”.
 */
export function codeFromScan(text: string): string | null {
  const fromLink = text.match(/[?&]pair=([^&#\s]+)/)?.[1];
  const candidate = normalizeCode(fromLink ?? text);
  if (candidate.length !== CODE_LENGTH || ![...candidate].every((c) => CODE_ALPHABET.includes(c))) return null;
  return candidate;
}

/**
 * Zdjęcie z galerii → tekst kodu. Najpierw `BarcodeDetector`; gdy go nie ma (iPhone, Firefox),
 * jsQR — ładowany dopiero tutaj, więc nie wchodzi do paczki startowej.
 */
export async function decodeQrImage(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file);
  const Detector = barcodeDetectorCtor();
  if (Detector) {
    const hits = await new Detector({ formats: ["qr_code"] }).detect(bitmap);
    return hits[0]?.rawValue ?? null;
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(pixels.data, pixels.width, pixels.height)?.data ?? null;
}

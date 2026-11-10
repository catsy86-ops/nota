/**
 * Skaner kodów QR/kreskowych do numeru seryjnego, katalogowego czy kodu na pudełku.
 * BarcodeDetector API (Chrome Android). Fallback: ręczny wpis. (B3.5)
 */

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
  getSupportedFormats(): Promise<string[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

export const hasBarcodeDetector = (): boolean => {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
};

/** Skanuje obraz z kamery, zwraca pierwszy znaleziony kod. */
export async function scanBarcode(video: HTMLVideoElement): Promise<string | null> {
  try {
    if (!hasBarcodeDetector() || !window.BarcodeDetector) return null;

    const detector = new window.BarcodeDetector({
      formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39"],
    });

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    const results = await detector.detect(canvas);
    if (results.length > 0) {
      return results[0].rawValue;
    }
    return null;
  } catch {
    return null;
  }
}

/** Żąda dostępu do kamery. */
export async function requestCamera(): Promise<MediaStream | null> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    });
  } catch {
    return null;
  }
}

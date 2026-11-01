import { PLAN_FILE_BYTES_MAX, PLAN_IMAGE_PIXELS_MAX, PLAN_IMAGE_SIDE_MAX, type PlanImageType } from "./model";

/**
 * Rozpoznanie obrazu planu po bajtach, nie po `file.type` (rozszerzenie i typ MIME z systemu da się
 * podmienić). Wymiary czytamy z nagłówka PRZED dekodowaniem — ogromny obraz („bomba dekompresji”)
 * odrzucamy, zanim przeglądarka zarezerwuje na niego pamięć. SVG i GIF nie przechodzą.
 */

export interface SniffedImage {
  type: PlanImageType;
  w: number;
  h: number;
}

const ascii = (b: Uint8Array, at: number, s: string) => s.split("").every((c, i) => b[at + i] === c.charCodeAt(0));
const u16be = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const u32be = (b: Uint8Array, at: number) => ((b[at] << 24) >>> 0) + (b[at + 1] << 16) + (b[at + 2] << 8) + b[at + 3];
const u16le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u24le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);

function png(b: Uint8Array): SniffedImage | null {
  // Sygnatura + pierwszy fragment musi być IHDR.
  if (b.length < 24 || !(b[0] === 0x89 && ascii(b, 1, "PNG\r\n\x1a\n") && ascii(b, 12, "IHDR"))) return null;
  return { type: "image/png", w: u32be(b, 16), h: u32be(b, 20) };
}

function jpeg(b: Uint8Array): SniffedImage | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) { i++; continue; }
    // SOF0–SOF15 bez DHT (C4), JPG (C8) i DAC (CC): wysokość i szerokość ramki.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { type: "image/jpeg", w: u16be(b, i + 7), h: u16be(b, i + 5) };
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    i += 2 + u16be(b, i + 2);
  }
  return null;
}

function webp(b: Uint8Array): SniffedImage | null {
  if (b.length < 30 || !ascii(b, 0, "RIFF") || !ascii(b, 8, "WEBP")) return null;
  if (ascii(b, 12, "VP8X")) return { type: "image/webp", w: u24le(b, 24) + 1, h: u24le(b, 27) + 1 };
  if (ascii(b, 12, "VP8L")) {
    if (b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { type: "image/webp", w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (ascii(b, 12, "VP8 ")) {
    // Ramka kluczowa: kod startowy 9d 01 2a, potem 14-bitowe wymiary.
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { type: "image/webp", w: u16le(b, 26) & 0x3fff, h: u16le(b, 28) & 0x3fff };
  }
  return null;
}

/** Typ i wymiary z pierwszych bajtów pliku (wystarczy ~64 KB — JPEG z dużym EXIF ma SOF dalej). */
export function sniffImage(head: Uint8Array): SniffedImage | null {
  return png(head) ?? jpeg(head) ?? webp(head);
}

export type ImportError = "type" | "tooBig" | "tooLarge" | "empty";

export const IMPORT_ERROR_TEXT: Record<ImportError, string> = {
  type: "To nie jest obraz PNG, JPG ani WebP. Zapisz plan w DWG FastView jako zrzut ekranu (PNG) i spróbuj jeszcze raz.",
  tooBig: `Plik jest większy niż ${PLAN_FILE_BYTES_MAX / 1024 / 1024} MB. Zmniejsz zrzut albo zapisz go jako PNG.`,
  tooLarge: `Obraz jest za duży (ponad ${PLAN_IMAGE_SIDE_MAX} px na boku albo ${PLAN_IMAGE_PIXELS_MAX / 1_000_000} MP). Zrób zrzut mniejszego fragmentu planu.`,
  empty: "Plik jest pusty albo uszkodzony.",
};

/** Sprawdzenie pliku przed dekodowaniem; `ok` = typ i wymiary z nagłówka. */
export function checkPlanFile(size: number, head: Uint8Array): { ok: SniffedImage } | { error: ImportError } {
  if (size === 0) return { error: "empty" };
  if (size > PLAN_FILE_BYTES_MAX) return { error: "tooBig" };
  const s = sniffImage(head);
  if (!s) return { error: "type" };
  if (s.w < 1 || s.h < 1) return { error: "empty" };
  if (s.w > PLAN_IMAGE_SIDE_MAX || s.h > PLAN_IMAGE_SIDE_MAX || s.w * s.h > PLAN_IMAGE_PIXELS_MAX) return { error: "tooLarge" };
  return { ok: s };
}

/**
 * Bajty planu z magazynu przed dekodowaniem (przegląd bezpieczeństwa W2): od innego urządzenia albo
 * z kopii mogą przyjść dowolne bajty pod kluczem planu — mały PNG, który rozpakowuje się do dziesiątek
 * tysięcy pikseli, wywróciłby kartę przy otwarciu analizy, OCR albo wyszukiwaniu tras. Te same limity co
 * przy imporcie, a wymiary z nagłówka muszą się zgadzać z zapisanymi w analizie.
 */
export function checkStoredPlanImage(bytes: ArrayBuffer, expected?: { w: number; h: number }): SniffedImage | null {
  const head = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 64 * 1024));
  const checked = checkPlanFile(bytes.byteLength, head);
  if ("error" in checked) return null;
  const s = checked.ok;
  // Zdjęcie JPEG z obrotem EXIF: przeglądarka zamienia boki przy dekodowaniu, więc zamiana też pasuje.
  if (expected && !((s.w === expected.w && s.h === expected.h) || (s.w === expected.h && s.h === expected.w))) return null;
  return s;
}

/**
 * Przygotowanie obrazu do zapisu: pliki do limitu przechodzą bez zmian, większe
 * (zrzuty ekranu, zdjęcia z telefonu) są skalowane i kodowane do JPEG tak, żeby
 * zmieściły się w limicie — zamiast być odrzucane.
 */

/** Limit jednego obrazu (zgodny z limitem synchronizacji P2P w `imageSync`). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const MAX_SIDES = [2560, 2048, 1600, 1280, 1024, 800];
const QUALITIES = [0.86, 0.72];

/** Formaty, których przekodowanie do JPEG zepsułoby zawartość (animacja, wektor). */
const KEEP_AS_IS = /^image\/(gif|svg\+xml)$/;

/** Kształt wyjściowy z wymiarami po skalowaniu: dłuższy bok ≤ `maxSide`, proporcje zachowane. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const k = maxSide / longest;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

async function encode(bitmap: ImageBitmap, maxSide: number, quality: number): Promise<Blob | null> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // JPEG nie ma przezroczystości — podkład w kolorze kartki zamiast czarnego tła.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Zwraca blob gotowy do zapisu albo `null`, gdy obrazu nie da się zmieścić w limicie
 * (nieobsługiwany format, uszkodzony plik, GIF/SVG ponad limit).
 */
export async function prepareImage(file: File, maxBytes: number = MAX_IMAGE_BYTES): Promise<Blob | null> {
  if (file.size <= maxBytes) return file;
  if (KEEP_AS_IS.test(file.type) || typeof createImageBitmap !== "function") return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    for (const side of MAX_SIDES) {
      for (const q of QUALITIES) {
        const blob = await encode(bitmap, side, q);
        if (blob && blob.size <= maxBytes) return blob;
      }
    }
    return null;
  } finally {
    bitmap.close();
  }
}

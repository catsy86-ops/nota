import { imageStore } from "@/lib/imageStore";
import { fitWithin } from "@/lib/imagePrepare";
import type { PlanImage } from "./model";
import { checkPlanFile, IMPORT_ERROR_TEXT, type ImportError } from "./imageSniff";
import { PLAN_SYNC_MAX_BYTES } from "./planRefs";

/**
 * Import zrzutu planu (przeglądarka: `createImageBitmap`, płótno). Oryginał zapisujemy bez zmian —
 * pomiary są w jego układzie. Kopia robocza powstaje, gdy oryginał ma ponad 2 MB albo dłuższy bok
 * ponad 4096 px: mieści się w limitach płótna telefonów i jedzie do innych urządzeń (D3). Nie przez
 * `prepareImage` — ten zawsze koduje do JPEG, a JPEG rozmywa cienkie linie i drobny tekst planu.
 */

/** Dłuższy bok kopii roboczej i limit pikseli (płótno na iOS/Androidzie ok. 16 MP). */
export const WORK_SIDE_MAX = 4096;
const WORK_PIXELS_MAX = 16_000_000;
/** Ile bajtów nagłówka czytamy przed dekodowaniem (JPEG z dużym EXIF ma wymiary dalej). */
const HEAD_BYTES = 64 * 1024;

export interface ImportedPlan {
  image: PlanImage;
  work?: PlanImage;
  /** Adres podglądu (obiekt URL) — wołający zwalnia go `URL.revokeObjectURL`. */
  previewUrl: string;
}

export class PlanImportError extends Error {
  constructor(readonly code: ImportError | "decode" | "storage") {
    super(code === "decode" ? "Nie udało się odczytać obrazu — plik może być uszkodzony."
      : code === "storage" ? "Brak miejsca na urządzeniu — usuń stare analizy albo zdjęcia i spróbuj ponownie."
        : IMPORT_ERROR_TEXT[code]);
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Kopia robocza ≤ 2 MB: PNG (ostre linie), potem WebP, potem JPEG; przy dużym rysunku mniejszy bok. */
async function workCopy(bitmap: ImageBitmap): Promise<Blob | null> {
  let side = WORK_SIDE_MAX;
  const ratio = bitmap.width * bitmap.height / Math.max(bitmap.width, bitmap.height) ** 2;
  while (side * side * ratio > WORK_PIXELS_MAX) side = Math.floor(side * 0.9);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, side);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    for (const [type, q] of [["image/png"], ["image/webp", 0.92], ["image/jpeg", 0.9]] as [string, number?][]) {
      const blob = await canvasBlob(canvas, type, q);
      // Przeglądarka bez kodera WebP zwraca PNG — wtedy typ się nie zgadza i próbujemy dalej.
      if (blob && blob.type === type && blob.size <= PLAN_SYNC_MAX_BYTES) return blob;
    }
    side = Math.floor(side * 0.75);
  }
  return null;
}

export async function importPlanFile(file: File): Promise<ImportedPlan> {
  const head = new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer());
  const checked = checkPlanFile(file.size, head);
  if ("error" in checked) throw new PlanImportError(checked.error);
  const { type } = checked.ok;
  // Bajty jako Blob o typie z sygnatury (nie z `file.type`), dopiero potem dekodowanie.
  const bytes = new Blob([await file.arrayBuffer()], { type });
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(bytes);
  } catch {
    throw new PlanImportError("decode");
  }
  try {
    // Wymiary z dekodowania (to, co widać) — zrzuty ekranu nie mają EXIF, ale zdjęcie z telefonu może mieć obrót.
    const w = bitmap.width, h = bitmap.height;
    let work: PlanImage | undefined;
    let ref: string;
    try {
      ref = await imageStore.putBlob(bytes);
      if (bytes.size > PLAN_SYNC_MAX_BYTES || Math.max(w, h) > WORK_SIDE_MAX) {
        const blob = await workCopy(bitmap);
        if (blob) {
          const dims = fitWithin(w, h, WORK_SIDE_MAX);
          const wb = await createImageBitmap(blob).catch(() => null);
          work = { ref: await imageStore.putBlob(blob), type: blob.type as PlanImage["type"], size: blob.size, w: wb?.width ?? dims.width, h: wb?.height ?? dims.height };
          wb?.close();
        }
      }
    } catch {
      throw new PlanImportError("storage");
    }
    return { image: { ref, type, size: bytes.size, w, h }, ...(work ? { work } : {}), previewUrl: URL.createObjectURL(bytes) };
  } finally {
    bitmap.close();
  }
}

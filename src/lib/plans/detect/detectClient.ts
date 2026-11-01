import { fitWithin } from "@/lib/imagePrepare";
import { imageStore } from "@/lib/imageStore";
import type { AnalysisProject, DetectedText } from "../model";
import { rgbToHex, type DetectedPolyline } from "./lines";

/**
 * Przeglądarkowa część propozycji tras: dekoduje plan (kopię roboczą albo oryginał) do pikseli
 * o dłuższym boku ≤ 2048 px — szkielet i maska rosną z liczbą pikseli, a na telefonie liczy się pamięć —
 * pobiera kolor pipetą i przelicza wyniki na piksele ORYGINAŁU. Ładowany dynamicznie z panelu.
 */

export const DETECT_SIDE_MAX = 2048;

interface Decoded { key: string; data: ImageData; k: number }
let cache: Decoded | null = null;

async function decode(project: AnalysisProject): Promise<Decoded> {
  const ref = project.work?.ref ?? project.image.ref;
  const key = `${project.id}:${ref}`;
  if (cache?.key === key) return cache;
  const rec = (project.work && await imageStore.get(project.work.ref)) || await imageStore.get(project.image.ref);
  if (!rec) throw new Error("Obrazu planu nie ma na tym urządzeniu.");
  const bitmap = await createImageBitmap(new Blob([rec.bytes], { type: rec.type }));
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, DETECT_SIDE_MAX);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(bitmap, 0, 0, width, height);
    cache = { key, data: ctx.getImageData(0, 0, width, height), k: project.image.w / width };
    return cache;
  } finally {
    bitmap.close();
  }
}

/** Kolor planu w punkcie (piksele oryginału) — mediana 3×3, żeby nie trafić w brzeg linii. */
export async function sampleColor(project: AnalysisProject, x: number, y: number): Promise<string | null> {
  const { data, k } = await decode(project);
  const cx = Math.round(x / k), cy = Math.round(y / k);
  const px: [number, number, number][] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const xx = cx + dx, yy = cy + dy;
    if (xx < 0 || yy < 0 || xx >= data.width || yy >= data.height) continue;
    const i = (yy * data.width + xx) * 4;
    px.push([data.data[i], data.data[i + 1], data.data[i + 2]]);
  }
  // Najbardziej nasycony z okolicy (linia zwykle cieńsza niż 3 px; tło jest białe).
  const best = px.sort((a, b) => sat(b) - sat(a))[0];
  if (!best || (best[0] > 235 && best[1] > 235 && best[2] > 235)) return null;
  return rgbToHex(...best);
}

const sat = ([r, g, b]: [number, number, number]) => Math.max(r, g, b) - Math.min(r, g, b) + (255 - Math.max(r, g, b)) * 0.3;

/** Propozycje tras w kolorze `color`, w pikselach oryginału. Ramki zatwierdzonych opisów są pomijane. */
export async function detectRoutes(project: AnalysisProject, texts: readonly DetectedText[], color: string, tolerance: number): Promise<DetectedPolyline[]> {
  const { data, k } = await decode(project);
  const { detectInWorker } = await import("@/workers/planDetect");
  const ignore = texts.map((t) => ({ x: t.box[0] / k - 2, y: t.box[1] / k - 2, w: t.box[2] / k + 4, h: t.box[3] / k + 4 }));
  // Najkrótsza propozycja: 2% dłuższego boku (krótsze to zwykle symbole, strzałki i litery).
  const minLength = Math.max(20, Math.max(data.width, data.height) * 0.02);
  const found = await detectInWorker(new Uint8ClampedArray(data.data), data.width, data.height, { color, tolerance, minLength, ignore });
  return found.map((l) => ({ ...l, pts: l.pts.map((v) => Math.round(v * k * 10) / 10), length: l.length * k }));
}

/** Zwalnia zdekodowany obraz (kilkanaście MB) — przy wyjściu z edytora. */
export function releaseDetectCache(): void {
  cache = null;
}

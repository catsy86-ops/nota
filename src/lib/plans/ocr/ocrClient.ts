import type { Worker as TesseractWorker } from "tesseract.js";
import { dedupeWords, OCR_OVERLAP, OCR_TILE, tileGrid, tileToImage, type Rect } from "../tiles";

/**
 * Klient OCR Analizatora planów (przeglądarka). Ładowany dynamicznie dopiero po „Rozpoznaj opisy” —
 * nie wchodzi do paczki widoku ani do precache. Silnik (tesseract.js 7, LSTM) i dane `pol` + `eng`
 * leżą pod własnym adresem `/ocr/<wersja>/` (kopiuje je `scripts/copy-ocr.mjs`): obraz planu nigdy nie
 * wychodzi do zewnętrznej usługi, a po pierwszym pobraniu service worker (`ocr-engine`) daje offline.
 * `cacheMethod: "none"` — tesseract nie pisze ~10 MB do IndexedDB `keyval-store`, wspólnej z aplikacją.
 * Jeden worker, kafle po kolei; „Anuluj” = `terminate()` (tesseract nie przerywa pojedynczego zadania).
 */

export const OCR_VERSION = "7.0.0";
const BASE = `/ocr/${OCR_VERSION}`;
const CORE = { simd: "tesseract-core-simd-lstm", plain: "tesseract-core-lstm" } as const;

export interface OcrLine {
  /** Tekst z OCR bez zmian. */
  raw: string;
  /** Prostokąt w pikselach ORYGINAŁU. */
  box: Rect;
  /** 0–1. */
  confidence: number;
}

export type OcrStage = "download" | "start" | "recognize";
export interface OcrProgress {
  stage: OcrStage;
  /** 0–1 dla całego etapu. */
  value: number;
  /** „kafel 2 z 6” w etapie rozpoznawania. */
  detail?: string;
}

export class OcrCancelled extends Error {
  constructor() { super("Przerwano rozpoznawanie opisów."); }
}

let active: TesseractWorker | null = null;
let cancelled = false;

/** Przerywa trwające rozpoznawanie (i pobieranie silnika między plikami). */
export function cancelOcr(): void {
  cancelled = true;
  const w = active;
  active = null;
  void w?.terminate().catch(() => {});
}

async function coreName(): Promise<string> {
  try {
    const { simd } = await import("wasm-feature-detect");
    return (await simd()) ? CORE.simd : CORE.plain;
  } catch {
    return CORE.plain;
  }
}

/** Pliki silnika dla tego urządzenia (wariant SIMD albo zwykły). */
export async function engineFiles(): Promise<string[]> {
  const core = await coreName();
  return ["worker.min.js", `${core}.js`, `${core}.wasm`, "pol.traineddata.gz", "eng.traineddata.gz"].map((f) => `${BASE}/${f}`);
}

/** Czy silnik jest już w pamięci podręcznej (pobrany wcześniej — działa offline). */
export async function engineReady(): Promise<boolean> {
  if (typeof caches === "undefined") return false;
  try {
    const cache = await caches.open("ocr-engine");
    const files = await engineFiles();
    const hits = await Promise.all(files.map((f) => cache.match(f)));
    return hits.every(Boolean);
  } catch {
    return false;
  }
}

/**
 * Pobiera pliki silnika z postępem (bajty), zanim worker po nie sięgnie — service worker odkłada je do
 * `ocr-engine`. Bez service workera (podgląd deweloperski) zostają w zwykłej pamięci podręcznej HTTP.
 */
async function downloadEngine(onProgress: (p: OcrProgress) => void): Promise<void> {
  const files = await engineFiles();
  void navigator.storage?.persist?.().catch(() => false);
  // Przybliżone rozmiary (bajty) do paska postępu, gdy serwer nie poda Content-Length.
  const approx: Record<string, number> = { js: 100_000, wasm: 2_860_000, gz: 2_800_000 };
  const total = files.reduce((s, f) => s + (approx[f.split(".").pop() ?? ""] ?? 100_000), 0);
  let done = 0;
  for (const f of files) {
    if (cancelled) throw new OcrCancelled();
    const res = await fetch(f);
    if (!res.ok || !res.body) throw new Error(`Nie udało się pobrać silnika OCR (${res.status}).`);
    const reader = res.body.getReader();
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      done += value.byteLength;
      onProgress({ stage: "download", value: Math.min(0.99, done / total) });
      if (cancelled) { void reader.cancel(); throw new OcrCancelled(); }
    }
  }
  onProgress({ stage: "download", value: 1 });
}

async function startWorker(onProgress: (p: OcrProgress) => void): Promise<TesseractWorker> {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const core = await coreName();
  onProgress({ stage: "start", value: 0 });
  const worker = await createWorker(["pol", "eng"], OEM.LSTM_ONLY, {
    workerPath: `${BASE}/worker.min.js`,
    corePath: `${BASE}/${core}.js`,
    langPath: BASE,
    // Wymagane: core szuka .wasm względem adresu workera — z adresu `blob:` by go nie znalazł.
    workerBlobURL: false,
    cacheMethod: "none",
    gzip: true,
    logger: (m) => { if (m.status.startsWith("loading") || m.status.startsWith("initializ")) onProgress({ stage: "start", value: m.progress }); },
  });
  await worker.setParameters({
    // Rozrzucone opisy na rysunku, nie akapity tekstu.
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300",
  });
  return worker;
}

/** Kafel obrazu jako PNG (tesseract przyjmuje Blob, nie ImageBitmap), w szarości i powiększony dla małych napisów. */
async function tileBlob(bitmap: ImageBitmap, r: Rect, up: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(r.w * up);
  canvas.height = Math.round(r.h * up);
  const ctx = canvas.getContext("2d", { willReadFrequently: false })!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.filter = "grayscale(1) contrast(1.4)";
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Nie udało się przygotować fragmentu planu.");
  return blob;
}

/**
 * Rozpoznaje opisy na planie. `source` = kopia robocza albo oryginał (bajty z magazynu), `imageWidth` =
 * szerokość ORYGINAŁU — prostokąty wracają w jego pikselach. Zwraca linie tekstu (bez filtrowania —
 * znaczenie ocenia `interpretOcrText`).
 */
export async function recognizePlan(source: Blob, imageWidth: number, onProgress: (p: OcrProgress) => void): Promise<OcrLine[]> {
  cancelled = false;
  if (!(await engineReady())) await downloadEngine(onProgress);
  if (cancelled) throw new OcrCancelled();
  const bitmap = await createImageBitmap(source);
  try {
    const worker = await startWorker(onProgress);
    if (cancelled) { void worker.terminate(); throw new OcrCancelled(); }
    active = worker;
    // Zrzut ekranu ma drobne napisy (~10–14 px) — LSTM czyta najlepiej ~30 px, więc małe plany powiększamy 2×.
    const up = Math.max(bitmap.width, bitmap.height) <= 2600 ? 2 : 1;
    const tiles = tileGrid(bitmap.width, bitmap.height, Math.round(OCR_TILE / up), Math.round(OCR_OVERLAP / up));
    const k = imageWidth / bitmap.width;
    const lines: OcrLine[] = [];
    for (let i = 0; i < tiles.length; i++) {
      if (cancelled) throw new OcrCancelled();
      onProgress({ stage: "recognize", value: i / tiles.length, detail: tiles.length > 1 ? `fragment ${i + 1} z ${tiles.length}` : undefined });
      const { data } = await worker.recognize(await tileBlob(bitmap, tiles[i], up), {}, { blocks: true, text: false });
      for (const block of data.blocks ?? []) for (const par of block.paragraphs) for (const line of par.lines) {
        const raw = line.text.replace(/\s+/g, " ").trim();
        if (!raw) continue;
        const b = line.bbox;
        const box = { x: b.x0 / up, y: b.y0 / up, w: (b.x1 - b.x0) / up, h: (b.y1 - b.y0) / up };
        lines.push({ raw, box: tileToImage(tiles[i], box, k), confidence: Math.max(0, Math.min(1, line.confidence / 100)) });
      }
    }
    onProgress({ stage: "recognize", value: 1 });
    return dedupeWords(lines.map((l) => ({ ...l, text: l.raw }))).map(({ raw, box, confidence }) => ({ raw, box, confidence }));
  } catch (e) {
    if (cancelled) throw new OcrCancelled();
    throw e;
  } finally {
    bitmap.close();
    // Worker trzyma ~100 MB sterty wasm — po przebiegu zwalniamy wszystko.
    const w = active;
    active = null;
    void w?.terminate().catch(() => {});
  }
}

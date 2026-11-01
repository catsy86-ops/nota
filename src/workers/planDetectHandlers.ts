import { detectLines, type DetectOptions } from "@/lib/plans/detect/lines";

/**
 * Metody Workera propozycji tras (Analizator planów, faza 5). Osobno od pliku Workera, żeby dały się
 * testować w jsdom. Piksele przychodzą jako `Uint8ClampedArray` (kopiowany przez `postMessage`).
 */
export const planDetectHandlers = {
  detect: (rgba: Uint8ClampedArray, w: number, h: number, opts: DetectOptions) => detectLines(rgba, w, h, opts),
};

export type PlanDetectHandlers = typeof planDetectHandlers;

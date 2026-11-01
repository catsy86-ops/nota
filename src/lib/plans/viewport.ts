import type { PlanPoint } from "./model";

/**
 * Widok planu: `screen = image * scale + (tx, ty)` (piksele ekranu względem lewego górnego rogu płótna).
 * Czyste funkcje — komponent tylko je woła, testy sprawdzają przeliczenia po zoomie i przesunięciu.
 */
export interface Viewport {
  scale: number;
  tx: number;
  ty: number;
}

export const SCALE_MIN = 0.02;
export const SCALE_MAX = 8;

const clampScale = (s: number) => Math.min(SCALE_MAX, Math.max(SCALE_MIN, s));

export const screenToImage = (v: Viewport, p: PlanPoint): PlanPoint => ({ x: (p.x - v.tx) / v.scale, y: (p.y - v.ty) / v.scale });
export const imageToScreen = (v: Viewport, p: PlanPoint): PlanPoint => ({ x: p.x * v.scale + v.tx, y: p.y * v.scale + v.ty });

/** Cały obraz w oknie z marginesem, wyśrodkowany. */
export function fitView(imageW: number, imageH: number, viewW: number, viewH: number, margin = 16): Viewport {
  const w = Math.max(1, viewW - margin * 2), h = Math.max(1, viewH - margin * 2);
  const scale = clampScale(Math.min(w / imageW, h / imageH));
  return { scale, tx: (viewW - imageW * scale) / 2, ty: (viewH - imageH * scale) / 2 };
}

/** Zoom wokół punktu ekranu (kursor, środek szczypania) — ten punkt obrazu zostaje pod palcem. */
export function zoomAt(v: Viewport, factor: number, at: PlanPoint): Viewport {
  const scale = clampScale(v.scale * factor);
  const k = scale / v.scale;
  return { scale, tx: at.x - (at.x - v.tx) * k, ty: at.y - (at.y - v.ty) * k };
}

export const panBy = (v: Viewport, dx: number, dy: number): Viewport => ({ ...v, tx: v.tx + dx, ty: v.ty + dy });

/**
 * Nie pozwala wyprowadzić obrazu całkiem poza okno: zostaje co najmniej `keep` pikseli ekranu
 * obrazu przy krawędzi, więc „zgubionego” planu zawsze da się złapać.
 */
export function clampView(v: Viewport, imageW: number, imageH: number, viewW: number, viewH: number, keep = 48): Viewport {
  const w = imageW * v.scale, h = imageH * v.scale;
  const tx = Math.min(viewW - keep, Math.max(keep - w, v.tx));
  const ty = Math.min(viewH - keep, Math.max(keep - h, v.ty));
  return { ...v, tx, ty };
}

/** Przeliczenie dla szczypania: dwa palce przed i po → nowy widok (zoom wokół środka + przesunięcie środka). */
export function pinchView(v: Viewport, before: [PlanPoint, PlanPoint], after: [PlanPoint, PlanPoint]): Viewport {
  const d0 = Math.hypot(before[1].x - before[0].x, before[1].y - before[0].y);
  const d1 = Math.hypot(after[1].x - after[0].x, after[1].y - after[0].y);
  const c0 = { x: (before[0].x + before[1].x) / 2, y: (before[0].y + before[1].y) / 2 };
  const c1 = { x: (after[0].x + after[1].x) / 2, y: (after[0].y + after[1].y) / 2 };
  const zoomed = d0 > 0 ? zoomAt(v, d1 / d0, c0) : v;
  return panBy(zoomed, c1.x - c0.x, c1.y - c0.y);
}

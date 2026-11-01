import type { PlanCalibration, PlanPoint } from "./model";

/** Geometria planu i kalibracja — wszystko w pikselach oryginału obrazu. */

export const distance = (a: PlanPoint, b: PlanPoint) => Math.hypot(b.x - a.x, b.y - a.y);

/** Punkty z płaskiej listy `[x0, y0, x1, y1, …]`. */
export function toPoints(pts: readonly number[]): PlanPoint[] {
  const out: PlanPoint[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) out.push({ x: pts[i], y: pts[i + 1] });
  return out;
}

export const toFlat = (points: readonly PlanPoint[]): number[] => points.flatMap((p) => [p.x, p.y]);

/** Długość polilinii w pikselach: suma odcinków. */
export function polylineLength(pts: readonly number[]): number {
  let sum = 0;
  for (let i = 2; i + 1 < pts.length; i += 2) sum += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
  return sum;
}

/** Odległość punktu od odcinka AB (do zaznaczania trasy stuknięciem). */
export function distanceToSegment(p: PlanPoint, a: PlanPoint, b: PlanPoint): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function distanceToPolyline(p: PlanPoint, pts: readonly number[]): number {
  let best = Infinity;
  for (let i = 2; i + 1 < pts.length; i += 2) {
    best = Math.min(best, distanceToSegment(p, { x: pts[i - 2], y: pts[i - 1] }, { x: pts[i], y: pts[i + 1] }));
  }
  return best;
}

/** Najkrótszy odcinek kalibracji (px) — krótszy daje zbyt duży błąd skali. */
export const CALIBRATION_MIN_PX = 10;
export const CALIBRATION_MAX_METERS = 10_000;

export type CalibrationError = "short" | "meters";

/** Sprawdza kalibrację przed zapisem; `null` = poprawna. */
export function calibrationError(a: PlanPoint, b: PlanPoint, meters: number): CalibrationError | null {
  if (distance(a, b) < CALIBRATION_MIN_PX) return "short";
  if (!Number.isFinite(meters) || meters <= 0 || meters > CALIBRATION_MAX_METERS) return "meters";
  return null;
}

/** `metersPerPixel = knownDistanceMeters / pixelDistance`; `null` = brak kalibracji albo zła. */
export function metersPerPixel(cal: PlanCalibration | null | undefined): number | null {
  if (!cal) return null;
  const px = distance(cal.a, cal.b);
  if (px < CALIBRATION_MIN_PX || !(cal.meters > 0)) return null;
  return cal.meters / px;
}

export type MeasurementStatus = "confirmed" | "estimated" | "noScale";

export interface RouteMeasure {
  lengthPixels: number;
  /** `null` = bez skali — długości w metrach nie ma i nie wolno jej zgadywać. */
  lengthMeters: number | null;
  status: MeasurementStatus;
}

/**
 * Pomiar trasy: piksele zawsze, metry tylko ze skalą. „Potwierdzone” = trasa zatwierdzona i nie
 * oznaczona jako szacunkowa; reszta ze skalą to „szacunkowe”.
 */
export function measureRoute(route: { pts: readonly number[]; verified: boolean; estimate?: boolean }, mpp: number | null): RouteMeasure {
  const lengthPixels = polylineLength(route.pts);
  if (mpp === null) return { lengthPixels, lengthMeters: null, status: "noScale" };
  return { lengthPixels, lengthMeters: lengthPixels * mpp, status: route.verified && !route.estimate ? "confirmed" : "estimated" };
}

/** „12,40 m” albo „840 px (bez skali)” — nigdy metry bez kalibracji. */
export function lengthLabel(m: RouteMeasure): string {
  if (m.lengthMeters === null) return `${Math.round(m.lengthPixels)} px (bez skali)`;
  return `${m.lengthMeters.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
}

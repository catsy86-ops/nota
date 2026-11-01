import { distanceToSegment } from "./geometry";
import type { DetectedSymbol, PipeRoute, PlanPoint, SymbolType, SystemType } from "./model";

/**
 * Propozycje kształtek z geometrii tras (faza 6). Kolano = załamanie trasy (kąt zmiany kierunku
 * co najmniej `ELBOW_MIN_DEG`). Trójnik = koniec trasy leżący NA innej trasie tej samej instalacji
 * (nie na jej końcu) — nie z przypadkowych przecięć linii różnych instalacji czy tras, które się tylko
 * krzyżują. Wynik to propozycje (`verified: false`) do zatwierdzenia; symbol, który już stoi w pobliżu,
 * nie jest proponowany drugi raz.
 */

export const ELBOW_MIN_DEG = 30;

export interface FittingProposal {
  type: Extract<SymbolType, "elbow" | "tee">;
  x: number;
  y: number;
  system: SystemType;
  confidence: number;
  /** Trasy, z których wynika (do podświetlenia). */
  routeIds: string[];
}

/** Kąt zmiany kierunku w wierzchołku B (0° = prosto, 90° = kolano prostokątne). */
export function turnAngle(a: PlanPoint, b: PlanPoint, c: PlanPoint): number {
  const v1x = b.x - a.x, v1y = b.y - a.y, v2x = c.x - b.x, v2y = c.y - b.y;
  const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
  if (!l1 || !l2) return 0;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / (l1 * l2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

const pt = (pts: readonly number[], i: number): PlanPoint => ({ x: pts[i * 2], y: pts[i * 2 + 1] });

export function proposeFittings(routes: readonly PipeRoute[], existing: readonly DetectedSymbol[], tolerance: number): FittingProposal[] {
  const out: FittingProposal[] = [];
  const taken = (x: number, y: number) =>
    existing.some((s) => Math.hypot(s.x - x, s.y - y) <= tolerance) || out.some((s) => Math.hypot(s.x - x, s.y - y) <= tolerance);

  for (const r of routes) {
    const n = r.pts.length / 2;
    for (let i = 1; i < n - 1; i++) {
      const angle = turnAngle(pt(r.pts, i - 1), pt(r.pts, i), pt(r.pts, i + 1));
      if (angle < ELBOW_MIN_DEG) continue;
      const p = pt(r.pts, i);
      if (taken(p.x, p.y)) continue;
      // Kąt prosty (typowe kolano 90°) pewniejszy niż łagodne załamanie.
      const confidence = Math.round((0.6 + 0.35 * Math.max(0, 1 - Math.abs(angle - 90) / 60)) * 100) / 100;
      out.push({ type: "elbow", x: p.x, y: p.y, system: r.system, confidence, routeIds: [r.id] });
    }
  }

  for (const r of routes) {
    const n = r.pts.length / 2;
    for (const end of [pt(r.pts, 0), pt(r.pts, n - 1)]) {
      for (const other of routes) {
        if (other.id === r.id || other.system !== r.system) continue;
        const m = other.pts.length / 2;
        // Koniec przy końcu drugiej trasy to przedłużenie albo kolano, nie trójnik.
        if (Math.hypot(end.x - other.pts[0], end.y - other.pts[1]) <= tolerance) continue;
        if (Math.hypot(end.x - other.pts[(m - 1) * 2], end.y - other.pts[(m - 1) * 2 + 1]) <= tolerance) continue;
        let onIt = false;
        for (let i = 1; i < m && !onIt; i++) if (distanceToSegment(end, pt(other.pts, i - 1), pt(other.pts, i)) <= tolerance) onIt = true;
        if (!onIt || taken(end.x, end.y)) continue;
        out.push({ type: "tee", x: end.x, y: end.y, system: r.system, confidence: 0.8, routeIds: [r.id, other.id] });
      }
    }
  }
  return out;
}

/** Symbol najbliżej punktu w promieniu (do zaznaczania stuknięciem). */
export function pickSymbol(symbols: readonly DetectedSymbol[], p: PlanPoint, tolerance: number): string | null {
  let best: string | null = null;
  let bestD = tolerance;
  for (const s of symbols) {
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d <= bestD) { bestD = d; best = s.id; }
  }
  return best;
}

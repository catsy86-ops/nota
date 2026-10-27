/**
 * Punkty zatrzymania dolnego arkusza (plan UI/UX 3.10): „pół” i „pełny” ekran.
 * Czysta logika bez DOM — `sheet.tsx` przekazuje przesunięcie palca i prędkość, dostaje decyzję.
 */
export type SheetSnap = "half" | "full";

/** Wysokości punktów zatrzymania; `full` odpowiada dotychczasowemu limitowi arkusza (92 dvh). */
export const SNAP_HEIGHT: Record<SheetSnap, string> = { half: "55dvh", full: "92dvh" };

/** Progi jak w zamykaniu: odległość w px albo szybki ruch (px/ms). */
const DIST_CLOSE = 110;
const DIST_STEP = 40;
const DIST_FAST = 30;
const VELOCITY_FAST = 0.6;

/**
 * Decyzja po puszczeniu palca.
 * - `dy` — przesunięcie w pionie od początku gestu (ujemne = w górę),
 * - `velocity` — to samo przesunięcie podzielone przez czas (px/ms, ze znakiem).
 *
 * Z „pół” w górę otwiera „pełny”, w dół zamyka. Z „pełny” w dół wraca do „pół”
 * (zamknięcie dopiero z „pół”, żeby jeden gest nie zamykał całego ekranu).
 */
export function snapDecision({ snap, dy, velocity }: { snap: SheetSnap; dy: number; velocity: number }): SheetSnap | "close" {
  const up = dy < 0;
  const down = dy > 0;
  const distance = Math.abs(dy);
  const fast = Math.abs(velocity) > VELOCITY_FAST && distance > DIST_FAST;

  if (snap === "half") {
    if (up && (distance > DIST_STEP || fast)) return "full";
    if (down && (dy > DIST_CLOSE || (dy > DIST_FAST && velocity > VELOCITY_FAST))) return "close";
    return "half";
  }
  if (down && (dy > DIST_CLOSE || (dy > DIST_FAST && velocity > VELOCITY_FAST))) return "half";
  return "full";
}

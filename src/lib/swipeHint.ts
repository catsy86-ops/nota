/**
 * Podpisy w tle przesunięcia kafla („Przypnij” / „Archiwizuj”) przy pierwszych
 * gestach — potem same ikony. Licznik wykonanych gestów w localStorage
 * (na tym urządzeniu; to nauka gestu, nie dane do synchronizacji).
 */
export const SWIPE_HINT_KEY = "kaczy.swipeHints.v1";
export const SWIPE_HINT_LIMIT = 3;

function read(): number {
  try {
    const n = Number(localStorage.getItem(SWIPE_HINT_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function showSwipeLabels(): boolean {
  return read() < SWIPE_HINT_LIMIT;
}

export function countSwipe(): void {
  const n = read();
  if (n >= SWIPE_HINT_LIMIT) return;
  try {
    localStorage.setItem(SWIPE_HINT_KEY, String(n + 1));
  } catch {
    /* prywatne okno — podpisy zostaną */
  }
}

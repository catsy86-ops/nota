import { useSyncExternalStore } from "react";

/**
 * Liczba terminów Pracy na liście Terminów (D1 planu Przypomnień). Pisze ją leniwy
 * `StudyOverdueSync`, czyta `Index` — dzięki temu pasek i tytuł liczą to samo, a dane
 * Pracy nie wchodzą do paczki startowej.
 */
let count = 0;
const listeners = new Set<() => void>();

export function setStudyOverdueCount(next: number): void {
  if (next === count) return;
  count = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useStudyOverdueCount(): number {
  return useSyncExternalStore(subscribe, () => count, () => 0);
}

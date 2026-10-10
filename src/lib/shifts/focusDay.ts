/**
 * Prośba „pokaż ten dzień w Grafiku” — z palety poleceń do widoku Grafiku.
 * Widok bywa dopiero ładowany (leniwy moduł), więc prośba czeka, aż ktoś ją odbierze.
 */
let pending: string | null = null;
const listeners = new Set<() => void>();

export function requestShiftDay(key: string): void {
  pending = key;
  listeners.forEach((l) => l());
}

/** Odbiera oczekującą prośbę (raz). */
export function takeShiftDay(): string | null {
  const key = pending;
  pending = null;
  return key;
}

export function subscribeShiftDay(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

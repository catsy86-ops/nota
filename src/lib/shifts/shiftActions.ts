/**
 * Polecenie „zrób coś w Grafiku” z palety poleceń. Jak `focusDay`: widok bywa dopiero ładowany,
 * więc prośba czeka, aż ktoś ją odbierze (raz).
 */
export type ShiftAction = "addToday" | "pattern" | "image";

let pending: ShiftAction | null = null;
const listeners = new Set<() => void>();

export function requestShiftAction(action: ShiftAction): void {
  pending = action;
  listeners.forEach((l) => l());
}

export function takeShiftAction(): ShiftAction | null {
  const action = pending;
  pending = null;
  return action;
}

export function subscribeShiftAction(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

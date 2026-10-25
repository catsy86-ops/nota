import { useSyncExternalStore } from "react";

/**
 * Fala pieczątek po nałożeniu cyklu (5.6): dni dostają kolejne opóźnienia, żeby cykl
 * „wpadał” w kratkę po kolei, a nie naraz. Pusta po chwili, więc zwykłe kliknięcie nie czeka.
 */
const STEP_MS = 40;
const TAIL_MS = 900;
let wave = new Map<string, number>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

const emit = () => listeners.forEach((l) => l());

/** Ustawia falę dla dni w kolejności (posortowane daty). */
export function setCycleWave(keys: string[]): void {
  wave = new Map(keys.map((k, i) => [k, i]));
  emit();
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { wave = new Map(); timer = null; emit(); }, keys.length * STEP_MS + TAIL_MS);
}

export const DELAY_STEP_MS = STEP_MS;

/** Bieżąca fala (do testów i do `useCycleWave`). */
export const getCycleWave = (): ReadonlyMap<string, number> => wave;

export function subscribeCycleWave(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Dzień → indeks w fali (tylko dla dni z właśnie nałożonego cyklu). */
export const useCycleWave = (): ReadonlyMap<string, number> => useSyncExternalStore(subscribeCycleWave, () => wave);

/**
 * Blokada wyłączna między kartami (Web Locks). Dla operacji krótkich i nieodwracalnych
 * — migracje, import kopii — żeby dwie karty nie robiły ich naraz.
 * Bez `navigator.locks` (starsze WebView) zostaje kolejka w obrębie jednej karty.
 */
const queues = new Map<string, Promise<unknown>>();

export function withExclusiveLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks?.request) return locks.request(name, { mode: "exclusive" }, fn) as Promise<T>;
  const prev = queues.get(name) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  queues.set(name, run.catch(() => undefined));
  return run;
}

export const MIGRATION_LOCK = "notatnik-migracja";

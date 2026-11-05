import { createPersistedStore } from "@/lib/persistedStore";

/**
 * „Ostatnio widziane” urządzenia (nowy plan 5.6). Tylko lokalnie, poza Yjs: to wiedza tego
 * urządzenia o innych, nie dane do synchronizacji. Klucz to nazwa urządzenia — id z awareness
 * zmienia się przy każdym połączeniu, więc po nim to samo urządzenie byłoby za każdym razem nowe.
 */
export type SeenMap = Record<string, number>;

const MAX = 20;

export function mergeSeen(prev: SeenMap, names: readonly string[], now: number): SeenMap {
  if (names.length === 0) return prev;
  const next: SeenMap = { ...prev };
  for (const n of names) if (n) next[n] = now;
  const keys = Object.keys(next);
  if (keys.length > MAX) {
    keys.sort((a, b) => next[b] - next[a]);
    for (const k of keys.slice(MAX)) delete next[k];
  }
  return next;
}

/** Urządzenia, których teraz nie ma, od ostatnio widzianego. */
export function seenOffline(seen: SeenMap, connected: readonly string[]): { name: string; at: number }[] {
  const now = new Set(connected);
  return Object.entries(seen).filter(([name]) => !now.has(name)).map(([name, at]) => ({ name, at })).sort((a, b) => b.at - a.at);
}

const store = createPersistedStore<SeenMap>("kaczy.sync.seen.v1", {}, {
  merge: (_d, stored) => (stored && typeof stored === "object" && !Array.isArray(stored)
    ? Object.fromEntries(Object.entries(stored as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === "number" && e[0].length <= 40))
    : {}),
});

export function recordSeenDevices(names: readonly string[], now = Date.now()): void {
  const next = mergeSeen(store.get(), names, now);
  if (next !== store.get()) store.set(next);
}

export function useSeenDevices(): SeenMap {
  return store.use();
}

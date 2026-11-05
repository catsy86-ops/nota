import { createPersistedStore } from "@/lib/persistedStore";

/**
 * „Ostatnio widziane” urządzenia (nowy plan 5.6). Tylko lokalnie, poza Yjs: to wiedza tego
 * urządzenia o innych, nie dane do synchronizacji. Klucz to nazwa urządzenia — id z awareness
 * zmienia się przy każdym połączeniu, więc po nim to samo urządzenie byłoby za każdym razem nowe.
 */
export type SeenMap = Record<string, number>;

const MAX = 20;
/** Ten sam zestaw urządzeń częściej niż raz na minutę nie zapisuje się ponownie (awareness zmienia się często). */
const REFRESH_MS = 60_000;

/** Nazwa od innego urządzenia bez znaków sterujących i formatujących (np. odwrócenie kierunku tekstu). */
export function cleanDeviceName(name: string): string {
  return name.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, 40);
}

export function mergeSeen(prev: SeenMap, names: readonly string[], now: number): SeenMap {
  const clean = [...new Set(names.map(cleanDeviceName).filter(Boolean))];
  if (clean.length === 0) return prev;
  if (clean.every((n) => Object.prototype.hasOwnProperty.call(prev, n) && now - prev[n] < REFRESH_MS)) return prev;
  const next: SeenMap = { ...prev };
  for (const n of clean) next[n] = now;
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

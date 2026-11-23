import { createPersistedStore } from "@/lib/persistedStore";
import { cleanDeviceName } from "@/lib/syncSeen";
import { SYNC } from "@/lib/storage/names";

/**
 * Koniec pokoi v2 (S2.6, `docs/plan-wymiana-kodu.md` §2). Pokój v2 (jeden SHA-256 kodu) jest dołączany
 * tylko w oknie zgodności; okno nie chroni przed wyciekiem nazwy (naprawą jest nowy kod), pilnuje tylko,
 * żeby koniec nie rozdzielił grupy po cichu — stąd przedłużenie, gdy w pokoju v2 wciąż bywa stare
 * urządzenie, i twardy koniec po 90 dniach.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Czas zgodności z pokojem v2 po przejściu na v3 (S3) i długość jednego przedłużenia. */
export const V2_COMPAT_MS = 30 * DAY;
/** Twardy koniec okna liczony od jego początku. */
export const V2_MAX_MS = 90 * DAY;
/** Tylko urządzenie widziane w v2 (bez v3) w tym czasie przedłuża okno i jest pokazywane w ustawieniach. */
export const V2_ONLY_RECENT_MS = 14 * DAY;
/** Po tylu sekundach od połączenia obecność tylko w v2 oznacza starą wersję (zaktualizowane są w obu pokojach). */
export const V2_ONLY_GRACE_MS = 60_000;

export interface V2Window {
  v2Until: number;
  /** Brak pola = zapis sprzed przedłużeń: początek to `v2Until − 30 dni`. */
  v2Start?: number | null;
}

export const v2WindowStart = (w: V2Window): number => w.v2Start ?? w.v2Until - V2_COMPAT_MS;

/**
 * Przedłużenie zamiast cichego rozdzielenia: gdy okno minęło, a stare urządzenie było w v2 w ostatnich
 * 14 dniach, `v2Until` przesuwa się o 30 dni, najwyżej do 90 dni od początku. `null` = bez zmiany
 * (okno trwa, nikogo nie było albo twardy koniec już minął).
 */
export function extendV2Window(w: V2Window, oldDeviceSeenAt: number | null, now: number): { v2Until: number; v2Start: number } | null {
  if (now < w.v2Until) return null;
  if (oldDeviceSeenAt === null || now - oldDeviceSeenAt > V2_ONLY_RECENT_MS) return null;
  const start = v2WindowStart(w);
  const until = Math.min(w.v2Until + V2_COMPAT_MS, start + V2_MAX_MS);
  return until > now ? { v2Until: until, v2Start: start } : null;
}

// ── urządzenia widziane tylko w pokoju v2 ───────────────────────────────────

/** Nazwa urządzenia → kiedy ostatnio było tylko w v2 (ms). Lokalnie, poza kopią. */
export type V2OnlyMap = Record<string, number>;
const V2_ONLY_MAX = 20;

export function mergeV2Only(prev: V2OnlyMap, names: readonly string[], now: number): V2OnlyMap {
  const clean = [...new Set(names.map(cleanDeviceName).filter(Boolean))];
  if (clean.length === 0) return prev;
  const next: V2OnlyMap = { ...prev };
  for (const n of clean) next[n] = now;
  const keys = Object.keys(next);
  if (keys.length > V2_ONLY_MAX) {
    keys.sort((a, b) => next[b] - next[a]);
    for (const k of keys.slice(V2_ONLY_MAX)) delete next[k];
  }
  return next;
}

/** Najświeższe pojawienie się starego urządzenia w ostatnich 14 dniach; `null` = nie było. */
export function latestV2Only(map: V2OnlyMap, now: number): number | null {
  let best: number | null = null;
  for (const at of Object.values(map)) {
    if (now - at <= V2_ONLY_RECENT_MS && (best === null || at > best)) best = at;
  }
  return best;
}

const store = createPersistedStore<V2OnlyMap>(SYNC.syncV2only, {}, {
  merge: (_d, stored) => (stored && typeof stored === "object" && !Array.isArray(stored)
    ? Object.fromEntries(Object.entries(stored as Record<string, unknown>).filter((e): e is [string, number] => typeof e[1] === "number" && e[0].length <= 40))
    : {}),
});

export function getV2Only(): V2OnlyMap {
  return store.get();
}

export function recordV2Only(names: readonly string[], now = Date.now()): void {
  const next = mergeV2Only(store.get(), names, now);
  if (next !== store.get()) store.set(next);
}

/** Urządzenie pojawiło się w v3 (zaktualizowane) albo użytkownik zamknął komunikat. */
export function clearV2Only(name: string): void {
  const cur = store.get();
  if (!Object.prototype.hasOwnProperty.call(cur, name)) return;
  const { [name]: _gone, ...rest } = cur;
  store.set(rest);
}

export function clearAllV2Only(): void {
  if (Object.keys(store.get()).length) store.set({});
}

export function useV2Only(): V2OnlyMap {
  return store.use();
}

/** Komunikaty do ustawień: w oknie — wpisy z 14 dni; po końcu okna — wszystkie, do ręcznego zamknięcia. */
export function v2OnlyNotices(map: V2OnlyMap, windowActive: boolean, now: number): { name: string; at: number }[] {
  return Object.entries(map)
    .filter(([, at]) => !windowActive || now - at <= V2_ONLY_RECENT_MS)
    .map(([name, at]) => ({ name, at }))
    .sort((a, b) => b.at - a.at);
}

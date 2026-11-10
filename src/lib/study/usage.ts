/**
 * Lokalny licznik użycia funkcji Pracy (plan B0.1). Tylko na tym telefonie: nie trafia do Yjs, kopii
 * ani sieci. Zapisuje nazwę funkcji, liczbę użyć i moment ostatniego — bez treści wpisów.
 * Służy do decyzji „co schować, co wysunąć” (plan Pracy na budowie, B2.2).
 */
import { useEffect } from "react";

export const USAGE_KEY = "kaczy.study.usage.v1";
const MAX_FEATURES = 60;
const NAME_RE = /^[a-z0-9][a-z0-9.-]{0,39}$/;
const DAY_MS = 86_400_000;

export interface UsageStat { n: number; last: number }
export type UsageMap = Record<string, UsageStat>;

/** Czyta licznik; uszkodzony zapis albo nieznany kształt daje pusty wynik. */
export function readUsage(): UsageMap {
  try {
    const raw = JSON.parse(localStorage.getItem(USAGE_KEY) ?? "{}") as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: UsageMap = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!NAME_RE.test(k) || !v || typeof v !== "object") continue;
      const { n, last } = v as Partial<UsageStat>;
      if (typeof n === "number" && Number.isFinite(n) && n > 0 && typeof last === "number" && Number.isFinite(last)) out[k] = { n: Math.floor(n), last };
    }
    return out;
  } catch {
    return {};
  }
}

/** Zlicza jedno użycie funkcji. Nigdy nie rzuca (tryb prywatny, brak miejsca). */
export function trackUse(feature: string, now = Date.now()): void {
  if (!NAME_RE.test(feature)) return;
  try {
    const map = readUsage();
    const cur = map[feature];
    map[feature] = { n: (cur?.n ?? 0) + 1, last: now };
    const keys = Object.keys(map);
    if (keys.length > MAX_FEATURES) {
      for (const k of keys.sort((a, b) => map[a].last - map[b].last).slice(0, keys.length - MAX_FEATURES)) delete map[k];
    }
    localStorage.setItem(USAGE_KEY, JSON.stringify(map));
  } catch {
    /* licznik jest dodatkiem */
  }
}

/** Liczy użycie za każdym razem, gdy `active` zmienia się na prawdę (otwarcie okna, wejście w zakładkę). */
export function useTrackUse(feature: string, active: boolean): void {
  useEffect(() => {
    if (active) trackUse(feature);
  }, [feature, active]);
}

export interface UsageRow { feature: string; n: number; last: number; idle: boolean }

/** Wiersze od najczęściej używanych; `idle` = ostatnie użycie starsze niż `idleDays`. */
export function usageRows(map: UsageMap, now = Date.now(), idleDays = 30): UsageRow[] {
  return Object.entries(map)
    .map(([feature, s]) => ({ feature, n: s.n, last: s.last, idle: now - s.last > idleDays * DAY_MS }))
    .sort((a, b) => b.n - a.n || a.feature.localeCompare(b.feature));
}

export function usageReportLines(map: UsageMap, now = Date.now()): string[] {
  const rows = usageRows(map, now);
  if (!rows.length) return ["brak"];
  return rows.map((r) => `${r.feature}: ${r.n}x, ostatnio ${new Date(r.last).toISOString().slice(0, 10)}${r.idle ? " (nieużywane od 30 dni)" : ""}`);
}

import { useSyncExternalStore } from "react";
import { getCurrentSeason, type Season } from "@/lib/season";

export type SeasonPref = "auto" | Season;

const STORAGE_KEY = "kaczy.seasonTheme.v1";

export const SEASON_META: Record<Season, { label: string; emoji: string }> = {
  spring: { label: "Wiosna", emoji: "🌸" },
  summer: { label: "Lato", emoji: "☀️" },
  autumn: { label: "Jesień", emoji: "🍂" },
  winter: { label: "Zima", emoji: "❄️" },
};

function read(): SeasonPref {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "auto" || raw === "spring" || raw === "summer" || raw === "autumn" || raw === "winter") return raw;
  } catch { /* ignore */ }
  return "auto";
}

let current: SeasonPref = read();
const listeners = new Set<() => void>();

export function getSeasonPref(): SeasonPref {
  return current;
}

/** Resolves "auto" to the season derived from today's date. */
export function resolveSeason(pref: SeasonPref = current): Season {
  return pref === "auto" ? getCurrentSeason().season : pref;
}

export function setSeasonPref(pref: SeasonPref) {
  current = pref;
  try { localStorage.setItem(STORAGE_KEY, pref); } catch { /* ignore */ }
  applySeasonAttr();
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Writes <html data-season="..."> so CSS can theme background + accents. */
export function applySeasonAttr() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.season = resolveSeason();
}

export function useSeasonPref() {
  const pref = useSyncExternalStore(subscribe, getSeasonPref, getSeasonPref);
  return { pref, season: resolveSeason(pref), setPref: setSeasonPref };
}

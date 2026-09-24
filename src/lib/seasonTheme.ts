import { getCurrentSeason, type Season } from "@/lib/season";
import { createPersistedStore } from "@/lib/persistedStore";

export type SeasonPref = "auto" | Season;

export const SEASON_META: Record<Season, { label: string; emoji: string }> = {
  spring: { label: "Wiosna", emoji: "🌸" },
  summer: { label: "Lato", emoji: "☀️" },
  autumn: { label: "Jesień", emoji: "🍂" },
  winter: { label: "Zima", emoji: "❄️" },
};

function isValidPref(v: unknown): v is SeasonPref {
  return v === "auto" || v === "spring" || v === "summer" || v === "autumn" || v === "winter";
}

const store = createPersistedStore<SeasonPref>("kaczy.seasonTheme.v1", "auto", {
  merge: (defaults, stored) => (isValidPref(stored) ? stored : defaults),
});

export function getSeasonPref(): SeasonPref {
  return store.get();
}

/** Resolves "auto" to the season derived from today's date. */
export function resolveSeason(pref: SeasonPref = store.get()): Season {
  return pref === "auto" ? getCurrentSeason().season : pref;
}

export function setSeasonPref(pref: SeasonPref) {
  store.set(pref);
  applySeasonAttr();
}

/** Writes <html data-season="..."> so CSS can theme background + accents. */
export function applySeasonAttr() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.season = resolveSeason();
}

export function useSeasonPref() {
  const pref = store.use();
  return { pref, season: resolveSeason(pref), setPref: setSeasonPref };
}

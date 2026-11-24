import { recordKey } from "./entryCheck";
import { distanceM, type GeoPoint } from "./geo";
import type { SiteInfo } from "./sites";

export interface StartDayCandidate {
  site: SiteInfo;
  /** Odległość od pozycji (m); `null` = brak pozycji albo budowa bez lokalizacji. */
  distance: number | null;
  /** Wejście na tę budowę jest już zapisane dziś. */
  entered: boolean;
}

/**
 * Budowy do wyboru w „Zacznij dzień” (R2.5): najpierw te z lokalizacją obok (od najbliższej),
 * potem reszta od ostatnio używanej. Zarchiwizowane pomijamy. Czysta funkcja — bez GPS i zapisu.
 */
export function startDayCandidates(
  sites: readonly SiteInfo[],
  at: GeoPoint | null,
  day: string,
  records: ReadonlyMap<string, { at?: number }>,
  nearM: number,
): StartDayCandidate[] {
  const list = sites
    .filter((s) => s.archived === undefined)
    .map((site): StartDayCandidate => ({
      site,
      distance: at && site.geo ? Math.round(distanceM(site.geo, at)) : null,
      entered: records.get(recordKey(site.id, day))?.at !== undefined,
    }));
  const near = (c: StartDayCandidate) => c.distance !== null && c.distance <= nearM;
  return list.sort((a, b) => {
    if (near(a) !== near(b)) return near(a) ? -1 : 1;
    if (near(a) && near(b)) return a.distance! - b.distance!;
    return (b.site.last ?? b.site.created) - (a.site.last ?? a.site.created);
  });
}

import { recordKey } from "./entryCheck";
import { nearestSite, type GeoPoint } from "./geo";
import type { SiteCard } from "./sites";

/**
 * P2.10 „Jesteś przy budowie X — Wchodzę?”: budowa z zapisaną lokalizacją (`SiteCard.geo`), najbliższa
 * w promieniu `NEAR_SITE_M`, na którą nie ma jeszcze wejścia tego dnia. Czysta logika — bez GPS i bez zapisu.
 */
export function arrivalSite(
  sites: readonly SiteCard[],
  at: GeoPoint,
  day: string,
  records: ReadonlyMap<string, { at?: number }>,
): SiteCard | null {
  const open = sites.filter((s) => !records.get(recordKey(s.id, day))?.at);
  return nearestSite(open, at);
}

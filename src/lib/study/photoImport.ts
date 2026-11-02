import { nearestSite, type GeoPoint } from "./geo";
import { JOURNAL_MAX_IMAGES } from "./journalEntry";

/**
 * H4.3 Zdjęcia z dnia: zdjęcia z galerii → propozycja wpisów. Czyste funkcje; odczyt plików i zapis
 * w `PhotoDayDialog.tsx`. Lokalizacja zdjęcia służy tylko do podpowiedzi budowy — nie trafia do wpisu
 * (lokalizacja zapisuje się wyłącznie po „Tu jestem”, decyzja 2026-10-18).
 */

export interface PhotoInfo {
  /** Indeks zdjęcia w wyborze. */
  key: number;
  /** Moment zrobienia (EXIF) albo zmiany pliku. */
  at: number;
  /** `true` = czas z EXIF; `false` = z daty pliku (może być datą skopiowania). */
  exact: boolean;
  geo?: GeoPoint;
}

export type SiteReason = "gps" | "day" | "current" | "none";

export interface PhotoGroup {
  keys: number[];
  start: number;
  end: number;
  /** Nazwa budowy (pusta = bez budowy). */
  site: string;
  why: SiteReason;
}

export interface GroupContext {
  sites: readonly { id: string; name: string; geo?: GeoPoint; archived?: number }[];
  /** Id budów z godzinami albo wpisami danego dnia (`YYYY-MM-DD`). */
  daySites: (day: string) => readonly string[];
  /** Bieżąca budowa (id); `null` = żadna. */
  current: string | null;
  dayKeyOf: (at: number) => string;
}

/** Przerwa w zdjęciach, po której zaczyna się nowy wpis. */
export const PHOTO_GAP_MS = 60 * 60 * 1000;
/** Zdjęcia w jednym imporcie — każde ląduje w magazynie urządzenia. */
export const PHOTO_IMPORT_MAX = 60;

/**
 * Zdjęcia → grupy na wpisy. Nowy wpis: przerwa ponad godzinę, inny dzień, inna budowa z GPS albo pełny
 * wpis (`max` zdjęć). Budowa grupy: z GPS (najbliższa w promieniu), z dnia (jedyna budowa z godzinami albo
 * wpisami tego dnia, bieżąca, jeśli jest wśród nich), bieżąca, a bez niej — żadna.
 */
export function groupPhotos(photos: readonly PhotoInfo[], ctx: GroupContext, max = JOURNAL_MAX_IMAGES): PhotoGroup[] {
  const sorted = [...photos].sort((a, b) => a.at - b.at || a.key - b.key);
  const gpsOf = (p: PhotoInfo) => (p.geo ? nearestSite(ctx.sites, p.geo)?.id : undefined);
  const raw: { photos: PhotoInfo[]; gps?: string }[] = [];
  for (const p of sorted) {
    const gps = gpsOf(p);
    const last = raw[raw.length - 1];
    const prev = last?.photos[last.photos.length - 1];
    const split = !last || !prev
      || p.at - prev.at > PHOTO_GAP_MS
      || ctx.dayKeyOf(p.at) !== ctx.dayKeyOf(prev.at)
      || (gps !== undefined && last.gps !== undefined && gps !== last.gps)
      || last.photos.length >= max;
    if (split) raw.push({ photos: [p], gps });
    else {
      last.photos.push(p);
      if (last.gps === undefined) last.gps = gps;
    }
  }
  const name = (id: string) => ctx.sites.find((s) => s.id === id)?.name ?? "";
  return raw.map((g) => {
    const start = g.photos[0].at;
    const end = g.photos[g.photos.length - 1].at;
    const keys = g.photos.map((p) => p.key);
    if (g.gps) return { keys, start, end, site: name(g.gps), why: "gps" as const };
    const day = ctx.daySites(ctx.dayKeyOf(start)).filter((id) => name(id));
    const fromDay = ctx.current && day.includes(ctx.current) ? ctx.current : day.length === 1 ? day[0] : undefined;
    if (fromDay) return { keys, start, end, site: name(fromDay), why: "day" as const };
    if (ctx.current && name(ctx.current)) return { keys, start, end, site: name(ctx.current), why: "current" as const };
    return { keys, start, end, site: "", why: "none" as const };
  });
}

/**
 * Lokalizacja wpisu i budowy („Tu jestem”). Zapisywana tylko po stuknięciu, nigdy w tle,
 * i widoczna tylko w aplikacji — raport dla szefa jej nie zawiera (decyzja 2026-10-18).
 * Czyste funkcje; pobranie pozycji z przeglądarki jest w `JournalEntrySheet` i `SiteCardDialog`.
 */
export interface GeoPoint {
  lat: number;
  lng: number;
  /** Dokładność w metrach (promień z `GeolocationCoordinates.accuracy`). */
  acc: number;
}

/** Budowa „obok” — wpis podpowiada ją, jeśli jest bliżej niż tyle metrów. */
export const NEAR_SITE_M = 300;

/** Dowolne wejście (peer, kopia) → punkt albo `undefined`. Współrzędne zaokrąglone do ~1 m. */
export function cleanGeo(raw: unknown): GeoPoint | undefined {
  const g = raw as Partial<GeoPoint> | null;
  if (!g || typeof g !== "object") return undefined;
  const { lat, lng, acc } = g;
  if (typeof lat !== "number" || typeof lng !== "number" || typeof acc !== "number") return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(acc)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || acc < 0) return undefined;
  const r5 = (v: number) => Math.round(v * 1e5) / 1e5;
  return { lat: r5(lat), lng: r5(lng), acc: Math.min(Math.round(acc), 100_000) };
}

/** Odległość po kuli ziemskiej (haversine), w metrach. */
export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Najbliższa budowa z zapisaną lokalizacją, w promieniu `maxM`; `null` = żadnej obok. */
export function nearestSite<T extends { geo?: GeoPoint; archived?: number }>(sites: readonly T[], at: GeoPoint, maxM = NEAR_SITE_M): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const s of sites) {
    if (!s.geo || s.archived !== undefined) continue;
    const d = distanceM(s.geo, at);
    if (d <= maxM && d < bestD) { best = s; bestD = d; }
  }
  return best;
}

/** Link do map (Google Maps działa w przeglądarce i otwiera aplikację map na telefonie). */
export function mapsUrl(p: GeoPoint): string {
  return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}

/** „±12 m” — dokładność odczytu, żeby było widać, czy pozycja jest pewna. */
export function accuracyLabel(p: GeoPoint): string {
  return p.acc >= 1000 ? `±${(p.acc / 1000).toFixed(1).replace(".", ",")} km` : `±${p.acc} m`;
}

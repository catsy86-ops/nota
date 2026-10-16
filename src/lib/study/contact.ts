import { formatPhone, normalizePhone } from "./boss";

/**
 * Kontakt i dojazd z karty budowy: linki `tel:`/`sms:` i nawigacja do adresu. Numer czyści
 * `normalizePhone` (ten sam co numer szefa w raporcie). Czyste funkcje; widok w `SiteCardDialog.tsx`.
 */

/** Telefon w polu karty — z miejscem na „+48 600 100 200 wew. 12”. */
export const SITE_PHONE_MAX = 40;
/** Dostęp do budowy (kod do bramy, klucze u sąsiada…) — jedno-dwa zdania. */
export const SITE_ACCESS_MAX = 300;

export const telHref = (raw: string) => { const n = normalizePhone(raw); return n ? `tel:+${n}` : null; };
export const smsHref = (raw: string) => { const n = normalizePhone(raw); return n ? `sms:+${n}` : null; };

/** Numer czytelnie („+48 600 100 200”); nie-numer zostaje, jak był wpisany. */
export function prettyPhone(raw: string): string {
  const n = normalizePhone(raw);
  return n ? formatPhone(n) : raw.trim();
}

/**
 * Nawigacja do adresu. Uniwersalny link Map Google: na Androidzie otwiera aplikację Mapy (z wyborem
 * nawigacji), na iPhonie i komputerze — stronę. Bez adresu — `null`.
 */
export function mapsHref(address: string): string | null {
  const a = address.trim();
  if (!a) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a)}`;
}

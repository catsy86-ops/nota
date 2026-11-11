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

/** Telefon jednym stuknięciem: do inwestora, a bez jego numeru — do kierownika. `null` = brak numeru. */
export function primaryCall(site: { phone?: string; managerPhone?: string }): { href: string; label: string } | null {
  const investor = site.phone ? telHref(site.phone) : null;
  if (investor) return { href: investor, label: `Zadzwoń do inwestora: ${prettyPhone(site.phone!)}` };
  const manager = site.managerPhone ? telHref(site.managerPhone) : null;
  if (manager) return { href: manager, label: `Zadzwoń do kierownika: ${prettyPhone(site.managerPhone!)}` };
  return null;
}

interface ContactsAPINavigator extends Navigator {
  contacts?: {
    select(properties: string[], options?: { multiple?: boolean }): Promise<Array<{ name?: string[]; tel?: string[] }>>;
  };
}

/** B3.8: Contact Picker API — Chrome na Androidzie, https i po geście użytkownika. */
export const hasContactPicker = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return typeof (navigator as ContactsAPINavigator).contacts?.select === "function";
};

export interface PickedContact {
  /** Numer telefonu pierwszego numeru kontaktu. */
  tel: string;
  /** Imię i nazwisko z kontaktu (do pola, jeśli puste). */
  name?: string;
}

const FIELD_MAX = 80;

/** Wybrany kontakt: pierwszy numer i nazwa. `null` = anulowano, kontakt bez numeru albo API zawiodło. */
export async function pickContact(): Promise<PickedContact | null> {
  try {
    const nav = navigator as ContactsAPINavigator;
    if (!nav.contacts) return null;
    const picked = await nav.contacts.select(["name", "tel"], { multiple: false });
    const tel = picked?.[0]?.tel?.find((t) => typeof t === "string" && t.trim() !== "");
    if (!tel) return null;
    const name = picked[0].name?.find((n) => typeof n === "string" && n.trim() !== "");
    return { tel: tel.trim().slice(0, SITE_PHONE_MAX), ...(name ? { name: name.replace(/\s+/g, " ").trim().slice(0, FIELD_MAX) } : {}) };
  } catch {
    return null;
  }
}

import { createPersistedStore } from "@/lib/persistedStore";
import { safeLine } from "@/lib/safeText";
import { normalizeNip } from "./nip";
import { cleanSeries } from "./numbering";
import type { Party } from "./invoice";
import { PRACA } from "@/lib/storage/names";

/**
 * Dane sprzedawcy na fakturze (nazwa firmy, NIP, adres) — dane firmy wykonawcy, na urządzeniu jak `companyName`
 * i wchodzą do kopii zapasowej. Seria numeracji jest osobno i NIE wchodzi do kopii: to cecha tego telefonu.
 */
export const SELLER_KEY = PRACA.seller;
export const SERIES_KEY = PRACA.ksefSeries;

export const EMPTY_SELLER: Party = { name: "", nip: "", address1: "", address2: "" };

const line = (v: unknown, max: number) => (typeof v === "string" ? safeLine(v).slice(0, max) : "");

export function cleanSellerPrefs(raw: unknown): Party {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Party>;
  return { name: line(r.name, 200), nip: normalizeNip(line(r.nip, 20)), address1: line(r.address1, 200), address2: line(r.address2, 200) };
}

export const sellerStore = createPersistedStore<Party>(SELLER_KEY, EMPTY_SELLER, {
  merge: (def, stored) => cleanSellerPrefs(stored) ?? def,
});
export const useSeller = () => sellerStore.use();
export const setSeller = (p: Party) => sellerStore.set(cleanSellerPrefs(p));

export const seriesStore = createPersistedStore<string>(SERIES_KEY, "A", {
  merge: (def, stored) => (typeof stored === "string" ? cleanSeries(stored) : def),
});
export const useSeries = () => seriesStore.use();
export const setSeries = (s: string) => seriesStore.set(cleanSeries(s));

export const DEVICE_ID_KEY = PRACA.ksefDeviceId;

/** Losowy identyfikator tego urządzenia (nie wchodzi do kopii); służy do wykrycia, że dwie osoby użyły tej samej serii. */
export function getDeviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored && /^[a-z0-9]{6,32}$/.test(stored)) return stored;
    const id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return "anon";
  }
}

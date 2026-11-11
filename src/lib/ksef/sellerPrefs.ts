import { createPersistedStore } from "@/lib/persistedStore";
import { safeLine } from "@/lib/safeText";
import { normalizeNip } from "./nip";
import { cleanSeries } from "./numbering";
import type { Party } from "./invoice";

/**
 * Dane sprzedawcy na fakturze (nazwa firmy, NIP, adres) — dane firmy wykonawcy, na urządzeniu jak `companyName`
 * i wchodzą do kopii zapasowej. Seria numeracji jest osobno i NIE wchodzi do kopii: to cecha tego telefonu.
 */
export const SELLER_KEY = "kaczy.study.seller.v1";
export const SERIES_KEY = "kaczy.ksef.series.v1";

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

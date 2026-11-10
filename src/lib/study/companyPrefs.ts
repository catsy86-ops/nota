import { createPersistedStore } from "@/lib/persistedStore";
import { safeLine } from "@/lib/safeText";
import type { CompanyPricing } from "@/lib/pricing";
import { EMPTY_PRICING, cleanPricing } from "@/lib/pricing";

/**
 * Nazwa firmy na nagłówku protokołu PDF (P2.5, Ustawienia → Praca). Pusta = bez nagłówka.
 * Trzymana na urządzeniu: to dane firmy, nie budowy, więc nie idzie do dokumentu Nauki.
 */
export const COMPANY_NAME_KEY = "kaczy.study.companyName.v1";
export const COMPANY_NAME_MAX = 80;

export const companyNameStore = createPersistedStore<string>(COMPANY_NAME_KEY, "", {
  merge: (def, stored) => (typeof stored === "string" ? stored.slice(0, COMPANY_NAME_MAX) : def),
});

export const setCompanyName = (name: string) => companyNameStore.set(name.slice(0, COMPANY_NAME_MAX));
export const useCompanyName = () => companyNameStore.use();

/**
 * B4.1 Cennik robocizny dla fuch (własne pozycje typu „WC: 350 zł").
 * Trzymany na urządzeniu — dane firmy, nie budowy.
 */
export const PRICING_KEY = "kaczy.study.pricing.v1";

export const pricingStore = createPersistedStore<CompanyPricing>(PRICING_KEY, EMPTY_PRICING, {
  merge: (def, stored) => cleanPricing(stored) || def,
});

export const setPricing = (pricing: CompanyPricing) => pricingStore.set(pricing);
export const usePricing = () => pricingStore.use();

/**
 * H5.1 Autor: imię osoby na tym urządzeniu („Marek”) dopisywane do nowych wpisów, braków i kroków punktów
 * (pole `by`). Na urządzeniu, nie w dokumencie — każdy telefon to inna osoba. Pusty = bez autora.
 */
export const AUTHOR_KEY = "kaczy.study.author.v1";
export const AUTHOR_MAX = 40;
export const cleanAuthor = (v: unknown): string | undefined => {
  const t = typeof v === "string" ? safeLine(v).slice(0, AUTHOR_MAX) : "";
  return t || undefined;
};
export const authorStore = createPersistedStore<string>(AUTHOR_KEY, "", {
  merge: (def, stored) => cleanAuthor(stored) ?? def,
});
export const setAuthor = (name: string) => authorStore.set(cleanAuthor(name) ?? "");
export const useAuthor = () => authorStore.use();
/** Autor do zapisu; `undefined` = nie ustawiony. */
export const currentAuthor = () => cleanAuthor(authorStore.get());
/** Kogo pokazać przy pozycji: autor inny niż osoba na tym urządzeniu (swoje wpisy bez podpisu). */
export const otherAuthor = (by: string | undefined, me: string) => (by && by !== me ? by : undefined);

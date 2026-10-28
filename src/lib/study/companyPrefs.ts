import { createPersistedStore } from "@/lib/persistedStore";

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

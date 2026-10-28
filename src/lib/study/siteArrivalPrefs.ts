import { createPersistedStore } from "@/lib/persistedStore";

/**
 * P2.10: podpowiedź „Jesteś przy budowie” przy otwarciu aplikacji. Domyślnie wyłączona — lokalizacja
 * pytana tylko po włączeniu w Ustawieniach (Praca). Jedno odczytanie położenia, bez śledzenia w tle.
 */
export const SITE_ARRIVAL_KEY = "kaczy.study.siteArrival.v1";

export const siteArrivalStore = createPersistedStore<boolean>(SITE_ARRIVAL_KEY, false, {
  merge: (def, stored) => (typeof stored === "boolean" ? stored : def),
});

export const setSiteArrival = (on: boolean) => siteArrivalStore.set(on);
export const useSiteArrival = () => siteArrivalStore.use();

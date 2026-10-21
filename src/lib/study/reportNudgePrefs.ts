import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Podpowiedzi „Raport dnia/tygodnia gotowy” w aplikacji (dymek i powiadomienie systemowe).
 * Osobno od kategorii push „raporty” — ta sama treść, dwie drogi. Domyślnie włączone.
 */
export const REPORT_NUDGES_KEY = "kaczy.study.reportNudges.v1";

export const reportNudgesStore = createPersistedStore<boolean>(REPORT_NUDGES_KEY, true, {
  merge: (def, stored) => (typeof stored === "boolean" ? stored : def),
});

export const setReportNudges = (on: boolean) => reportNudgesStore.set(on);
export const useReportNudges = () => reportNudgesStore.use();

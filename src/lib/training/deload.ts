import { createPersistedStore } from "@/lib/persistedStore";
import { CWICZENIA } from "@/lib/storage/names";

/**
 * C2.5: odrzucenie podpowiedzi „tydzień lżej” na bieżący tydzień — zapamiętany poniedziałek tego tygodnia.
 * W następnym tygodniu (inny poniedziałek) podpowiedź wraca, jeśli seria trwa. Per urządzenie, poza kopią.
 */
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export const deloadDismissedStore = createPersistedStore<string | null>(CWICZENIA.deloadDismissed, null, {
  merge: (def, stored) => (isDay(stored) ? stored : def),
});

export const useDeloadDismissed = () => deloadDismissedStore.use();
export const dismissDeload = (weekStart: string) => deloadDismissedStore.set(weekStart);

import { createPersistedStore } from "@/lib/persistedStore";

/** Czas przerwy między seriami (1.2): wybór z krótkiej listy, zapamiętany na urządzeniu. */
export const REST_OPTIONS = [60, 90, 120, 180] as const;
export type RestSeconds = (typeof REST_OPTIONS)[number];
export const REST_DEFAULT: RestSeconds = 90;
export const REST_KEY = "kaczy.training.restSeconds.v1";

export const restStore = createPersistedStore<RestSeconds>(REST_KEY, REST_DEFAULT, {
  merge: (def, stored) => (REST_OPTIONS.includes(stored as RestSeconds) ? (stored as RestSeconds) : def),
});

export const setRestSeconds = (s: RestSeconds) => restStore.set(s);
export const useRestSeconds = () => restStore.use();

/** „90 s” albo „2 min”. */
export const restLabel = (s: number): string => (s % 60 === 0 ? `${s / 60} min` : `${s} s`);

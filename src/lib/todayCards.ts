import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Karty opcjonalne na Dziś (D-2, plan Dziś 4.1). Zapis tylko na tym urządzeniu: telefon na budowie
 * i komputer w domu mogą mieć inne karty, więc nie idą przez synchronizację.
 */
export interface TodayCards {
  brainTraining: boolean;
  weeklyReview: boolean;
}

export const TODAY_CARDS_DEFAULTS: TodayCards = { brainTraining: true, weeklyReview: true };

export const todayCardsStore = createPersistedStore<TodayCards>("kaczy.todayCards.v1", TODAY_CARDS_DEFAULTS, {
  merge: (defaults, stored) => {
    if (!stored || typeof stored !== "object") return defaults;
    return {
      brainTraining: typeof stored.brainTraining === "boolean" ? stored.brainTraining : defaults.brainTraining,
      weeklyReview: typeof stored.weeklyReview === "boolean" ? stored.weeklyReview : defaults.weeklyReview,
    };
  },
});

export const useTodayCards = () => todayCardsStore.use();

export function setTodayCard(key: keyof TodayCards, on: boolean): void {
  todayCardsStore.set({ ...todayCardsStore.get(), [key]: on });
}

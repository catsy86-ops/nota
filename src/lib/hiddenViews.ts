import type { View } from "@/hooks/useFilteredNotes";
import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Działy, które można ukryć (PW-3, plan Powłoki 2.2). Notatki, Dziś, Archiwum i Kosz zostają zawsze.
 * Ukrycie zabiera dział z paska bocznego, z „Więcej” i z palety; dane zostają, a link dalej działa.
 */
export const HIDEABLE_VIEWS = ["inbox", "reminders", "calendar", "shifts", "study", "debts", "cwiczenia"] as const satisfies readonly View[];
export type HideableView = (typeof HIDEABLE_VIEWS)[number];

/** Odczyt zapisu: nieznane wartości odrzucamy, więc starsza albo uszkodzona wartość nie ukrywa niczego przypadkiem. */
export const hiddenViewsStore = createPersistedStore<HideableView[]>("kaczy.hiddenViews.v1", [], {
  merge: (defaults, stored) => (Array.isArray(stored) ? stored.filter((v): v is HideableView => (HIDEABLE_VIEWS as readonly string[]).includes(v)) : defaults),
});

export const useHiddenViews = () => hiddenViewsStore.use();

export function setViewHidden(view: HideableView, hidden: boolean): void {
  const cur = hiddenViewsStore.get();
  const next = hidden ? [...cur.filter((v) => v !== view), view] : cur.filter((v) => v !== view);
  hiddenViewsStore.set(next);
}

/** Czy dział jest pokazany (wszystko poza listą ukrytych, także Notatki i Kosz). */
export const isViewShown = (hidden: readonly View[], view: View): boolean => !hidden.includes(view);

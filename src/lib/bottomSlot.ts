import type { View } from "@/hooks/useFilteredNotes";
import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Czwarta pozycja dolnego paska (plan Powłoki 2.3): domyślnie Terminy, do wyboru Grafik, Praca,
 * Kalendarz i Skrzynka. Zapis per urządzenie; wybór z Ustawień → Wygląd.
 */
export const BOTTOM_SLOT_VIEWS = ["reminders", "shifts", "study", "calendar", "inbox"] as const satisfies readonly View[];
export type BottomSlotView = (typeof BOTTOM_SLOT_VIEWS)[number];

export const bottomSlotStore = createPersistedStore<BottomSlotView>("kaczy.bottomSlot.v1", "reminders", {
  merge: (defaults, stored) => ((BOTTOM_SLOT_VIEWS as readonly string[]).includes(stored) ? stored : defaults),
});

export const useBottomSlot = () => bottomSlotStore.use();

export function setBottomSlot(view: BottomSlotView): void {
  bottomSlotStore.set(view);
}

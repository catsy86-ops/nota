import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Układ Terminów (2.6, decyzja T-3): kafle na komputerze, lista na telefonie, a wybór zapisany na tym
 * urządzeniu. `null` = nie wybrano jeszcze — wtedy o układzie decyduje ekran.
 */
export type RemindersLayout = "tiles" | "list";

export const remindersLayoutStore = createPersistedStore<RemindersLayout | null>("kaczy.remindersLayout.v1", null, {
  merge: (defaults, stored) => (stored === "tiles" || stored === "list" ? stored : defaults),
});

export const useRemindersLayoutChoice = () => remindersLayoutStore.use();

/** Układ do pokazania: wybór użytkownika, a bez niego lista na telefonie i kafle na komputerze. */
export function effectiveRemindersLayout(choice: RemindersLayout | null, isMobile: boolean): RemindersLayout {
  return choice ?? (isMobile ? "list" : "tiles");
}

export function setRemindersLayout(layout: RemindersLayout): void {
  remindersLayoutStore.set(layout);
}

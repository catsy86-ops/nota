import { createPersistedStore } from "@/lib/persistedStore";

export type ConfirmKey = "trash" | "archive";

export interface ConfirmPrefs {
  trash: boolean;
  archive: boolean;
}

// Kosz i archiwum są odwracalne (kosz 30 dni, archiwum bez limitu), więc domyślnie bez pytania — jest „Cofnij” w toaście (plan 3.1).
const DEFAULTS: ConfirmPrefs = { trash: false, archive: false };

const store = createPersistedStore<ConfirmPrefs>("kaczy.confirmPrefs.v1", DEFAULTS, {
  merge: (defaults, stored) =>
    stored !== null && typeof stored === "object" && !Array.isArray(stored) ? { ...defaults, ...stored } : defaults,
});

export function getConfirmPrefs(): ConfirmPrefs {
  return store.get();
}

export function setConfirmPref(key: ConfirmKey, value: boolean) {
  store.set({ ...store.get(), [key]: value });
}

export function useConfirmPrefs(): ConfirmPrefs {
  return store.use();
}

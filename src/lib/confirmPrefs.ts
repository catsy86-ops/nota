import { createPersistedStore } from "@/lib/persistedStore";

export type ConfirmKey = "trash" | "archive";

export interface ConfirmPrefs {
  trash: boolean;
  archive: boolean;
}

const DEFAULTS: ConfirmPrefs = { trash: true, archive: true };

const store = createPersistedStore<ConfirmPrefs>("kaczy.confirmPrefs.v1", DEFAULTS, {
  merge: (defaults, stored) => ({ ...defaults, ...stored }),
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

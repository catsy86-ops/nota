import { useSyncExternalStore } from "react";

export type ConfirmKey = "trash" | "archive";

export interface ConfirmPrefs {
  trash: boolean;
  archive: boolean;
}

const STORAGE_KEY = "kaczy.confirmPrefs.v1";

const DEFAULTS: ConfirmPrefs = { trash: true, archive: true };

function read(): ConfirmPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

let current: ConfirmPrefs = read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getConfirmPrefs(): ConfirmPrefs {
  return current;
}

export function setConfirmPref(key: ConfirmKey, value: boolean) {
  current = { ...current, [key]: value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useConfirmPrefs(): ConfirmPrefs {
  return useSyncExternalStore(subscribe, getConfirmPrefs, () => DEFAULTS);
}

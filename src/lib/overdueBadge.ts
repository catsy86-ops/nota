import { createPersistedStore } from "@/lib/persistedStore";

export const BADGE_KEY = "kaczy:badge.enabled";
export const BASE_TITLE = "NOTKI";

const store = createPersistedStore<boolean>(BADGE_KEY, true, {
  merge: (defaults, stored) => (typeof stored === "boolean" ? stored : defaults),
});

export const setBadgeEnabled = (v: boolean) => store.set(v);
export const useBadgeEnabled = () => store.use();

/** Tytuł karty: „(3) G” przy zaległych, sam tytuł bazowy przy zerze. */
export function formatBadgeTitle(base: string, count: number): string {
  const n = Math.floor(count);
  return n > 0 ? `(${n > 99 ? "99+" : n}) ${base}` : base;
}

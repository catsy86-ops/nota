import { createPersistedStore } from "@/lib/persistedStore";
import { APP_NAME } from "@/lib/appName";

export const BADGE_KEY = "kaczy:badge.enabled";
export const BASE_TITLE = APP_NAME;

const store = createPersistedStore<boolean>(BADGE_KEY, true, {
  merge: (defaults, stored) => (typeof stored === "boolean" ? stored : defaults),
});

export const setBadgeEnabled = (v: boolean) => store.set(v);
export const useBadgeEnabled = () => store.use();

/**
 * Skrzynka 5.3: licznik nieposortowanych notatek dokładany do znaczka aplikacji. Domyślnie wyłączony —
 * znaczek pokazuje wtedy tylko zaległe, jak dotąd.
 */
export const INBOX_BADGE_KEY = "kaczy.badge.inbox.v1";

const inboxStore = createPersistedStore<boolean>(INBOX_BADGE_KEY, false, {
  merge: (defaults, stored) => (typeof stored === "boolean" ? stored : defaults),
});

export const setInboxBadgeEnabled = (v: boolean) => inboxStore.set(v);
export const useInboxBadgeEnabled = () => inboxStore.use();

/**
 * Liczba na znaczku aplikacji: zaległe (gdy ich licznik jest włączony) plus Skrzynka (gdy jest włączona).
 * Obie wyłączone albo zero = bez znaczka.
 */
export function appBadgeCount(overdue: number, inbox: number, flags: { overdueOn: boolean; inboxOn: boolean }): number {
  return (flags.overdueOn ? overdue : 0) + (flags.inboxOn ? inbox : 0);
}

/** Tytuł karty: „(3) NOTKI” przy zaległych, sam tytuł bazowy przy zerze. */
export function formatBadgeTitle(base: string, count: number): string {
  const n = Math.floor(count);
  return n > 0 ? `(${n > 99 ? "99+" : n}) ${base}` : base;
}

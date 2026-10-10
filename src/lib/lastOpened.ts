import { createPersistedStore } from "@/lib/persistedStore";

/**
 * „Ostatnio otwierane” — tylko lokalnie. Celowo poza dokumentem Yjs: otwarcie
 * notatki nie jest zmianą treści i nie ma po co trafiać do synchronizacji
 * (ani zaśmiecać historii) na każdym urządzeniu.
 */
export type LastOpenedMap = Record<string, number>;

const MAX_ENTRIES = 500;

const store = createPersistedStore<LastOpenedMap>("kaczy.lastOpened.v1", {}, {
  merge: (_defaults, stored) => (stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {}),
});

export function getLastOpened(): LastOpenedMap {
  return store.get();
}

export function useLastOpened(): LastOpenedMap {
  return store.use();
}

export function markNoteOpened(id: string, now = Date.now()) {
  const next: LastOpenedMap = { ...store.get(), [id]: now };
  const ids = Object.keys(next);
  if (ids.length > MAX_ENTRIES) {
    ids.sort((a, b) => next[a] - next[b]);
    for (const old of ids.slice(0, ids.length - MAX_ENTRIES)) delete next[old];
  }
  store.set(next);
}

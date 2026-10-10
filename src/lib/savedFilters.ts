import { createPersistedStore } from "@/lib/persistedStore";

/** Zapisane zapytanie wyszukiwarki („filtr inteligentny”). */
export interface SavedFilter {
  id: string;
  name: string;
  query: string;
}

export const MAX_FILTER_NAME = 40;
export const MAX_SAVED_FILTERS = 50;

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

/** Dane z localStorage są niezaufane — zostają tylko poprawne wpisy. */
export function sanitizeFilters(raw: unknown): SavedFilter[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SavedFilter[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const { id, name, query } = x as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string" || typeof query !== "string") continue;
    const n = clean(name).slice(0, MAX_FILTER_NAME);
    const q = query.trim();
    if (!id || !n || !q || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name: n, query: q });
  }
  return out.slice(0, MAX_SAVED_FILTERS);
}

/** Czyste: dodaje filtr na końcu. Pusta nazwa lub zapytanie → bez zmian. */
export function addFilter(list: SavedFilter[], name: string, query: string, id: string): SavedFilter[] {
  const n = clean(name).slice(0, MAX_FILTER_NAME);
  const q = query.trim();
  if (!n || !q || list.length >= MAX_SAVED_FILTERS) return list;
  return [...list, { id, name: n, query: q }];
}

export function renameFilter(list: SavedFilter[], id: string, name: string): SavedFilter[] {
  const n = clean(name).slice(0, MAX_FILTER_NAME);
  if (!n) return list;
  return list.map((f) => (f.id === id ? { ...f, name: n } : f));
}

export function removeFilter(list: SavedFilter[], id: string): SavedFilter[] {
  return list.filter((f) => f.id !== id);
}

/** Porównanie zapytań z pominięciem spacji na brzegach i wielkości liter. */
export function sameQuery(a: string, b: string): boolean {
  return clean(a).toLowerCase() === clean(b).toLowerCase();
}

const store = createPersistedStore<SavedFilter[]>("kaczy.savedFilters.v1", [], {
  merge: (_defaults, stored) => sanitizeFilters(stored),
});

export const savedFiltersStore = store;

export function useSavedFilters() {
  const filters = store.use();
  return {
    filters,
    add: (name: string, query: string) => store.set(addFilter(store.get(), name, query, crypto.randomUUID())),
    rename: (id: string, name: string) => store.set(renameFilter(store.get(), id, name)),
    remove: (id: string) => store.set(removeFilter(store.get(), id)),
  };
}

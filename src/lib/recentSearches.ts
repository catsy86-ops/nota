const STORAGE_KEY = "kaczy.recentSearches.v1";
export const MAX_RECENT_SEARCHES = 5;

/** Czysto: dodaje zapytanie na początek, bez duplikatów (bez rozróżniania wielkości liter), max 5. */
export function pushRecentSearch(list: string[], query: string): string[] {
  const q = query.trim().replace(/\s+/g, " ");
  if (q.length < 2) return list;
  const lower = q.toLowerCase();
  return [q, ...list.filter((x) => x.toLowerCase() !== lower)].slice(0, MAX_RECENT_SEARCHES);
}

export function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Dane z localStorage traktujemy jak niezaufane.
    return parsed
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.slice(0, 80))
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function saveRecentSearch(query: string): string[] {
  const next = pushRecentSearch(loadRecentSearches(), query);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

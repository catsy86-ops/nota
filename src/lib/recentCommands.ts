const STORAGE_KEY = "kaczy.recentCommands.v1";
export const MAX_RECENT_COMMANDS = 3;

/** Czysto: dodaje polecenie na początek, bez duplikatów, max 3. */
export function pushRecentCommand(list: readonly string[], id: string): string[] {
  return [id, ...list.filter((x) => x !== id)].slice(0, MAX_RECENT_COMMANDS);
}

/** Wczytuje tylko znane identyfikatory — dane z localStorage traktujemy jak niezaufane. */
export function loadRecentCommands(known: readonly string[]): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string" && known.includes(x))
      .filter((x, i, a) => a.indexOf(x) === i)
      .slice(0, MAX_RECENT_COMMANDS);
  } catch {
    return [];
  }
}

export function saveRecentCommand(known: readonly string[], id: string): string[] {
  const next = pushRecentCommand(loadRecentCommands(known), id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Brak localStorage (tryb prywatny) — lista działa tylko w tej sesji.
  }
  return next;
}

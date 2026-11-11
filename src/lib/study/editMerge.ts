import type { JournalEntry } from "./journalEntry";

/** JSON z posortowanymi kluczami — porównanie wartości niezależne od kolejności pól obiektu. */
function stable(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x)
    ? Object.fromEntries(Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
    : x));
}

/**
 * Scalanie edycji wpisu (W4): `base` — wpis w chwili otwarcia arkusza, `mine` — to, co wyszło z formularza,
 * `current` — wpis w dokumencie teraz (mógł się zmienić na drugim telefonie, gdy arkusz był otwarty). Pole, którego
 * użytkownik nie ruszył (`mine` = `base`), zostaje takie, jakie jest teraz; pole zmienione w arkuszu wygrywa.
 * Bez `base` (stare ścieżki) działa jak dotąd: wygrywa formularz.
 */
export function mergeEdit(base: JournalEntry | undefined, mine: JournalEntry, current: JournalEntry | undefined): JournalEntry {
  if (!base || !current) return mine;
  const out: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(mine), ...Object.keys(base), ...Object.keys(current)]);
  const b = base as unknown as Record<string, unknown>;
  const m = mine as unknown as Record<string, unknown>;
  const c = current as unknown as Record<string, unknown>;
  for (const k of keys) {
    const v = stable(m[k]) === stable(b[k]) ? c[k] : m[k];
    if (v !== undefined) out[k] = v;
  }
  out.id = mine.id;
  return out as unknown as JournalEntry;
}

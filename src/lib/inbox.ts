/**
 * Skrzynka: notatki „do posortowania” — bez folderu, bez etykiet i nie będące podnotatką.
 * Bez osobnego pola w danych: skrzynka to reguła nad istniejącymi notatkami, więc
 * sortowanie (przeniesienie do folderu albo nadanie etykiety) od razu ją opróżnia.
 */
/** „Odłożona” (S-1): termin odłożenia jeszcze nie minął, więc notatki nie ma w Skrzynce. */
export function isSnoozed(n: { snoozedUntil?: number }, now: number = Date.now()): boolean {
  return n.snoozedUntil !== undefined && n.snoozedUntil > now;
}

/**
 * Notatka prywatna (zablokowana) nigdy nie jest w skrzynce: ani na liście, ani w liczniku.
 * Odłożona (S-1) też nie, aż do swojego terminu.
 */
export function isInboxNote(n: { folderId?: string | null; labels: readonly string[]; parentId?: string | null; locked?: boolean; snoozedUntil?: number }): boolean {
  return !n.locked && !n.folderId && n.labels.length === 0 && !n.parentId && !isSnoozed(n);
}

export const INBOX_TITLE_MAX = 120;

/**
 * Tekst z pola przechwytywania → tytuł (pierwsza linia) i treść (reszta).
 * Jednolinijkowy wpis nie dubluje się w treści. `null` = pusty tekst.
 */
export function captureParts(raw: string): { title: string; content: string } | null {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const first = (lines[0] ?? "").trim();
  const rest = lines.slice(1).join("\n").trim();
  if (!first && !rest) return null;
  if (!first) return { title: rest.slice(0, INBOX_TITLE_MAX), content: rest.slice(INBOX_TITLE_MAX) };
  // Za długa pierwsza linia: tytuł to początek, reszta idzie do treści — nic nie przepada.
  const head = first.slice(0, INBOX_TITLE_MAX);
  const tail = first.slice(INBOX_TITLE_MAX).trim();
  const content = [tail, rest].filter(Boolean).join("\n");
  return { title: head, content };
}

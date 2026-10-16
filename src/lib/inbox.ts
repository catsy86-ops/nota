/**
 * Skrzynka: notatki „do posortowania” — bez folderu, bez etykiet i nie będące podnotatką.
 * Bez osobnego pola w danych: skrzynka to reguła nad istniejącymi notatkami, więc
 * sortowanie (przeniesienie do folderu albo nadanie etykiety) od razu ją opróżnia.
 */
export function isInboxNote(n: { folderId?: string | null; labels: readonly string[]; parentId?: string | null }): boolean {
  return !n.folderId && n.labels.length === 0 && !n.parentId;
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
  if (!first) return { title: rest.slice(0, INBOX_TITLE_MAX), content: "" };
  return { title: first.slice(0, INBOX_TITLE_MAX), content: rest };
}

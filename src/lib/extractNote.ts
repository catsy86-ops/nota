/**
 * Wyodrębnianie zaznaczenia do nowej notatki (Sieć wiedzy, Faza 3). Zaznaczony fragment
 * przechodzi do nowej notatki, a w bieżącej zostaje `[[tytuł]]`. Tu czysta logika:
 * tytuł z pierwszej linii, unikalność tytułu i podmiana zaznaczenia. Zapis i UI są w
 * `useNoteEditSession` (`handleExtractSelection`) i `NoteEditor`.
 */

/** Najdłuższy tytuł z zaznaczenia — dłuższy zostaje przycięty do granicy słowa. */
export const EXTRACT_TITLE_MAX = 60;

/** Tytuł, gdy zaznaczenie nie daje żadnego tekstu do nazwania. */
export const EXTRACT_TITLE_FALLBACK = "Wyodrębniona notatka";

/** Znaki, których nie wolno w tytule, bo psują składnię `[[cel|tekst#nagłówek]]`. */
const WIKI_UNSAFE = /[[\]|#]/g;

/**
 * Tytuł z pierwszej niepustej linii zaznaczenia: bez znaczników Markdown (nagłówek, lista,
 * cytat, pogrubienie) i bez znaków składni linku, z przyciętymi białymi znakami.
 */
export function titleFromSelection(selected: string): string {
  const firstLine = selected.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const plain = firstLine
    .replace(/^(?:#{1,6}\s+|>\s*|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/, "")
    .replace(/[*~`]/g, "")
    .replace(WIKI_UNSAFE, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return EXTRACT_TITLE_FALLBACK;
  if (plain.length <= EXTRACT_TITLE_MAX) return plain;
  const cut = plain.slice(0, EXTRACT_TITLE_MAX);
  const space = cut.lastIndexOf(" ");
  // Przycięcie do spacji tylko wtedy, gdy nie kasuje połowy tytułu.
  return (space > EXTRACT_TITLE_MAX / 2 ? cut.slice(0, space) : cut).trim();
}

/**
 * Tytuł wolny wśród istniejących (bez względu na wielkość liter): wikilink wskazuje na pierwszą
 * notatkę o tym tytule, więc nowa notatka dostaje sufiks „(2)”, zamiast przekierować stary link.
 */
export function uniqueNoteTitle(base: string, existingTitles: string[]): string {
  const taken = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

/** Podmienia zaznaczenie `[start, end)` na link do `title`. Zwraca nową treść i pozycję kursora za linkiem. */
export function replaceSelectionWithLink(content: string, start: number, end: number, title: string): { content: string; caret: number } {
  const link = `[[${title}]]`;
  return {
    content: content.slice(0, start) + link + content.slice(end),
    caret: start + link.length,
  };
}

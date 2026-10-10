/** Wyszukiwanie i zamiana w treści jednej notatki (pasek „Znajdź i zamień” w edytorze). */

export interface FindOptions {
  caseSensitive?: boolean;
}

/** Początki wszystkich nienakładających się wystąpień `query` w `text`. */
export function findMatches(text: string, query: string, { caseSensitive = false }: FindOptions = {}): number[] {
  if (!query) return [];
  const hay = caseSensitive ? text : text.toLocaleLowerCase("pl");
  const needle = caseSensitive ? query : query.toLocaleLowerCase("pl");
  // `toLocaleLowerCase` może zmienić długość (np. „İ”) — wtedy indeksy nie pasują do tekstu.
  if (hay.length !== text.length) return findMatches(text, query, { caseSensitive: true });
  const out: number[] = [];
  for (let i = hay.indexOf(needle); i !== -1; i = hay.indexOf(needle, i + needle.length)) out.push(i);
  return out;
}

/** Zamienia jedno wystąpienie zaczynające się w `at`. */
export function replaceAt(text: string, at: number, length: number, replacement: string): string {
  return text.slice(0, at) + replacement + text.slice(at + length);
}

/** Zamienia wszystkie wystąpienia; zwraca nowy tekst i ich liczbę. */
export function replaceAll(text: string, query: string, replacement: string, opts: FindOptions = {}): { text: string; count: number } {
  const matches = findMatches(text, query, opts);
  if (matches.length === 0) return { text, count: 0 };
  let out = "";
  let last = 0;
  for (const at of matches) {
    out += text.slice(last, at) + replacement;
    last = at + query.length;
  }
  return { text: out + text.slice(last), count: matches.length };
}

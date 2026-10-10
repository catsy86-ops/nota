import { fold } from "@/lib/searchQuery";

export interface Suggestion {
  /** Tekst na liście. */
  label: string;
  /** Co wstawić w miejsce ostatniego tokenu. */
  insert: string;
}

export interface SuggestContext {
  labels: string[];
  folders: string[];
}

const OPERATORS: Suggestion[] = [
  { label: "etykieta:", insert: "etykieta:" },
  { label: "folder:", insert: "folder:" },
  { label: "ma:przypomnienie", insert: "ma:przypomnienie " },
  { label: "ma:obraz", insert: "ma:obraz " },
  { label: "ma:lista", insert: "ma:lista " },
  { label: "ma:zalacznik", insert: "ma:zalacznik " },
  { label: "brak:przypomnienia", insert: "brak:przypomnienia " },
  { label: "brak:etykiety", insert: "brak:etykiety " },
  { label: "brak:folderu", insert: "brak:folderu " },
  { label: "priorytet:wysoki", insert: "priorytet:wysoki " },
  { label: "przypięte", insert: "przypięte " },
  { label: "lista:otwarte", insert: "lista:otwarte " },
  { label: "starsze:30d", insert: "starsze:30d " },
  { label: "nowsze:7d", insert: "nowsze:7d " },
];

const quoteIfNeeded = (v: string) => (/\s/.test(v) ? `"${v}"` : v);

/** Indeks początku ostatniego tokenu (z uwzględnieniem cudzysłowów). */
function lastTokenStart(q: string): number {
  let start = 0;
  let inQuote = false;
  for (let i = 0; i < q.length; i++) {
    const ch = q[i];
    if (ch === '"') inQuote = !inQuote;
    else if (/\s/.test(ch) && !inQuote) start = i + 1;
  }
  return start;
}

/**
 * Podpowiedzi dla ostatniego, jeszcze niedokończonego tokenu zapytania.
 * `etykieta:` / `folder:` → istniejące nazwy; początek operatora → operatory.
 */
export function suggestOperators(query: string, ctx: SuggestContext, limit = 8): { from: number; items: Suggestion[] } {
  const from = lastTokenStart(query);
  const token = query.slice(from);
  if (!token) return { from, items: [] };

  const m = token.match(/^([^:"\s]+):(.*)$/);
  if (m) {
    const key = fold(m[1]);
    const source = key === "etykieta" || key === "label" ? ctx.labels : key === "folder" ? ctx.folders : null;
    if (!source) return { from, items: [] };
    const typed = fold(m[2].replace(/"/g, ""));
    const items = source
      .filter((name) => fold(name).includes(typed) && fold(name) !== typed)
      .slice(0, limit)
      .map((name) => ({ label: name, insert: `${m[1]}:${quoteIfNeeded(name)} ` }));
    return { from, items };
  }

  const typed = fold(token);
  const items = OPERATORS.filter((o) => fold(o.label).startsWith(typed) && fold(o.label) !== typed).slice(0, limit);
  return { from, items };
}

/** Wstawia podpowiedź w miejsce ostatniego tokenu. */
export function applySuggestion(query: string, from: number, s: Suggestion): string {
  return query.slice(0, from) + s.insert;
}

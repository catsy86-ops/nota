import type { Note } from "@/hooks/useNotes";

const RX = /\[\[([^[\]\n]+?)\]\]/g;

/** Extract note titles referenced via [[Title]] syntax. */
export function extractWikiLinks(content: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = RX.exec(content)) !== null) {
    const t = m[1].trim();
    if (t) out.add(t.toLowerCase());
  }
  return Array.from(out);
}

/** Resolve a wiki target title → note id (case-insensitive). */
export function resolveWikiTarget(title: string, all: Note[]): Note | undefined {
  const t = title.trim().toLowerCase();
  return all.find((n) => n.title.trim().toLowerCase() === t);
}

export interface WikiLinkRef {
  id: string;
  title: string;
}

/**
 * Wszystko, czego karty potrzebują do linków, policzone raz dla całej bazy
 * (zamiast skanowania wszystkich notatek w każdej karcie — to byłoby N² przy każdym renderze).
 */
export interface WikiIndex {
  /** Tytuły do podpowiedzi, najświeżej edytowane pierwsze, bez duplikatów wielkości liter. */
  titles: string[];
  /** Tytuł (małymi literami) → notatki, które go linkują. */
  backlinks: Map<string, WikiLinkRef[]>;
}

export function buildWikiIndex(notes: Note[]): WikiIndex {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const n of [...notes].sort((a, b) => b.updatedAt - a.updatedAt)) {
    const t = n.title.trim();
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); titles.push(t); }
  }
  const backlinks = new Map<string, WikiLinkRef[]>();
  for (const n of notes) {
    for (const target of extractWikiLinks(n.content)) {
      const list = backlinks.get(target) ?? [];
      list.push({ id: n.id, title: n.title.trim() });
      backlinks.set(target, list);
    }
  }
  return { titles, backlinks };
}

/** Notatki linkujące do tej (bez niej samej). */
export function backlinksOf(note: Pick<Note, "id" | "title">, index: WikiIndex): WikiLinkRef[] {
  const title = note.title.trim().toLowerCase();
  if (!title) return [];
  return (index.backlinks.get(title) ?? []).filter((r) => r.id !== note.id);
}

export interface WikiQuery {
  /** Pozycja otwierającego `[[`. */
  start: number;
  /** To, co wpisano między `[[` a karetką. */
  query: string;
}

/** Otwarte, jeszcze niezamknięte `[[` przed karetką — wtedy pokazujemy podpowiedzi. */
export function wikiQueryAt(text: string, caret: number): WikiQuery | null {
  if (caret < 2) return null;
  const start = text.lastIndexOf("[[", caret - 2);
  if (start < 0) return null;
  const query = text.slice(start + 2, caret);
  if (/[[\]\n]/.test(query) || query.length > 80) return null;
  return { start, query };
}

/** Tytuły pasujące do zapytania: najpierw od początku, potem od początku słowa, potem gdziekolwiek. */
export function suggestWikiTitles(query: string, titles: string[], exclude = "", limit = 6): string[] {
  const q = query.trim().toLowerCase();
  const ex = exclude.trim().toLowerCase();
  const pool = titles.filter((t) => t.toLowerCase() !== ex);
  if (!q) return pool.slice(0, limit);
  const rank = (t: string) => {
    const l = t.toLowerCase();
    if (l.startsWith(q)) return 0;
    if (l.includes(` ${q}`)) return 1;
    return l.includes(q) ? 2 : -1;
  };
  return pool
    .map((t, i) => ({ t, i, r: rank(t) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.t);
}

/**
 * Wstawia `[[tytuł]]` w miejsce otwartego zapytania. Zamykające `]]` tuż za
 * karetką (wstawione przyciskiem „Link do notatki”) jest wchłaniane, nie dublowane.
 */
export function completeWikiLink(text: string, q: WikiQuery, caret: number, title: string): { text: string; caret: number } {
  const rest = text.slice(caret).replace(/^ *\]\]/, "");
  const link = `[[${title}]]`;
  return { text: text.slice(0, q.start) + link + rest, caret: q.start + link.length };
}

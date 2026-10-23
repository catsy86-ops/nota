import type { Note } from "@/hooks/useNotes";
import { buildSubpageIndex, type SubpageInfo } from "@/lib/subpages";

const RX = /\[\[([^[\]\n]+?)\]\]/g;

export interface WikiTarget {
  /** Tytuł albo alias notatki, do której link prowadzi. */
  title: string;
  /** Nagłówek, do którego przewija czytnik (`[[tytuł#nagłówek]]`). */
  heading: string | null;
  /** Tekst wyświetlany zamiast celu (`[[cel|tekst]]`); `null` = pokaż cel. */
  display: string | null;
}

/**
 * `Tytuł#Nagłówek|tekst` → cel, nagłówek i tekst wyświetlany. Część po `|` nie jest celem:
 * `[[Plan|Plan budowy]]` prowadzi do „Plan”, ale pokazuje „Plan budowy”.
 */
export function splitWikiTarget(raw: string): WikiTarget {
  const bar = raw.indexOf("|");
  const display = bar < 0 ? null : raw.slice(bar + 1).trim() || null;
  const head = bar < 0 ? raw : raw.slice(0, bar);
  const i = head.indexOf("#");
  if (i < 0) return { title: head.trim(), heading: null, display };
  const heading = head.slice(i + 1).trim();
  return { title: head.slice(0, i).trim(), heading: heading || null, display };
}

/** Extract note titles referenced via [[Title]] or [[Title#Heading]] syntax. */
export function extractWikiLinks(content: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = RX.exec(content)) !== null) {
    const t = splitWikiTarget(m[1]).title;
    if (t) out.add(t.toLowerCase());
  }
  return Array.from(out);
}

/**
 * Przepina `[[stary]]` na `[[nowy]]` (bez względu na wielkość liter, z trimem).
 * Zwraca tę samą treść, gdy nic nie linkuje do starego tytułu.
 */
export function renameLinkTargets(content: string, oldTitle: string, newTitle: string): string {
  const from = oldTitle.trim().toLowerCase();
  if (!from || !content.includes("[[")) return content;
  return content.replace(RX, (full, inner: string) => {
    const { title, heading } = splitWikiTarget(inner);
    if (title.toLowerCase() !== from) return full;
    return `[[${newTitle.trim()}${heading ? `#${heading}` : ""}]]`;
  });
}

/** Limit długości i liczby aliasów (zgodny z walidacją w `noteSchema` i `REMOTE_LIMITS`). */
export const ALIAS_MAX_COUNT = 20;
export const ALIAS_MAX_LENGTH = 200;

/**
 * Czyści listę aliasów z pola tekstowego: przycina, odrzuca puste i za długie, usuwa duplikaty
 * (bez względu na wielkość liter) i alias równy tytułowi notatki (nic by nie dodał).
 */
export function cleanAliases(raw: string[], title: string): string[] {
  const own = title.trim().toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const alias = item.trim();
    if (!alias || alias.length > ALIAS_MAX_LENGTH) continue;
    const key = alias.toLowerCase();
    if (key === own || seen.has(key)) continue;
    seen.add(key);
    out.push(alias);
    if (out.length >= ALIAS_MAX_COUNT) break;
  }
  return out;
}

/**
 * Cel linku → notatka (bez względu na wielkość liter). Najpierw tytuł, potem alias:
 * tytuł zawsze wygrywa, więc alias nie przesłania istniejącej notatki.
 */
export function resolveWikiTarget(title: string, all: Note[]): Note | undefined {
  const t = title.trim().toLowerCase();
  if (!t) return undefined;
  return all.find((n) => n.title.trim().toLowerCase() === t)
    ?? all.find((n) => (n.aliases ?? []).some((a) => a.trim().toLowerCase() === t));
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
  /** Id notatki → jej rodzic i liczba podstron (tylko notatki w drzewie). */
  tree: Map<string, SubpageInfo>;
}

export function buildWikiIndex(notes: Note[]): WikiIndex {
  const seen = new Set<string>();
  const titles: string[] = [];
  const add = (t: string) => {
    if (t && !seen.has(t.toLowerCase())) { seen.add(t.toLowerCase()); titles.push(t); }
  };
  const byRecency = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
  // Tytuły przed aliasami: podpowiedź najpierw proponuje prawdziwe nazwy notatek.
  for (const n of byRecency) add(n.title.trim());
  for (const n of byRecency) for (const a of n.aliases ?? []) add(a.trim());
  const backlinks = new Map<string, WikiLinkRef[]>();
  for (const n of notes) {
    for (const target of extractWikiLinks(n.content)) {
      const list = backlinks.get(target) ?? [];
      list.push({ id: n.id, title: n.title.trim() });
      backlinks.set(target, list);
    }
  }
  return { titles, backlinks, tree: buildSubpageIndex(notes) };
}

/** Odcisk indeksu: zmienia się tylko, gdy zmienią się tytuły albo linki. */
export function wikiIndexKey(index: WikiIndex): string {
  const links = [...index.backlinks].map(([target, refs]) => `${target}\t${refs.map((r) => `${r.id}:${r.title}`).join(",")}`);
  const tree = [...index.tree].map(([id, t]) => `${id}>${t.parentId ?? ""}:${t.childCount}:${t.parentTitle}`);
  return `${index.titles.join("\n")}\n--\n${links.sort().join("\n")}\n--\n${tree.sort().join("\n")}`;
}

/** Notatki linkujące do tej (bez niej samej). */
export function backlinksOf(note: Pick<Note, "id" | "title"> & { aliases?: string[] }, index: WikiIndex): WikiLinkRef[] {
  const keys = [note.title, ...(note.aliases ?? [])].map((t) => t.trim().toLowerCase()).filter(Boolean);
  const out: WikiLinkRef[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    for (const r of index.backlinks.get(key) ?? []) {
      if (r.id === note.id || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
  }
  return out;
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

/**
 * @-wzmianki w edytorze: `@` na początku słowa otwiera listę dat (dziś, jutro,
 * wczoraj) i notatek (od ostatnio edytowanych). Notatka wstawia się jako `[[tytuł]]`,
 * data jako tekst w formacie zmiennej `{{data}}` szablonów.
 */
import { suggestWikiTitles } from "@/lib/wikiLinks";
import { renderTemplate } from "@/lib/templateVars";

export interface MentionQuery {
  /** Pozycja `@`. */
  start: number;
  /** To, co wpisano między `@` a karetką. */
  query: string;
}

export interface MentionItem {
  key: string;
  label: string;
  hint: "data" | "notatka";
  /** Tekst wstawiany w miejsce `@zapytanie`. */
  text: string;
}

/** Otwarte `@` przed karetką, poprzedzone początkiem tekstu, spacją, nową linią lub nawiasem. */
export function mentionQueryAt(text: string, caret: number): MentionQuery | null {
  const before = text.slice(0, caret);
  const m = /(^|[\s(])@([^\s@[\]]{0,30})$/.exec(before);
  if (!m) return null;
  return { start: caret - m[2].length - 1, query: m[2] };
}

const DATE_SHIFTS: { label: string; days: number }[] = [
  { label: "Dziś", days: 0 },
  { label: "Jutro", days: 1 },
  { label: "Wczoraj", days: -1 },
];

export function suggestMentions(query: string, titles: string[], exclude = "", now: Date = new Date(), limit = 8): MentionItem[] {
  const q = query.trim().toLowerCase();
  const dates: MentionItem[] = DATE_SHIFTS
    .filter((d) => !q || d.label.toLowerCase().startsWith(q))
    .map((d) => {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d.days);
      return { key: `date:${d.days}`, label: d.label, hint: "data" as const, text: renderTemplate("{{data}}", day) };
    });
  const notes: MentionItem[] = suggestWikiTitles(query, titles, exclude, limit)
    .map((t) => ({ key: `note:${t}`, label: t, hint: "notatka" as const, text: `[[${t}]]` }));
  return [...dates, ...notes].slice(0, limit);
}

export function completeMention(text: string, q: MentionQuery, caret: number, insert: string): { text: string; caret: number } {
  return { text: text.slice(0, q.start) + insert + text.slice(caret), caret: q.start + insert.length };
}

import type { Note } from "@/hooks/useNotes";
import { fold, matchesClauses, parseSearchQuery, type MatchContext } from "@/lib/searchQuery";
import { blockIdOfLine, stripBlockId } from "@/lib/blockRefs";

/**
 * Trafienie w sekcji notatki: nagłówek (`## Tekst`) albo blok z `^id`. `target` to to, czego
 * oczekuje `requestHeading` (tekst nagłówka albo `^id`), więc czytnik przewinie do właściwego miejsca.
 */
export type SectionHit =
  | { kind: "heading"; note: Note; target: string; text: string }
  | { kind: "block"; note: Note; target: string; text: string };

const HEADING_LINE = /^\s*#{1,6}\s+(.+?)\s*#*\s*$/;
const LIST_MARK = /^\s*(?:[-*+]|\d+[.)])\s+/;

/**
 * Nagłówki i bloki pasujące do wolnego tekstu zapytania (operatory są pomijane, jak w `searchNotes`).
 * Wszystkie słowa muszą wystąpić w linii (AND), dopasowanie bez wielkości liter i ogonków.
 * Operatory (`etykieta:`, `folder:` itd.) zawężają notatki tak samo jak w `searchNotes`.
 * Notatki zablokowane są pomijane; wynik przycięty do `limit`.
 */
export function sectionHits(notes: Note[], query: string, ctx: MatchContext = {}, limit = 20): SectionHit[] {
  const { clauses, text } = parseSearchQuery(query);
  const words = fold(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const matches = (hay: string) => {
    const h = fold(hay);
    return words.every((w) => h.includes(w));
  };

  const out: SectionHit[] = [];
  for (const note of notes) {
    if (note.locked) continue;
    if (clauses.length && !matchesClauses(note, clauses, ctx)) continue;
    // Tania odprawa: notatka bez wszystkich słów nie ma sekcji do sprawdzania linia po linii.
    if (!matches(`${note.title}\n${note.content}`)) continue;
    for (const line of note.content.split("\n")) {
      const heading = HEADING_LINE.exec(line);
      if (heading) {
        const t = heading[1].replace(/[*_`]/g, "").trim();
        if (t && matches(t)) {
          out.push({ kind: "heading", note, target: t, text: t });
        }
      } else {
        const id = blockIdOfLine(line);
        const body = stripBlockId(line);
        if (id && matches(`${body} ${id}`)) {
          out.push({ kind: "block", note, target: `^${id}`, text: body.replace(LIST_MARK, "").trim() || `^${id}` });
        }
      }
      if (out.length >= limit) return out;
    }
  }
  return out;
}

import Fuse from "fuse.js";
import type { Note } from "@/hooks/useNotes";
import { parseSearchQuery, matchesClauses, type MatchFolder } from "@/lib/searchQuery";

export interface SearchContext {
  /** Potrzebne operatorowi `folder:` (nazwa → id, z podfolderami). */
  folders?: MatchFolder[];
  now?: number;
}

/**
 * Wyszukiwanie: operatory (patrz `searchQuery.ts`) zawężają pulę, a reszta
 * tekstu jest dopasowywana rozmyto do tytułu/treści/etykiet/pozycji listy.
 */
export function searchNotes(notes: Note[], query: string, ctx: SearchContext = {}): Note[] {
  const q = query.trim();
  if (!q) return notes;

  const { clauses, text } = parseSearchQuery(q);
  const pool = clauses.length ? notes.filter((n) => matchesClauses(n, clauses, ctx)) : notes;

  const free = text.trim();
  if (!free) return pool;

  // Notatki prywatne nie biorą udziału w wyszukiwaniu tekstu — nawet po odblokowaniu skarbca.
  const fuse = new Fuse(pool.filter((n) => !n.locked), {
    keys: [
      { name: "title", weight: 0.5 },
      { name: "content", weight: 0.3 },
      { name: "labels", weight: 0.2 },
      // Pozycje checklisty to treść jak każda inna — zadanie zapisane tylko
      // w liście musi dać się znaleźć.
      { name: "checklist.text", weight: 0.3 },
    ],
    threshold: 0.38,
    ignoreLocation: true,
    includeScore: false,
  });
  return fuse.search(free).map((r) => r.item);
}

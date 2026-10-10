import Fuse from "fuse.js";
import type { Note } from "@/hooks/useNotes";
import { parseSearchQuery, matchesClauses, type MatchFolder } from "@/lib/searchQuery";

export interface SearchContext {
  /** Potrzebne operatorowi `folder:` (nazwa → id, z podfolderami). */
  folders?: MatchFolder[];
  now?: number;
}

/**
 * Indeks Fuse jest drogi (przechodzi całą treść), a zapytanie zmienia się co znak —
 * stąd jeden indeks na tablicę notatek. `useNotes` zachowuje tożsamość tablicy,
 * dopóki nic się nie zmieni, więc kolejne znaki w wyszukiwarce tylko szukają.
 */
const indexCache = new WeakMap<Note[], Fuse<Note>>();

function indexFor(source: Note[]): Fuse<Note> {
  let fuse = indexCache.get(source);
  if (!fuse) {
    // Notatki prywatne nie biorą udziału w wyszukiwaniu tekstu — nawet po odblokowaniu skarbca.
    fuse = new Fuse(source.filter((n) => !n.locked), {
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
    indexCache.set(source, fuse);
  }
  return fuse;
}

/**
 * Wyszukiwanie: operatory (patrz `searchQuery.ts`) zawężają pulę, a reszta
 * tekstu jest dopasowywana rozmyto do tytułu/treści/etykiet/pozycji listy.
 *
 * `source` — tablica, z której pochodzi `notes` (np. wszystkie notatki, gdy `notes`
 * jest przefiltrowane do folderu). Indeks jest budowany i cache'owany dla niej,
 * a wynik zawężany do `notes`.
 */
export function searchNotes(notes: Note[], query: string, ctx: SearchContext = {}, source: Note[] = notes): Note[] {
  const q = query.trim();
  if (!q) return notes;

  const { clauses, text } = parseSearchQuery(q);
  const pool = clauses.length ? notes.filter((n) => matchesClauses(n, clauses, ctx)) : notes;

  const free = text.trim();
  if (!free) return pool;

  const hits = indexFor(source).search(free).map((r) => r.item);
  if (pool === source) return hits;
  const allowed = new Set(pool);
  return hits.filter((n) => allowed.has(n));
}

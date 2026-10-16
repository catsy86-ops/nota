import { useSyncExternalStore } from "react";
import type Fuse from "fuse.js";
import type { Note } from "@/hooks/useNotes";
import { parseSearchQuery, matchesClauses, fold, type MatchFolder } from "@/lib/searchQuery";
import type { PropDef } from "@/lib/noteProps";

export interface SearchContext {
  /** Potrzebne operatorowi `folder:` (nazwa → id, z podfolderami). */
  folders?: MatchFolder[];
  now?: number;
  /** Potrzebne operatorowi `pole:`. */
  propDefs?: PropDef[];
}

/**
 * Fuse ładuje się osobno (poza główną paczką): w wolnej chwili po starcie albo przy pierwszym
 * wyszukiwaniu. Do tego czasu tekst jest dopasowywany dokładnie (bez ogonków i wielkości liter),
 * a `useSearchReady` przelicza wyniki, gdy biblioteka dojdzie.
 */
let FuseLib: typeof Fuse | null = null;
let fuseLoading: Promise<void> | null = null;
const readyListeners = new Set<() => void>();

export function loadSearchIndex(): Promise<void> {
  fuseLoading ??= import("fuse.js").then((m) => {
    FuseLib = m.default;
    readyListeners.forEach((l) => l());
  });
  return fuseLoading;
}

function subscribeReady(cb: () => void) {
  readyListeners.add(cb);
  return () => { readyListeners.delete(cb); };
}

/** `true`, gdy wyszukiwanie rozmyte jest gotowe — w zależnościach `useMemo` z `searchNotes`. */
export function useSearchReady(): boolean {
  return useSyncExternalStore(subscribeReady, () => FuseLib !== null, () => false);
}

/** Przed załadowaniem Fuse: każde słowo musi wystąpić w tytule, treści, etykietach albo liście. */
function exactHits(source: Note[], words: string[]): Note[] {
  return source.filter((n) => {
    if (n.locked) return false;
    const hay = fold([n.title, n.content, ...n.labels, ...(n.checklist ?? []).map((c) => c.text)].join("\n"));
    return words.every((w) => hay.includes(w));
  });
}

/**
 * Indeks Fuse jest drogi (przechodzi całą treść), a zapytanie zmienia się co znak —
 * stąd jeden indeks na tablicę notatek. `useNotes` zachowuje tożsamość tablicy,
 * dopóki nic się nie zmieni, więc kolejne znaki w wyszukiwarce tylko szukają.
 */
const indexCache = new WeakMap<Note[], Fuse<Note>>();

function indexFor(source: Note[], Fuse: typeof import("fuse.js").default): Fuse<Note> {
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
      includeScore: true,
      // Indeks bez ogonków i wielkości liter: „zolta” znajduje „żółta”.
      getFn: (obj, path) => {
        const v = Fuse.config.getFn(obj, path);
        // Dla tablic (etykiety, pozycje listy) Fuse oddaje albo teksty, albo `{ v, i }`.
        const f = (s: unknown) => (typeof s === "string" ? fold(s) : s && typeof s === "object" && "v" in s ? { ...(s as { v: string; i: number }), v: fold((s as { v: string }).v) } : s);
        return (Array.isArray(v) ? v.map(f) : f(v)) as never;
      },
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

  // Każde słowo musi się znaleźć (AND) — kolejność słów nie ma znaczenia; trafność = suma wyników.
  const words = fold(free).split(/\s+/).filter(Boolean);
  let hits: Note[];
  if (!FuseLib) {
    void loadSearchIndex();
    hits = exactHits(source, words);
  } else if (words.length <= 1) {
    hits = indexFor(source, FuseLib).search(words[0] ?? "").map((r) => r.item);
  } else {
    const fuse = indexFor(source, FuseLib);
    const scores = new Map<Note, number>();
    words.forEach((w, i) => {
      const found = new Map(fuse.search(w).map((r) => [r.item, r.score ?? 0] as const));
      if (i === 0) found.forEach((s, n) => scores.set(n, s));
      else for (const n of [...scores.keys()]) {
        const s = found.get(n);
        if (s === undefined) scores.delete(n);
        else scores.set(n, (scores.get(n) ?? 0) + s);
      }
    });
    hits = [...scores.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n);
  }
  if (pool === source) return hits;
  const allowed = new Set(pool);
  return hits.filter((n) => allowed.has(n));
}

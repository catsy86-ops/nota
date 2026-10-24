import { useSyncExternalStore } from "react";
import type MiniSearch from "minisearch";
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
 * MiniSearch ładuje się osobno (poza główną paczką): w wolnej chwili po starcie albo przy pierwszym
 * wyszukiwaniu. Do tego czasu tekst jest dopasowywany dokładnie (bez ogonków i wielkości liter),
 * a `useSearchReady` przelicza wyniki, gdy biblioteka dojdzie.
 */
let Engine: typeof MiniSearch | null = null;
let engineLoading: Promise<void> | null = null;
const readyListeners = new Set<() => void>();

export function loadSearchIndex(): Promise<void> {
  engineLoading ??= import("minisearch").then((m) => {
    Engine = m.default;
    readyListeners.forEach((l) => l());
  });
  return engineLoading;
}

function subscribeReady(cb: () => void) {
  readyListeners.add(cb);
  return () => { readyListeners.delete(cb); };
}

/** `true`, gdy wyszukiwanie rozmyte jest gotowe — w zależnościach `useMemo` z `searchNotes`. */
export function useSearchReady(): boolean {
  return useSyncExternalStore(subscribeReady, () => Engine !== null, () => false);
}

/** Przed załadowaniem silnika: każde słowo musi wystąpić w tytule, treści, etykietach albo liście. */
function exactHits(source: Note[], words: string[]): Note[] {
  return source.filter((n) => {
    if (n.locked) return false;
    const hay = fold([n.title, n.content, ...n.labels, ...(n.checklist ?? []).map((c) => c.text)].join("\n"));
    return words.every((w) => hay.includes(w));
  });
}

/**
 * Dokument indeksu: każde pole osobno, żeby MiniSearch liczył trafność per pole (tytuł waży więcej
 * niż treść). Aliasy, etykiety i pozycje listy to teksty złączone znakiem nowej linii.
 */
interface IndexDoc {
  id: string;
  title: string;
  aliases: string;
  labels: string;
  checklist: string;
  content: string;
}

const FIELDS: (keyof Omit<IndexDoc, "id">)[] = ["title", "aliases", "labels", "checklist", "content"];

/** Waga pól przy trafności (BM25 per pole, sumowane). */
const BOOST: Record<(typeof FIELDS)[number], number> = { title: 4, aliases: 3, labels: 2, checklist: 1.5, content: 1 };

/**
 * Podział na słowa po zdjęciu ogonków: „Żółta, kartka” → `zolta`, `kartka`. Ten sam podział
 * dotyczy zapytania, więc „zolta” trafia w „żółta”, a „kupić” w „kupic”.
 */
function tokenize(text: string): string[] {
  return fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function toDoc(n: Note): IndexDoc {
  return {
    id: n.id,
    title: n.title,
    aliases: (n.aliases ?? []).join("\n"),
    labels: n.labels.join("\n"),
    checklist: (n.checklist ?? []).map((c) => c.text).join("\n"),
    content: n.content,
  };
}

function sameDoc(a: IndexDoc, b: IndexDoc): boolean {
  return FIELDS.every((f) => a[f] === b[f]);
}

/**
 * Dokument policzony raz na obiekt notatki: kolejne widoki (archiwum, kosz, kafle) dostają te same
 * obiekty, więc nie sklejamy pól od nowa przy każdym renderze. Zmieniona notatka to nowy obiekt.
 */
const docCache = new WeakMap<Note, IndexDoc>();
function docOf(n: Note): IndexDoc {
  let doc = docCache.get(n);
  if (!doc) { doc = toDoc(n); docCache.set(n, doc); }
  return doc;
}

/**
 * Jeden indeks dla wszystkich notatek, dokładany przyrostowo: przy zmianie tablicy porównujemy każdą
 * notatkę z tym, co już jest w indeksie, i przebudowujemy tylko zmienione dokumenty. Dzięki temu
 * edycja jednej notatki nie buduje całości od nowa, a widoki (archiwum, kosz, pasek boczny) dzielą
 * ten sam indeks. Wyniki są zawężane do tablicy wywołania (`source`), więc notatki z kosza nie
 * wypływają w widoku notatek.
 */
interface IndexState {
  engine: MiniSearch<IndexDoc>;
  /** Id → dokument w indeksie (do porównania przy następnej synchronizacji). */
  docs: Map<string, IndexDoc>;
  /** Id → notatka z ostatniej synchronizowanej tablicy (zamiana trafień na obiekty). */
  byId: Map<string, Note>;
  source: Note[] | null;
}

let state: IndexState | null = null;

/**
 * Doprowadza indeks do stanu `source`. Notatki zablokowane (prywatne) są z indeksu usuwane, a po
 * odblokowaniu wracają przy najbliższej synchronizacji, bo zmiana `locked` zmienia tablicę wejściową.
 */
function syncIndex(source: Note[]): IndexState {
  if (!state) {
    const Ctor = Engine!;
    state = {
      engine: new Ctor<IndexDoc>({
        fields: FIELDS,
        storeFields: [],
        idField: "id",
        tokenize,
        searchOptions: { prefix: true, fuzzy: 0.2, combineWith: "AND", boost: BOOST },
      }),
      docs: new Map(),
      byId: new Map(),
      source: null,
    };
  }
  if (state.source === source) return state;
  const s = state;
  s.source = source;
  s.byId = new Map();
  for (const n of source) {
    s.byId.set(n.id, n);
    const prev = s.docs.get(n.id);
    if (n.locked) {
      if (prev) { s.engine.discard(n.id); s.docs.delete(n.id); }
      continue;
    }
    const doc = docOf(n);
    if (prev === doc || (prev && sameDoc(prev, doc))) continue;
    if (prev) s.engine.replace(doc);
    else s.engine.add(doc);
    s.docs.set(n.id, doc);
  }
  return s;
}

/**
 * Wyszukiwanie: operatory (patrz `searchQuery.ts`) zawężają pulę, a reszta tekstu idzie do indeksu.
 * Wszystkie słowa muszą wystąpić (AND), kolejność nie ma znaczenia, literówki i prefiksy są dozwolone.
 *
 * `source` — tablica, z której pochodzi `notes` (np. wszystkie notatki, gdy `notes` jest
 * przefiltrowane do folderu). Wynik jest zawężany do `notes`.
 */
export function searchNotes(notes: Note[], query: string, ctx: SearchContext = {}, source: Note[] = notes): Note[] {
  const q = query.trim();
  if (!q) return notes;

  const { clauses, text } = parseSearchQuery(q);
  const pool = clauses.length ? notes.filter((n) => matchesClauses(n, clauses, ctx)) : notes;

  const free = text.trim();
  if (!free) return pool;

  let hits: Note[];
  if (!Engine) {
    void loadSearchIndex();
    hits = exactHits(source, fold(free).split(/\s+/).filter(Boolean));
  } else {
    const s = syncIndex(source);
    hits = s.engine.search(free)
      .map((r) => s.byId.get(String(r.id)))
      .filter((n): n is Note => n !== undefined);
  }
  if (pool === source) return hits;
  const allowed = new Set(pool);
  return hits.filter((n) => allowed.has(n));
}

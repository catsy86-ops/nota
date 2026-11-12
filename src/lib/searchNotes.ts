import { useSyncExternalStore } from "react";
import type MiniSearch from "minisearch";
import type { Note } from "@/hooks/useNotes";
import { parseSearchQuery, matchesClauses, fold, type MatchFolder } from "@/lib/searchQuery";
import type { PropDef } from "@/lib/noteProps";
import { createNoteIndex, sameDoc, toDoc, type IndexDoc } from "@/lib/noteSearchCore";
import { createNoteSearchEngine, type NoteSearchEngine } from "@/lib/noteSearchEngine";
import { workerTransport } from "@/workers/rpc";

export interface SearchContext {
  /** Potrzebne operatorowi `folder:` (nazwa → id, z podfolderami). */
  folders?: MatchFolder[];
  now?: number;
  /** Potrzebne operatorowi `pole:`. */
  propDefs?: PropDef[];
}

/**
 * Silnik wyszukiwania (plan 3.2). W przeglądarce indeks MiniSearch żyje w Workerze (`noteSearchEngine.ts`): główny
 * wątek wysyła tylko zmienione dokumenty i odbiera id trafień, więc budowa indeksu i zapytania nie blokują
 * pisania. Do czasu odpowiedzi tekst jest dopasowywany dokładnie (bez ogonków i wielkości liter), a `useSearchVersion`
 * przelicza wyniki, gdy odpowiedź dojdzie. Bez Workerów (testy, jsdom) albo po jego błędzie działa ten sam indeks
 * w głównym wątku, ładowany osobno od głównej paczki (w wolnej chwili po starcie albo przy pierwszym wyszukiwaniu).
 */
let Engine: typeof MiniSearch | null = null;
let engineLoading: Promise<void> | null = null;
const readyListeners = new Set<() => void>();
let localVersion = 0;

const notifyReady = () => { localVersion++; readyListeners.forEach((l) => l()); };

/** `undefined` = jeszcze nie sprawdzono, `null` = brak Workerów. */
let workerEngine: NoteSearchEngine | null | undefined;
let workerUnsub: (() => void) | null = null;

function attachWorker(e: NoteSearchEngine | null): void {
  workerUnsub?.();
  workerEngine = e;
  workerUnsub = e ? e.subscribe(notifyReady) : null;
}

/** Silnik w Workerze, gdy da się go użyć; inaczej `null` (indeks w głównym wątku). */
function activeWorker(): NoteSearchEngine | null {
  if (workerEngine === undefined) {
    attachWorker(typeof Worker === "undefined"
      ? null
      : createNoteSearchEngine(() => workerTransport(new Worker(new URL("../workers/search.worker.ts", import.meta.url), { type: "module" }))));
  }
  return workerEngine && !workerEngine.failed() ? workerEngine : null;
}

/** Podmiana silnika w testach (`null` = główny wątek). */
export function setNoteSearchEngine(e: NoteSearchEngine | null): void {
  attachWorker(e);
  notifyReady();
}

export function loadSearchIndex(): Promise<void> {
  if (activeWorker()) return Promise.resolve();
  engineLoading ??= import("minisearch").then((m) => {
    Engine = m.default;
    notifyReady();
  });
  return engineLoading;
}

function subscribeReady(cb: () => void) {
  readyListeners.add(cb);
  return () => { readyListeners.delete(cb); };
}

/** `true`, gdy wyszukiwanie rozmyte jest gotowe — w zależnościach `useMemo` z `searchNotes`. */
export function useSearchReady(): boolean {
  return useSyncExternalStore(subscribeReady, () => Engine !== null || activeWorker() !== null, () => false);
}

/**
 * Numer, który zmienia się, gdy dojdą nowe wyniki (silnik wczytany, odpowiedź Workera). Wstawiany do zależności
 * `useMemo` obok `searchNotes`, żeby widok przeliczył wyniki po odpowiedzi.
 */
export function useSearchVersion(): number {
  return useSyncExternalStore(subscribeReady, () => localVersion + (workerEngine ? workerEngine.version() : 0), () => 0);
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
      engine: createNoteIndex(Ctor),
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
  const worker = activeWorker();
  if (worker) {
    // Wynik z Workera, gdy już jest; do tego czasu dokładne trafienia (widok przeliczy się po odpowiedzi).
    hits = worker.lookup(source, free) ?? exactHits(source, fold(free).split(/\s+/).filter(Boolean));
  } else if (!Engine) {
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

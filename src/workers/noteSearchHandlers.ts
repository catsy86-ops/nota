import MiniSearch from "minisearch";
import { createStore, del, get, set } from "idb-keyval";
import { createNoteIndex, docFingerprint, INDEX_FORMAT, loadNoteIndex, type IndexDoc } from "@/lib/noteSearchCore";

/**
 * Metody Workera wyszukiwania notatek (plan 3.2): indeks MiniSearch żyje poza wątkiem UI, strona przysyła tylko
 * zmienione dokumenty i odbiera uszeregowane id trafień. Osobno od pliku Workera, żeby dało się testować w jsdom.
 *
 * Zrzut indeksu (plan Notatek 3.2): po zmianach Worker zapisuje `MiniSearch#toJSON` razem z odciskami dokumentów
 * w IndexedDB (osobna baza, patrz `INDEX_DB`). Po starcie wczytuje zrzut, a pierwsza synchronizacja (`full`) z odciskami
 * pomija notatki, które się nie zmieniły, i usuwa te, których strona już nie ma. Dzięki temu start nie indeksuje
 * od zera np. 5000 notatek. Zrzut z innym `INDEX_FORMAT` albo uszkodzony jest odrzucany i indeks powstaje od nowa.
 */
export const INDEX_DB = "kaczy-note-index-v1";
const SNAPSHOT_KEY = "snapshot";
/** Zapis zrzutu po ostatniej zmianie (opóźniony, żeby seria edycji dała jeden zapis). */
const SAVE_DELAY_MS = 3000;

interface Snapshot {
  format: string;
  index: unknown;
  /** id → odcisk dokumentu, który jest w `index`. */
  fingerprints: [string, string][];
}

let index: MiniSearch<IndexDoc> | null = null;
/** Odciski dokumentów, które siedzą w indeksie (id → odcisk). */
const fingerprints = new Map<string, string>();
/** Znacznik życia Workera: strona po nim poznaje, że Worker wstał od nowa (zwolniony przy bezczynności) i ma pusty indeks. */
const epoch = Math.random().toString(36).slice(2);
/** Dopiero po pierwszej synchronizacji wyniki są wiarygodne (wczytany zrzut mógł zawierać notatki, których już nie ma). */
let synced = false;
let loading: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const store = createStore(INDEX_DB, "index");

async function loadSnapshot(): Promise<void> {
  try {
    const snap = await get<Snapshot>(SNAPSHOT_KEY, store);
    if (!snap || snap.format !== INDEX_FORMAT) return;
    index = loadNoteIndex(MiniSearch, snap.index);
    for (const [id, fp] of snap.fingerprints) fingerprints.set(id, fp);
  } catch {
    // Uszkodzony zrzut: zaczynamy od pustego indeksu, a zły wpis znika.
    index = null;
    fingerprints.clear();
    await del(SNAPSHOT_KEY, store).catch(() => undefined);
  }
}

/** Zapisuje zrzut od razu (testy i ewentualne zamknięcie); zwykle robi to `scheduleSave` z opóźnieniem. */
export async function flushNoteIndexSnapshot(): Promise<void> {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (!index) return;
  const snap: Snapshot = { format: INDEX_FORMAT, index: index.toJSON(), fingerprints: [...fingerprints] };
  await set(SNAPSHOT_KEY, snap, store).catch(() => { /* brak miejsca albo tryb prywatny: indeks i tak działa */ });
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void flushNoteIndexSnapshot(); }, SAVE_DELAY_MS);
}

export const noteSearchHandlers = {
  /**
   * Dokłada, podmienia i usuwa dokumenty; zwraca znacznik życia i liczbę dokumentów w indeksie.
   * `full` — `upserts` to cały zestaw strony: dokumenty spoza niego (ze zrzutu) są usuwane.
   */
  noteSync: async (upserts: IndexDoc[], removes: string[], full = false): Promise<{ epoch: string; size: number }> => {
    await (loading ??= loadSnapshot());
    index ??= createNoteIndex(MiniSearch);
    let changed = false;
    for (const id of removes) if (fingerprints.delete(id)) { index.discard(id); changed = true; }
    for (const d of upserts) {
      const fp = docFingerprint(d);
      const known = fingerprints.get(d.id);
      if (known === fp) continue;
      if (known !== undefined) index.replace(d);
      else index.add(d);
      fingerprints.set(d.id, fp);
      changed = true;
    }
    if (full) {
      const keep = new Set(upserts.map((d) => d.id));
      for (const id of [...fingerprints.keys()]) {
        if (!keep.has(id)) { index.discard(id); fingerprints.delete(id); changed = true; }
      }
    }
    synced = true;
    if (changed) scheduleSave();
    return { epoch, size: fingerprints.size };
  },
  /** Id trafień od najlepszego (pusta lista przed pierwszą synchronizacją) i znacznik życia Workera. */
  noteSearch: (free: string): { epoch: string; ids: string[] } => ({ epoch, ids: index && synced ? index.search(free).map((r) => String(r.id)) : [] }),
};

export type NoteSearchHandlers = typeof noteSearchHandlers;

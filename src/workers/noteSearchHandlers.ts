import MiniSearch from "minisearch";
import { createNoteIndex, type IndexDoc } from "@/lib/noteSearchCore";

/**
 * Metody Workera wyszukiwania notatek (plan 3.2): indeks MiniSearch żyje poza wątkiem UI, strona przysyła tylko
 * zmienione dokumenty i odbiera uszeregowane id trafień. Osobno od pliku Workera, żeby dało się testować w jsdom.
 */
let index: MiniSearch<IndexDoc> | null = null;
const docs = new Set<string>();
/** Znacznik życia Workera: strona po nim poznaje, że Worker wstał od nowa (zwolniony przy bezczynności) i ma pusty indeks. */
const epoch = Math.random().toString(36).slice(2);

export const noteSearchHandlers = {
  /** Dokłada, podmienia i usuwa dokumenty; zwraca znacznik życia i liczbę dokumentów w indeksie. */
  noteSync: (upserts: IndexDoc[], removes: string[]): { epoch: string; size: number } => {
    index ??= createNoteIndex(MiniSearch);
    for (const id of removes) if (docs.delete(id)) index.discard(id);
    for (const d of upserts) {
      if (docs.has(d.id)) index.replace(d);
      else { index.add(d); docs.add(d.id); }
    }
    return { epoch, size: docs.size };
  },
  /** Id trafień od najlepszego (pusta lista przed pierwszą synchronizacją) i znacznik życia Workera. */
  noteSearch: (free: string): { epoch: string; ids: string[] } => ({ epoch, ids: index ? index.search(free).map((r) => String(r.id)) : [] }),
};

export type NoteSearchHandlers = typeof noteSearchHandlers;

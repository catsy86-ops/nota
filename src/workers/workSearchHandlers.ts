import MiniSearch from "minisearch";
import { makeIndex, searchKeys, type IndexDoc } from "@/lib/study/workSearchCore";

/**
 * Metody Workera wyszukiwania w Pracy (B5.6): budowa indeksu MiniSearch i zapytania poza wątkiem UI. Osobno od pliku
 * Workera, żeby dały się testować w jsdom. Indeks żyje w Workerze; strona trzyma tylko opisy trafień.
 */
let index: MiniSearch<IndexDoc> | null = null;

export const workSearchHandlers = {
  /** Buduje indeks z dokumentów; zwraca ich liczbę. */
  build: (docs: IndexDoc[]): number => {
    index = makeIndex(MiniSearch, docs);
    return docs.length;
  },
  /** Klucze trafień dla zapytania (pusta lista przed pierwszą budową). */
  search: (query: string, limit: number): string[] => (index ? searchKeys(index, query, limit) : []),
};

export type WorkSearchHandlers = typeof workSearchHandlers;

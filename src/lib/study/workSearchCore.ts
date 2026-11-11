import type MiniSearch from "minisearch";
import { fold } from "@/lib/searchQuery";

/**
 * Wspólny rdzeń wyszukiwania w Pracy (B2.5, B5.6): dokument indeksu i konfiguracja MiniSearch. Bez Reacta i bez typów
 * budów, żeby Worker nie wciągał ich do swojej paczki. Opisy trafień (tytuł, budowa) zostają w głównym wątku.
 */
export interface IndexDoc {
  key: string;
  text: string;
  site: string;
}

export const tokenize = (s: string) => fold(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Indeks MiniSearch: bez ogonków, z literówkami i początkami słów, każde słowo zapytania musi pasować. */
export function makeIndex(Engine: typeof MiniSearch, docs: readonly IndexDoc[]): MiniSearch<IndexDoc> {
  const mini = new Engine<IndexDoc>({
    idField: "key",
    fields: ["text", "site"],
    storeFields: [],
    tokenize,
    processTerm: (t) => fold(t),
    searchOptions: { boost: { text: 2 }, prefix: true, fuzzy: 0.2, combineWith: "AND" },
  });
  mini.addAll(docs as IndexDoc[]);
  return mini;
}

/** Klucze najlepszych trafień (kolejność wg trafności). */
export function searchKeys(mini: MiniSearch<IndexDoc>, query: string, limit: number): string[] {
  if (!query.trim()) return [];
  return mini.search(query).slice(0, limit).map((r) => String(r.id));
}

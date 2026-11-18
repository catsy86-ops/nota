import * as Y from "yjs";
import { byNewest, cleanDebt, DEBT_MAX_ENTRIES, type DebtEntry } from "./model";
import { toStored } from "@/lib/extraFields";

/**
 * Długi w Y.Doc notatek — tym samym, który niesie synchronizację, plik i kopię.
 * Każdy wpis to osobny klucz mapy, więc dwa telefony dopisujące różne pożyczki
 * scalają się bez strat; ten sam wpis edytowany równocześnie wygrywa w całości.
 */

/** Origin transakcji Długów — odróżnia lokalne zmiany od tych z sieci. */
export const DEBTS_ORIGIN = "debts";

export function createYDebts(doc: Y.Doc) {
  const entries = doc.getMap<DebtEntry>("debts");
  let snapshot: DebtEntry[] | null = null;
  const listeners = new Set<() => void>();
  entries.observe(() => {
    snapshot = null;
    listeners.forEach((l) => l());
  });

  /** Oczyszczona lista, najnowsze pierwsze; śmieci od peera są pomijane po cichu. */
  function get(): DebtEntry[] {
    if (snapshot) return snapshot;
    const out: DebtEntry[] = [];
    for (const raw of entries.values()) {
      const e = cleanDebt(raw);
      if (e) out.push(e);
    }
    snapshot = out.sort(byNewest);
    return snapshot;
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  /** Każdy zapis przez tę funkcję: nieznane pola (`extra`) wracają na wierzch wpisu (Z-17.3). */
  const put = (e: DebtEntry) => entries.set(e.id, toStored(e) as DebtEntry);

  function add(entry: DebtEntry): boolean {
    if (entries.size >= DEBT_MAX_ENTRIES || entries.has(entry.id)) return false;
    doc.transact(() => put(entry), DEBTS_ORIGIN);
    return true;
  }

  function remove(id: string): DebtEntry | null {
    const prev = cleanDebt(entries.get(id));
    // L9: uszkodzony wpis (nie przechodzi czyszczenia) też da się usunąć — inaczej zajmuje miejsce w limicie.
    if (!prev) {
      if (entries.has(id)) doc.transact(() => entries.delete(id), DEBTS_ORIGIN);
      return null;
    }
    doc.transact(() => entries.delete(id), DEBTS_ORIGIN);
    return prev;
  }

  /** Zmiana istniejącego wpisu (ten sam id): kwota, dzień, notatka, rodzaj, osoba. `false` gdy wpisu nie ma. */
  function replace(entry: DebtEntry): boolean {
    if (!entries.has(entry.id)) return false;
    doc.transact(() => put(entry), DEBTS_ORIGIN);
    return true;
  }

  /** Kilka zmian jedną transakcją (3.1: zmiana nazwy, łączenie, cofnięcie). Wpisów, których nie ma, nie dodaje. */
  function replaceMany(list: readonly DebtEntry[]): number {
    let n = 0;
    doc.transact(() => {
      for (const e of list) if (entries.has(e.id)) { put(e); n++; }
    }, DEBTS_ORIGIN);
    return n;
  }

  /** Cofnięcie usunięcia: wpis wraca z tym samym id i datą. */
  function restore(entry: DebtEntry): void {
    doc.transact(() => put(entry), DEBTS_ORIGIN);
  }

  /** Zrzut do kopii zapasowej: wszystkie pożyczki w kształcie zapisu (nieznane pola na wierzchu). */
  function dump(): DebtEntry[] {
    return get().map((e) => toStored(e) as DebtEntry);
  }

  /**
   * Scala zrzut z kopii: dodaje pożyczki, których jeszcze nie ma (po id), w limicie. Niczego nie kasuje
   * i nie nadpisuje wpisu o tym samym id, który już jest na tym telefonie.
   */
  function mergeDump(raw: unknown): void {
    const incoming = Array.isArray(raw) ? raw.map(cleanDebt).filter((e): e is DebtEntry => !!e) : [];
    doc.transact(() => {
      for (const e of incoming) if (!entries.has(e.id) && entries.size < DEBT_MAX_ENTRIES) put(e);
    }, DEBTS_ORIGIN);
  }

  return { get, subscribe, add, remove, restore, replace, replaceMany, dump, mergeDump };
}

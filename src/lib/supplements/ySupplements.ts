import * as Y from "yjs";
import { bySupplementOrder, cleanSupplement, logKey, parseLogKey, SUPPLEMENT_MAX_ENTRIES, type Supplement } from "./model";

/**
 * Odżywki w Y.Doc notatek — ten sam dokument, który niesie synchronizację, plik i kopię.
 * Każda odżywka i każde odhaczenie to osobny klucz mapy, więc dwa telefony scalają się bez strat.
 */

/** Origin transakcji Odżywek — odróżnia lokalne zmiany od tych z sieci. */
export const SUPPLEMENTS_ORIGIN = "supplements";

export function createYSupplements(doc: Y.Doc) {
  const list = doc.getMap<Supplement>("supplements");
  const log = doc.getMap<true>("supplementLog");
  let snapshot: Supplement[] | null = null;
  let logSnapshot: Set<string> | null = null;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  list.observe(() => { snapshot = null; emit(); });
  log.observe(() => { logSnapshot = null; emit(); });

  /** Oczyszczona lista w kolejności pory dnia; śmieci od peera są pomijane po cichu. */
  function get(): Supplement[] {
    if (snapshot) return snapshot;
    const out: Supplement[] = [];
    for (const raw of list.values()) {
      const s = cleanSupplement(raw);
      if (s) out.push(s);
    }
    snapshot = out.sort(bySupplementOrder);
    return snapshot;
  }

  /** Wszystkie odhaczone pary jako klucze `dzień|id`; poprawne klucze, reszta pominięta. */
  function getTaken(): Set<string> {
    if (logSnapshot) return logSnapshot;
    const out = new Set<string>();
    for (const key of log.keys()) if (parseLogKey(key)) out.add(key);
    logSnapshot = out;
    return out;
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function add(s: Supplement): boolean {
    if (list.size >= SUPPLEMENT_MAX_ENTRIES || list.has(s.id)) return false;
    doc.transact(() => list.set(s.id, s), SUPPLEMENTS_ORIGIN);
    return true;
  }

  /** Usunięcie odżywki zdejmuje też jej odhaczenia, żeby nie zostały osierocone. */
  function remove(id: string): Supplement | null {
    const prev = cleanSupplement(list.get(id));
    if (!prev) return null;
    doc.transact(() => {
      list.delete(id);
      for (const key of Array.from(log.keys())) if (parseLogKey(key)?.supplementId === id) log.delete(key);
    }, SUPPLEMENTS_ORIGIN);
    return prev;
  }

  /** Cofnięcie usunięcia: odżywka wraca z tym samym id. Odhaczeń nie przywracamy. */
  function restore(s: Supplement): void {
    doc.transact(() => list.set(s.id, s), SUPPLEMENTS_ORIGIN);
  }

  function setTaken(day: string, supplementId: string, on: boolean): void {
    const key = logKey(day, supplementId);
    doc.transact(() => {
      if (on) log.set(key, true); else log.delete(key);
    }, SUPPLEMENTS_ORIGIN);
  }

  /** Zrzut do kopii zapasowej: odżywki i odhaczenia jako zwykłe dane. */
  function dump(): SupplementDump {
    return { list: get(), taken: Array.from(getTaken()) };
  }

  /**
   * Scala zrzut z kopii: dodaje to, czego jeszcze nie ma, i niczego nie kasuje — przywracanie nie usuwa
   * odżywek dodanych na tym telefonie. Śmieci w pliku są pomijane po czyszczeniu.
   */
  function mergeDump(raw: unknown): void {
    const d = raw as Partial<SupplementDump> | null;
    const incoming = Array.isArray(d?.list) ? d.list.map(cleanSupplement).filter((s): s is Supplement => !!s) : [];
    const takenIn = Array.isArray(d?.taken) ? d.taken.filter((k): k is string => typeof k === "string" && parseLogKey(k) !== null) : [];
    doc.transact(() => {
      for (const s of incoming) if (!list.has(s.id) && list.size < SUPPLEMENT_MAX_ENTRIES) list.set(s.id, s);
      for (const key of takenIn) if (!log.has(key)) log.set(key, true);
    }, SUPPLEMENTS_ORIGIN);
  }

  return { get, getTaken, subscribe, add, remove, restore, setTaken, dump, mergeDump };
}

export interface SupplementDump {
  list: Supplement[];
  taken: string[];
}

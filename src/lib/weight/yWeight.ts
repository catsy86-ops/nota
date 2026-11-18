import * as Y from "yjs";
import { mergeStored, toStored } from "@/lib/extraFields";
import { cleanWeight, WEIGHT_MAX_ENTRIES, type WeightEntry, WEIGHT_KNOWN } from "./model";

/**
 * Masa ciała w Y.Doc notatek (C-2) — ten sam dokument co synchronizacja i kopia.
 * Jeden wpis na dzień (klucz mapy = dzień), więc dwa telefony ważące różne dni scalają się bez strat.
 */
export function createYWeight(doc: Y.Doc) {
  const map = doc.getMap<WeightEntry>("weightEntries");
  let snapshot: WeightEntry[] | null = null;
  const listeners = new Set<() => void>();
  map.observe(() => {
    snapshot = null;
    listeners.forEach((l) => l());
  });

  /** Oczyszczone wpisy od najstarszego dnia; ta sama referencja, dopóki mapa się nie zmieni. */
  function get(): WeightEntry[] {
    if (snapshot) return snapshot;
    const out: WeightEntry[] = [];
    for (const raw of map.values()) {
      const e = cleanWeight(raw);
      if (e) out.push(e);
    }
    snapshot = out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    return snapshot;
  }

  /** Zapis ważenia dnia (nadpisuje poprzednie tego dnia). `false` = niepoprawne dane albo pełna historia. */
  function set(entry: WeightEntry): boolean {
    const clean = cleanWeight(entry);
    if (!clean) return false;
    if (!map.has(clean.day) && map.size >= WEIGHT_MAX_ENTRIES) return false;
    // Ważenie tego samego dnia nadpisuje wpis — pola nowszej wersji z poprzedniego przechodzą (D1.1).
    map.set(clean.day, mergeStored(clean, map.get(clean.day), WEIGHT_KNOWN) as WeightEntry);
    return true;
  }

  function remove(day: string): WeightEntry | null {
    const prev = cleanWeight(map.get(day));
    if (!prev) return null;
    map.delete(day);
    return prev;
  }

  /** Scalenie z kopii: brakujące dni przychodzą, a dla tego samego dnia wygrywa nowszy zapis. */
  function mergeDump(raw: unknown): void {
    if (!Array.isArray(raw)) return;
    for (const r of raw) {
      const e = cleanWeight(r);
      if (!e) continue;
      const prev = cleanWeight(map.get(e.day));
      if (!prev || e.created > prev.created) map.set(e.day, mergeStored(e, map.get(e.day), WEIGHT_KNOWN) as WeightEntry);
    }
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  return { get, set, remove, mergeDump, dump: () => get().map((e) => toStored(e) as WeightEntry), subscribe };
}

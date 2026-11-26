import * as Y from "yjs";
import { mergeStored, toStored } from "@/lib/extraFields";
import { cleanMeasure, MEASURE_KNOWN, MEASURE_MAX_ENTRIES, measureKey, type Measure } from "./measures";

/**
 * C3.4 Obwody ciała w Y.Doc notatek — mapa `bodyMeasures`, klucz `partia:dzień` (`measureKey`). Wzór jak `yWeight.ts`:
 * zapis tego samego dnia i partii nadpisuje pomiar, pola nowszej wersji przechodzą (`mergeStored`).
 */
export function createYMeasures(doc: Y.Doc) {
  const map = doc.getMap<Measure>("bodyMeasures");
  let snapshot: Measure[] | null = null;
  const listeners = new Set<() => void>();
  map.observe(() => { snapshot = null; listeners.forEach((l) => l()); });

  /** Oczyszczone pomiary od najstarszego dnia, w dniu według partii. */
  function get(): Measure[] {
    if (snapshot) return snapshot;
    const out: Measure[] = [];
    for (const raw of map.values()) { const m = cleanMeasure(raw); if (m) out.push(m); }
    snapshot = out.sort((a, b) => (a.day !== b.day ? (a.day < b.day ? -1 : 1) : a.part < b.part ? -1 : a.part > b.part ? 1 : 0));
    return snapshot;
  }

  function set(m: Measure): boolean {
    const clean = cleanMeasure(m);
    if (!clean) return false;
    const key = measureKey(clean.part, clean.day);
    if (!map.has(key) && map.size >= MEASURE_MAX_ENTRIES) return false;
    map.set(key, mergeStored(clean, map.get(key), MEASURE_KNOWN) as Measure);
    return true;
  }

  function remove(part: Measure["part"], day: string): Measure | null {
    const key = measureKey(part, day);
    const prev = cleanMeasure(map.get(key));
    if (!prev) return null;
    map.delete(key);
    return prev;
  }

  /** Scalenie z kopii: brakujące pomiary przychodzą, dla tej samej partii i dnia wygrywa nowszy zapis. */
  function mergeDump(raw: unknown): void {
    if (!Array.isArray(raw)) return;
    for (const r of raw) {
      const m = cleanMeasure(r);
      if (!m) continue;
      const key = measureKey(m.part, m.day);
      const prev = cleanMeasure(map.get(key));
      if ((!prev && map.size < MEASURE_MAX_ENTRIES) || (prev && m.created > prev.created)) map.set(key, mergeStored(m, map.get(key), MEASURE_KNOWN) as Measure);
    }
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  return { get, set, remove, mergeDump, dump: () => get().map((m) => toStored(m) as Measure), subscribe };
}

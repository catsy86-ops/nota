import * as Y from "yjs";
import { cleanCheckItems, cleanRecord, DEFAULT_CHECK_ITEMS, isRecordKey, keepFrom, recordKey, type CheckItem, type CheckRecord } from "./entryCheck";

/**
 * Lista przed wejściem w Y.Doc notatek — synchronizacja, plik i kopia jak reszta danych. Mapa
 * `studyEntryCheck`: klucz `items` = własna lista punktów (cała lista, ostatni zapis wygrywa),
 * klucze `r␁budowa␁dzień` = odhaczenia dnia. Osobno od `yStudy.ts`, bo ten moduł jest w paczce
 * startowej, a lista ładuje się dopiero z Dziennikiem.
 */

export const ENTRY_CHECK_ORIGIN = "entry-check";
const ITEMS_KEY = "items";

export interface EntryCheckState {
  /** Punkty stałe: własne albo domyślne. */
  items: CheckItem[];
  /** Lista zmieniona przez użytkownika (nie domyślna). */
  custom: boolean;
  /** Odhaczenia po kluczu `recordKey(budowa, dzień)`. */
  records: ReadonlyMap<string, CheckRecord>;
}

export interface EntryCheckDump {
  items?: CheckItem[];
  records: CheckRecord[];
}

export function createYEntryCheck(doc: Y.Doc) {
  const map = doc.getMap<unknown>("studyEntryCheck");
  let snapshot: EntryCheckState | null = null;
  const listeners = new Set<() => void>();
  map.observe(() => {
    snapshot = null;
    listeners.forEach((l) => l());
  });

  function get(): EntryCheckState {
    if (snapshot) return snapshot;
    const own = cleanCheckItems(map.get(ITEMS_KEY));
    const records = new Map<string, CheckRecord>();
    for (const [k, v] of map.entries()) {
      if (!isRecordKey(k)) continue;
      const r = cleanRecord(v);
      if (r && recordKey(r.site, r.day) === k) records.set(k, r);
    }
    snapshot = { items: own ?? DEFAULT_CHECK_ITEMS.map((i) => ({ ...i })), custom: own !== undefined, records };
    return snapshot;
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  /** Zapis odhaczeń dnia; przy okazji wypadają dni starsze niż `CHECK_KEEP_DAYS`. */
  function setRecord(record: CheckRecord): void {
    const clean = cleanRecord(record);
    if (!clean) return;
    const from = keepFrom(clean.day);
    doc.transact(() => {
      map.set(recordKey(clean.site, clean.day), clean);
      for (const [k, v] of Array.from(map.entries())) {
        if (!isRecordKey(k)) continue;
        const r = cleanRecord(v);
        if (!r || r.day < from) map.delete(k);
      }
    }, ENTRY_CHECK_ORIGIN);
  }

  /** Własna lista punktów; `null` = wróć do domyślnej. */
  function setItems(items: readonly CheckItem[] | null): void {
    doc.transact(() => {
      if (items === null) map.delete(ITEMS_KEY);
      else map.set(ITEMS_KEY, cleanCheckItems(items) ?? []);
    }, ENTRY_CHECK_ORIGIN);
  }

  function dump(): EntryCheckDump {
    const s = get();
    return { ...(s.custom ? { items: s.items } : {}), records: [...s.records.values()] };
  }

  /** Scala kopię: lista punktów tylko, gdy tu jest domyślna; odhaczenia tylko brakujących dni. */
  function mergeDump(raw: unknown): void {
    const d = (raw && typeof raw === "object" ? raw : {}) as Partial<EntryCheckDump>;
    const items = cleanCheckItems(d.items);
    const records = Array.isArray(d.records) ? d.records.map(cleanRecord).filter((r): r is CheckRecord => !!r) : [];
    doc.transact(() => {
      if (items && !map.has(ITEMS_KEY)) map.set(ITEMS_KEY, items);
      for (const r of records) {
        const k = recordKey(r.site, r.day);
        if (!map.has(k)) map.set(k, r);
      }
    }, ENTRY_CHECK_ORIGIN);
  }

  return { get, subscribe, setRecord, setItems, dump, mergeDump };
}

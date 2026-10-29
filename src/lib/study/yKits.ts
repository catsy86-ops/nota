import * as Y from "yjs";
import { cleanKit, DEFAULT_KITS, KITS_MAX, type Kit } from "./kits";

/**
 * Zestawy materiału w Y.Doc notatek (H1.2) — synchronizacja i kopia jak reszta danych. Mapa `studyKits`:
 * klucz `k␁<id>` = zestaw (każdy osobno, więc dwa telefony edytujące różne zestawy się nie nadpisują),
 * klucz `own` = użytkownik zmienił listę (od tej chwili bez przykładowych). Osobno od `yStudy.ts`
 * (paczka startowa) — ładuje się z arkuszem wpisu.
 */

export const KITS_ORIGIN = "kits";
const OWN_KEY = "own";
const PREFIX = "k\u0001";

export interface KitsState {
  /** Zestawy od najstarszego dodanego (kolejność z `order`), albo przykładowe. */
  kits: Kit[];
  /** Lista zmieniona przez użytkownika (nie przykładowa). */
  own: boolean;
}

export interface KitsDump {
  own: boolean;
  kits: Kit[];
}

export function createYKits(doc: Y.Doc) {
  const map = doc.getMap<unknown>("studyKits");
  let snapshot: KitsState | null = null;
  const listeners = new Set<() => void>();
  map.observe(() => {
    snapshot = null;
    listeners.forEach((l) => l());
  });

  function stored(): Kit[] {
    const out: { kit: Kit; order: number }[] = [];
    for (const [k, v] of map.entries()) {
      if (!k.startsWith(PREFIX)) continue;
      const kit = cleanKit(v);
      if (!kit || PREFIX + kit.id !== k) continue;
      const order = typeof (v as { order?: unknown }).order === "number" ? (v as { order: number }).order : 0;
      out.push({ kit, order });
    }
    return out.sort((a, b) => a.order - b.order || a.kit.name.localeCompare(b.kit.name, "pl")).map((x) => x.kit);
  }

  function get(): KitsState {
    if (snapshot) return snapshot;
    const own = map.get(OWN_KEY) === true;
    snapshot = { kits: own ? stored() : DEFAULT_KITS.map((k) => structuredClone(k)), own };
    return snapshot;
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  /** Pierwsza zmiana zapisuje przykładowe zestawy jako własne — dalej edytuje się je jak każdy inny. */
  function adopt(): void {
    if (map.get(OWN_KEY) === true) return;
    map.set(OWN_KEY, true);
    DEFAULT_KITS.forEach((k, i) => { if (!map.has(PREFIX + k.id)) map.set(PREFIX + k.id, { ...structuredClone(k), order: i }); });
  }

  /** Zapis zestawu (nowego albo zmienionego); `false` = odrzucony (bez nazwy, bez pozycji, limit). */
  function save(kit: Kit): boolean {
    const clean = cleanKit(kit);
    if (!clean) return false;
    let ok = true;
    doc.transact(() => {
      adopt();
      const key = PREFIX + clean.id;
      const prev = map.get(key) as { order?: unknown } | undefined;
      if (!prev && stored().length >= KITS_MAX) { ok = false; return; }
      const order = typeof prev?.order === "number" ? prev.order : Date.now();
      map.set(key, { ...clean, order });
    }, KITS_ORIGIN);
    return ok;
  }

  /** Usuwa zestaw; zwraca go do „Cofnij”. */
  function remove(id: string): Kit | null {
    const kit = get().kits.find((k) => k.id === id) ?? null;
    doc.transact(() => {
      adopt();
      map.delete(PREFIX + id);
    }, KITS_ORIGIN);
    return kit;
  }

  function dump(): KitsDump {
    const s = get();
    return { own: s.own, kits: s.own ? s.kits : [] };
  }

  /** Scala kopię: zestawy, których tu nie ma, dochodzą; istniejące zostają (bez nadpisywania). */
  function mergeDump(raw: unknown): void {
    const d = (raw && typeof raw === "object" ? raw : {}) as Partial<KitsDump>;
    if (d.own !== true || !Array.isArray(d.kits)) return;
    const kits = d.kits.map(cleanKit).filter((k): k is Kit => !!k);
    doc.transact(() => {
      adopt();
      kits.forEach((k, i) => { if (!map.has(PREFIX + k.id)) map.set(PREFIX + k.id, { ...k, order: Date.now() + i }); });
    }, KITS_ORIGIN);
  }

  return { get, subscribe, save, remove, dump, mergeDump };
}

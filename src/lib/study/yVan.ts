import * as Y from "yjs";
import { cleanVanEvent, cleanVanItem, VAN_ITEMS_MAX, type VanEvent, type VanItem } from "./van";

/**
 * Materiał w aucie (H1.3) w Y.Doc notatek. Mapa `studyVan`: `i␁id` pozycja, `e␁pozycja␁id` zdarzenie
 * (inwentaryzacja albo przyjęcie), `s␁budowa` ostatni wybór źródła materiału na budowie („site” / „van”).
 * Każde zdarzenie pod własnym kluczem — dwa telefony scalają się bez strat. Osobno od `yStudy.ts`.
 */

export const VAN_ORIGIN = "van";
const SEP = "\u0001";
const key = (...parts: string[]) => parts.join(SEP);
const isId = (v: string) => v.length > 0 && v.length <= 64;

export interface VanState {
  items: VanItem[];
  events: VanEvent[];
  /** Ostatni wybór źródła na budowie: id budowy → „site” (dostawa na budowę) albo „van”. */
  siteSupply: Record<string, "site" | "van">;
}

export interface VanDump {
  items: VanItem[];
  events: VanEvent[];
}

export function createYVan(doc: Y.Doc) {
  const map = doc.getMap<unknown>("studyVan");
  let snapshot: VanState | null = null;
  const listeners = new Set<() => void>();
  map.observe(() => {
    snapshot = null;
    listeners.forEach((l) => l());
  });

  function get(): VanState {
    if (snapshot) return snapshot;
    const items: VanItem[] = [];
    const events: VanEvent[] = [];
    const siteSupply: Record<string, "site" | "van"> = {};
    for (const [k, v] of map.entries()) {
      const [kind, a, b] = k.split(SEP);
      if (kind === "i" && a) { const it = cleanVanItem(v, a); if (it) items.push(it); }
      else if (kind === "e" && a && b) { const ev = cleanVanEvent(v, a, b); if (ev) events.push(ev); }
      else if (kind === "s" && a && isId(a) && (v === "site" || v === "van")) siteSupply[a] = v;
    }
    items.sort((x, y) => x.order - y.order || x.name.localeCompare(y.name, "pl"));
    // Zdarzenia pozycji usuniętej na innym telefonie nie liczą się.
    const ids = new Set(items.map((i) => i.id));
    snapshot = { items, events: events.filter((e) => ids.has(e.item)).sort((x, y) => x.at - y.at), siteSupply };
    return snapshot;
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  /** Nowa albo zmieniona pozycja; `false` = złe dane albo za dużo pozycji. */
  function saveItem(item: VanItem): boolean {
    const clean = cleanVanItem(item, item.id);
    const exists = map.has(key("i", item.id));
    if (!clean || (!exists && get().items.length >= VAN_ITEMS_MAX)) return false;
    const { id, ...value } = clean;
    doc.transact(() => map.set(key("i", id), value), VAN_ORIGIN);
    return true;
  }

  /** Usuwa pozycję z jej zdarzeniami; zwraca je do „Cofnij”. */
  function removeItem(id: string): { item: VanItem; events: VanEvent[] } | null {
    const cur = get();
    const item = cur.items.find((i) => i.id === id);
    if (!item) return null;
    const events = cur.events.filter((e) => e.item === id);
    doc.transact(() => {
      map.delete(key("i", id));
      for (const e of events) map.delete(key("e", id, e.id));
    }, VAN_ORIGIN);
    return { item, events };
  }

  function restoreItem(r: { item: VanItem; events: VanEvent[] }): void {
    doc.transact(() => {
      const { id, ...value } = r.item;
      map.set(key("i", id), value);
      for (const e of r.events) { const { id: eid, item, ...ev } = e; map.set(key("e", item, eid), ev); }
    }, VAN_ORIGIN);
  }

  /** Inwentaryzacja albo przyjęcie; `false` = zła ilość albo brak pozycji. */
  function addEvent(ev: VanEvent): boolean {
    if (!get().items.some((i) => i.id === ev.item)) return false;
    const clean = cleanVanEvent(ev, ev.item, ev.id);
    if (!clean) return false;
    const { id, item, ...value } = clean;
    doc.transact(() => map.set(key("e", item, id), value), VAN_ORIGIN);
    return true;
  }

  function removeEvent(ev: Pick<VanEvent, "item" | "id">): void {
    const k = key("e", ev.item, ev.id);
    if (map.has(k)) doc.transact(() => map.delete(k), VAN_ORIGIN);
  }

  /** Ostatni wybór źródła materiału na budowie (H-1: karta pamięta). */
  function setSiteSupply(site: string, supply: "site" | "van"): void {
    if (!isId(site) || map.get(key("s", site)) === supply) return;
    doc.transact(() => map.set(key("s", site), supply), VAN_ORIGIN);
  }

  function dump(): VanDump {
    const { items, events } = get();
    return { items, events };
  }

  /** Scala kopię: pozycje i zdarzenia, których tu nie ma, dochodzą; istniejące zostają. */
  function mergeDump(raw: unknown): void {
    const d = raw as Partial<VanDump> | null;
    if (!d || typeof d !== "object") return;
    doc.transact(() => {
      for (const v of Array.isArray(d.items) ? d.items.slice(0, VAN_ITEMS_MAX) : []) {
        const id = (v as Partial<VanItem> | null)?.id;
        const it = typeof id === "string" ? cleanVanItem(v, id) : null;
        if (it && !map.has(key("i", it.id))) { const { id: _, ...value } = it; map.set(key("i", it.id), value); }
      }
      // Zdarzenia tylko znanych pozycji i w rozsądnej liczbie (D4, D5 audytu).
      for (const v of (Array.isArray(d.events) ? d.events : []).slice(0, 20_000)) {
        const e = v as Partial<VanEvent> | null;
        const ev = e && typeof e.item === "string" && typeof e.id === "string" ? cleanVanEvent(e, e.item, e.id) : null;
        if (ev && map.has(key("i", ev.item)) && !map.has(key("e", ev.item, ev.id))) { const { id, item, ...value } = ev; map.set(key("e", item, id), value); }
      }
    }, VAN_ORIGIN);
  }

  return { get, subscribe, saveItem, removeItem, restoreItem, addEvent, removeEvent, setSiteSupply, dump, mergeDump };
}

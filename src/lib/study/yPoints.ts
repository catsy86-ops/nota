import * as Y from "yjs";
import { cleanPoint, cleanRoom, POINTS_MAX, ROOMS_MAX, type Room, type WaterPoint } from "./points";

/**
 * Punkty w pomieszczeniach w Y.Doc notatek (H2.1) — synchronizacja i kopia jak reszta danych. Mapa
 * `studyPoints`: `r␁budowa␁id` = pomieszczenie, `p␁budowa␁id` = punkt. Każda pozycja pod własnym kluczem,
 * więc dwa telefony odhaczające różne punkty scalają się bez strat; ten sam punkt — ostatni zapis wygrywa.
 * Osobno od `yStudy.ts` (paczka startowa) — ładuje się z kartą budowy.
 */

export const POINTS_ORIGIN = "points";
const SEP = "\u0001";
const roomKey = (site: string, id: string) => ["r", site, id].join(SEP);
const pointKey = (site: string, id: string) => ["p", site, id].join(SEP);

export interface SitePoints {
  rooms: Room[];
  points: WaterPoint[];
}

export interface PointsDump {
  sites: Record<string, SitePoints>;
}

const EMPTY: SitePoints = { rooms: [], points: [] };

export function createYPoints(doc: Y.Doc) {
  const map = doc.getMap<unknown>("studyPoints");
  let snapshot: Map<string, SitePoints> | null = null;
  const listeners = new Set<() => void>();
  map.observe(() => {
    snapshot = null;
    listeners.forEach((l) => l());
  });

  function all(): Map<string, SitePoints> {
    if (snapshot) return snapshot;
    const out = new Map<string, SitePoints>();
    const of = (site: string) => { let s = out.get(site); if (!s) { s = { rooms: [], points: [] }; out.set(site, s); } return s; };
    for (const [k, v] of map.entries()) {
      const [kind, site, id] = k.split(SEP);
      if (!site || !id) continue;
      if (kind === "r") { const r = cleanRoom(v); if (r && r.id === id) of(site).rooms.push(r); }
      else if (kind === "p") { const p = cleanPoint(v); if (p && p.id === id) of(site).points.push(p); }
    }
    for (const s of out.values()) {
      const rooms = new Set(s.rooms.map((r) => r.id));
      // Punkt bez pomieszczenia (usunięte na drugim telefonie) nie jest pokazywany.
      s.points = s.points.filter((p) => rooms.has(p.room)).sort((a, b) => a.order - b.order);
      s.rooms.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pl"));
    }
    snapshot = out;
    return out;
  }

  const get = (site: string): SitePoints => all().get(site) ?? EMPTY;

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  /** Pomieszczenie z punktami jednym zapisem; `false` = odrzucone (limit, zła nazwa). */
  function addRoom(site: string, room: Room, points: readonly WaterPoint[] = []): boolean {
    const r = cleanRoom(room);
    const cur = get(site);
    if (!r || cur.rooms.length >= ROOMS_MAX || cur.points.length + points.length > POINTS_MAX) return false;
    doc.transact(() => {
      map.set(roomKey(site, r.id), r);
      for (const p of points) { const c = cleanPoint({ ...p, room: r.id }); if (c) map.set(pointKey(site, c.id), c); }
    }, POINTS_ORIGIN);
    return true;
  }

  function renameRoom(site: string, id: string, name: string): void {
    const prev = get(site).rooms.find((r) => r.id === id);
    const r = prev && cleanRoom({ ...prev, name });
    if (r) doc.transact(() => map.set(roomKey(site, id), r), POINTS_ORIGIN);
  }

  /** Usuwa pomieszczenie z jego punktami; zwraca je do „Cofnij”. */
  function removeRoom(site: string, id: string): { room: Room; points: WaterPoint[] } | null {
    const cur = get(site);
    const room = cur.rooms.find((r) => r.id === id);
    if (!room) return null;
    const points = cur.points.filter((p) => p.room === id);
    doc.transact(() => {
      map.delete(roomKey(site, id));
      for (const p of points) map.delete(pointKey(site, p.id));
    }, POINTS_ORIGIN);
    return { room, points };
  }

  /** Zapis punktu (nowego albo zmienionego); `false` = odrzucony (limit, brak pomieszczenia). */
  function savePoint(site: string, point: WaterPoint): boolean {
    const p = cleanPoint(point);
    const cur = get(site);
    if (!p || !cur.rooms.some((r) => r.id === p.room)) return false;
    if (!cur.points.some((x) => x.id === p.id) && cur.points.length >= POINTS_MAX) return false;
    doc.transact(() => map.set(pointKey(site, p.id), p), POINTS_ORIGIN);
    return true;
  }

  function removePoint(site: string, id: string): WaterPoint | null {
    const p = get(site).points.find((x) => x.id === id) ?? null;
    if (p) doc.transact(() => map.delete(pointKey(site, id)), POINTS_ORIGIN);
    return p;
  }

  function dump(): PointsDump {
    return { sites: Object.fromEntries(all()) };
  }

  /** Scala kopię: pozycje, których tu nie ma, dochodzą; istniejące zostają. */
  function mergeDump(raw: unknown): void {
    const sites = (raw as Partial<PointsDump> | null)?.sites;
    if (!sites || typeof sites !== "object") return;
    doc.transact(() => {
      for (const [site, data] of Object.entries(sites)) {
        if (!site || site.length > 64 || !data || typeof data !== "object") continue;
        const d = data as Partial<SitePoints>;
        for (const raw of Array.isArray(d.rooms) ? d.rooms : []) {
          const r = cleanRoom(raw);
          if (r && !map.has(roomKey(site, r.id))) map.set(roomKey(site, r.id), r);
        }
        for (const raw of Array.isArray(d.points) ? d.points : []) {
          const p = cleanPoint(raw);
          if (p && !map.has(pointKey(site, p.id))) map.set(pointKey(site, p.id), p);
        }
      }
    }, POINTS_ORIGIN);
  }

  return { get, subscribe, addRoom, renameRoom, removeRoom, savePoint, removePoint, dump, mergeDump };
}

import { useCallback, useSyncExternalStore } from "react";
import { yjsStore } from "@/lib/yjsStore";
import { newPoint, pointType, ROOM_TEMPLATES, toggleStep, type Room, type WaterPoint } from "./points";
import { createYPoints, type SitePoints } from "./yPoints";

/** Punkty w pomieszczeniach żyją w dokumencie Yjs notatek (`yPoints.ts`); widoki zmieniają je tylko akcjami poniżej. */
const yPoints = createYPoints(yjsStore.doc);

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export function useSitePoints(site: string): SitePoints {
  const get = useCallback(() => yPoints.get(site), [site]);
  return useSyncExternalStore(yPoints.subscribe, get);
}

export const getSitePoints = (site: string) => yPoints.get(site);

/** Nowe pomieszczenie; z szablonu dostaje jego punkty. Nazwa z szablonu dostaje numer, gdy już jest („Łazienka 2”). */
export function addRoom(site: string, name: string, templateId?: string): Room | null {
  const cur = yPoints.get(site);
  const tpl = ROOM_TEMPLATES.find((t) => t.id === templateId);
  let finalName = name.trim() || tpl?.name || "";
  if (tpl && !name.trim()) {
    const taken = new Set(cur.rooms.map((r) => r.name));
    for (let n = 2; taken.has(finalName); n++) finalName = `${tpl.name} ${n}`;
  }
  const order = Date.now();
  const room: Room = { id: id("room"), name: finalName, order };
  const points = (tpl?.types ?? []).map((t, i) => newPoint(id("pt"), room.id, t, order + i));
  return yPoints.addRoom(site, room, points) ? room : null;
}

export const renameRoom = (site: string, roomId: string, name: string) => yPoints.renameRoom(site, roomId, name);
export const removeRoom = (site: string, roomId: string) => yPoints.removeRoom(site, roomId);
export const restoreRoom = (site: string, removed: { room: Room; points: WaterPoint[] }) => yPoints.addRoom(site, removed.room, removed.points);

export function addPoint(site: string, roomId: string, typeId: string): WaterPoint | null {
  const p = newPoint(id("pt"), roomId, pointType(typeId).id, Date.now());
  return yPoints.savePoint(site, p) ? p : null;
}

export const savePoint = (site: string, point: WaterPoint) => yPoints.savePoint(site, point);
export const removePoint = (site: string, pointId: string) => yPoints.removePoint(site, pointId);

/** Stuknięcie kratki kroku punktu (`toggleStep`). Zwraca punkt sprzed zmiany — do „Cofnij”. */
export function togglePointStep(site: string, point: WaterPoint, index: number, now: number = Date.now()): WaterPoint {
  yPoints.savePoint(site, toggleStep(point, index, now));
  return point;
}

export const pointsDump = () => yPoints.dump();
export const mergePointsDump = (raw: unknown) => yPoints.mergeDump(raw);
export const subscribePoints = (cb: () => void) => yPoints.subscribe(cb);

import type * as Y from "yjs";
import { MAIN_SCHEDULE_ID, SHIFTS_MAP_BASE_NAMES, shiftsMapName } from "./yShifts";

/**
 * Rejestr grafików: nazwy i kolejność. Dane każdego grafiku siedzą we własnych mapach (`yShifts.ts`).
 * Rejestr jest w dokumencie, więc nowy grafik pojawia się na innych urządzeniach po synchronizacji.
 * Grafik główny istnieje zawsze i nie da się go usunąć.
 */

export interface ShiftSchedule {
  id: string;
  name: string;
}

export const SCHEDULE_NAME_MAX = 40;
export const SCHEDULES_MAX = 10;
export const MAIN_SCHEDULE_NAME = "Główny";
const REGISTRY_MAP = "shiftSchedules";

/** Id nadawane przez `add`: `s-` i UUID. Id z pliku kopii musi mieć ten kształt (M5). */
export const isScheduleId = (id: string): boolean => /^s-[A-Za-z0-9-]{8,64}$/.test(id);

/** Czyszczenie nazwy: bez nadmiaru spacji, w limicie długości. `null` = pusta. */
export function cleanScheduleName(name: string): string | null {
  const n = name.replace(/\s+/g, " ").trim().slice(0, SCHEDULE_NAME_MAX);
  return n ? n : null;
}

export function createScheduleRegistry(doc: Y.Doc) {
  const registry = doc.getMap<ShiftSchedule>(REGISTRY_MAP);
  // Lista grafików jest czytana przez useSyncExternalStore: ten sam obiekt, dopóki rejestr się nie zmieni.
  let cache: ShiftSchedule[] | null = null;
  const listeners = new Set<() => void>();
  registry.observe(() => { cache = null; listeners.forEach((l) => l()); });

  /** Wszystkie grafiki: główny zawsze pierwszy, potem alfabetycznie po nazwie. */
  function list(): ShiftSchedule[] {
    if (cache) return cache;
    const main: ShiftSchedule = { id: MAIN_SCHEDULE_ID, name: registry.get(MAIN_SCHEDULE_ID)?.name ?? MAIN_SCHEDULE_NAME };
    const others: ShiftSchedule[] = [];
    for (const [id, s] of registry.entries()) {
      if (id === MAIN_SCHEDULE_ID) continue;
      const name = cleanScheduleName(typeof s?.name === "string" ? s.name : "");
      if (name) others.push({ id, name });
    }
    cache = [main, ...others.sort((a, b) => a.name.localeCompare(b.name, "pl"))];
    return cache;
  }

  function has(id: string): boolean {
    return id === MAIN_SCHEDULE_ID || list().some((s) => s.id === id);
  }

  /** Dodaje grafik; `null` = pusta nazwa albo osiągnięty limit. */
  function add(name: string, newId: string = `s-${crypto.randomUUID()}`): ShiftSchedule | null {
    const clean = cleanScheduleName(name);
    if (!clean || list().length >= SCHEDULES_MAX) return null;
    const s = { id: newId, name: clean };
    doc.transact(() => registry.set(s.id, s));
    return s;
  }

  function rename(id: string, name: string): boolean {
    const clean = cleanScheduleName(name);
    if (!clean || !has(id)) return false;
    doc.transact(() => registry.set(id, { id, name: clean }));
    return true;
  }

  /**
   * Usuwa grafik wraz z jego danymi (rodzaje, dni, cykle, premie). Główny nie da się usunąć.
   * Zwraca `false`, gdy nie wolno albo grafiku nie ma.
   */
  function remove(id: string): boolean {
    if (id === MAIN_SCHEDULE_ID || !has(id)) return false;
    doc.transact(() => {
      registry.delete(id);
      for (const base of SHIFTS_MAP_BASE_NAMES) {
        const m = doc.getMap(shiftsMapName(id, base));
        for (const k of Array.from(m.keys())) m.delete(k);
      }
    });
    return true;
  }

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }

  return { list, has, add, rename, remove, subscribe };
}

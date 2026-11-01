import * as Y from "yjs";
import {
  cleanCalibration, cleanColors, cleanItem, cleanProject, cleanRoute, cleanSymbol, cleanText, isPlanId,
  PLAN_ITEMS_MAX, PLAN_PROJECTS_MAX, PLAN_ROUTES_MAX, PLAN_SYMBOLS_MAX, PLAN_TEXTS_MAX,
  type AnalysisProject, type DetectedSymbol, type PlanColor, type DetectedText, type MaterialItem, type PipeRoute, type PlanCalibration,
} from "./model";
import { PLANS_MAP } from "./planRefs";

/**
 * Analizy planów w Y.Doc notatek — synchronizacja i kopia jak reszta danych. Jedna mapa `plans`,
 * każda encja pod własnym kluczem (wzór `yPoints.ts`):
 * `p␁pid` projekt, `c␁pid` kalibracja, `k␁pid` kolory warstw → instalacje, `r␁pid␁id` trasa, `t␁pid␁id` tekst OCR, `s␁pid␁id` symbol,
 * `i␁pid␁id` ręczna pozycja zestawienia. Wartość = zwykły obiekt; dwa urządzenia edytujące różne
 * trasy scalają się bez strat, ta sama trasa — ostatni zapis wygrywa. Kalibracja osobno od projektu,
 * żeby zmiana nazwy na telefonie nie nadpisała kalibracji z komputera.
 */

export const PLANS_ORIGIN = "plans";
/** Scalanie kopii — osobny origin, więc nie trafia na stos „Cofnij”. */
const IMPORT_ORIGIN = "plans-import";
const SEP = "\u0001";

export type EntityKind = "r" | "t" | "s" | "i";
type EntityOf = { r: PipeRoute; t: DetectedText; s: DetectedSymbol; i: MaterialItem };

const CLEAN: { [K in EntityKind]: (v: unknown) => EntityOf[K] | null } = { r: cleanRoute, t: cleanText, s: cleanSymbol, i: cleanItem };
const LIMIT: Record<EntityKind, number> = { r: PLAN_ROUTES_MAX, t: PLAN_TEXTS_MAX, s: PLAN_SYMBOLS_MAX, i: PLAN_ITEMS_MAX };

export interface PlanData {
  project: AnalysisProject;
  calibration: PlanCalibration | null;
  /** Kolory warstw przypisane do instalacji (`k␁pid`). */
  colors: PlanColor[];
  routes: PipeRoute[];
  texts: DetectedText[];
  symbols: DetectedSymbol[];
  items: MaterialItem[];
  /** Ostatnia zmiana czegokolwiek w analizie (projekt albo encja) — do sortowania listy. */
  lastEdit: number;
}

/** Wszystko, co należy do analizy — do „Cofnij” po usunięciu i do kopii. */
export type PlanEntries = Record<string, unknown>;

export interface PlansDump {
  entries: PlanEntries;
}

const projectKey = (pid: string) => ["p", pid].join(SEP);
const calKey = (pid: string) => ["c", pid].join(SEP);
const colorsKey = (pid: string) => ["k", pid].join(SEP);
const entityKey = (kind: EntityKind, pid: string, id: string) => [kind, pid, id].join(SEP);

const LIST_OF: Record<EntityKind, "routes" | "texts" | "symbols" | "items"> = { r: "routes", t: "texts", s: "symbols", i: "items" };

export function createYPlans(doc: Y.Doc) {
  const map = doc.getMap<unknown>(PLANS_MAP);
  let snapshot: { byId: Map<string, PlanData>; list: PlanData[] } | null = null;
  const listeners = new Set<() => void>();
  map.observe(() => {
    snapshot = null;
    listeners.forEach((l) => l());
  });
  // Cofanie zmian z tego urządzenia (zmiany z innych przychodzą bez origin i nie są cofane).
  // Kilka zapisów w 400 ms to jeden krok (np. przeciągnięcie punktu trasy).
  const undo = new Y.UndoManager(map, { trackedOrigins: new Set([PLANS_ORIGIN]), captureTimeout: 400 });
  const undoListeners = new Set<() => void>();
  const undoChanged = () => undoListeners.forEach((l) => l());
  for (const ev of ["stack-item-added", "stack-item-popped", "stack-cleared"] as const) undo.on(ev, undoChanged);

  function read() {
    if (snapshot) return snapshot;
    const byId = new Map<string, PlanData>();
    const cals = new Map<string, PlanCalibration>();
    const colors = new Map<string, PlanColor[]>();
    const entities: [EntityKind, string, string, unknown][] = [];
    for (const [k, v] of map.entries()) {
      const [kind, pid, id] = k.split(SEP);
      if (!pid) continue;
      if (kind === "p") {
        const p = cleanProject(v);
        if (p && p.id === pid) byId.set(pid, { project: p, calibration: null, colors: [], routes: [], texts: [], symbols: [], items: [], lastEdit: p.updatedAt });
      } else if (kind === "c") {
        const c = cleanCalibration(v);
        if (c) cals.set(pid, c);
      } else if (kind === "k") {
        colors.set(pid, cleanColors(v));
      } else if ((kind === "r" || kind === "t" || kind === "s" || kind === "i") && id) {
        entities.push([kind, pid, id, v]);
      }
    }
    for (const [pid, c] of colors) { const d = byId.get(pid); if (d) d.colors = c; }
    for (const [pid, c] of cals) {
      const d = byId.get(pid);
      if (d) { d.calibration = c; d.lastEdit = Math.max(d.lastEdit, c.at); }
    }
    // Sieroty (encja analizy usuniętej na drugim urządzeniu) nie są pokazywane.
    for (const [kind, pid, id, v] of entities) {
      const d = byId.get(pid);
      if (!d) continue;
      const e = CLEAN[kind](v);
      if (!e || e.id !== id) continue;
      const list = d[LIST_OF[kind]] as { at: number }[];
      if (list.length >= LIMIT[kind]) continue;
      list.push(e);
      d.lastEdit = Math.max(d.lastEdit, e.at);
    }
    for (const d of byId.values()) for (const k of ["routes", "texts", "symbols", "items"] as const) (d[k] as { at: number; id: string }[]).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
    const list = [...byId.values()].sort((a, b) => b.lastEdit - a.lastEdit).slice(0, PLAN_PROJECTS_MAX);
    snapshot = { byId, list };
    return snapshot;
  }

  const list = (): PlanData[] => read().list;
  const get = (pid: string): PlanData | null => read().byId.get(pid) ?? null;

  function subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  /** Nowa analiza; `false` = odrzucona (limit, zły kształt). */
  function createProject(project: AnalysisProject): boolean {
    const p = cleanProject(project);
    if (!p || get(p.id) || list().length >= PLAN_PROJECTS_MAX) return false;
    doc.transact(() => map.set(projectKey(p.id), p), PLANS_ORIGIN);
    return true;
  }

  /** Zmiana pól projektu (nazwa, status, budowa); obraz i daty utworzenia zostają. */
  function updateProject(pid: string, patch: Partial<Pick<AnalysisProject, "name" | "status" | "siteId">>, now = Date.now()): boolean {
    const cur = get(pid)?.project;
    if (!cur) return false;
    const next = { ...cur, ...patch, updatedAt: Math.max(now, cur.createdAt) };
    if ("siteId" in patch && !patch.siteId) delete next.siteId;
    const p = cleanProject(next);
    if (!p) return false;
    doc.transact(() => map.set(projectKey(pid), p), PLANS_ORIGIN);
    return true;
  }

  function setCalibration(pid: string, cal: PlanCalibration | null): boolean {
    if (!get(pid)) return false;
    if (cal === null) { doc.transact(() => map.delete(calKey(pid)), PLANS_ORIGIN); return true; }
    const c = cleanCalibration(cal);
    if (!c) return false;
    doc.transact(() => map.set(calKey(pid), c), PLANS_ORIGIN);
    return true;
  }

  /** Kolory warstw → instalacje (cała lista naraz; pusta lista usuwa klucz). */
  function setColors(pid: string, list: PlanColor[]): boolean {
    if (!get(pid)) return false;
    const clean = cleanColors(list);
    doc.transact(() => { if (clean.length) map.set(colorsKey(pid), clean); else map.delete(colorsKey(pid)); }, PLANS_ORIGIN);
    return true;
  }

  /** Zapis encji (nowej albo zmienionej); `false` = odrzucona (limit, zły kształt, brak analizy). */
  function save<K extends EntityKind>(kind: K, pid: string, entity: EntityOf[K]): boolean {
    const d = get(pid);
    const e = CLEAN[kind](entity);
    if (!d || !e) return false;
    const list = d[LIST_OF[kind]] as { id: string }[];
    if (!list.some((x) => x.id === e.id) && list.length >= LIMIT[kind]) return false;
    doc.transact(() => map.set(entityKey(kind, pid, e.id), e), PLANS_ORIGIN);
    return true;
  }

  function remove<K extends EntityKind>(kind: K, pid: string, id: string): EntityOf[K] | null {
    const list = (get(pid)?.[LIST_OF[kind]] ?? []) as EntityOf[K][];
    const e = list.find((x) => x.id === id) ?? null;
    if (e) doc.transact(() => map.delete(entityKey(kind, pid, id)), PLANS_ORIGIN);
    return e;
  }

  /** Klucze i wartości analizy (projekt, kalibracja, encje). */
  function entriesOf(pid: string): PlanEntries {
    const out: PlanEntries = {};
    for (const [k, v] of map.entries()) {
      const [, p] = k.split(SEP);
      if (p === pid) out[k] = v;
    }
    return out;
  }

  /** Usuwa analizę ze wszystkim w jednej transakcji; zwraca wpisy do „Cofnij”. */
  function removeProject(pid: string): PlanEntries | null {
    if (!get(pid)) return null;
    const entries = entriesOf(pid);
    doc.transact(() => { for (const k of Object.keys(entries)) map.delete(k); }, PLANS_ORIGIN);
    return entries;
  }

  /** Wpisy (z „Cofnij” albo z kopii) wracają przez `clean*` — tylko znane klucze i kształty. */
  function restore(entries: PlanEntries, onlyMissing = false, origin: string = PLANS_ORIGIN): void {
    doc.transact(() => {
      for (const [k, v] of Object.entries(entries)) {
        if (onlyMissing && map.has(k)) continue;
        const [kind, pid, id] = k.split(SEP);
        if (!isPlanId(pid)) continue;
        if (kind === "p") { const p = cleanProject(v); if (p && p.id === pid && !id) map.set(k, p); }
        else if (kind === "c") { const c = cleanCalibration(v); if (c && !id) map.set(k, c); }
        else if (kind === "k") { const c = cleanColors(v); if (c.length && !id) map.set(k, c); }
        else if ((kind === "r" || kind === "t" || kind === "s" || kind === "i") && isPlanId(id)) {
          const e = CLEAN[kind](v);
          if (e && e.id === id) map.set(k, e);
        }
      }
    }, origin);
  }

  function dump(): PlansDump {
    const entries: PlanEntries = {};
    for (const d of list()) Object.assign(entries, entriesOf(d.project.id));
    return { entries };
  }

  /** Scala kopię: wpisy, których tu nie ma, dochodzą; istniejące zostają (jak `kits`/`points`). */
  function mergeDump(raw: unknown): void {
    const entries = (raw as Partial<PlansDump> | null)?.entries;
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) return;
    restore(entries as PlanEntries, true, IMPORT_ORIGIN);
  }

  const history = {
    undo: () => { undo.undo(); },
    redo: () => { undo.redo(); },
    /** Nowy stos przy otwarciu analizy — „Cofnij” nie sięga do innej analizy. */
    clear: () => { undo.clear(); },
    /** Kończy bieżący krok: następny zapis to osobna pozycja „Cofnij”. */
    stop: () => { undo.stopCapturing(); },
    canUndo: () => undo.undoStack.length > 0,
    canRedo: () => undo.redoStack.length > 0,
    subscribe: (cb: () => void) => { undoListeners.add(cb); return () => { undoListeners.delete(cb); }; },
  };

  return { list, get, subscribe, history, createProject, updateProject, setCalibration, setColors, save, remove, removeProject, restore, dump, mergeDump };
}

export type YPlans = ReturnType<typeof createYPlans>;

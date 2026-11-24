import { createPersistedStore } from "@/lib/persistedStore";
import { PRACA } from "@/lib/storage/names";
import { POINT_TYPES, POINTS_MAX, ROOM_NAME_MAX, ROOMS_MAX, type Room, type WaterPoint } from "./points";
import { addRoom } from "./pointsStore";
import { setSiteStages } from "./store";
import { cleanStages, type SiteStage } from "./stages";

/**
 * R4.4 Wzorce powtarzalnych budów („Łazienka”, „Kotłownia”): zapisane etapy i pomieszczenia z rodzajami punktów.
 * Nowa budowa z wzorca dostaje je bez stanów (etapy nieodhaczone, punkty bez kroków). Wzorce są ustawieniem
 * tego urządzenia (klucz `localStorage` w kopii), nie danymi budowy — nie synchronizują się między telefonami.
 */

export const PATTERN_NAME_MAX = 40;
export const PATTERNS_MAX = 20;

interface PatternRoom { name: string; types: string[] }
export interface SitePattern {
  id: string;
  name: string;
  /** Etapy bez `done`. */
  stages: SiteStage[];
  rooms: PatternRoom[];
  created: number;
}

const KNOWN_TYPES = new Set(POINT_TYPES.map((t) => t.id));

function cleanRoom(raw: unknown): PatternRoom | null {
  const r = raw as Partial<PatternRoom> | null;
  if (!r || typeof r !== "object") return null;
  const name = typeof r.name === "string" ? r.name.trim().slice(0, ROOM_NAME_MAX) : "";
  if (!name) return null;
  const types = Array.isArray(r.types) ? r.types.filter((t): t is string => typeof t === "string" && KNOWN_TYPES.has(t)).slice(0, POINTS_MAX) : [];
  return { name, types };
}

/** Dowolne wejście (localStorage, kopia) → poprawna lista; zepsute wzorce odpadają. */
export function cleanPatterns(raw: unknown): SitePattern[] {
  if (!Array.isArray(raw)) return [];
  const out: SitePattern[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    const p = v as Partial<SitePattern> | null;
    if (!p || typeof p !== "object" || typeof p.id !== "string" || !p.id || p.id.length > 40 || seen.has(p.id)) continue;
    const name = typeof p.name === "string" ? p.name.trim().slice(0, PATTERN_NAME_MAX) : "";
    if (!name) continue;
    const stages = (cleanStages(p.stages) ?? []).map(({ id, name: n }) => ({ id, name: n }));
    const rooms = Array.isArray(p.rooms) ? p.rooms.flatMap((r) => { const c = cleanRoom(r); return c ? [c] : []; }).slice(0, ROOMS_MAX) : [];
    if (stages.length === 0 && rooms.length === 0) continue;
    seen.add(p.id);
    out.push({ id: p.id, name, stages, rooms, created: typeof p.created === "number" && Number.isFinite(p.created) ? p.created : 0 });
    if (out.length >= PATTERNS_MAX) break;
  }
  return out;
}

/** Wzorzec z karty budowy: etapy bez stanów i pomieszczenia z rodzajami punktów w kolejności. */
export function patternFromSite(
  name: string,
  site: { stages?: readonly SiteStage[] },
  points: { rooms: readonly Room[]; points: readonly WaterPoint[] },
  now: number,
): SitePattern | null {
  const rooms = [...points.rooms].sort((a, b) => a.order - b.order).map((r) => ({
    name: r.name,
    types: points.points.filter((p) => p.room === r.id).sort((a, b) => a.order - b.order).map((p) => p.type),
  }));
  const [clean] = cleanPatterns([{ id: `p-${now.toString(36)}`, name, stages: site.stages ?? [], rooms, created: now }]);
  return clean ?? null;
}

export const sitePatternsStore = createPersistedStore<SitePattern[]>(PRACA.sitePatterns, [], {
  merge: (_def, stored) => cleanPatterns(stored),
});
export const useSitePatterns = () => sitePatternsStore.use();

export type SavePatternResult = { ok: false } | { ok: true; replaced: SitePattern | null };

/**
 * Zapis wzorca; ta sama nazwa (bez wielkości liter) zastępuje stary na jego miejscu na liście, a wynik oddaje
 * zastąpiony — „Cofnij” go przywraca. Pełna lista = `{ ok: false }`.
 */
export function saveSitePattern(p: SitePattern): SavePatternResult {
  const cur = sitePatternsStore.get();
  const same = (x: SitePattern) => x.name.toLocaleLowerCase("pl") === p.name.toLocaleLowerCase("pl");
  const i = cur.findIndex(same);
  if (i < 0 && cur.length >= PATTERNS_MAX) return { ok: false };
  sitePatternsStore.set(cleanPatterns(i < 0 ? [...cur, p] : cur.map((x, j) => (j === i ? p : x))));
  return { ok: true, replaced: i < 0 ? null : cur[i] };
}

/** Cofnięcie zapisu: usuwa wzorzec, a gdy zastąpił starszy o tej samej nazwie — wstawia tamten z powrotem na to miejsce. */
export function undoSitePattern(id: string, replaced: SitePattern | null): void {
  const cur = sitePatternsStore.get();
  sitePatternsStore.set(replaced ? cleanPatterns(cur.map((x) => (x.id === id ? replaced : x))) : cur.filter((x) => x.id !== id));
}

export function removeSitePattern(id: string): void {
  sitePatternsStore.set(sitePatternsStore.get().filter((p) => p.id !== id));
}

/**
 * Wzorzec na świeżo założonej karcie (po `saveSiteCard`): etapy jedną zmianą, każde pomieszczenie razem z punktami
 * w jednej transakcji (`addRoom` z `types`) — bez osobnego zapisu na każdy punkt.
 */
export function applySitePattern(siteId: string, pattern: Pick<SitePattern, "stages" | "rooms">): void {
  if (pattern.stages.length > 0) setSiteStages(siteId, pattern.stages, []);
  // Kolejność pomieszczeń z wzorca: każde dostaje własny `order` (pętla mieści się w jednej milisekundzie).
  const base = Date.now();
  pattern.rooms.forEach((r, i) => addRoom(siteId, r.name, undefined, r.types, base + i * (POINTS_MAX + 1)));
}

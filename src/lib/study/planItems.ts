import { startOfDayOf } from "@/lib/dueTerms";

/**
 * Plan na dziś na budowie (P-5, plan Pracy 2.6): 3–5 zadań wpisanych na karcie budowy, odhaczanych w ciągu
 * dnia. Niezrobione zostają na jutro; zrobione z wczoraj znikają z widoku (raport dnia ma je jako „Zrobione”,
 * ale raport jeszcze nie czyta tej listy). Dane: rodzaj `todo` w `siteItems` (klucz mapy na pozycję).
 */

export const PLAN_MAX = 5;
export const PLAN_TEXT_MAX = 80;

export interface PlanItem {
  id: string;
  text: string;
  /** Moment dodania (ms) — kolejność na liście. */
  at: number;
  /** Moment odhaczenia (ms); brak = jeszcze niezrobione. */
  doneAt?: number;
}

/** Pozycje z zewnątrz (kopia, peer) przechodzą przez czyszczenie: tekst przycięty, dziwne wpisy odrzucone. */
export function cleanPlanItems(raw: unknown): PlanItem[] {
  if (!Array.isArray(raw)) return [];
  const out: PlanItem[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const p = r as Partial<PlanItem> | null;
    if (!p || typeof p !== "object") continue;
    if (typeof p.id !== "string" || !p.id || p.id.length > 64 || seen.has(p.id)) continue;
    const text = typeof p.text === "string" ? p.text.trim().replace(/\s+/g, " ").slice(0, PLAN_TEXT_MAX) : "";
    if (!text) continue;
    if (typeof p.at !== "number" || !Number.isFinite(p.at)) continue;
    const doneAt = typeof p.doneAt === "number" && Number.isFinite(p.doneAt) ? p.doneAt : undefined;
    seen.add(p.id);
    out.push({ id: p.id, text, at: p.at, ...(doneAt !== undefined ? { doneAt } : {}) });
    if (out.length >= PLAN_MAX) break;
  }
  return out.sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}

/** Widok planu na dziś: niezrobione i zrobione dziś; zrobione przed północą nie są już na liście. */
export function activePlanItems(items: readonly PlanItem[], now: number = Date.now()): PlanItem[] {
  const dayStart = startOfDayOf(now);
  return items.filter((i) => i.doneAt === undefined || i.doneAt >= dayStart);
}

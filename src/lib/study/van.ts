import { fittingKey } from "./fittings";
import { safeLine } from "@/lib/safeText";

/**
 * Materiał w aucie (H1.3, plan 2026-10-29). Stan nie jest wpisywany ręcznie, tylko liczony z historii:
 * ostatnia inwentaryzacja + przyjęcia − zużycie z wpisów dziennika „z auta” po dacie inwentaryzacji.
 * Każde zdarzenie (inwentaryzacja, przyjęcie) ma własny klucz w mapie Yjs `studyVan` (`yVan.ts`), więc
 * dwa telefony nie nadpisują sobie stanu. Wpis bez pola `supply` liczy się jako „z auta” (decyzja H-1).
 */

export type VanUnit = "szt." | "m";
export const VAN_UNITS: readonly VanUnit[] = ["szt.", "m"];
export const VAN_NAME_MAX = 60;
export const VAN_ITEMS_MAX = 120;
export const VAN_QTY_MAX = 100_000;

export interface VanItem {
  id: string;
  name: string;
  unit: VanUnit;
  /** Poniżej tego „Do dokupienia”; brak = bez minimum. */
  min?: number;
  /** Założenie pozycji (ms) — stan liczy się od zera od tej chwili, dopóki nie ma inwentaryzacji. */
  at: number;
  order: number;
}

export interface VanEvent {
  id: string;
  item: string;
  /** `count` — inwentaryzacja (stan w tej chwili), `in` — przyjęcie (dokupione). */
  kind: "count" | "in";
  qty: number;
  at: number;
}

const time = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined);
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64;

/** Ilość: nieujemna (inwentaryzacja może dać 0), do dwóch miejsc po przecinku. */
export function cleanVanQty(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= VAN_QTY_MAX ? Math.round(v * 100) / 100 : undefined;
}

export function cleanVanItem(raw: unknown, id: string): VanItem | null {
  const r = raw as Partial<VanItem> | null;
  if (!r || typeof r !== "object" || !isId(id)) return null;
  const name = typeof r.name === "string" ? safeLine(r.name).slice(0, VAN_NAME_MAX) : "";
  const at = time(r.at);
  if (!name || at === undefined) return null;
  const min = cleanVanQty(r.min);
  return { id, name, unit: r.unit === "m" ? "m" : "szt.", ...(min ? { min } : {}), at, order: typeof r.order === "number" && Number.isFinite(r.order) ? r.order : 0 };
}

export function cleanVanEvent(raw: unknown, item: string, id: string): VanEvent | null {
  const r = raw as Partial<VanEvent> | null;
  if (!r || typeof r !== "object" || !isId(item) || !isId(id)) return null;
  const qty = cleanVanQty(r.qty);
  const at = time(r.at);
  if ((r.kind !== "count" && r.kind !== "in") || qty === undefined || at === undefined) return null;
  if (r.kind === "in" && qty === 0) return null;
  return { id, item, kind: r.kind, qty, at };
}

/** Zużycie z jednego wpisu dziennika (kształtki w sztukach, rury w cm). */
export interface UsageEntry {
  at: number;
  /** „site” = dostawa na budowę, nie z auta; brak = z auta (H-1). */
  supply?: "site";
  fittings?: readonly { name: string; qty: number }[];
  pipes?: readonly { name: string; cm: number }[];
}

/** Ile zużyto pozycji z auta po chwili `since` (bez niej). Rury w metrach, kształtki w sztukach. */
export function usedSince(item: Pick<VanItem, "name" | "unit">, journal: readonly UsageEntry[], since: number): number {
  const key = fittingKey(item.name);
  let sum = 0;
  for (const e of journal) {
    if (e.at <= since || e.supply === "site") continue;
    if (item.unit === "m") for (const p of e.pipes ?? []) { if (fittingKey(p.name) === key) sum += p.cm / 100; }
    else for (const f of e.fittings ?? []) { if (fittingKey(f.name) === key) sum += f.qty; }
  }
  return Math.round(sum * 100) / 100;
}

export interface VanStock {
  item: VanItem;
  /** Stan teraz (może wyjść ujemny, gdy zużycie przekroczyło zapisany stan — wtedy pora na inwentaryzację). */
  qty: number;
  /** Ostatnia inwentaryzacja (ms); brak = od założenia pozycji. */
  countedAt?: number;
  /** Do dokupienia do minimum (0 = nie trzeba). */
  toBuy: number;
}

/** Stan pozycji: ostatnia inwentaryzacja (albo zero od założenia) + przyjęcia − zużycie z auta po niej. */
export function vanStock(item: VanItem, events: readonly VanEvent[], journal: readonly UsageEntry[]): VanStock {
  const mine = events.filter((e) => e.item === item.id);
  const last = mine.filter((e) => e.kind === "count").reduce<VanEvent | null>((m, e) => (!m || e.at > m.at || (e.at === m.at && e.id > m.id) ? e : m), null);
  const since = last?.at ?? item.at;
  const received = mine.filter((e) => e.kind === "in" && e.at > since).reduce((s, e) => s + e.qty, 0);
  const qty = Math.round(((last?.qty ?? 0) + received - usedSince(item, journal, since)) * 100) / 100;
  const toBuy = item.min !== undefined && qty < item.min ? Math.ceil((item.min - qty) * 100) / 100 : 0;
  return { item, qty, ...(last ? { countedAt: last.at } : {}), toBuy };
}

/** „12 szt.” / „24,5 m”. */
export const vanQtyLabel = (qty: number, unit: VanUnit) => `${qty.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} ${unit}`;

/** Ilość z pola: „2,5” → 2.5; zły tekst → `undefined`. */
export function parseVanQty(raw: string): number | undefined {
  const t = raw.replace(/\s/g, "").replace(",", ".");
  return /^\d+(\.\d{0,2})?$/.test(t) ? cleanVanQty(Number(t)) : undefined;
}

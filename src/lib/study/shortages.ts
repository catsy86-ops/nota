import { cleanFittings, fittingsLine, type Fitting } from "./fittings";

/**
 * Braki materiału na budowie (nie tylko kształtki): „Rura PEX 16 — 50 m”, „Klej do PCV”. Każda
 * pozycja ma status brakuje → zamówione → dostarczone; raport dla szefa pokazuje to, co jeszcze
 * nie dojechało. Do tego historia zamówień kształtek (`OrderLogEntry`) z „Oznacz jako zamówione”.
 * Oba w karcie budowy (`SiteCard.shortages`, `SiteCard.orders`). Czysta logika — zapis w `store.ts`.
 */

export type ShortageStatus = "missing" | "ordered" | "delivered";

export interface Shortage {
  id: string;
  /** Co: „Rura PEX 16”. */
  text: string;
  /** Ile, dowolnym tekstem: „50 m”, „2 opakowania”; pusty = bez ilości. */
  qty: string;
  status: ShortageStatus;
  /** Dopisanie pozycji (ms). */
  at: number;
  /** Ostatnia zmiana statusu (ms); brak = od dopisania bez zmian. */
  changed?: number;
}

export interface OrderLogEntry {
  /** Moment „Oznacz jako zamówione” (ms). */
  at: number;
  items: Fitting[];
}

export const SHORTAGE_TEXT_MAX = 80;
export const SHORTAGE_QTY_MAX = 20;
export const SHORTAGES_MAX = 40;
export const ORDER_LOG_MAX = 20;

export const STATUS_LABEL: Record<ShortageStatus, string> = { missing: "Brakuje", ordered: "Zamówione", delivered: "Dostarczone" };
const STATUSES: ShortageStatus[] = ["missing", "ordered", "delivered"];

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

/** Dowolne wejście z dokumentu → lista braków; `undefined` = karta bez listy. */
export function cleanShortages(raw: unknown): Shortage[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Shortage[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const s = v as Partial<Shortage>;
    const text = clip(s.text, SHORTAGE_TEXT_MAX);
    if (typeof s.id !== "string" || !s.id || s.id.length > 40 || seen.has(s.id) || !text) continue;
    seen.add(s.id);
    out.push({
      id: s.id,
      text,
      qty: clip(s.qty, SHORTAGE_QTY_MAX),
      status: STATUSES.includes(s.status as ShortageStatus) ? (s.status as ShortageStatus) : "missing",
      at: typeof s.at === "number" && Number.isFinite(s.at) ? s.at : 0,
      ...(typeof s.changed === "number" && Number.isFinite(s.changed) ? { changed: s.changed } : {}),
    });
    if (out.length >= SHORTAGES_MAX) break;
  }
  return out;
}

/** Historia zamówień kształtek: od najstarszego, ostatnie `ORDER_LOG_MAX`; `undefined` = brak historii. */
export function cleanOrderLog(raw: unknown): OrderLogEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .filter((v): v is { at: number; items: unknown } => !!v && typeof v === "object" && typeof (v as { at?: unknown }).at === "number" && Number.isFinite((v as { at: number }).at))
    .map((v) => ({ at: v.at, items: cleanFittings(v.items) }))
    .filter((v) => v.items.length > 0)
    .sort((a, b) => a.at - b.at);
  return out.slice(-ORDER_LOG_MAX);
}

/** Dopisuje zamówienie do historii (do limitu, najstarsze wypadają). */
export function logOrder(log: readonly OrderLogEntry[] | undefined, items: readonly Fitting[], at: number): OrderLogEntry[] {
  const next = [...(log ?? []).map((o) => ({ at: o.at, items: o.items.map((f) => ({ ...f })) }))];
  if (items.length > 0) next.push({ at, items: items.map((f) => ({ ...f })) });
  return next.slice(-ORDER_LOG_MAX);
}

const newId = () => `b-${Math.random().toString(36).slice(2, 10)}`;
const key = (s: string) => s.toLocaleLowerCase("pl").replace(/\s+/g, " ").trim();

/**
 * Dopisuje brak. Pusta nazwa albo limit → bez zmian. Ta sama nazwa wciąż niedostarczona → bez
 * duplikatu (najwyżej podmienia ilość, jeśli nowa podana).
 */
export function addShortage(list: readonly Shortage[], text: string, qty: string, now: number, makeId: () => string = newId): Shortage[] {
  const t = clip(text, SHORTAGE_TEXT_MAX);
  const q = clip(qty, SHORTAGE_QTY_MAX);
  const out = list.map((s) => ({ ...s }));
  if (!t) return out;
  const same = out.find((s) => s.status !== "delivered" && key(s.text) === key(t));
  if (same) { if (q) same.qty = q; return out; }
  if (out.length >= SHORTAGES_MAX) return out;
  let id = makeId();
  while (out.some((s) => s.id === id)) id = makeId();
  return [...out, { id, text: t, qty: q, status: "missing", at: now }];
}

/** Następny status po stuknięciu: brakuje → zamówione → dostarczone → brakuje. */
export const nextStatus = (s: ShortageStatus): ShortageStatus => STATUSES[(STATUSES.indexOf(s) + 1) % STATUSES.length];

export function setShortageStatus(list: readonly Shortage[], id: string, status: ShortageStatus, now: number): Shortage[] {
  return list.map((s) => (s.id === id ? { ...s, status, changed: now } : { ...s }));
}

export const removeShortage = (list: readonly Shortage[], id: string): Shortage[] => list.filter((s) => s.id !== id).map((s) => ({ ...s }));
export const clearDelivered = (list: readonly Shortage[]): Shortage[] => list.filter((s) => s.status !== "delivered").map((s) => ({ ...s }));
/** To, co jeszcze nie dojechało: brakuje i zamówione — kolejność: brakuje najpierw, potem wg dopisania. */
export const openShortages = (list: readonly Shortage[]): Shortage[] =>
  list.filter((s) => s.status !== "delivered").sort((a, b) => (a.status === b.status ? a.at - b.at : a.status === "missing" ? -1 : 1));

const shortDate = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });

/** Jedna linia braku: „Rura PEX 16: 50 m — brakuje” albo „Klej do PCV — zamówione 14.10”. */
export function shortageLine(s: Shortage): string {
  const status = s.status === "missing" ? "brakuje" : s.status === "ordered" ? `zamówione${s.changed ? ` ${shortDate(s.changed)}` : ""}` : "dostarczone";
  return `${s.text}${s.qty ? `: ${s.qty}` : ""} — ${status}`;
}

/** Tekst listy braków do wysłania (dostawca, szef, grupa). */
export function shortagesText(siteName: string, list: readonly Shortage[]): string {
  const open = openShortages(list);
  if (open.length === 0) return `Braki materiału — ${siteName}\nNiczego nie brakuje.`;
  return [`Braki materiału — ${siteName}`, ...open.map((s) => `- ${shortageLine(s)}`)].join("\n");
}

/** „14.10 — Kolano 16 × 5, Trójnik 16 × 1” — do historii zamówień. */
export const orderLogLine = (o: OrderLogEntry) => `${shortDate(o.at)} — ${fittingsLine(o.items)}`;

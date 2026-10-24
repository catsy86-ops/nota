import { cleanFittings, fittingsLine, type Fitting } from "./fittings";
import { endOfDayOffset } from "../dueTerms";
import { dayInputValue } from "../reminderTime";

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
  /** Data dostawy (ms, północ lokalna dnia); tylko przy „zamówione”. Brak = termin liczy się od zmiany statusu. */
  due?: number;
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
/** Zamówienie bez daty dostawy jest zaległe po tylu dniach od zmiany statusu. */
export const ORDER_LATE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export const STATUS_LABEL: Record<ShortageStatus, string> = { missing: "Brakuje", ordered: "Zamówione", delivered: "Dostarczone" };
const STATUSES: ShortageStatus[] = ["missing", "ordered", "delivered"];

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");

/**
 * Dowolne wejście z dokumentu → lista braków (najwyżej `SHORTAGES_MAX`, w kolejności wejścia) i liczba
 * poprawnych pozycji, których nie weszło przez limit. `list` = `undefined` dla karty bez listy.
 * Ponad limitem zostaje 40 najnowszych: najpierw odpadają dostarczone (od najdawniej zmienionych), potem
 * najstarsze (`at`) — decyzja 24.10, 1.12 planu Praca. Przycinanie jest tylko w odczycie: zapis listy
 * zapisuje różnicę względem widocznej listy (`writeListItems`), więc ukryte pozycje zostają w dokumencie.
 * Starsza wersja aplikacji przycina odwrotnie (pierwsze 40 w kolejności wejścia) — też tylko w odczycie.
 */
export function cleanShortagesCounted(raw: unknown): { list: Shortage[] | undefined; dropped: number } {
  if (!Array.isArray(raw)) return { list: undefined, dropped: 0 };
  const out: Shortage[] = [];
  const seen = new Set<string>();
  let dropped = 0;
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
      ...(typeof s.due === "number" && Number.isFinite(s.due) ? { due: s.due } : {}),
    });
  }
  if (out.length > SHORTAGES_MAX) {
    dropped = out.length - SHORTAGES_MAX;
    const order = (x: Shortage) => [x.status === "delivered" ? 0 : 1, x.status === "delivered" ? x.changed ?? x.at : x.at] as const;
    const gone = new Set(
      [...out]
        .sort((a, b) => { const [ga, ta] = order(a); const [gb, tb] = order(b); return ga - gb || ta - tb || (a.id < b.id ? -1 : 1); })
        .slice(0, dropped)
        .map((x) => x.id),
    );
    return { list: out.filter((x) => !gone.has(x.id)), dropped };
  }
  return { list: out, dropped };
}

/** Lista braków bez liczby odrzuconych (ścieżki, które jej nie pokazują). */
export function cleanShortages(raw: unknown): Shortage[] | undefined {
  return cleanShortagesCounted(raw).list;
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

/** Ustawia albo czyści (`undefined`) datę dostawy. Dotyczy tylko pozycji zamówionych — inne zwraca bez zmian. */
export function setShortageDue(list: readonly Shortage[], id: string, due: number | undefined): Shortage[] {
  return list.map((s) => {
    if (s.id !== id || s.status !== "ordered") return { ...s };
    const next: Shortage = { ...s };
    if (due === undefined) delete next.due;
    else next.due = due;
    return next;
  });
}

/**
 * Moment, po którym zamówienie jest zaległe (przypomnienie i push). Z datą dostawy: koniec tego
 * dnia. Bez niej: ponad `ORDER_LATE_DAYS` od zmiany statusu. `null` dla pozycji, które nie są zamówione.
 */
export function orderLateFrom(s: Shortage): number | null {
  if (s.status !== "ordered") return null;
  return s.due !== undefined ? endOfDayOffset(s.due) : (s.changed ?? s.at) + ORDER_LATE_DAYS * DAY_MS;
}

/** Data dostawy jako wartość pola `type="date"` (lokalna, `YYYY-MM-DD`); pusta = brak. */
export function dueDayValue(due: number | undefined): string {
  return due === undefined ? "" : dayInputValue(due);
}

/** Odwrotność `dueDayValue`: pusta albo źle sformatowana wartość → `undefined` (bez daty). */
export function dueFromDayValue(v: string): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return undefined;
  const t = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  return Number.isFinite(t) ? t : undefined;
}

export const removeShortage = (list: readonly Shortage[], id: string): Shortage[] => list.filter((s) => s.id !== id).map((s) => ({ ...s }));
export const clearDelivered = (list: readonly Shortage[]): Shortage[] => list.filter((s) => s.status !== "delivered").map((s) => ({ ...s }));
/** To, co jeszcze nie dojechało: brakuje i zamówione — kolejność: brakuje najpierw, potem wg dopisania. */
export const openShortages = (list: readonly Shortage[]): Shortage[] =>
  list.filter((s) => s.status !== "delivered").sort((a, b) => (a.status === b.status ? a.at - b.at : a.status === "missing" ? -1 : 1));

const shortDate = (at: number) => new Date(at).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });

/** Jedna linia braku: „Rura PEX 16: 50 m — brakuje” albo „Klej do PCV — zamówione 14.10”. */
export function shortageLine(s: Shortage): string {
  const status = s.status === "missing"
    ? "brakuje"
    : s.status === "ordered"
      ? `zamówione${s.changed ? ` ${shortDate(s.changed)}` : ""}${s.due !== undefined ? `, dostawa ${shortDate(s.due)}` : ""}`
      : "dostarczone";
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

/** Wynik dyktowania → tekst braku: pojedyncze spacje, pierwsza litera wielka; pusty wynik = `""`. */
export function spokenShortageLabel(spoken: string): string {
  const phrase = spoken.trim().replace(/\s+/g, " ");
  return phrase ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : "";
}

/**
 * Dopisuje braki z wypowiedzi do listy budowy. Zwraca nową listę i liczbę pozycji, których nie weszło
 * przez limit `SHORTAGES_MAX` (duplikaty łączą się z istniejącą pozycją i nie liczą się jako odrzucone).
 */
export function addShortagesFromDictation(
  base: readonly Shortage[],
  items: readonly { text: string; qty: string }[],
  now: number,
  makeId: () => string = newId,
): { list: Shortage[]; rejected: number } {
  let rejected = 0;
  const list = items.reduce((cur, x) => {
    const next = addShortage(cur, x.text, x.qty, now, makeId);
    if (next.length === cur.length && cur.length >= SHORTAGES_MAX && !cur.some((s) => s.status !== "delivered" && key(s.text) === key(x.text))) rejected++;
    return next;
  }, [...base]);
  return { list, rejected };
}

/** „Oznacz jako zamówione” w karcie: braki „Brakuje” przechodzą na „Zamówione” z datą zmiany (1.7 planu Praca 2026-10-24). */
export function markMissingOrdered(list: readonly Shortage[], now: number): Shortage[] {
  return list.map((s) => (s.status === "missing" ? { ...s, status: "ordered" as const, changed: now } : { ...s }));
}

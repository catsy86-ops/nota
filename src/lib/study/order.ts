import type { JournalEntry } from "./yStudy";
import { entrySiteId } from "./sites";
import { sumFittings, type Fitting } from "./fittings";

/**
 * Zamówienie kształtek dla budowy (punkt „Do zamówienia” w karcie budowy). Liczy kształtki
 * zużyte od ostatniego zamówienia (`orderedAt` karty), a nie od początku budowy — inaczej lista
 * rosłaby bez końca i nie mówiłaby, czego jeszcze brakuje. Czysta funkcja, bez Yjs i bez UI.
 */

export interface SiteOrder {
  /** Suma sztuk per nazwa, od największej liczby. Pusta = nic do zamówienia. */
  items: Fitting[];
  /** Wpisy z kształtkami, z których powstała suma. */
  entries: number;
  /** Od kiedy liczymy (ostatnie zamówienie); `null` = od początku budowy. */
  since: number | null;
}

export function siteOrder(journal: readonly JournalEntry[], siteId: string, orderedAt?: number): SiteOrder {
  const after = orderedAt ?? -Infinity;
  const picked = journal.filter((e) => entrySiteId(e) === siteId && e.at > after && (e.fittings?.length ?? 0) > 0);
  return {
    items: sumFittings(picked.map((e) => e.fittings)),
    entries: picked.length,
    since: orderedAt ?? null,
  };
}

/**
 * Tekst zamówienia do wysłania (SMS, WhatsApp, mail): nazwa budowy, pozycje i od kiedy liczymy.
 * Bez znaczników formatowania — działa w każdym komunikatorze.
 */
export function orderText(siteName: string, order: SiteOrder): string {
  const head = `Zamówienie kształtek — ${siteName}`;
  if (order.items.length === 0) return `${head}\nNic do zamówienia od ostatniego zamówienia.`;
  const lines = order.items.map((f) => `- ${f.name}: ${f.qty} szt.`);
  const since = order.since === null
    ? "Liczone od początku budowy."
    : `Liczone od ${new Date(order.since).toLocaleDateString("pl-PL")} (${order.entries} ${order.entries === 1 ? "wpis" : "wpisów"}).`;
  return [head, ...lines, since].join("\n");
}

/**
 * Link „wyślij przez WhatsApp” z tekstem zamówienia. Bez numeru: WhatsApp pyta, do kogo wysłać,
 * więc numer hurtowni nigdzie nie trafia (ani do synchronizacji, ani do kopii).
 */
export const whatsappOrderUrl = (text: string): string => `https://wa.me/?text=${encodeURIComponent(text)}`;

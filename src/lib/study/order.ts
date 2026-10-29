import type { JournalEntry } from "./yStudy";
import { entrySiteId } from "./sites";
import { sumFittings, type Fitting } from "./fittings";
import { metersLabel, sumPipes, type Pipe } from "./pipes";
import { normalizePhone } from "./boss";
import type { Shortage } from "./shortages";

/**
 * Zamówienie kształtek dla budowy (punkt „Do zamówienia” w karcie budowy). Liczy kształtki
 * zużyte od ostatniego zamówienia (`orderedAt` karty), a nie od początku budowy — inaczej lista
 * rosłaby bez końca i nie mówiłaby, czego jeszcze brakuje. Czysta funkcja, bez Yjs i bez UI.
 */

export interface SiteOrder {
  /** Suma sztuk per nazwa, od największej liczby. Pusta = nic do zamówienia. */
  items: Fitting[];
  /** Rury (cm) od ostatniego zamówienia, od najdłuższej (H1.1). Historia zamówień ich nie zapisuje. */
  pipes: Pipe[];
  /** Wpisy z kształtkami albo rurami, z których powstała suma. */
  entries: number;
  /** Od kiedy liczymy (ostatnie zamówienie); `null` = od początku budowy. */
  since: number | null;
}

export function siteOrder(journal: readonly JournalEntry[], siteId: string, orderedAt?: number): SiteOrder {
  const after = orderedAt ?? -Infinity;
  const picked = journal.filter((e) => entrySiteId(e) === siteId && e.at > after && ((e.fittings?.length ?? 0) > 0 || (e.pipes?.length ?? 0) > 0));
  return {
    items: sumFittings(picked.map((e) => e.fittings)),
    pipes: sumPipes(picked.map((e) => e.pipes)),
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
  if (order.items.length === 0 && order.pipes.length === 0) return `${head}\nNic do zamówienia od ostatniego zamówienia.`;
  const lines = [...order.items.map((f) => `- ${f.name}: ${f.qty} szt.`), ...pipeLines(order)];
  const since = order.since === null
    ? "Liczone od początku budowy."
    : `Liczone od ${new Date(order.since).toLocaleDateString("pl-PL")} (${order.entries} ${order.entries === 1 ? "wpis" : "wpisów"}).`;
  return [head, ...lines, since].join("\n");
}

/** „- Rura PEX 16×2: 24,5 m” — rury w wiadomości do hurtowni. */
const pipeLines = (order: SiteOrder) => order.pipes.map((p) => `- ${p.name}: ${metersLabel(p.cm)}`);

/**
 * Link „wyślij przez WhatsApp” z tekstem zamówienia. Z numerem hurtowni z karty (U7, 2026-10-20)
 * otwiera rozmowę z nią; bez numeru WhatsApp pyta, do kogo wysłać. Numer jest zapisany w karcie budowy
 * (trafia do synchronizacji i kopii — decyzja właściciela).
 */
export const whatsappOrderUrl = (text: string, phone?: string): string => {
  const digits = phone ? normalizePhone(phone) : null;
  return `https://wa.me/${digits ?? ""}?text=${encodeURIComponent(text)}`;
};

/**
 * Jedna wiadomość do hurtowni (1.7 planu Praca 2026-10-24): braki „Brakuje” i kształtki od ostatniego
 * zamówienia. Bez braków — ten sam tekst co `orderText`. Braki „Zamówione” i dostarczone się nie powtarzają.
 */
export function supplierOrderText(siteName: string, order: SiteOrder, shortages: readonly Shortage[]): string {
  const missing = shortages.filter((s) => s.status === "missing");
  if (missing.length === 0) return orderText(siteName, order);
  const lines = [`Zamówienie — ${siteName}`, "Braki:", ...missing.map((s) => `- ${s.text}${s.qty ? `: ${s.qty}` : ""}`)];
  if (order.pipes.length > 0) lines.push("Rury:", ...pipeLines(order));
  if (order.items.length > 0) {
    lines.push("Kształtki:", ...order.items.map((f) => `- ${f.name}: ${f.qty} szt.`));
    lines.push(order.since === null
      ? "Kształtki liczone od początku budowy."
      : `Kształtki liczone od ${new Date(order.since).toLocaleDateString("pl-PL")}.`);
  }
  return lines.join("\n");
}

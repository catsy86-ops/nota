import { fittingKey } from "./fittings";
import { cleanQty, QUOTE_NAME_MAX, type QuoteItem } from "./jobs";
import { priceOf, type MaterialUsage, type PriceList } from "./materialUsage";
import { pointType, type WaterPoint } from "./points";
import { pointRateFor, type SiteBilling } from "./billing";

/**
 * Pozycje wyceny z tego, co o budowie już wiadomo (plan wycen i klientów, 4.4): punkty wodne × stawka za punkt z rozliczenia
 * budowy (robocizna) i zużyty materiał × cena z cennika kształtek (materiał). Zamiast „wyniku kalkulatora” z planu: kalkulatory
 * Pracy liczą spadki, ciśnienie próby i objętość rur — nie dają ilości, które da się wycenić; ilości dają punkty i wpisy
 * z kształtkami i rurami. Czyste funkcje: zwracają propozycję, a dopisanie robi formularz (z „Cofnij”).
 */

export type ProposedItem = Pick<QuoteItem, "kind" | "name" | "qty" | "unit" | "price">;

export interface QuoteProposal {
  items: ProposedItem[];
  /** Nazwy pozycji bez stawki albo ceny — nie zostały dodane. */
  noPrice: string[];
  /** Nazwy, które już są w wycenie — nie zostały dodane drugi raz. */
  existing: string[];
}

const trim = (name: string) => name.slice(0, QUOTE_NAME_MAX);

function finish(candidates: { item: ProposedItem | null; name: string }[], existing: readonly Pick<QuoteItem, "name">[]): QuoteProposal {
  const have = new Set(existing.map((i) => fittingKey(i.name)));
  const out: QuoteProposal = { items: [], noPrice: [], existing: [] };
  for (const { item, name } of candidates) {
    if (!item) { out.noPrice.push(name); continue; }
    if (have.has(fittingKey(item.name))) { out.existing.push(item.name); continue; }
    out.items.push(item);
  }
  return out;
}

/** Robocizna z punktów: jedna pozycja na typ punktu — liczba punktów × stawka typu (albo stawka domyślna). Typ bez stawki trafia do `noPrice`. */
export function itemsFromPoints(points: readonly Pick<WaterPoint, "type">[], billing: Pick<SiteBilling, "pointRate" | "typeRates">, existing: readonly Pick<QuoteItem, "name">[]): QuoteProposal {
  const counts = new Map<string, number>();
  for (const p of points) { const id = pointType(p.type).id; counts.set(id, (counts.get(id) ?? 0) + 1); }
  const candidates = [...counts].map(([id, n]) => {
    const t = pointType(id);
    const rate = pointRateFor(billing, id);
    const qty = cleanQty(n);
    const name = trim(`${t.label} — punkt`);
    return { name: t.label, item: rate === undefined || qty === undefined ? null : { kind: "labor" as const, name, qty, unit: "pkt", price: rate } };
  });
  return finish(candidates, existing);
}

/**
 * Materiał ze zużycia: kształtki w sztukach i rury w metrach, z ceną z cennika kształtek (cena rury to zł za metr).
 * Pozycje bez ceny w cenniku trafiają do `noPrice` — cenę wpisze się w „Zużycie materiału” na karcie budowy.
 */
export function itemsFromUsage(usage: Pick<MaterialUsage, "total" | "totalPipes">, prices: PriceList, existing: readonly Pick<QuoteItem, "name">[]): QuoteProposal {
  // Kształtki w sztukach, rury w metrach (długość w cm); reszta jest ta sama: cena z cennika, ilość w limicie, nazwa w limicie.
  const used = [
    ...usage.total.map((f) => ({ name: f.name, qty: f.qty, unit: "szt." })),
    ...usage.totalPipes.map((p) => ({ name: p.name, qty: p.cm / 100, unit: "m" })),
  ];
  const candidates = used.map(({ name, qty, unit }) => {
    const price = priceOf(prices, name);
    const clean = cleanQty(qty);
    return { name, item: price === undefined || clean === undefined ? null : { kind: "material" as const, name: trim(name), qty: clean, unit, price } };
  });
  return finish(candidates, existing);
}

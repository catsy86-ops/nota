import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { cell } from "@/lib/shifts/timesheet";
import { fittingKey, sumFittings, type Fitting } from "./fittings";
import { metersLabel, sumPipes, type Pipe } from "./pipes";
import { entrySiteId } from "./siteKey";
import type { Shortage } from "./shortages";
import type { JournalEntry } from "./yStudy";

/**
 * P2.6 Zużycie materiału na budowie (decyzja P-9: opcjonalna cena jednostkowa, bez faktur).
 * Kształtki z wpisów sumowane per miesiąc; dostarczone braki jako lista (ilość to dowolny tekst,
 * więc się jej nie sumuje). Cena za sztukę po nazwie kształtki, wartość tylko z wycenionych pozycji.
 * Rury (H1.1) w metrach, z ceną za metr w tej samej liście cen (klucz nazwy).
 */

/** Cena za sztukę kształtki albo za metr rury (zł) po kluczu nazwy (`fittingKey`). */
export type PriceList = Readonly<Record<string, number>>;

export interface DeliveredItem {
  text: string;
  qty: string;
}

export interface MaterialMonth {
  /** `YYYY-MM`. */
  month: string;
  label: string;
  fittings: Fitting[];
  /** Rury w tym miesiącu (cm), od najdłuższej. */
  pipes: Pipe[];
  delivered: DeliveredItem[];
  /** Wartość wycenionych kształtek i rur (zł); `null`, gdy żadna pozycja nie ma ceny. */
  cost: number | null;
  /** Ile pozycji kształtek i rur bez ceny. */
  unpriced: number;
}

export interface MaterialUsage {
  /** Od najnowszego miesiąca. */
  months: MaterialMonth[];
  total: Fitting[];
  /** Rury z całej budowy (cm). */
  totalPipes: Pipe[];
  cost: number | null;
  unpriced: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const monthOf = (at: number) => { const d = new Date(at); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const monthLabel = (m: string) => { const [y, mo] = m.split("-").map(Number); return format(new Date(y, mo - 1, 1), "LLLL yyyy", { locale: pl }); };

export const priceOf = (prices: PriceList, name: string): number | undefined => {
  const p = prices[fittingKey(name)];
  return typeof p === "number" && Number.isFinite(p) && p >= 0 ? p : undefined;
};

/** Wartość kształtek (zł/szt.) i rur (zł/m) oraz liczba pozycji bez ceny. */
export function costOf(list: readonly Fitting[], prices: PriceList, pipes: readonly Pipe[] = []): { cost: number | null; unpriced: number } {
  let cost = 0, priced = 0, unpriced = 0;
  for (const [name, amount] of [...list.map((f) => [f.name, f.qty] as const), ...pipes.map((p) => [p.name, p.cm / 100] as const)]) {
    const p = priceOf(prices, name);
    if (p === undefined) unpriced += 1;
    else { cost += amount * p; priced += 1; }
  }
  return { cost: priced > 0 ? Math.round(cost * 100) / 100 : null, unpriced };
}

export function materialUsage(journal: readonly JournalEntry[], siteId: string, shortages: readonly Shortage[] | undefined, prices: PriceList): MaterialUsage {
  const fittingsBy = new Map<string, (readonly Fitting[])[]>();
  const pipesBy = new Map<string, (readonly Pipe[])[]>();
  for (const e of journal) {
    if (entrySiteId(e) !== siteId) continue;
    const m = monthOf(e.at);
    if (e.fittings?.length) fittingsBy.set(m, [...(fittingsBy.get(m) ?? []), e.fittings]);
    if (e.pipes?.length) pipesBy.set(m, [...(pipesBy.get(m) ?? []), e.pipes]);
  }
  const deliveredBy = new Map<string, DeliveredItem[]>();
  for (const s of shortages ?? []) {
    if (s.status !== "delivered") continue;
    const m = monthOf(s.changed ?? s.at);
    deliveredBy.set(m, [...(deliveredBy.get(m) ?? []), { text: s.text, qty: s.qty }]);
  }
  const keys = [...new Set([...fittingsBy.keys(), ...pipesBy.keys(), ...deliveredBy.keys()])].sort().reverse();
  const months = keys.map((month): MaterialMonth => {
    const fittings = sumFittings(fittingsBy.get(month) ?? []);
    const pipes = sumPipes(pipesBy.get(month) ?? []);
    return { month, label: monthLabel(month), fittings, pipes, delivered: deliveredBy.get(month) ?? [], ...costOf(fittings, prices, pipes) };
  });
  const total = sumFittings([...fittingsBy.values()].flat());
  const totalPipes = sumPipes([...pipesBy.values()].flat());
  return { months, total, totalPipes, ...costOf(total, prices, totalPipes) };
}

const zl = (n: number) => `${n.toFixed(2).replace(".", ",")} zł`;

/** Tekst do „Kopiuj” (szef, dostawca). */
export function materialText(u: MaterialUsage, site: string, prices: PriceList): string {
  const lines = [`Zużycie materiału — ${site}`];
  for (const m of u.months) {
    lines.push("", `## ${m.label}`);
    for (const f of m.fittings) {
      const p = priceOf(prices, f.name);
      lines.push(`- ${f.name}: ${f.qty} szt.${p !== undefined ? ` × ${zl(p)} = ${zl(f.qty * p)}` : ""}`);
    }
    for (const r of m.pipes) {
      const p = priceOf(prices, r.name);
      lines.push(`- ${r.name}: ${metersLabel(r.cm)}${p !== undefined ? ` × ${zl(p)}/m = ${zl((r.cm / 100) * p)}` : ""}`);
    }
    for (const d of m.delivered) lines.push(`- Dostarczone: ${d.text}${d.qty ? ` — ${d.qty}` : ""}`);
    if (m.cost !== null) lines.push(`Wartość: ${zl(m.cost)}${m.unpriced ? ` (${m.unpriced} poz. bez ceny)` : ""}`);
  }
  if (u.cost !== null) lines.push("", `Razem: ${zl(u.cost)}${u.unpriced ? ` (${u.unpriced} poz. bez ceny)` : ""}`);
  return lines.join("\n");
}

/** CSV (separator `;`, BOM — polski Excel). Kształtki i rury (metry) z ceną i wartością, dostawy jako osobne wiersze. */
export function materialCsv(u: MaterialUsage, prices: PriceList): string {
  const num = (n: number) => n.toFixed(2).replace(".", ",");
  const rows: (string | number)[][] = [["Miesiąc", "Rodzaj", "Pozycja", "Ilość", "Cena jedn. (zł)", "Wartość (zł)"]];
  for (const m of [...u.months].reverse()) {
    for (const f of m.fittings) {
      const p = priceOf(prices, f.name);
      rows.push([m.month, "kształtka", f.name, f.qty, p !== undefined ? num(p) : "", p !== undefined ? num(f.qty * p) : ""]);
    }
    for (const r of m.pipes) {
      const p = priceOf(prices, r.name);
      rows.push([m.month, "rura (m)", r.name, num(r.cm / 100), p !== undefined ? num(p) : "", p !== undefined ? num((r.cm / 100) * p) : ""]);
    }
    for (const d of m.delivered) rows.push([m.month, "dostawa", d.text, d.qty, "", ""]);
  }
  return "\uFEFF" + rows.map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

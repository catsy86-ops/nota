import type { SiteCard } from "./sites";
import type { SiteStage } from "./stages";
import type { OrderLogEntry, Shortage } from "./shortages";
import { cleanOrderLog, cleanShortages } from "./shortages";
import type { SiteHours } from "./siteHours";
import { cleanSiteHours } from "./siteHours";
import type { SiteDoc } from "./siteDocs";
import { cleanSiteDocs } from "./siteDocs";
import type { ServiceCall } from "./service";
import { cleanServiceCalls } from "./service";

/**
 * Listy karty budowy (etapy, braki, historia zamówień) w dokumencie: każda pozycja to osobny klucz
 * mapy `studySiteItems` (`budowa␁rodzaj␁id`), a nie jedno pole karty. Dwa telefony zmieniające
 * różne pozycje tej samej budowy scalają się bez strat — przy jednym polu wygrywał ostatni zapis
 * całej listy. Znacznik `budowa␁meta␁rodzaj` mówi, że lista jest już w mapie (także pusta).
 * Czysta logika bez `yjs` — zapis w `yStudy.ts`.
 */

export type SiteListKind = "stage" | "short" | "order" | "hours" | "docs" | "service";
export const SITE_LIST_KINDS: SiteListKind[] = ["stage", "short", "order", "hours", "docs", "service"];
export const LIST_FIELD = { stage: "stages", short: "shortages", order: "orders", hours: "hours", docs: "docs", service: "service" } as const satisfies Record<SiteListKind, keyof SiteCard>;

const SEP = "\u0001";
export const itemKey = (siteId: string, kind: SiteListKind, id: string) => [siteId, kind, id].join(SEP);
export const metaKey = (siteId: string, kind: SiteListKind) => [siteId, "meta", kind].join(SEP);

/** Wartość etapu w mapie: kolejność zapisana raz, przy dodaniu — usunięcie innego etapu jej nie zmienia. */
export interface StageItem { name: string; order: number; done?: number }

/** Id pozycji listy w kluczu mapy. */
export function listItemId(kind: SiteListKind, item: unknown): string {
  if (kind === "order") return String((item as OrderLogEntry).at);
  return (item as SiteStage | Shortage | SiteHours | SiteDoc | ServiceCall).id;
}

/** Wartość pozycji w mapie (bez kolejności etapu — tę ustala zapis). */
export function listItemValue(kind: SiteListKind, item: unknown): unknown {
  if (kind === "stage") {
    const s = item as SiteStage;
    return { name: s.name, ...(s.done !== undefined ? { done: s.done } : {}) };
  }
  if (kind === "order") {
    const o = item as OrderLogEntry;
    return { at: o.at, items: o.items.map((f) => ({ ...f })) };
  }
  if (kind === "hours") return { minutes: (item as SiteHours).minutes };
  if (kind === "docs") { const { id: _id, ...rest } = item as SiteDoc; return rest; }
  if (kind === "service") return { ...(item as ServiceCall) };
  return { ...(item as Shortage) };
}

/** Czy pozycja się zmieniła (etap: nazwa i odhaczenie, bez kolejności). */
export function sameItem(kind: SiteListKind, a: unknown, b: unknown): boolean {
  if (kind === "stage") {
    const x = a as Partial<StageItem> | undefined;
    const y = b as Partial<StageItem> | undefined;
    return !!x && !!y && x.name === y.name && x.done === y.done;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

export type SiteLists = Partial<Pick<SiteCard, "stages" | "shortages" | "orders" | "hours" | "docs" | "service">>;

/**
 * Wpisy mapy (wszystkie budowy) → listy per budowa. Lista jest, gdy ma znacznik albo choć jedną
 * pozycję. Etapy po zapisanej kolejności, braki po dopisaniu, zamówienia po czasie; remisy po id.
 * Wartości nie są tu czyszczone — robi to `cleanSite` przy odczycie stanu.
 */
export function composeSiteLists(entries: Iterable<[string, unknown]>): Map<string, SiteLists> {
  const stages = new Map<string, (SiteStage & { order: number })[]>();
  const shortages = new Map<string, Shortage[]>();
  const orders = new Map<string, OrderLogEntry[]>();
  const hours = new Map<string, SiteHours[]>();
  const docs = new Map<string, SiteDoc[]>();
  const service = new Map<string, ServiceCall[]>();
  const seen = new Map<string, Set<SiteListKind>>();
  const mark = (siteId: string, kind: SiteListKind) => {
    const s = seen.get(siteId) ?? new Set<SiteListKind>();
    s.add(kind);
    seen.set(siteId, s);
  };
  for (const [key, value] of entries) {
    const [siteId, kind, id] = key.split(SEP);
    if (!siteId || !id) continue;
    if (kind === "meta") {
      if ((SITE_LIST_KINDS as string[]).includes(id)) mark(siteId, id as SiteListKind);
      continue;
    }
    if (!value || typeof value !== "object") continue;
    if (kind === "stage") {
      const v = value as Partial<StageItem>;
      const list = stages.get(siteId) ?? [];
      list.push({ id, name: typeof v.name === "string" ? v.name : "", order: typeof v.order === "number" ? v.order : 0, ...(typeof v.done === "number" ? { done: v.done } : {}) });
      stages.set(siteId, list);
      mark(siteId, "stage");
    } else if (kind === "short") {
      // Dane z zewnątrz (kopia, peer) przechodzą przez czyszczenie, nie przez rzutowanie.
      const ok = cleanShortages([value]) ?? [];
      if (ok.length) shortages.set(siteId, [...(shortages.get(siteId) ?? []), ...ok]);
      mark(siteId, "short");
    } else if (kind === "order") {
      const ok = cleanOrderLog([value]) ?? [];
      if (ok.length) orders.set(siteId, [...(orders.get(siteId) ?? []), ...ok]);
      mark(siteId, "order");
    } else if (kind === "hours") {
      const ok = cleanSiteHours([{ id, minutes: (value as { minutes?: unknown }).minutes }]) ?? [];
      if (ok.length) hours.set(siteId, [...(hours.get(siteId) ?? []), ...ok]);
      mark(siteId, "hours");
    } else if (kind === "docs") {
      const ok = cleanSiteDocs([{ ...value, id }]) ?? [];
      if (ok.length) docs.set(siteId, [...(docs.get(siteId) ?? []), ...ok]);
      mark(siteId, "docs");
    } else if (kind === "service") {
      const ok = cleanServiceCalls([value]) ?? [];
      if (ok.length) service.set(siteId, [...(service.get(siteId) ?? []), ...ok]);
      mark(siteId, "service");
    }
  }
  const out = new Map<string, SiteLists>();
  for (const [siteId, kinds] of seen) {
    const lists: SiteLists = {};
    if (kinds.has("stage")) {
      lists.stages = (stages.get(siteId) ?? [])
        .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1))
        .map(({ order: _o, ...s }) => s);
    }
    if (kinds.has("short")) {
      lists.shortages = (shortages.get(siteId) ?? []).sort((a, b) => (a.at ?? 0) - (b.at ?? 0) || (a.id < b.id ? -1 : 1));
    }
    if (kinds.has("order")) lists.orders = (orders.get(siteId) ?? []).sort((a, b) => a.at - b.at);
    if (kinds.has("hours")) lists.hours = (hours.get(siteId) ?? []).sort((a, b) => (a.id < b.id ? -1 : 1));
    if (kinds.has("service")) lists.service = (service.get(siteId) ?? []).sort((a, b) => (a.at ?? 0) - (b.at ?? 0) || (a.id < b.id ? -1 : 1));
    if (kinds.has("docs")) lists.docs = (docs.get(siteId) ?? []).sort((a, b) => (a.at ?? 0) - (b.at ?? 0) || (a.id < b.id ? -1 : 1));
    out.set(siteId, lists);
  }
  return out;
}

/** Karta bez list — te żyją w osobnej mapie. */
export function stripLists<C extends SiteCard>(card: C): Omit<C, "stages" | "shortages" | "orders" | "hours" | "docs" | "service"> {
  const { stages: _s, shortages: _h, orders: _o, hours: _g, docs: _d, service: _v, ...plain } = card;
  return plain;
}

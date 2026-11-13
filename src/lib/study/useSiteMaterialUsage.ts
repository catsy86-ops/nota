import { materialUsage, type MaterialUsage, type PriceList } from "./materialUsage";
import { usePrices } from "./pricingStore";
import type { JournalEntry } from "./journalEntry";
import type { SiteInfo } from "./sites";
import { useStudy } from "./store";

/**
 * Zużycie materiału budowy dla paneli wyceny („Z zużytego materiału”, „Wycena a wykonanie”). Oba montują się razem w panelu
 * zlecenia z tymi samymi danymi, więc ostatni wynik jest pamiętany po tożsamości wejścia (dziennik, budowa, braki, ceny):
 * drugi panel w tym samym renderze dostaje gotowy wynik zamiast drugiego przebiegu po całym dzienniku.
 */
let last: { journal: readonly JournalEntry[]; siteId: string; shortages: SiteInfo["shortages"]; prices: PriceList; value: MaterialUsage } | null = null;

export function siteMaterialUsage(journal: readonly JournalEntry[], site: Pick<SiteInfo, "id" | "shortages">, prices: PriceList): MaterialUsage {
  if (last && last.journal === journal && last.siteId === site.id && last.shortages === site.shortages && last.prices === prices) return last.value;
  const value = materialUsage(journal, site.id, site.shortages, prices);
  last = { journal, siteId: site.id, shortages: site.shortages, prices, value };
  return value;
}

export function useSiteMaterialUsage(site: Pick<SiteInfo, "id" | "shortages">): MaterialUsage {
  return siteMaterialUsage(useStudy().journal, site, usePrices());
}

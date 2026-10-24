import type { JournalEntry } from "./yStudy";
import type { SiteInfo } from "./sites";
import { siteStages, stageProgress } from "./stages";
import { siteOrder } from "./order";

/** Liczniki na górze karty budowy: etapy, braki i kształtki do zamówienia (1.3 planu Praca 2026-10-24). */
export interface SiteTally {
  stages: { done: number; total: number };
  /** Braki ze statusem „Brakuje” — jeszcze do zamówienia. */
  missing: number;
  /** Braki „Zamówione” — w drodze. */
  ordered: number;
  /** Pozycje kształtek zużytych od ostatniego zamówienia. */
  order: number;
}

export function siteTally(site: Pick<SiteInfo, "id" | "stages" | "shortages" | "orderedAt">, journal: readonly JournalEntry[]): SiteTally {
  const { done, total } = stageProgress(siteStages(site));
  const list = site.shortages ?? [];
  return {
    stages: { done, total },
    missing: list.filter((s) => s.status === "missing").length,
    ordered: list.filter((s) => s.status === "ordered").length,
    order: siteOrder(journal, site.id, site.orderedAt).items.length,
  };
}

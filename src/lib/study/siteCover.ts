import { entrySiteId } from "./siteKey";
import { isImageDoc, type SiteDoc } from "./siteDocs";
import type { JournalEntry } from "./yStudy";

/**
 * P5.1: okładka karty budowy — pierwszy plan (zdjęcie wśród dokumentów), a bez niego najnowsze
 * zdjęcie z wpisów tej budowy. `null` = brak zdjęcia; wtedy karta zostaje bez okładki.
 */
export function siteCoverRef(journal: readonly JournalEntry[], site: { id: string; docs?: readonly SiteDoc[] }): string | null {
  const plan = (site.docs ?? []).find(isImageDoc);
  if (plan) return plan.id;
  let best: { at: number; ref: string } | null = null;
  for (const e of journal) {
    if (entrySiteId(e) !== site.id || e.images.length === 0) continue;
    if (!best || e.at > best.at) best = { at: e.at, ref: e.images[0] };
  }
  return best?.ref ?? null;
}

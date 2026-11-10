import { entrySiteId } from "@/lib/study/siteKey";
import type { JournalEntry } from "@/lib/study/journalEntry";

/** Id etapu „Zakrycie instalacji” (`stages.ts`). */
export const COVER_STAGE_ID = "zakrycie";

/** Podpis zdjęć robionych przed zakryciem (wypalany przy eksporcie jak każdy podpis). */
export const COVER_CAPTION = "Przed zakryciem";

/**
 * Zdjęcia przypięte do etapu zakrycia we wpisach tej budowy (P2.2). Licznik w karcie i w przypomnieniu
 * przed zakryciem, zanim etap zostanie odhaczony.
 */
export function coverPhotoCount(journal: readonly JournalEntry[], siteId: string): number {
  return journal
    .filter((e) => e.stage === COVER_STAGE_ID && entrySiteId(e) === siteId)
    .reduce((n, e) => n + e.images.length, 0);
}

import { imageStore } from "@/lib/imageStore";
import { entrySiteId } from "./siteKey";
import type { SiteDoc } from "./siteDocs";
import type { JournalEntry } from "./yStudy";

/**
 * P3.1 Miejsce zajmowane przez budowę: zdjęcia wpisów (także „po naprawie”), nagrania i dokumenty.
 * Nagrania i dokumenty mają rozmiar w metadanych; zdjęcia trzeba odczytać — robi to `measure`, leniwie.
 */

/** Referencje budowy → znany rozmiar (bajty) albo `undefined`, gdy trzeba go odczytać. Bez duplikatów. */
export function siteStorageRefs(journal: readonly JournalEntry[], site: { id: string; docs?: readonly SiteDoc[] }): Map<string, number | undefined> {
  const out = new Map<string, number | undefined>();
  const add = (ref: string, size?: number) => { if (!out.has(ref) || (out.get(ref) === undefined && size !== undefined)) out.set(ref, size); };
  for (const e of journal) {
    if (entrySiteId(e) !== site.id) continue;
    for (const r of e.images) add(r);
    for (const r of e.after ?? []) add(r);
    for (const a of e.recordings ?? []) add(a.hash, a.size);
  }
  for (const d of site.docs ?? []) add(d.id, d.size);
  return out;
}

/** Rozmiar zdjęcia z magazynu (bajty); brak na urządzeniu = `undefined`. */
export const imageSize = async (ref: string) => (await imageStore.get(ref))?.bytes.byteLength;

/** Suma bajtów; brakujące rozmiary odczytuje `sizeOf` (np. z `imageStore`), nieobecne na urządzeniu = 0. */
export async function measure(refs: Map<string, number | undefined>, sizeOf: (ref: string) => Promise<number | undefined>): Promise<number> {
  let total = 0;
  for (const [ref, size] of refs) total += size ?? (await sizeOf(ref)) ?? 0;
  return total;
}

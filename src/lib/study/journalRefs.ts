import { isImageRef } from "@/lib/imageStore";

/**
 * Klucze zdjęć z dziennika budowy w dokumencie — dla sprzątania magazynu zdjęć i kopii
 * (`yjsStore.ts`). Osobny, mały moduł: rdzeń synchronizacji nie ciągnie za sobą całego
 * `yStudy.ts` do paczki startowej. Typ dokumentu strukturalny, bez importu `yjs`.
 */
export function journalRefsIn(doc: { getMap(name: string): { forEach(cb: (value: unknown) => void): void } }): Set<string> {
  const refs = new Set<string>();
  doc.getMap("studyJournal").forEach((e) => {
    const images = (e as { images?: unknown } | null)?.images;
    if (Array.isArray(images)) for (const r of images) if (typeof r === "string" && isImageRef(r)) refs.add(r);
  });
  return refs;
}

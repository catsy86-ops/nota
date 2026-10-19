import { isImageRef } from "@/lib/imageStore";

type MapLike = { forEach(cb: (value: unknown, key: string) => void): void };

/** Plik budowy większy niż to (i nie obraz) zostaje na urządzeniu — jak załącznik notatki (`ATTACHMENT_SYNC_MAX_BYTES`). */
const DOC_SYNC_MAX_BYTES = 2 * 1024 * 1024;
/** Rodzaj listy dokumentów w kluczu `studySiteItems` (`budowa␁docs␁id`, `siteItems.ts`). */
const DOCS_KEY = "\u0001docs\u0001";

/**
 * Pliki budów (plany, PDF, dokumenty z kart budów) — osobno od zdjęć dziennika, żeby raport kopii
 * nie nazywał planu zdjęciem. Tylko klucze dokumentów z `studySiteItems`.
 */
export function siteDocRefsIn(doc: { getMap(name: string): MapLike }): Set<string> {
  const refs = new Set<string>();
  doc.getMap("studySiteItems").forEach((_v, key) => {
    const i = key.indexOf(DOCS_KEY);
    if (i < 0) return;
    const id = key.slice(i + DOCS_KEY.length);
    if (isImageRef(id)) refs.add(id);
  });
  return refs;
}

/**
 * Klucze bajtów działu Praca w dokumencie — dla sprzątania magazynu, kopii i synchronizacji
 * (`yjsStore.ts`): zdjęcia wpisów dziennika i plany/dokumenty z kart budów (`siteDocs.ts`).
 * `syncable` pomija dokumenty (nie obrazy) większe niż 2 MB — nie jadą do innego urządzenia.
 * Osobny, mały moduł: rdzeń synchronizacji nie ciągnie za sobą całego `yStudy.ts` do paczki
 * startowej. Typ dokumentu strukturalny, bez importu `yjs`.
 */
export function journalRefsIn(doc: { getMap(name: string): MapLike }, syncable = false): Set<string> {
  const refs = new Set<string>();
  doc.getMap("studyJournal").forEach((e) => {
    const entry = e as { images?: unknown; recordings?: unknown } | null;
    const images = entry?.images;
    if (Array.isArray(images)) for (const r of images) if (typeof r === "string" && isImageRef(r)) refs.add(r);
    // Nagrania (U8): ten sam magazyn; do innego urządzenia jadą jak załączniki do 2 MB.
    if (Array.isArray(entry?.recordings)) {
      for (const r of entry.recordings) {
        const a = r as { hash?: unknown; size?: unknown } | null;
        if (typeof a?.hash !== "string" || !isImageRef(a.hash)) continue;
        if (syncable && !(typeof a.size === "number" && a.size <= DOC_SYNC_MAX_BYTES)) continue;
        refs.add(a.hash);
      }
    }
  });
  doc.getMap("studySiteItems").forEach((v, key) => {
    const i = key.indexOf(DOCS_KEY);
    if (i < 0) return;
    const id = key.slice(i + DOCS_KEY.length);
    if (!isImageRef(id)) return;
    const d = v as { size?: unknown; type?: unknown } | null;
    const image = typeof d?.type === "string" && d.type.startsWith("image/");
    if (syncable && !image && !(typeof d?.size === "number" && d.size <= DOC_SYNC_MAX_BYTES)) return;
    refs.add(id);
  });
  return refs;
}

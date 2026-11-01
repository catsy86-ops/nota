import { isImageRef } from "@/lib/imageStore";

type MapLike = { forEach(cb: (value: unknown, key: string) => void): void };

/** Mapa analiz planów w dokumencie Yjs notatek (`yPlans.ts`). */
export const PLANS_MAP = "plans";
/** Prefiks klucza projektu (`p␁<id>`). */
export const PROJECT_PREFIX = "p\u0001";
/** Obraz do 2 MB jedzie do innego urządzenia (jak zdjęcia); większy oryginał zostaje lokalnie (D3). */
export const PLAN_SYNC_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Klucze obrazów planów (oryginał i kopia robocza) — dla sprzątania magazynu, kopii i synchronizacji
 * (`yjsStore.ts`). `syncable` pomija oryginały ponad 2 MB: na inne urządzenie jedzie kopia robocza.
 * Osobny, mały moduł bez `yjs` (typ strukturalny), żeby rdzeń synchronizacji nie ciągnął analizatora.
 */
export function planRefsIn(doc: { getMap(name: string): MapLike }, syncable = false): Set<string> {
  const refs = new Set<string>();
  doc.getMap(PLANS_MAP).forEach((v, key) => {
    if (!key.startsWith(PROJECT_PREFIX)) return;
    const p = v as { image?: { ref?: unknown; size?: unknown }; work?: { ref?: unknown } } | null;
    const work = p?.work?.ref;
    if (typeof work === "string" && isImageRef(work)) refs.add(work);
    const image = p?.image?.ref;
    if (typeof image !== "string" || !isImageRef(image)) return;
    const size = p?.image?.size;
    if (syncable && !(typeof size === "number" && size <= PLAN_SYNC_MAX_BYTES)) return;
    refs.add(image);
  });
  return refs;
}

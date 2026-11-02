import { isImageRef, MAX_PEER_BLOB_BYTES } from "@/lib/imageStore";
import { signatureRefsIn } from "@/lib/study/journalRefs";

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

/**
 * Klucze, które wychodzą z urządzenia tylko do 2 MB prawdziwego rozmiaru (`mayLeaveDevice`): obrazy planów
 * i podpisy klientów z kart budów (P2.4). Podpis nie ma rozmiaru w danych, więc obca karta mogłaby wskazać
 * hash dowolnego dużego pliku z magazynu i wymusić jego wysłanie — limit to zamyka.
 */
export function sizeCappedRefsIn(doc: { getMap(name: string): MapLike }): Set<string> {
  const refs = planRefsIn(doc);
  for (const r of signatureRefsIn(doc)) refs.add(r);
  return refs;
}

/**
 * Czy bajty spod klucza mogą wyjść z urządzenia (P2P, przekaźnik, plik synchronizacji). Rozmiar w danych
 * planu deklaruje zapis — także obcy — więc decyduje PRAWDZIWY rozmiar bajtów: ponad limit peera nic,
 * a plik ponad 2 MB spod klucza z `sizeCappedRefsIn` (plan, podpis) zostaje lokalnie (D3; przegląd
 * bezpieczeństwa W1 — obcy projekt ani karta nie wymuszą wysłania dużego pliku przez wskazanie jego hasha).
 */
export function mayLeaveDevice(ref: string, size: number, cappedRefs: ReadonlySet<string>): boolean {
  return size <= MAX_PEER_BLOB_BYTES && !(size > PLAN_SYNC_MAX_BYTES && cappedRefs.has(ref));
}

import { imageStore, isDataUrl } from "@/lib/imageStore";
import { makeThumbnail } from "@/lib/study/photoShrink";

/** Dłuższy bok miniatury na protokole (P6.4): komórka siatki 3 × ~60 mm, więc 360 px wystarcza także na wydruku. */
export const HANDOVER_THUMB_MAX_SIDE = 360;

/**
 * Miniatura zdjęcia do protokołu. `null` = nie ma czego zmniejszać (adres danych, zdjęcie już małe,
 * brak zdjęcia na tym urządzeniu albo przeglądarka nie umie) — wtedy protokół pokazuje oryginał.
 */
export async function handoverThumbBlob(imageRef: string): Promise<Blob | null> {
  if (isDataUrl(imageRef)) return null;
  const rec = await imageStore.get(imageRef).catch(() => undefined);
  if (!rec) return null;
  const blob = new Blob([rec.bytes], { type: rec.type });
  return makeThumbnail(blob, HANDOVER_THUMB_MAX_SIDE).catch(() => null);
}

import { prepareImage } from "@/lib/imagePrepare";
import { imageStore } from "@/lib/imageStore";
import { addJournalEntry, setSite } from "@/lib/study/store";
import { measureSpan } from "./perf";

export type PhotoEntryResult = "ok" | "too-big" | "failed";

/**
 * Zdjęcie z aparatu jako osobny, nowy wpis budowy (P2.1). Jedno zdjęcie = jeden wpis, więc nie dotyka
 * limitu zdjęć we wpisie. Domyślnie bez etapu; `stage` i `caption` ustawia np. zdjęcie przed zakryciem (P2.2).
 * Błędy zapisu rzuca wyjątkiem; wynik `too-big` / `failed` to odmowa, którą wywołujący pokazuje w komunikacie.
 */
export async function addPhotoEntry(
  file: File,
  siteName: string,
  extra: { stage?: string; caption?: string } = {},
): Promise<PhotoEntryResult> {
  // R4.2: czas od wybrania zdjęcia do zapisu bajtów (zmniejszanie + IndexedDB) — do raportu diagnostyki z telefonu.
  const done = measureSpan("zdjecie-zapis");
  const prepared = await prepareImage(file);
  if (!prepared) return "too-big";
  const ref = await imageStore.putBlob(prepared);
  done();
  setSite(siteName);
  const entry = addJournalEntry({
    kind: "ok",
    topic: null,
    text: "",
    images: [ref],
    stage: extra.stage ?? null,
    captions: extra.caption ? { [ref]: extra.caption } : undefined,
  });
  return entry ? "ok" : "failed";
}

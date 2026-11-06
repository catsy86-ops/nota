import { prepareImage } from "@/lib/imagePrepare";
import { imageStore } from "@/lib/imageStore";
import { addJournalEntry, setSite } from "@/lib/study/store";

export type PhotoEntryResult = "ok" | "too-big" | "failed";

/**
 * Zdjęcie z aparatu jako osobny, nowy wpis budowy (P2.1). Jedno zdjęcie = jeden wpis, więc nie dotyka
 * limitu zdjęć we wpisie. Etapu nie ustawia (zostaje `null`, jak dotąd na karcie). Błędy zapisu rzuca
 * wyjątkiem; wynik `too-big` / `failed` to odmowa, którą wywołujący pokazuje w komunikacie.
 */
export async function addPhotoEntry(file: File, siteName: string): Promise<PhotoEntryResult> {
  const prepared = await prepareImage(file);
  if (!prepared) return "too-big";
  const ref = await imageStore.putBlob(prepared);
  setSite(siteName);
  return addJournalEntry({ kind: "ok", topic: null, text: "", images: [ref] }) ? "ok" : "failed";
}

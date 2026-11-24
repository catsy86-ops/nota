import { useState } from "react";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { imageStore } from "@/lib/imageStore";
import { prepareImage } from "@/lib/imagePrepare";
import { pluralPl } from "@/lib/plural";
import { requestPersistentStorage } from "@/lib/storagePersistence";
import { measureSpan } from "@/lib/study/perf";
import { JOURNAL_MAX_IMAGES } from "@/lib/study/store";
import { photoSaveFailed } from "../useJournalPhotoEdits";
import type { EntryForm } from "./entryForm";

// Prośba o trwały zapis przy pierwszym zdjęciu: zdjęcia z budowy to najcięższe i najcenniejsze
// dane w przeglądarce, a Chrome chętniej przyznaje trwałość przy wyraźnym zaangażowaniu.
let persistAsked = false;

/** Dodawanie zdjęć do wpisu: zmniejszenie do 2 MB, magazyn, limit wpisu i licznik `processing` (blokuje „Zapisz”). */
export function useEntryPhotos({ getForm, patch }: Pick<EntryForm, "getForm" | "patch">) {
  const [processing, setProcessing] = useState(0);

  /** Zwraca, ile zdjęć faktycznie trafiło do wpisu (licznik zdjęć z aparatu liczy tylko te). */
  async function addPhotos(files: File[]): Promise<number> {
    let skipped = 0;
    let added = 0;
    // Miejsca liczone z góry: dwa szybkie wybory zdjęć nie przekroczą limitu wpisu.
    const room = JOURNAL_MAX_IMAGES - getForm().images.length - processing;
    if (files.length > room) toast(`Wpis mieści maksymalnie ${JOURNAL_MAX_IMAGES} ${pluralPl(JOURNAL_MAX_IMAGES, ["zdjęcie", "zdjęcia", "zdjęć"])}`);
    const batch = files.slice(0, Math.max(0, room));
    if (batch.length === 0) return 0;
    if (!persistAsked) { persistAsked = true; void requestPersistentStorage(); }
    setProcessing((n) => n + batch.length);
    // Ile zdjęć z paczki jeszcze nie oddało swojej części licznika: wyjątek przerywa pętlę, a przycisk „Zapisz wpis”
    // czeka na `processing === 0` — bez tego zostawał zablokowany na stałe.
    let unreleased = batch.length;
    try {
      for (const file of batch) {
        try {
          const done = measureSpan("zdjecie-zapis");
          const prepared = await prepareImage(file);
          if (!prepared) { skipped += 1; continue; }
          const ref = await imageStore.putBlob(prepared);
          done();
          // Szkic czytany na świeżo: w trakcie obróbki mogło zniknąć inne zdjęcie albo zmienić się tekst.
          const now = getForm().images;
          if (now.length < JOURNAL_MAX_IMAGES && !now.includes(ref)) { patch({ images: [...now, ref] }); added += 1; haptic("tap"); }
        } finally {
          unreleased -= 1;
          setProcessing((n) => n - 1);
        }
      }
    } catch {
      photoSaveFailed();
    } finally {
      if (unreleased > 0) setProcessing((n) => n - unreleased);
    }
    if (skipped > 0) toast.error("Nie udało się zmniejszyć zdjęcia do 2 MB");
    return added;
  }

  return { processing, setProcessing, addPhotos };
}

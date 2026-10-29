import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { prepareImage } from "@/lib/imagePrepare";
import { imageStore } from "@/lib/imageStore";
import type { JournalDraft } from "@/lib/study/draft";

/** Błąd zapisu zdjęcia (brak miejsca w przeglądarce) — wspólny komunikat dla podpisu i rysunku. */
export function photoSaveFailed() {
  toast.error("Nie udało się zapisać zdjęcia", { description: "Brakuje miejsca w pamięci przeglądarki. Usuń stare zdjęcia albo zrób kopię zapasową i spróbuj ponownie." });
}

interface JournalPhotoEditsDeps {
  getForm: () => Pick<JournalDraft, "captions" | "images" | "drawnFrom">;
  patch: (p: Partial<Pick<JournalDraft, "captions" | "images" | "drawnFrom">>) => void;
  setProcessing: Dispatch<SetStateAction<number>>;
  setCaptioning: (ref: string | null) => void;
  setCaptionDraft: (text: string) => void;
}

/**
 * Zdjęcia we wpisie budowy (K-…, P6.1): podpis zapisywany w `captions`, rysunek podmienia zdjęcie
 * we wpisie, a oryginał zostaje w `drawnFrom` (H0.1) do „Cofnij rysunek”.
 */
export function useJournalPhotoEdits({ getForm, patch, setProcessing, setCaptioning, setCaptionDraft }: JournalPhotoEditsDeps) {
  /**
   * Podpis zdjęcia (P-1): zapisuje tekst w `captions` wpisu; zdjęcie zostaje bez zmian. Wypalenie w pliku
   * dopiero przy eksporcie (ZIP, raport). Pusty tekst = usunięcie podpisu.
   */
  function saveCaption(ref: string, text: string) {
    const clean = text.trim().replace(/\s+/g, " ").slice(0, 80);
    const next = { ...getForm().captions };
    if (clean) next[ref] = clean;
    else delete next[ref];
    patch({ captions: next });
    haptic("success");
    setCaptioning(null);
    setCaptionDraft("");
  }

  /** Zdjęcie otwarte do rysowania (strzałka, wymiar „przed zakryciem”); `null` = płótno zamknięte. */
  const [drawing, setDrawing] = useState<{ ref: string; url: string } | null>(null);
  useEffect(() => () => { if (drawing) URL.revokeObjectURL(drawing.url); }, [drawing]);

  async function openDrawing(ref: string) {
    const rec = await imageStore.get(ref);
    if (!rec) { toast.error("Tego zdjęcia nie ma na tym urządzeniu"); return; }
    setDrawing({ ref, url: URL.createObjectURL(new Blob([rec.bytes], { type: rec.type })) });
  }

  /**
   * Podmienia zdjęcie `from` na `to` we wpisie razem z podpisem. `original` to oryginał, który ma zostać
   * zapamiętany przy `to` (rysunek); `null` = `to` jest oryginałem (cofnięcie rysunku).
   */
  function swapPhoto(from: string, to: string, original: string | null) {
    const form = getForm();
    if (!form.images.includes(from)) return;
    const captions = { ...form.captions };
    if (captions[from] !== undefined) { captions[to] = captions[from]; delete captions[from]; }
    const drawnFrom = { ...form.drawnFrom };
    delete drawnFrom[from];
    if (original) drawnFrom[to] = original;
    patch({ images: form.images.map((r) => (r === from ? to : r)), captions, drawnFrom });
  }

  /** „Cofnij rysunek” (H0.1): wraca oryginał sprzed pierwszego rysowania. */
  function undoDrawing(ref: string) {
    const original = getForm().drawnFrom?.[ref];
    if (!original) return;
    swapPhoto(ref, original, null);
    haptic("success");
  }

  /** Rysunek na zdjęciu podmienia zdjęcie we wpisie; oryginał (sprzed pierwszego rysunku) zostaje w `drawnFrom`. */
  async function saveDrawing(dataUrl: string) {
    const ref = drawing?.ref;
    if (!ref) return;
    setProcessing((n) => n + 1);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const fitted = await prepareImage(new File([blob], "rysunek.jpg", { type: blob.type || "image/jpeg" }));
      if (!fitted) { toast.error("Nie udało się zapisać rysunku na zdjęciu"); return; }
      const next = await imageStore.putBlob(fitted);
      swapPhoto(ref, next, getForm().drawnFrom?.[ref] ?? ref);
      haptic("success");
    } catch {
      photoSaveFailed();
    } finally {
      setProcessing((n) => n - 1);
    }
  }

  return { saveCaption, drawing, setDrawing, openDrawing, saveDrawing, undoDrawing };
}

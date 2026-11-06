import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addPhotoEntry } from "@/lib/study/photoEntry";
import { COVER_CAPTION, COVER_STAGE_ID } from "@/lib/study/coverPhotos";
import { photoEntryToast, photoSaveFailed } from "./useJournalPhotoEdits";

/**
 * „Zrób zdjęcia” przed zakryciem (P2.2): aparat i nowy wpis budowy przypięty do etapu „Zakrycie”
 * z podpisem „Przed zakryciem”. Ten sam wpis trafi do protokołu pod etapem, z datą.
 */
export function CoverPhotoButton({ siteName }: { siteName: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const result = await addPhotoEntry(file, siteName, { stage: COVER_STAGE_ID, caption: COVER_CAPTION });
      photoEntryToast(result, `Zdjęcie przed zakryciem: ${siteName}`);
    } catch {
      photoSaveFailed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={input}
        data-testid="cover-photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        aria-label={busy ? "Zapisuję zdjęcie" : `Zrób zdjęcia przed zakryciem: ${siteName}`}
        onClick={() => input.current?.click()}
        className="shrink-0 coarse:min-h-11"
      >
        <Camera className="mr-1.5 h-4 w-4" aria-hidden />{busy ? "…" : "Zrób zdjęcia"}
      </Button>
    </>
  );
}

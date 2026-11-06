import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { haptic } from "@/lib/haptics";
import { addPhotoEntry } from "@/lib/study/photoEntry";
import { photoSaveFailed } from "./useJournalPhotoEdits";

/**
 * Pływający przycisk „Zdjęcie” na osi dziennika (P2.1): jedno stuknięcie otwiera aparat i zdjęcie
 * od razu staje się wpisem wybranej budowy. Bez budowy w filtrach otwiera zwykły arkusz wpisu,
 * bo nie wiadomo, do której budowy zdjęcie należy. Na komputerze schowany: jest „Wpis” w nagłówku.
 * Cichy, bez koloru akcentu: główny „+” w dolnej nawigacji zostaje jedynym jaskrawym przyciskiem.
 */
export function JournalPhotoButton({ siteName, onNoSite }: { siteName: string | null; onNoSite: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File, site: string) {
    setBusy(true);
    try {
      const result = await addPhotoEntry(file, site);
      if (result === "too-big") { toast.error("Nie udało się zmniejszyć zdjęcia do 2 MB"); return; }
      if (result === "failed") { toast.error("Nie zapisano zdjęcia"); return; }
      haptic("tap");
      toast.success(`Dodano zdjęcie do budowy „${site}”`);
    } catch {
      photoSaveFailed();
    } finally {
      setBusy(false);
    }
  }

  const label = busy ? "Zapisuję zdjęcie" : siteName ? `Zdjęcie do wpisu: ${siteName}` : "Zdjęcie do nowego wpisu";

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file && siteName) void onFile(file, siteName);
        }}
      />
      <button
        type="button"
        disabled={busy}
        aria-label={label}
        title={label}
        onClick={() => (siteName ? input.current?.click() : onNoSite())}
        className="pressable fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+96px)] z-raised flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-primary-ink shadow-elevation-2 disabled:opacity-60 coarse:h-14 coarse:w-14 md:hidden"
      >
        <Camera className="h-5 w-5" aria-hidden />
      </button>
    </>
  );
}

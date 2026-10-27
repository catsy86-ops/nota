import { toast } from "sonner";
import { SKIN_META } from "@/lib/skinGallery";
import { setSkin, skinStore, type Skin } from "@/lib/skins";

/**
 * „Przymierz” (plan motywów 3.1): wybór stylu działa od razu, a dymek „Cofnij” wraca do stylu
 * sprzed całej serii przymiarek — Neon, potem Zorza, potem Plan i „Cofnij” daje z powrotem Zeszyt.
 * Seria trwa, dopóki dymek jest widoczny (stałe `id` podmienia go zamiast piętrzyć).
 * Moduł leniwy: wołają go tylko galeria w Ustawieniach i paleta poleceń.
 */
const TOAST_ID = "skin-try";
let origin: Skin | null = null;

const endSeries = () => { origin = null; };

export function trySkin(next: Skin) {
  const current = skinStore.get();
  if (next === current) return;
  if (origin === null) origin = current;
  setSkin(next);
  if (next === origin) {
    // Powrót do stylu wyjściowego ręcznie — nie ma czego cofać.
    endSeries();
    toast.dismiss(TOAST_ID);
    return;
  }
  const back = origin;
  toast(`Styl: ${SKIN_META[next].label}`, {
    id: TOAST_ID,
    description: `Cofnij wraca do stylu ${SKIN_META[back].label}.`,
    action: { label: "Cofnij", onClick: () => { endSeries(); setSkin(back); } },
    onAutoClose: endSeries,
    onDismiss: endSeries,
  });
}

/** Tylko dla testów. */
export function __resetSkinTry() { origin = null; }

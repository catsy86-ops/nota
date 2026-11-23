import { yjsStore } from "@/lib/yjsStore";
import { GC_LOCK, withExclusiveLock } from "@/lib/tabLock";

/**
 * Z-6.6: ręczne sprzątanie plików bez odwołania (Ustawienia → Kopia i dane). Automatyczne odśmiecanie po starcie
 * (`useNotes`) ma bezpiecznik: gdy większość magazynu wygląda na nieużywaną, nie usuwa nic — śmieci zostawały wtedy
 * na stałe. Tu użytkownik widzi liczbę i rozmiar, potwierdza, a bezpiecznik jest pomijany. Karencja (7 dni) zostaje.
 * Lista używanych — ta sama co w odśmiecaniu: obrazy i załączniki notatek, zdjęcia dziennika, plany, dowody długów.
 */
async function usedRefs(): Promise<Set<string>> {
  const { journalImageRefs } = await import("@/lib/study/images");
  return new Set<string>([...yjsStore.referencedImages(), ...journalImageRefs()]);
}

export async function scanUnusedFiles(): Promise<{ count: number; bytes: number }> {
  await yjsStore.ready();
  return yjsStore.images.unusedFiles(await usedRefs());
}

/** Usuwa nieużywane pliki starsze niż karencja; zwraca liczbę usuniętych. Jedna karta naraz (`GC_LOCK`). */
export async function removeUnusedFiles(): Promise<number> {
  await yjsStore.ready();
  return withExclusiveLock(GC_LOCK, async () => yjsStore.images.collectGarbage(await usedRefs(), Date.now(), undefined, { force: true }));
}

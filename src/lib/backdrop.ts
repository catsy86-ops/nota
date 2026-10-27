import { createPersistedStore } from "@/lib/persistedStore";

/**
 * Natężenie tła stylu (plan motywów 1.3; Ustawienia → Wygląd → „Tło”). Niezależne od „Ruch i animacje”:
 * ktoś chce animacji przycisków, ale nie deszczu znaków za czytaną notatką.
 * - `full` — tło stylu jak zaprojektowane,
 * - `quiet` — ruch tła stoi, ozdoby przygaszone o połowę (sygnatury zapisu dalej grają),
 * - `plain` — sam kolor tła, bez kratki, płótna i bąbelków.
 * `auto` (domyślne) = `full`, a przy oszczędzaniu danych w systemie (`saveData`) `quiet`.
 * CSS: `html[data-backdrop]` w `src/styles/backdrop.css`; płótno i bąbelki: `PaperBackdrop.tsx`.
 */
export type BackdropPref = "auto" | "full" | "quiet" | "plain";
export type Backdrop = Exclude<BackdropPref, "auto">;

const isPref = (v: unknown): v is BackdropPref => v === "auto" || v === "full" || v === "quiet" || v === "plain";

const saveData = () =>
  typeof navigator !== "undefined" && (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

/** Czysta decyzja: jakie tło pokazać. */
export function resolveBackdrop(pref: BackdropPref, systemSaveData: boolean): Backdrop {
  if (pref !== "auto") return pref;
  return systemSaveData ? "quiet" : "full";
}

function applyToDom(pref: BackdropPref) {
  if (typeof document === "undefined") return;
  const b = resolveBackdrop(pref, saveData());
  if (b === "full") delete document.documentElement.dataset.backdrop;
  else document.documentElement.dataset.backdrop = b;
}

const store = createPersistedStore<BackdropPref>("kaczy.backdrop.v1", "auto", {
  merge: (defaults, stored) => (isPref(stored) ? stored : defaults),
  onChange: applyToDom,
});

applyToDom(store.get());

/** Tło w użyciu (po rozwiązaniu `auto`). */
export function useBackdrop(): Backdrop {
  return resolveBackdrop(store.use(), saveData());
}
export const setBackdrop = (b: Backdrop) => store.set(b);

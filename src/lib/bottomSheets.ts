import { useEffect, useSyncExternalStore } from "react";

/**
 * Ile arkuszy wysuwanych od dołu jest otwartych (nowy plan 4.5 / Etap 7). Na telefonie toasty stoją
 * nad dolnym paskiem, czyli na przyciskach otwartego arkusza („Zapisz”, „Gotowe”). Przy otwartym arkuszu
 * `<html data-bottom-sheet>` przesuwa je na górę ekranu regułą CSS w `index.css`. Zmiana `position`
 * samego `Toaster` przebudowywała go i przewijała listę pod arkuszem — stąd atrybut, nie właściwość.
 * Liczymy montowania `SheetContent side="bottom"` i `DialogContent sheet`.
 */
let open = 0;
const listeners = new Set<() => void>();
const emit = () => {
  if (typeof document !== "undefined") document.documentElement.toggleAttribute("data-bottom-sheet", open > 0);
  listeners.forEach((l) => l());
};

/** Rysowany wewnątrz `Content` okna — Radix montuje go tylko przy otwartym oknie, więc licznik jest dokładny. */
export function BottomSheetMarker(): null {
  useRegisterBottomSheet(true);
  return null;
}

export function useRegisterBottomSheet(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    open++;
    emit();
    return () => { open--; emit(); };
  }, [active]);
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const get = () => open > 0;

export function useBottomSheetOpen(): boolean {
  return useSyncExternalStore(subscribe, get, () => false);
}

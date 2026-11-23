import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { loadShiftsStore } from "./indexViews";

/** A2.2: stan `Index` wyniesiony z komponentu (mapa w `docs/index-mapa.md`). */
/** Pasek boczny: na komputerze otwarty, na telefonie zamknięty — od startu (bez wjazdu po montażu) i przy zmianie szerokości. */
export function useSidebarOpen(isMobile: boolean) {
  const [open, setOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  useEffect(() => { setOpen(!isMobile); }, [isMobile]);
  return [open, setOpen] as const;
}

/**
 * Ctrl+Z / Ctrl+Shift+Z w Grafiku. Magazyn ładuje się przy wejściu na widok (ShiftsView i tak go potrzebuje), a skrót
 * sprawdza go synchronicznie. `undo`/`redo` zwracają `false`, gdy to nie Grafik albo nie ma czego cofać — wtedy skrót
 * sięga po historię kosza i archiwum.
 */
export function useShiftsUndo(view: string) {
  const store = useRef<Awaited<ReturnType<typeof loadShiftsStore>> | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    if (view === "shifts" && !store.current) void loadShiftsStore().then((m) => { store.current = m; });
  }, [view]);
  return useMemo(() => ({
    undo(): boolean {
      const s = store.current;
      if (viewRef.current !== "shifts" || !s?.canUndoShifts()) return false;
      s.undoShifts();
      toast("Cofnięto zmianę w Grafiku", { icon: "↩️" });
      return true;
    },
    redo(): boolean {
      const s = store.current;
      if (viewRef.current !== "shifts" || !s?.canRedoShifts()) return false;
      s.redoShifts();
      toast("Ponowiono zmianę w Grafiku", { icon: "↪️" });
      return true;
    },
  }), []);
}

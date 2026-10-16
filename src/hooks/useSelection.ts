import { useCallback, useEffect, useRef, useState } from "react";
import type { View } from "@/hooks/useFilteredNotes";

/**
 * Zaznaczone notatki w widoku listy. Zaznaczenie znika przy zmianie widoku, etykiety
 * albo folderu. Wyciągnięte z `Index.tsx` bez zmiany zachowania: zaznaczanie pojedynczej
 * notatki i Shift-zakres (`toggleSelect`) zostają w `Index`, bo czytają widoczne notatki.
 * Testy: `e2e/notes.spec.ts` (zaznaczanie), `e2e/mobile.spec.ts` (przytrzymanie na dotyku).
 */
export function useSelection({
  view,
  activeLabel,
  activeFolder,
}: {
  view: View;
  activeLabel: string | null | undefined;
  activeFolder: string | null | undefined;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Ostatnio kliknięta notatka — punkt startowy dla zaznaczenia z Shift. */
  const lastSelectedRef = useRef<string | null>(null);
  const selectionMode = selectedIds.size > 0;

  // Reset selection whenever the view or active label/folder changes.
  useEffect(() => { setSelectedIds(new Set()); lastSelectedRef.current = null; }, [view, activeLabel, activeFolder]);

  const clearSelection = useCallback(() => { setSelectedIds(new Set()); lastSelectedRef.current = null; }, []);

  return { selectedIds, setSelectedIds, selectionMode, lastSelectedRef, clearSelection };
}

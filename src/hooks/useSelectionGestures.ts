import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { View } from "@/hooks/useFilteredNotes";

/**
 * Zaznaczanie notatek klikiem i Shift-zakresem oraz skrót Ctrl/Cmd+A. Wyciągnięte z `Index.tsx`
 * bez zmiany zachowania: zakres Shift i Ctrl+A idą po notatkach widocznych na ekranie (bez zwiniętych
 * sekcji), a Ctrl+A nic nie robi, gdy otwarte jest okno, czytnik albo prezentacja.
 * Testy: `e2e/notes.spec.ts`, `e2e/mobile.spec.ts` (przytrzymanie), `e2e/editor-keys.spec.ts`.
 */
export function useSelectionGestures({
  view,
  visibleNotesRef,
  previewId,
  presentingNoteId,
  setSelectedIds,
  lastSelectedRef,
}: {
  view: View;
  /** Notatki w kolejności widoku (`useLatestRef`): klik i zakres Shift czytają je w chwili kliknięcia. */
  visibleNotesRef: { readonly current: { id: string }[] };
  previewId: string | null | undefined;
  presentingNoteId: string | null;
  setSelectedIds: Dispatch<SetStateAction<Set<string>>>;
  lastSelectedRef: MutableRefObject<string | null>;
}) {
  const toggleSelect = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedRef.current && lastSelectedRef.current !== id) {
        const ids = visibleNotesRef.current.map((n) => n.id);
        const a = ids.indexOf(lastSelectedRef.current);
        const b = ids.indexOf(id);
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(ids[i]);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      lastSelectedRef.current = id;
      return next;
    });
  }, [visibleNotesRef, lastSelectedRef, setSelectedIds]);

  // Ctrl/Cmd+A poza polami tekstowymi: zaznacza wszystko, co widać (bez zwiniętych sekcji).
  useEffect(() => {
    if (view === "calendar" || view === "shifts" || view === "study") return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "a") return;
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)) return;
      if (document.querySelector('[role="dialog"][data-state="open"]') || previewId || presentingNoteId) return;
      const ids = visibleNotesRef.current.map((n) => n.id);
      if (ids.length === 0) return;
      e.preventDefault();
      setSelectedIds(new Set(ids));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, previewId, presentingNoteId, visibleNotesRef, setSelectedIds]);

  return { toggleSelect };
}

import { useCallback, useMemo } from "react";
import { useGridNavPreviewId, getGridNavFocusedId, setGridNavPreview } from "@/lib/gridKeyboardNav";
import { readerNeighbors } from "@/lib/readerStep";
import type { Note } from "@/hooks/useNotes";
import type { ReaderMode } from "@/components/NoteReader";

interface ReaderNavArgs {
  notes: Note[];
  archivedNotes: Note[];
  trashedNotes: Note[];
  /** Notatki w kolejności widoku (bez zwiniętych grup) — po nich idą kroki ←/→. */
  visibleNotes: Note[];
  /** Prezentacja (pełny ekran) — stan żyje w `Index`, bo ustawia go też klawiatura siatki. */
  presentingNoteId: string | null;
  setPresentingNoteId: (id: string | null) => void;
  paletteOpen: boolean;
  selectedIds: ReadonlySet<string>;
  openNote: (id: string, first: boolean, second: boolean) => void;
}

/**
 * Czytnik i prezentacja: która notatka jest otwarta, jej sąsiedzi w liście, kroki ←/→ i przejścia
 * między podglądem a prezentacją. Nie trzyma własnego stanu poza tym, co już jest w `gridKeyboardNav`
 * i w `Index` (prezentacja).
 */
export function useReaderNav({
  notes, archivedNotes, trashedNotes, visibleNotes, presentingNoteId, setPresentingNoteId, paletteOpen, selectedIds, openNote,
}: ReaderNavArgs) {
  const previewId = useGridNavPreviewId();
  const readerId = presentingNoteId ?? previewId;
  const readerNote = useMemo(
    // Czytnik, prezentacja i podgląd nie otwierają notatek prywatnych (nie ma jak ich bezpiecznie pokazać).
    () => (readerId ? [...notes, ...archivedNotes, ...trashedNotes].find((n) => n.id === readerId && !n.locked) ?? null : null),
    [readerId, notes, archivedNotes, trashedNotes],
  );
  // „Bieżąca” notatka dla palety poleceń: otwarta w czytniku, jedyna zaznaczona albo z fokusem.
  // Fokus siatki czytamy tylko po otwarciu palety — subskrypcja przerysowywałaby
  // całą stronę przy każdej strzałce (patrz selektory w `gridKeyboardNav`).
  // Sąsiedzi czytnika w liście, którą użytkownik widzi (bez notatek prywatnych).
  const readerSteps = useMemo(() => {
    const ids = visibleNotes.filter((n) => !n.locked).map((n) => n.id);
    return readerNeighbors(ids, readerId ?? null);
  }, [visibleNotes, readerId]);
  const copyTarget = useMemo(() => {
    if (!paletteOpen) return null;
    const id = readerId ?? (selectedIds.size === 1 ? [...selectedIds][0] : getGridNavFocusedId());
    return id ? [...notes, ...archivedNotes, ...trashedNotes].find((n) => n.id === id && !n.locked) ?? null : null;
  }, [paletteOpen, readerId, selectedIds, notes, archivedNotes, trashedNotes]);
  const closeReader = useCallback(() => { setPresentingNoteId(null); setGridNavPreview(null); }, [setPresentingNoteId]);
  const showInReader = useCallback((id: string, mode: ReaderMode) => {
    if (mode === "present") { setGridNavPreview(null); setPresentingNoteId(id); }
    else { setPresentingNoteId(null); setGridNavPreview(id); }
  }, [setPresentingNoteId]);
  const stepReader = useCallback((dir: -1 | 1) => {
    const target = dir < 0 ? readerSteps.prev : readerSteps.next;
    if (!target) return;
    showInReader(target, presentingNoteId ? "present" : "preview");
  }, [readerSteps, presentingNoteId, showInReader]);
  const editFromReader = useCallback((id: string) => {
    closeReader();
    // Kafel musi najpierw wrócić na wierzch po zamknięciu czytnika.
    setTimeout(() => openNote(id, false, true), 50);
  }, [closeReader, openNote]);

  return { previewId, readerId, readerNote, readerSteps, copyTarget, closeReader, showInReader, stepReader, editFromReader };
}

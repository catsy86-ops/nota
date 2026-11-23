import { useEffect, type RefObject } from "react";
import { loadShiftPresets } from "@/hooks/useShiftPresets";
import { registerUndoHandlers } from "@/lib/actionHistory";
import { markNoteOpened } from "@/lib/lastOpened";
import { noteHistory } from "@/lib/noteHistory";
import { highlightTokens } from "@/lib/searchQuery";
import { setSearchTerms } from "@/lib/searchTerms";
import type { Note } from "@/lib/types/note";
import { loadNoteReader } from "./indexViews";

/**
 * A2.2 (`docs/plan-architektura-2026-11-15.md`, mapa w `docs/index-mapa.md`): efekty `Index` bez własnego widoku,
 * montowane obok widoków wzorem `PushScheduleSync`. Każdy renderuje `null` i robi jedną rzecz.
 */

/** Czytnik i presety Grafiku (chipy „po zmianie” w pickerze terminu, Plan-nowy 1.5) ładowane w bezczynności po starcie. */
export function IdleWarmup() {
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const warm = () => { void loadNoteReader(); void loadShiftPresets(); };
    if (!w.requestIdleCallback) { const t = window.setTimeout(warm, 1500); return () => window.clearTimeout(t); }
    const id = w.requestIdleCallback(warm, { timeout: 4000 });
    return () => w.cancelIdleCallback?.(id);
  }, []);
  return null;
}

/** Frazy wyszukiwania dla wyróżniania w kaflach (magazyn `searchTerms`, bez przerysowania całej listy). */
export function SearchTermsSync({ search }: { search: string }) {
  useEffect(() => { setSearchTerms(highlightTokens(search)); }, [search]);
  return null;
}

/** Cofanie z historii odtworzonej z `localStorage` po przeładowaniu — kosz i archiwum. */
export function UndoHandlersSync({ restore, unarchive }: { restore: (ids: string[]) => void; unarchive: (id: string) => void }) {
  useEffect(() => {
    registerUndoHandlers({ trash: (ids) => restore(ids), archive: (ids) => ids.forEach(unarchive) });
  }, [restore, unarchive]);
  return null;
}

/** Czytnik też liczy się jako „otwarcie” (sortowanie „Ostatnio otwierane”). */
export function MarkOpenedSync({ noteId }: { noteId: string | null }) {
  useEffect(() => { if (noteId) markNoteOpened(noteId); }, [noteId]);
  return null;
}

/**
 * 5.1: Alt+← / Alt+→ po historii otwieranych notatek. Tylko gdy historia ma dokąd iść — inaczej skrót zostaje
 * przeglądarce (wstecz). Nie w polu tekstowym i nie nad innym oknem niż czytnik. Zablokowane notatki pomija.
 */
export function ReaderHistoryKeys({ notesRef, archivedRef, show }: {
  notesRef: RefObject<Note[]>;
  archivedRef: RefObject<Note[]>;
  show: (id: string) => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      const known = new Set([...notesRef.current, ...archivedRef.current].filter((n) => !n.locked).map((n) => n.id));
      const id = noteHistory.step(e.key === "ArrowLeft" ? -1 : 1, (x) => known.has(x));
      if (!id) return;
      e.preventDefault();
      show(id);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notesRef, archivedRef, show]);
  return null;
}


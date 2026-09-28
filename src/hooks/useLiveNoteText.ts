import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { onRemoteNoteTextChange, rebaseNoteTextEdit } from "@/hooks/useNotes";

interface LiveNoteTextOptions {
  noteId: string;
  /** Czy sesja edycji jest otwarta (`beginNoteTextEdit` już zawołane). */
  active: boolean;
  textareaRef: RefObject<HTMLTextAreaElement>;
  /** Bieżący szkic treści — czytany w chwili zdarzenia, nie z domknięcia. */
  getDraft: () => string;
  setDraft: (text: string) => void;
}

/**
 * Tekst dopisany przez peera pojawia się w otwartym edytorze od razu,
 * a nie dopiero po zapisie. Szkic jest najpierw scalany (bez utraty
 * niczego z żadnej strony), a karetka zostaje przy tym samym znaku.
 */
export function useLiveNoteText({ noteId, active, textareaRef, getDraft, setDraft }: LiveNoteTextOptions) {
  const getDraftRef = useRef(getDraft);
  getDraftRef.current = getDraft;
  const setDraftRef = useRef(setDraft);
  setDraftRef.current = setDraft;
  const pendingSelection = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!active) return;
    return onRemoteNoteTextChange(noteId, () => {
      const ta = textareaRef.current;
      const sel: [number, number] = ta ? [ta.selectionStart, ta.selectionEnd] : [0, 0];
      const res = rebaseNoteTextEdit(noteId, getDraftRef.current(), sel);
      if (!res) return;
      if (ta && document.activeElement === ta) pendingSelection.current = res.selection;
      setDraftRef.current(res.text);
    });
  }, [active, noteId, textareaRef]);

  // Po wlaniu nowej wartości przywracamy zaznaczenie przed malowaniem.
  useLayoutEffect(() => {
    const sel = pendingSelection.current;
    const ta = textareaRef.current;
    if (!sel || !ta) return;
    pendingSelection.current = null;
    ta.setSelectionRange(sel[0], sel[1]);
  });
}

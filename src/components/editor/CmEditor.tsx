import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent, type MutableRefObject } from "react";
import { Annotation, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useLatestRef } from "@/hooks/useLatestRef";
import type { TextControl } from "@/lib/textControl";
import { newNoteUndoManager, type NoteYText as YText } from "@/hooks/useNotes";
import { buildCmExtensions, type CmExtensionOptions } from "./cmExtensions";
import { createCmTextControl } from "./cmTextControl";

/** Zmiany zewnętrzne (z `value`) nie wracają jako `onChange` — to tylko odzwierciedlenie stanu. */
const External = Annotation.define<boolean>();

/**
 * Opakowanie CodeMirror 6 o kształcie `value` / `onChange` jak zwykłe pole.
 * Ładowane leniwie przez wywołującego (paczka edytora nie wchodzi do paczki startowej).
 *
 * Widok tworzy się raz; zewnętrzna zmiana `value` (np. z innego urządzenia) zamienia tylko
 * różniący się środek tekstu, więc karetka zostaje przy tym samym znaku, tak jak w textarea.
 *
 * Zdarzenia klawiatury i schowka idą najpierw do rodzica (faza przechwytywania): jeśli
 * obsługa wywoła `preventDefault`, CodeMirror już ich nie dostaje — tak jak w textarea.
 */
export interface CmEditorProps extends Omit<CmExtensionOptions, "onChange"> {
  value: string;
  onChange: (text: string) => void;
  onSelect?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (e: ClipboardEvent<HTMLDivElement>) => void;
  /** Klik na `[[link]]` poza kursorem (Faza 1, podgląd na żywo). */
  onWikiClick?: (title: string) => void;
  /** Adapter `TextControl` widoku (ustawiany po montażu, zerowany przy odmontowaniu). */
  textControlRef?: MutableRefObject<TextControl | null>;
  /** Wiązanie z `Y.Text` (Faza 1b): dokument jest źródłem prawdy, `value` tylko odzwierciedla. */
  yText?: YText;
  /** Fokus na treści zaraz po montażu (np. Enter w tytule, zanim edytor się załadował). */
  autoFocus?: boolean;
  className?: string;
}

export function CmEditor({ value, onChange, onSelect, onKeyDown, onPaste, onWikiClick, textControlRef, autoFocus, yText, className, ...opts }: CmEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useLatestRef(onChange);
  const onSelectRef = useLatestRef(onSelect);
  // Widok tworzy się raz, więc klik w link czyta aktualną funkcję przez ref (jak `onChange`).
  const onWikiClickRef = useLatestRef(onWikiClick);
  const onKeyDownRef = useLatestRef(onKeyDown);
  const onPasteRef = useLatestRef(onPaste);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Cofanie w trybie wiązania: własny menedżer na sesję edytora, żeby adapter mógł zamykać grupy operacji.
    const undoManager = yText ? newNoteUndoManager(yText) : undefined;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: yText ? yText.toString() : value,
        extensions: [
          ...buildCmExtensions({
            ...opts,
            yText,
            yUndoManager: undoManager,
            onChange: undefined,
            onWikiClick: onWikiClickRef.current ? (title) => onWikiClickRef.current?.(title) : undefined,
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged && !u.transactions.some((t) => t.annotation(External))) {
              onChangeRef.current(u.state.doc.toString());
            }
            if (u.selectionSet) onSelectRef.current?.();
          }),
        ],
      }),
    });
    viewRef.current = view;
    const control = createCmTextControl(view, undoManager);
    if (textControlRef) textControlRef.current = control;
    if (autoFocus) view.focus();
    return () => {
      // Czyścimy tylko własny adapter: starsza instancja (np. po zmianie `key`) nie może wyzerować nowej.
      if (textControlRef && textControlRef.current === control) textControlRef.current = null;
      view.destroy();
      undoManager?.destroy();
      viewRef.current = null;
    };
    // Widok tworzony raz: opcje czytane tylko przy starcie (zmiana trybu tylko do odczytu wymaga nowego montażu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    // Z wiązaniem Yjs tekst przychodzi z dokumentu (yCollab), nie z `value`.
    if (!view || yText) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    // Najmniejsza zmiana: wspólny prefiks i sufiks zostają, więc zaznaczenie poza zmianą nie znika.
    const min = Math.min(current.length, value.length);
    let p = 0;
    while (p < min && current[p] === value[p]) p++;
    let q = 0;
    while (q < min - p && current[current.length - 1 - q] === value[value.length - 1 - q]) q++;
    view.dispatch({
      changes: { from: p, to: current.length - q, insert: value.slice(p, value.length - q) },
      annotations: External.of(true),
    });
  }, [value, yText]);

  return (
    <div
      ref={hostRef}
      className={className}
      onKeyDownCapture={(e) => {
        onKeyDownRef.current?.(e);
        if (e.defaultPrevented) e.stopPropagation();
      }}
      onPasteCapture={(e) => {
        onPasteRef.current?.(e);
        if (e.defaultPrevented) e.stopPropagation();
      }}
    />
  );
}

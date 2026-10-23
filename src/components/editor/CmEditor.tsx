import { useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useLatestRef } from "@/hooks/useLatestRef";
import { buildCmExtensions, type CmExtensionOptions } from "./cmExtensions";

/**
 * Opakowanie CodeMirror 6 o kształcie `value` / `onChange` jak zwykłe pole.
 * Ładowane leniwie przez wywołującego (paczka edytora nie wchodzi do paczki startowej).
 *
 * Widok tworzy się raz; zewnętrzna zmiana `value` (np. z innego urządzenia) nadpisuje
 * dokument, a zmiana z klawiatury nie — bo `value` wraca z `onChange` i jest już równy dokumentowi.
 */
export interface CmEditorProps extends Omit<CmExtensionOptions, "onChange"> {
  value: string;
  onChange: (text: string) => void;
  className?: string;
}

export function CmEditor({ value, onChange, className, ...opts }: CmEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useLatestRef(onChange);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: value,
        extensions: buildCmExtensions({ ...opts, onChange: (t) => onChangeRef.current(t) }),
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Widok tworzony raz: opcje czytane tylko przy starcie (zmiana trybu tylko do odczytu wymaga nowego montażu).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div ref={hostRef} className={className} />;
}

import type { EditorView } from "@codemirror/view";
import type { TextControl } from "@/lib/textControl";
import type { NoteUndoManager } from "@/hooks/useNotes";

/**
 * Adapter `TextControl` na widoku CodeMirror (plan rozbudowy, Faza 1a).
 * Zmiany idą przez transakcje, więc Ctrl+Z cofa też wstawienia z podpowiedzi
 * i skrótów (`applyEdit`), a nie tylko pisanie z klawiatury.
 */
export function createCmTextControl(view: EditorView, undoManager?: NoteUndoManager): TextControl {
  const clamp = (n: number) => Math.max(0, Math.min(n, view.state.doc.length));
  return {
    get value() { return view.state.doc.toString(); },
    set value(text: string) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
    },
    get selectionStart() { return view.state.selection.main.from; },
    set selectionStart(n: number) { this.setSelectionRange(n, Math.max(n, view.state.selection.main.to)); },
    get selectionEnd() { return view.state.selection.main.to; },
    set selectionEnd(n: number) { this.setSelectionRange(Math.min(view.state.selection.main.from, n), n); },
    get offsetParent() { return view.dom.offsetParent; },
    get offsetTop() { return view.dom.offsetTop; },
    get offsetLeft() { return view.dom.offsetLeft; },
    get scrollTop() { return view.scrollDOM.scrollTop; },
    set scrollTop(n: number) { view.scrollDOM.scrollTop = n; },
    get focused() { return view.hasFocus; },
    setSelectionRange(start: number, end: number) {
      view.dispatch({ selection: { anchor: clamp(start), head: clamp(end) }, scrollIntoView: true });
    },
    setRangeText(text: string, start: number, end: number, mode?: "end") {
      const from = clamp(start);
      const to = clamp(end);
      // Operacja z podpowiedzi, skrótu lub paska to osobna jednostka cofania (nie scala się z pisaniem obok).
      undoManager?.stopCapturing();
      view.dispatch({
        changes: { from, to, insert: text },
        selection: mode === "end" ? { anchor: from + text.length } : undefined,
        userEvent: "input",
      });
      undoManager?.stopCapturing();
    },
    focus() { view.focus(); },
    caretCoords(pos: number) {
      const dom = view.dom.getBoundingClientRect();
      const c = view.coordsAtPos(clamp(pos));
      if (!c) return { top: 0, left: 0, height: 20 };
      return { top: c.top - dom.top, left: c.left - dom.left, height: c.bottom - c.top };
    },
  };
}

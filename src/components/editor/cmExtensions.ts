import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import type { NoteUndoManager, NoteYText as YText } from "@/hooks/useNotes";

/**
 * Konfiguracja edytora CodeMirror 6 (plan rozbudowy, Faza 1, krok 1a/1b).
 * Czysta funkcja: zwraca rozszerzenia, nie tworzy widoku — dzięki temu da się ją testować bez DOM.
 *
 * Świadomie NIE ma `indentWithTab`: Tab zostaje w przeglądarce, żeby klawiatura nie utknęła w polu.
 */
export interface CmExtensionOptions {
  placeholder?: string;
  spellcheck?: boolean;
  readOnly?: boolean;
  ariaLabel?: string;
  onChange?: (text: string) => void;
  /**
   * Wiązanie z `Y.Text` notatki (Faza 1b): zmiany idą od razu do dokumentu, a cofanie
   * przechodzi przez `Y.UndoManager` (zamiast historii CM). Bez tego — zwykły widok bez Yjs.
   */
  yText?: YText;
  /** Menedżer cofania przekazany z zewnątrz (żeby adapter mógł zamykać grupy operacji). */
  yUndoManager?: NoteUndoManager;
}

export function buildCmExtensions(opts: CmExtensionOptions = {}): Extension[] {
  const exts: Extension[] = [
    drawSelection(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage }),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of(opts.yText ? defaultKeymap : [...defaultKeymap, ...historyKeymap]),
    placeholder(opts.placeholder ?? ""),
    EditorView.contentAttributes.of({
      spellcheck: String(opts.spellcheck ?? true),
      "aria-label": opts.ariaLabel ?? "Treść notatki",
    }),
    EditorView.theme({
      "&": { color: "hsl(var(--foreground))", backgroundColor: "transparent", fontFamily: "var(--app-font, inherit)", height: "100%" },
      "&.cm-focused": { outline: "2px solid hsl(var(--ring))", outlineOffset: "2px" },
      ".cm-content": { caretColor: "hsl(var(--foreground))", padding: "0.5rem 0", minHeight: "60px" },
      ".cm-placeholder": { color: "hsl(var(--muted-foreground))" },
      ".cm-scroller": { fontFamily: "inherit" },
    }),
  ];
  if (opts.yText) {
    // Historia należy do Y.UndoManager: Ctrl+Z cofa też to, co zrobiła podpowiedź albo skrót.
    exts.push(yCollab(opts.yText, null, { undoManager: opts.yUndoManager }), keymap.of(yUndoManagerKeymap));
  } else {
    exts.unshift(history());
  }
  if (opts.readOnly) exts.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
  if (opts.onChange) {
    const onChange = opts.onChange;
    exts.push(EditorView.updateListener.of((u) => {
      if (u.docChanged) onChange(u.state.doc.toString());
    }));
  }
  return exts;
}

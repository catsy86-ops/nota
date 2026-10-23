import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";

/**
 * Konfiguracja edytora CodeMirror 6 (plan rozbudowy, Faza 1, krok 1a).
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
}

export function buildCmExtensions(opts: CmExtensionOptions = {}): Extension[] {
  const exts: Extension[] = [
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    markdown({ base: markdownLanguage }),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    placeholder(opts.placeholder ?? ""),
    EditorView.contentAttributes.of({
      spellcheck: String(opts.spellcheck ?? true),
      "aria-label": opts.ariaLabel ?? "Treść notatki",
    }),
    EditorView.theme({
      "&": { color: "hsl(var(--foreground))", backgroundColor: "transparent", fontFamily: "var(--app-font, inherit)" },
      "&.cm-focused": { outline: "2px solid hsl(var(--ring))", outlineOffset: "2px" },
      ".cm-content": { caretColor: "hsl(var(--foreground))", padding: "0.5rem 0", minHeight: "60px" },
      ".cm-placeholder": { color: "hsl(var(--muted-foreground))" },
      ".cm-scroller": { fontFamily: "inherit" },
    }),
  ];
  if (opts.readOnly) exts.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
  if (opts.onChange) {
    const onChange = opts.onChange;
    exts.push(EditorView.updateListener.of((u) => {
      if (u.docChanged) onChange(u.state.doc.toString());
    }));
  }
  return exts;
}

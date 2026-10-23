import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

/**
 * Podgląd na żywo w CodeMirror (plan rozbudowy, Faza 1, krok 1c).
 * Znaczniki Markdown (`#`, `**`, `*`, `` ` ``, `~~`, `[]()`, `>`) są ukryte poza linią, na której stoi kursor,
 * a treść dostaje styl (nagłówek, pochylenie, pogrubienie, kod, link, cytat).
 *
 * Dokument się nie zmienia — to tylko dekoracje widoku. Ukryte znaczniki są „atomowe”,
 * więc strzałki przeskakują przez nie zamiast wchodzić do środka.
 *
 * Świadomie bez widżetów (pole zadania, obraz, tabela, `[[link]]`) — to kolejne kroki Fazy 1.
 */

const HIDDEN = Decoration.replace({});
const EMPHASIS = Decoration.mark({ class: "cm-lp-em" });
const STRONG = Decoration.mark({ class: "cm-lp-strong" });
const CODE = Decoration.mark({ class: "cm-lp-code" });
const STRIKE = Decoration.mark({ class: "cm-lp-strike" });
const LINK = Decoration.mark({ class: "cm-lp-link" });

const HEADING_LEVEL: Record<string, number> = {
  ATXHeading1: 1,
  ATXHeading2: 2,
  ATXHeading3: 3,
  ATXHeading4: 4,
  ATXHeading5: 5,
  ATXHeading6: 6,
  SetextHeading1: 1,
  SetextHeading2: 2,
};

export interface LivePreview {
  /** Wszystkie dekoracje (styl i ukrycie). */
  decorations: DecorationSet;
  /** Tylko ukryte znaczniki — zbiór atomowy dla klawiatury. */
  hidden: DecorationSet;
}

/** Numery linii, na których jest kursor albo zaznaczenie. Na nich znaczniki zostają widoczne. */
export function activeLineNumbers(state: EditorState): Set<number> {
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number;
    const last = state.doc.lineAt(range.to).number;
    for (let n = first; n <= last; n++) lines.add(n);
  }
  return lines;
}

/** Czysta funkcja: liczy dekoracje dla fragmentu dokumentu. Nie dotyka DOM. */
export function buildLivePreview(state: EditorState, from = 0, to = state.doc.length): LivePreview {
  const doc = state.doc;
  const active = activeLineNumbers(state);
  const ranges: Range<Decoration>[] = [];
  const hiddenRanges: Range<Decoration>[] = [];

  const hide = (start: number, end: number) => {
    hiddenRanges.push(HIDDEN.range(start, end));
    ranges.push(HIDDEN.range(start, end));
  };
  // Znacznik z jedną spacją za nim (`# `, `> `) znika razem ze spacją, inaczej zostaje wcięcie.
  const hideWithSpace = (start: number, end: number) => {
    hide(start, doc.sliceString(end, end + 1) === " " ? end + 1 : end);
  };

  const tree = ensureSyntaxTree(state, to, 200) ?? syntaxTree(state);
  tree.iterate({
    from,
    to,
    enter: (node) => {
      const name = node.name;
      const parent = node.node.parent?.name ?? "";
      const onActiveLine = active.has(doc.lineAt(node.from).number);

      const level = HEADING_LEVEL[name];
      if (level) {
        ranges.push(Decoration.line({ class: `cm-lp-h${level}` }).range(doc.lineAt(node.from).from));
        return;
      }
      if (name === "Blockquote") {
        const first = doc.lineAt(node.from).number;
        const last = doc.lineAt(node.to).number;
        for (let n = first; n <= last; n++) {
          ranges.push(Decoration.line({ class: "cm-lp-quote" }).range(doc.line(n).from));
        }
        return;
      }
      if (name === "Emphasis") ranges.push(EMPHASIS.range(node.from, node.to));
      else if (name === "StrongEmphasis") ranges.push(STRONG.range(node.from, node.to));
      else if (name === "InlineCode") ranges.push(CODE.range(node.from, node.to));
      else if (name === "Strikethrough") ranges.push(STRIKE.range(node.from, node.to));
      else if (name === "Link") ranges.push(LINK.range(node.from, node.to));

      if (onActiveLine) return;
      if (name === "HeaderMark" && parent.startsWith("ATXHeading")) hideWithSpace(node.from, node.to);
      else if (name === "QuoteMark") hideWithSpace(node.from, node.to);
      else if (name === "EmphasisMark" && (parent === "Emphasis" || parent === "StrongEmphasis")) hide(node.from, node.to);
      else if (name === "CodeMark" && parent === "InlineCode") hide(node.from, node.to);
      else if (name === "StrikethroughMark") hide(node.from, node.to);
      else if ((name === "LinkMark" || name === "URL") && parent === "Link") hide(node.from, node.to);
    },
  });

  return {
    decorations: Decoration.set(ranges, true),
    hidden: Decoration.set(hiddenRanges, true),
  };
}

class LivePreviewPlugin {
  decorations: DecorationSet;
  hidden: DecorationSet;
  private activeKey: string;

  constructor(view: EditorView) {
    const preview = buildLivePreview(view.state, view.viewport.from, view.viewport.to);
    this.decorations = preview.decorations;
    this.hidden = preview.hidden;
    this.activeKey = [...activeLineNumbers(view.state)].join(",");
  }

  update(update: ViewUpdate) {
    // Przebudowa tylko wtedy, gdy zmienił się tekst, widok albo zestaw aktywnych linii.
    const activeKey = [...activeLineNumbers(update.state)].join(",");
    if (!update.docChanged && !update.viewportChanged && activeKey === this.activeKey) return;
    this.activeKey = activeKey;
    const preview = buildLivePreview(update.view.state, update.view.viewport.from, update.view.viewport.to);
    this.decorations = preview.decorations;
    this.hidden = preview.hidden;
  }
}

const livePreviewPlugin = ViewPlugin.fromClass(LivePreviewPlugin, {
  decorations: (plugin) => plugin.decorations,
  provide: (plugin) =>
    EditorView.atomicRanges.of((view) => view.plugin(plugin)?.hidden ?? Decoration.none),
});

/** Style podglądu z tokenów aplikacji (kolory i kroje zmieniają się z motywem). */
const livePreviewTheme = EditorView.baseTheme({
  ".cm-lp-h1": { fontSize: "1.6em", fontWeight: "700", lineHeight: "1.3" },
  ".cm-lp-h2": { fontSize: "1.35em", fontWeight: "700", lineHeight: "1.3" },
  ".cm-lp-h3": { fontSize: "1.15em", fontWeight: "600" },
  ".cm-lp-h4, .cm-lp-h5, .cm-lp-h6": { fontWeight: "600" },
  ".cm-lp-em": { fontStyle: "italic" },
  ".cm-lp-strong": { fontWeight: "700" },
  ".cm-lp-strike": { textDecoration: "line-through" },
  ".cm-lp-code": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    backgroundColor: "hsl(var(--muted))",
    borderRadius: "3px",
    padding: "0 0.2em",
  },
  ".cm-lp-link": { color: "hsl(var(--primary))", textDecoration: "underline" },
  ".cm-lp-quote": {
    borderLeft: "3px solid hsl(var(--border))",
    paddingLeft: "0.75em",
    color: "hsl(var(--muted-foreground))",
  },
});

/** Rozszerzenie CodeMirror: podgląd na żywo Markdown. */
export function livePreview(): Extension {
  return [livePreviewPlugin, livePreviewTheme];
}

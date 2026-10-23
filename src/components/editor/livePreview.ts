import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { splitWikiTarget } from "@/lib/wikiLinks";

/**
 * Podgląd na żywo w CodeMirror (plan rozbudowy, Faza 1, krok 1c).
 * Znaczniki Markdown (`#`, `**`, `*`, `` ` ``, `~~`, `[]()`, `>`) są ukryte poza linią, na której stoi kursor,
 * a treść dostaje styl (nagłówek, pochylenie, pogrubienie, kod, link, cytat).
 *
 * Widżety: pole zadania `- [ ]` (zawsze widoczne, klik odhacza), pozioma linia `---` (poza kursorem)
 * i `[[link]]` (nawiasy znikają poza kursorem, tekst dostaje styl wikilinku; klik na wyrenderowany link
 * otwiera notatkę przez `onWikiClick`, a na linii z kursorem klik tylko ustawia kursor).
 *
 * Dokument się nie zmienia — to tylko dekoracje widoku. Ukryte znaczniki i widżety są „atomowe”,
 * więc strzałki przeskakują przez nie zamiast wchodzić do środka.
 *
 * Świadomie bez widżetów: obraz, tabela i podgląd wzoru (kolejne kroki Fazy 1).
 */

const HIDDEN = Decoration.replace({});
const EMPHASIS = Decoration.mark({ class: "cm-lp-em" });
const STRONG = Decoration.mark({ class: "cm-lp-strong" });
const CODE = Decoration.mark({ class: "cm-lp-code" });
const STRIKE = Decoration.mark({ class: "cm-lp-strike" });
const LINK = Decoration.mark({ class: "cm-lp-link" });
const WIKI = Decoration.mark({ class: "cm-lp-wiki" });

/** Węzły kodu — `[[...]]` wewnątrz nich zostaje dosłowne. */
const CODE_NODES = new Set(["InlineCode", "FencedCode", "CodeBlock", "CodeText"]);

/** Ten sam kształt co `[[tytuł#nagłówek]]` i `[[cel|tekst]]` w aplikacji (`lib/wikiLinks.ts`). */
const WIKI_LINK = /\[\[[^[\]\n]+\]\]/g;

function insideCode(tree: ReturnType<typeof syntaxTree>, pos: number): boolean {
  for (let node: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(pos, 1); node; node = node.parent) {
    if (CODE_NODES.has(node.name)) return true;
  }
  return false;
}

/**
 * Pole zadania. Klik zmienia `[ ]` na `[x]` i odwrotnie w dokumencie (przez transakcję CM),
 * więc stan zostaje w tekście notatki, a nie w widżecie.
 */
class TaskWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }

  eq(other: TaskWidget) {
    return other.checked === this.checked;
  }

  toDOM(view: EditorView) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "cm-lp-task";
    box.checked = this.checked;
    box.setAttribute("aria-label", this.checked ? "Zrobione" : "Do zrobienia");
    // Klik obsługujemy sami: przeglądarka nie zmienia stanu pola, o nim decyduje dokument.
    box.addEventListener("mousedown", (e) => e.preventDefault());
    box.addEventListener("click", (e) => {
      e.preventDefault();
      const from = view.posAtDOM(box);
      const mark = view.state.doc.sliceString(from + 1, from + 2);
      if (view.state.doc.sliceString(from, from + 1) !== "[" || !/[ xX]/.test(mark)) return;
      const next = mark === " " ? "x" : " ";
      view.dispatch({ changes: { from: from + 1, to: from + 2, insert: next } });
    });
    return box;
  }

  ignoreEvent() {
    return true;
  }
}

class RuleWidget extends WidgetType {
  eq() {
    return true;
  }

  toDOM() {
    const hr = document.createElement("hr");
    hr.className = "cm-lp-hr";
    return hr;
  }
}

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

/**
 * Tytuł notatki z `[[link]]`, w którym leży `pos`, albo `null`, gdy `pos` nie jest w wikilinku
 * albo wikilink leży na linii z kursorem (wtedy klik ma tylko ustawić kursor, żeby edytować znaczniki).
 */
export function wikiTargetAt(state: EditorState, pos: number): string | null {
  const line = state.doc.lineAt(pos);
  if (activeLineNumbers(state).has(line.number)) return null;
  for (const m of line.text.matchAll(WIKI_LINK)) {
    const start = line.from + (m.index ?? 0);
    const end = start + m[0].length;
    if (pos < start || pos > end) continue;
    if (insideCode(syntaxTree(state), start)) return null;
    return splitWikiTarget(m[0].slice(2, -2)).title || null;
  }
  return null;
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

  // `[[link]]` nie jest składnią GFM, więc szukamy go w tekście widocznych linii, z pominięciem kodu.
  // Parser widzi go jako link `[Tytuł]` z zewnętrznym `[` w tekście — stąd mapa początek → koniec.
  const wikiAt = new Map<number, number>();
  for (let n = doc.lineAt(from).number; n <= doc.lineAt(to).number; n++) {
    const line = doc.line(n);
    for (const m of line.text.matchAll(WIKI_LINK)) {
      const start = line.from + (m.index ?? 0);
      if (!insideCode(tree, start)) wikiAt.set(start, start + m[0].length);
    }
  }

  tree.iterate({
    from,
    to,
    enter: (node) => {
      const name = node.name;
      const parent = node.node.parent?.name ?? "";
      const onActiveLine = active.has(doc.lineAt(node.from).number);

      // `[[cel]]` parser Markdown bierze za link z zagnieżdżonym `[...]`. Wikilinki obsługuje skan niżej,
      // a `false` pomija dzieci węzła, żeby nawiasy nie były ukrywane dwa razy.
      if (name === "Link" && wikiAt.get(node.from - 1) === node.to + 1) return false;

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

      if (name === "TaskMarker") {
        // Pole zadania jest zawsze widoczne, także na linii z kursorem (jak w Obsidianie).
        const checked = /[xX]/.test(doc.sliceString(node.from + 1, node.from + 2));
        const box = Decoration.replace({ widget: new TaskWidget(checked) });
        ranges.push(box.range(node.from, node.to));
        hiddenRanges.push(box.range(node.from, node.to));
        return;
      }
      if (name === "HorizontalRule") {
        if (onActiveLine) return;
        const rule = Decoration.replace({ widget: new RuleWidget() });
        ranges.push(rule.range(node.from, node.to));
        hiddenRanges.push(rule.range(node.from, node.to));
        return;
      }

      if (onActiveLine) return;
      if (name === "HeaderMark" && parent.startsWith("ATXHeading")) hideWithSpace(node.from, node.to);
      else if (name === "QuoteMark") hideWithSpace(node.from, node.to);
      else if (name === "EmphasisMark" && (parent === "Emphasis" || parent === "StrongEmphasis")) hide(node.from, node.to);
      else if (name === "CodeMark" && parent === "InlineCode") hide(node.from, node.to);
      else if (name === "StrikethroughMark") hide(node.from, node.to);
      else if ((name === "LinkMark" || name === "URL") && parent === "Link") hide(node.from, node.to);
    },
  });

  // Poza kursorem nawiasy wikilinku znikają, a cel dostaje styl.
  for (const [start, end] of wikiAt) {
    if (active.has(doc.lineAt(start).number)) {
      ranges.push(WIKI.range(start, end));
    } else {
      hide(start, start + 2);
      ranges.push(WIKI.range(start + 2, end - 2));
      hide(end - 2, end);
    }
  }

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
  ".cm-lp-wiki": { color: "hsl(var(--primary))", textDecoration: "underline dotted", cursor: "pointer" },
  ".cm-lp-task": {
    width: "1.1em",
    height: "1.1em",
    margin: "0 0.35em 0 0",
    verticalAlign: "-0.15em",
    accentColor: "hsl(var(--primary))",
    cursor: "pointer",
  },
  ".cm-lp-hr": { border: "0", borderTop: "1px solid hsl(var(--border))", margin: "0.9em 0" },
  ".cm-lp-quote": {
    borderLeft: "3px solid hsl(var(--border))",
    paddingLeft: "0.75em",
    color: "hsl(var(--muted-foreground))",
  },
});

export interface LivePreviewOptions {
  /** Klik na wyrenderowany `[[link]]` — dostaje tytuł notatki (jak `onWikiClick` w czytniku). */
  onWikiClick?: (title: string) => void;
}

/** Rozszerzenie CodeMirror: podgląd na żywo Markdown. */
export function livePreview(opts: LivePreviewOptions = {}): Extension {
  const exts: Extension[] = [livePreviewPlugin, livePreviewTheme];
  if (opts.onWikiClick) {
    const onWikiClick = opts.onWikiClick;
    // `mousedown`, nie `click`: kliknięcie w link poza kursorem ma otworzyć notatkę, a nie przesuwać kursor.
    exts.push(EditorView.domEventHandlers({
      mousedown(e, view) {
        if (e.button !== 0 || !(e.target instanceof Element) || !e.target.closest(".cm-lp-wiki")) return false;
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos === null) return false;
        const title = wikiTargetAt(view.state, pos);
        if (!title) return false;
        e.preventDefault();
        onWikiClick(title);
        return true;
      },
    }));
  }
  return exts;
}

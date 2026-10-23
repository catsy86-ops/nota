import { describe, expect, it } from "vitest";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { buildCmExtensions } from "./cmExtensions";
import { buildLivePreview } from "./livePreview";

/** Stan z Markdownem i kursorem na podanej pozycji (domyślnie koniec dokumentu). */
function stateAt(doc: string, cursor = doc.length): EditorState {
  const extensions: Extension[] = [markdown({ base: markdownLanguage })];
  return EditorState.create({ doc, selection: { anchor: cursor }, extensions });
}

/** Zakresy ukrytych znaczników jako tekst, który zakrywają — łatwiejsze w asercjach. */
function hiddenText(doc: string, cursor?: number): string[] {
  const state = stateAt(doc, cursor);
  const hidden: string[] = [];
  buildLivePreview(state).hidden.between(0, doc.length, (from, to) => {
    hidden.push(doc.slice(from, to));
  });
  return hidden;
}

describe("livePreview — ukrywanie znaczników poza linią kursora", () => {
  it("ukrywa ** i * na linii bez kursora, a na linii z kursorem zostawia", () => {
    const doc = "Ala **ma** kota\n\nDrugi *wers*";
    // kursor na końcu (trzecia linia) — ** w pierwszej ukryte, * w trzeciej zostaje
    expect(hiddenText(doc)).toEqual(["**", "**"]);
    // kursor w pogrubieniu (pierwsza linia) — ** zostaje, * w trzeciej ukryte
    expect(hiddenText(doc, 7)).toEqual(["*", "*"]);
  });

  it("ukrywa znak # i jedną spację po nim w nagłówku poza kursorem", () => {
    const doc = "# Tytuł\n\ntekst";
    expect(hiddenText(doc)).toEqual(["# "]);
    expect(hiddenText(doc, 3)).toEqual([]);
  });

  it("ukrywa ` w kodzie w linii, a bloki kodu zostają", () => {
    const doc = "a `kod` b\n\n```\nblok\n```";
    const hidden = hiddenText(doc);
    expect(hidden).toEqual(["`", "`"]);
  });

  it("ukrywa nawiasy i adres linku, zostawia tekst", () => {
    const doc = "[strona](https://example.com)\n\nkoniec";
    expect(hiddenText(doc)).toEqual(["[", "]", "(", "https://example.com", ")"]);
  });

  it("ukrywa znak > cytatu wraz ze spacją", () => {
    const doc = "> cytat\n\nkoniec";
    expect(hiddenText(doc)).toEqual(["> "]);
  });

  it("nie zmienia dokumentu — tylko dekoracje", () => {
    const doc = "# A **b** `c`";
    const state = stateAt(doc, 0);
    buildLivePreview(state);
    expect(state.doc.toString()).toBe(doc);
  });

  it("nagłówek dostaje klasę poziomu na swojej linii", () => {
    const state = stateAt("## Podtytuł\n\nakapit", 0);
    const classes: string[] = [];
    buildLivePreview(state).decorations.between(0, state.doc.length, (_from, _to, value) => {
      const spec = value.spec as { class?: string };
      if (spec.class) classes.push(spec.class);
    });
    expect(classes).toContain("cm-lp-h2");
  });
});

describe("livePreview w widoku CodeMirror", () => {
  it("dodaje klasę nagłówka do linii w DOM i zachowuje tekst", () => {
    const view = new EditorView({
      state: EditorState.create({ doc: "# Tytuł\n\ntekst", selection: { anchor: 12 }, extensions: buildCmExtensions() }),
    });
    expect(view.contentDOM.querySelector(".cm-lp-h1")).not.toBeNull();
    expect(view.state.doc.toString()).toBe("# Tytuł\n\ntekst");
    view.destroy();
  });

  it("po przesunięciu kursora na linię nagłówka znacznik wraca do DOM-u", () => {
    const view = new EditorView({
      state: EditorState.create({ doc: "# Tytuł\n\ntekst", selection: { anchor: 12 }, extensions: buildCmExtensions() }),
    });
    expect(view.contentDOM.textContent).not.toContain("# Tytuł");
    view.dispatch({ selection: { anchor: 3 } });
    expect(view.contentDOM.textContent).toContain("# Tytuł");
    view.destroy();
  });
});

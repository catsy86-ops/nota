import { describe, expect, it } from "vitest";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { buildCmExtensions } from "./cmExtensions";
import { buildLivePreview, tableCells, wikiTargetAt } from "./livePreview";

/** Stan z Markdownem i kursorem na podanej pozycji (domyślnie koniec dokumentu). */
function stateAt(doc: string, cursor = doc.length): EditorState {
  const extensions: Extension[] = [markdown({ base: markdownLanguage, extensions: [GFM] })];
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

describe("livePreview — widżety", () => {
  it("pole zadania jest zawsze atomowym widżetem, także na linii z kursorem", () => {
    const doc = "- [ ] zrobić\n- [x] gotowe\n\nkoniec";
    const state = stateAt(doc, 3);
    const widgets: boolean[] = [];
    buildLivePreview(state).hidden.between(0, doc.length, (from, to) => {
      if (doc.slice(from, to).startsWith("[")) widgets.push(doc.slice(from, to) === "[ ]");
    });
    expect(widgets).toEqual([true, false]);
  });

  it("klik w pole odhacza zadanie w dokumencie, a drugi klik cofa", () => {
    const view = new EditorView({
      state: EditorState.create({ doc: "- [ ] zrobić\n\nkoniec", selection: { anchor: 19 }, extensions: buildCmExtensions() }),
    });
    const box = view.contentDOM.querySelector<HTMLInputElement>("input.cm-lp-task");
    expect(box).not.toBeNull();
    expect(box?.checked).toBe(false);
    box?.click();
    expect(view.state.doc.toString()).toBe("- [x] zrobić\n\nkoniec");
    view.contentDOM.querySelector<HTMLInputElement>("input.cm-lp-task")?.click();
    expect(view.state.doc.toString()).toBe("- [ ] zrobić\n\nkoniec");
    view.destroy();
  });

  it("linia pozioma poza kursorem jest ukryta jako widżet, a na linii z kursorem zostaje", () => {
    const doc = "przed\n\n---\n\nza";
    expect(hiddenText(doc)).toEqual(["---"]);
    expect(hiddenText(doc, 9)).toEqual([]);
  });

  it("[[link]] traci nawiasy poza kursorem i zostaje tekst z tytułem i nagłówkiem", () => {
    const doc = "Zobacz [[Tytuł#Sekcja]] tutaj\n\nkoniec";
    expect(hiddenText(doc)).toEqual(["[[", "]]"]);
    expect(hiddenText(doc, 6)).toEqual([]);
  });

  it("[[...]] w kodzie zostaje dosłowne", () => {
    const doc = "a `[[nie]]` b\n\nkoniec";
    expect(hiddenText(doc)).toEqual(["`", "`"]);
  });
});

describe("wikiTargetAt — klik w [[link]] poza kursorem", () => {
  it("zwraca tytuł linku, gdy kliknięcie trafia w wikilink na linii bez kursora", () => {
    const doc = "start\n\nzobacz [[Budowa#Fundament]] tutaj\n\nkoniec";
    const at = doc.indexOf("Budowa") + 2;
    expect(wikiTargetAt(stateAt(doc, 0), at)).toBe("Budowa");
  });

  it("na linii z kursorem zwraca null, żeby klik tylko ustawił kursor", () => {
    const doc = "[[Budowa]] tekst";
    expect(wikiTargetAt(stateAt(doc, 3), 3)).toBeNull();
  });

  it("poza wikilinkiem i w kodzie zwraca null", () => {
    const doc = "zwykły tekst\n\na `[[nie]]` b\n\nkoniec";
    expect(wikiTargetAt(stateAt(doc, doc.length), 2)).toBeNull();
    expect(wikiTargetAt(stateAt(doc, doc.length), doc.indexOf("nie"))).toBeNull();
  });
});

describe("tableCells — wiersz tabeli GFM", () => {
  it("dzieli komórki po | i obcina skrajne kreski", () => {
    expect(tableCells("| a | b |")).toEqual(["a", "b"]);
    expect(tableCells("a|b")).toEqual(["a", "b"]);
  });

  it("kreska zapisana z ukośnikiem zostaje w komórce", () => {
    expect(tableCells("| a \\| b | c |")).toEqual(["a | b", "c"]);
  });
});

describe("livePreview — tabele i obrazy w widoku CodeMirror", () => {
  const table = "| Imię | Wiek |\n| --- | --- |\n| Ala | 7 |";

  it("tabela poza kursorem jest renderowana jako <table>, z nagłówkiem i wierszami", () => {
    const view = new EditorView({
      state: EditorState.create({ doc: `${table}\n\nkoniec`, selection: { anchor: table.length + 4 }, extensions: buildCmExtensions() }),
    });
    const cells = [...view.contentDOM.querySelectorAll("table.cm-lp-table th, table.cm-lp-table td")].map((c) => c.textContent);
    expect(cells).toEqual(["Imię", "Wiek", "Ala", "7"]);
    expect(view.state.doc.toString()).toBe(`${table}\n\nkoniec`);
    view.destroy();
  });

  it("kursor w tabeli pokazuje ją jako tekst, a klik w tabelę przenosi tam kursor", () => {
    const view = new EditorView({
      state: EditorState.create({ doc: `${table}\n\nkoniec`, selection: { anchor: 2 }, extensions: buildCmExtensions() }),
    });
    expect(view.contentDOM.querySelector("table.cm-lp-table")).toBeNull();
    view.dispatch({ selection: { anchor: table.length + 4 } });
    expect(view.contentDOM.querySelector("table.cm-lp-table")).not.toBeNull();
    view.destroy();
  });

  it("obraz poza kursorem to etykieta bez ładowania, a znaczniki wracają na linii z kursorem", () => {
    const doc = "![kot](https://example.com/kot.png)\n\nkoniec";
    const view = new EditorView({
      state: EditorState.create({ doc, selection: { anchor: doc.length }, extensions: buildCmExtensions() }),
    });
    expect(view.contentDOM.querySelector("img:not(.cm-widgetBuffer)")).toBeNull();
    expect(view.contentDOM.querySelector(".cm-lp-image")?.textContent).toBe("obraz: kot");
    view.dispatch({ selection: { anchor: 3 } });
    expect(view.contentDOM.querySelector(".cm-lp-image")).toBeNull();
    expect(view.state.doc.toString()).toBe(doc);
    view.destroy();
  });
});

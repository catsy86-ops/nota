import { describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { buildCmExtensions } from "./cmExtensions";

describe("buildCmExtensions", () => {
  it("tworzy stan z dokumentem i językiem Markdown", () => {
    const state = EditorState.create({ doc: "# Tytuł\n- [ ] zadanie", extensions: buildCmExtensions() });
    expect(state.doc.toString()).toBe("# Tytuł\n- [ ] zadanie");
    expect(state.doc.lines).toBe(2);
  });

  it("zgłasza zmiany dokumentu przez onChange", () => {
    const onChange = vi.fn();
    const view = new EditorView({
      state: EditorState.create({ doc: "a", extensions: buildCmExtensions({ onChange }) }),
    });
    view.dispatch({ changes: { from: 1, insert: "b" } });
    expect(onChange).toHaveBeenCalledWith("ab");
    view.destroy();
  });

  it("tryb tylko do odczytu wyłącza edycję w przeglądarce", () => {
    const view = new EditorView({
      state: EditorState.create({ doc: "stałe", extensions: buildCmExtensions({ readOnly: true }) }),
    });
    expect(view.state.readOnly).toBe(true);
    expect(view.contentDOM.getAttribute("contenteditable")).toBe("false");
    view.destroy();
  });

  it("ustawia atrybuty dostępności i pisowni na treści", () => {
    const view = new EditorView({
      state: EditorState.create({ doc: "", extensions: buildCmExtensions({ spellcheck: false, ariaLabel: "Treść" }) }),
    });
    const content = view.contentDOM;
    expect(content.getAttribute("spellcheck")).toBe("false");
    expect(content.getAttribute("aria-label")).toBe("Treść");
    view.destroy();
  });
});

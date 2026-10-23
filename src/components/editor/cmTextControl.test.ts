import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createCmTextControl } from "./cmTextControl";
import { applyEdit } from "@/lib/editorKeysDom";

function setup(doc: string) {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const view = new EditorView({ parent, state: EditorState.create({ doc }) });
  return { view, ta: createCmTextControl(view), done: () => view.destroy() };
}

describe("createCmTextControl", () => {
  it("czyta wartość i zaznaczenie z widoku", () => {
    const { ta, done } = setup("abcdef");
    ta.setSelectionRange(2, 4);
    expect(ta.value).toBe("abcdef");
    expect([ta.selectionStart, ta.selectionEnd]).toEqual([2, 4]);
    done();
  });

  it("setRangeText zamienia środek jedną transakcją i ustawia kursor na końcu", () => {
    const { view, ta, done } = setup("ab cd");
    ta.setRangeText("XYZ", 3, 5, "end");
    expect(view.state.doc.toString()).toBe("ab XYZ");
    expect(ta.selectionStart).toBe(6);
    done();
  });

  it("applyEdit przez adapter ustawia wynik i zaznaczenie, bez execCommand", () => {
    const { view, ta, done } = setup("tekst");
    applyEdit(ta, { value: "**tekst**", selStart: 2, selEnd: 7 });
    expect(view.state.doc.toString()).toBe("**tekst**");
    expect([ta.selectionStart, ta.selectionEnd]).toEqual([2, 7]);
    done();
  });
});

import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { Note } from "@/hooks/useNotes";
import { setQueryBlockData } from "@/lib/queryBlock";
import { buildCmExtensions } from "./cmExtensions";

// Plan Notatek 6.4: podgląd bloku ```zapytanie w widoku CodeMirror.
const block = "```zapytanie\netykieta:budowa kolumny:Status\n```";
const doc = `${block}\n\nkoniec`;
const base = { color: "default", folderId: null, reminder: null, pinned: false, archived: false, trashed: false, content: "", images: [], checklist: [], createdAt: 1 };
const notes = [
  { ...base, id: "a", title: "Alfa", labels: ["budowa"], props: { st: "Nowe" }, updatedAt: 2 },
  { ...base, id: "b", title: "Beta", labels: ["dom"], updatedAt: 1 },
] as unknown as Note[];

function view(source: string, anchor: number) {
  return new EditorView({ state: EditorState.create({ doc: source, selection: { anchor }, extensions: buildCmExtensions() }) });
}

describe("livePreview — blok zapytania", () => {
  it("poza kursorem pokazuje tabelę wyników, z kursorem — zwykły tekst", () => {
    setQueryBlockData({ notes, folders: [], propDefs: [{ id: "st", name: "Status", type: "text", order: 0 }] });
    const v = view(doc, block.length + 3);
    const cells = [...v.contentDOM.querySelectorAll(".cm-lp-query table th, .cm-lp-query table td")].map((c) => c.textContent);
    expect(cells).toEqual(["Notatka", "Status", "Alfa", "Nowe"]);
    expect(v.state.doc.toString()).toBe(doc);
    v.dispatch({ selection: { anchor: 3 } });
    expect(v.contentDOM.querySelector(".cm-lp-query")).toBeNull();
    v.destroy();
  });

  it("niedomknięty blok i blok innego języka zostają tekstem", () => {
    const open = view("```zapytanie\netykieta:a\n\nkoniec", 28);
    expect(open.contentDOM.querySelector(".cm-lp-query")).toBeNull();
    open.destroy();
    const other = view("```ts\nconst a = 1;\n```\n\nkoniec", 25);
    expect(other.contentDOM.querySelector(".cm-lp-query")).toBeNull();
    other.destroy();
  });
});

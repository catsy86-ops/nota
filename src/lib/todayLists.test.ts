import { describe, expect, it } from "vitest";
import type { Note } from "@/hooks/useNotes";
import { checkItem, todayListRows } from "./todayLists";

const NOW = new Date(2026, 10, 5, 12, 0);
const TODAY = NOW.getTime() - 3600_000;
const YESTERDAY = NOW.getTime() - 26 * 3600_000;

const note = (id: string, over: Partial<Note>): Note =>
  ({ id, title: id, content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null, labels: [],
     reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: YESTERDAY, updatedAt: YESTERDAY, ...over }) as Note;
const item = (id: string, text: string, checked = false) => ({ id, text, checked });

describe("listy na dziś (Dziś 4.2)", () => {
  it("bierze nieodhaczone pozycje z list zmienionych dziś albo z terminem dziś", () => {
    const { rows } = todayListRows([
      note("zmieniona", { updatedAt: TODAY, checklist: [item("1", "mleko"), item("2", "chleb", true)] }),
      note("termin", { reminder: NOW.getTime() + 3600_000, checklist: [item("3", "dzwonić")] }),
      note("stara", { checklist: [item("4", "nie dziś")] }),
    ], NOW);
    expect(rows.map((r) => r.item.text)).toEqual(["mleko", "dzwonić"]);
  });

  it("pomija prywatne, archiwum, kosz i puste pozycje; liczy nadmiar", () => {
    const many = Array.from({ length: 10 }, (_, i) => item(String(i), `p${i}`));
    const { rows, more } = todayListRows([
      note("prywatna", { updatedAt: TODAY, locked: true, checklist: [item("x", "sekret")] }),
      note("archiwum", { updatedAt: TODAY, archived: true, checklist: [item("y", "a")] }),
      note("kosz", { updatedAt: TODAY, trashed: true, checklist: [item("z", "b")] }),
      note("dużo", { updatedAt: TODAY, checklist: [item("pusta", "  "), ...many] }),
    ], NOW, 8);
    expect(rows).toHaveLength(8);
    expect(more).toBe(2);
    expect(rows.every((r) => r.noteId === "dużo")).toBe(true);
  });

  it("odhaczenie zmienia tylko jedną pozycję", () => {
    expect(checkItem([item("a", "x"), item("b", "y")], "b")).toEqual([item("a", "x"), item("b", "y", true)]);
  });
});

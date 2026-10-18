import { describe, it, expect } from "vitest";
import type { Note } from "@/hooks/useNotes";
import { MERGE_SEPARATOR, planMerge } from "./mergeNotes";

function note(over: Partial<Note> & { id: string }): Note {
  return {
    title: "", content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
    labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0,
    createdAt: 1, updatedAt: 1, ...over,
  } as Note;
}

const noChildren = () => false;

describe("planMerge — odmowy", () => {
  it("wymaga co najmniej dwóch notatek", () => {
    const r = planMerge([note({ id: "a" })], noChildren);
    expect(r.ok).toBe(false);
  });

  it("odmawia przy notatce prywatnej, tylko-do-odczytu, w archiwum/koszu i z podstronami", () => {
    const a = note({ id: "a" });
    expect(planMerge([a, note({ id: "b", locked: true })], noChildren).ok).toBe(false);
    expect(planMerge([a, note({ id: "b", readOnly: true })], noChildren).ok).toBe(false);
    expect(planMerge([a, note({ id: "b", archived: true })], noChildren).ok).toBe(false);
    expect(planMerge([a, note({ id: "b", trashed: true })], noChildren).ok).toBe(false);
    const withChild = planMerge([a, note({ id: "b" })], (id) => id === "b");
    expect(withChild.ok).toBe(false);
  });

  it("podaje powód odmowy po polsku", () => {
    const r = planMerge([note({ id: "a" }), note({ id: "b", locked: true })], noChildren);
    if (r.ok) throw new Error("oczekiwano odmowy");
    expect(r.reason).toMatch(/prywatne/);
  });
});

describe("planMerge — treść", () => {
  it("pierwsza notatka zostaje, kolejne dokładane z pogrubionym tytułem", () => {
    const r = planMerge([
      note({ id: "a", title: "Spotkanie", content: "Ustalenia" }),
      note({ id: "b", title: "Zakupy", content: "Mleko" }),
      note({ id: "c", title: "", content: "Sama treść" }),
    ], noChildren);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.targetId).toBe("a");
    expect(r.plan.sourceIds).toEqual(["b", "c"]);
    expect(r.plan.patch.content).toBe(
      ["Ustalenia", "**Zakupy**\n\nMleko", "Sama treść"].join(MERGE_SEPARATOR),
    );
    expect(r.plan.patch.title).toBeUndefined();
  });

  it("pusty tytuł pierwszej bierze pierwszy niepusty z pozostałych", () => {
    const r = planMerge([note({ id: "a", title: "  ", content: "x" }), note({ id: "b", title: "Drugi" })], noChildren);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.patch.title).toBe("Drugi");
  });

  it("pomija puste sekcje i nie dokłada zbędnych separatorów", () => {
    const r = planMerge([note({ id: "a", content: "Jeden" }), note({ id: "b" })], noChildren);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.patch.content).toBeUndefined();
  });
});

describe("planMerge — metadane", () => {
  it("sumuje etykiety i obrazy bez powtórzeń, zachowując kolejność", () => {
    const r = planMerge([
      note({ id: "a", labels: ["praca"], images: ["h1"] }),
      note({ id: "b", labels: ["praca", "dom"], images: ["h1", "h2"] }),
    ], noChildren);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.patch.labels).toEqual(["praca", "dom"]);
    expect(r.plan.patch.images).toEqual(["h1", "h2"]);
  });

  it("nie zmienia pól, których scalenie nie ruszyło (pusty patch przy identycznych danych)", () => {
    const r = planMerge([note({ id: "a", labels: ["x"] }), note({ id: "b", labels: ["x"] })], noChildren);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.patch.labels).toBeUndefined();
    expect(r.plan.patch.images).toBeUndefined();
  });

  it("checklisty pozycja po pozycji, w kolejności notatek", () => {
    const r = planMerge([
      note({ id: "a", checklist: [{ id: "1", text: "A", checked: false }] }),
      note({ id: "b", checklist: [{ id: "2", text: "B", checked: true }] }),
    ], noChildren);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.patch.checklist?.map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("priorytet: najwyższy z zaznaczonych; ulubiona, gdy którakolwiek", () => {
    const r = planMerge([
      note({ id: "a", priority: "low" }),
      note({ id: "b", priority: "high", favorite: true }),
    ], noChildren);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.patch.priority).toBe("high");
    expect(r.plan.patch.favorite).toBe(true);
  });

  it("załączniki bez duplikatów po skrócie treści", () => {
    const att = (hash: string) => ({ hash, name: `${hash}.pdf`, size: 1, type: "application/pdf" });
    const r = planMerge([
      note({ id: "a", attachments: [att("x")] }),
      note({ id: "b", attachments: [att("x"), att("y")] }),
    ], noChildren);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.patch.attachments?.map((a) => a.hash)).toEqual(["x", "y"]);
  });

  it("termin: zostaje pierwszej; bez niego — najwcześniejszy z pozostałych wraz z serią", () => {
    const r = planMerge([
      note({ id: "a" }),
      note({ id: "b", reminder: 2000, reminderRepeat: "weekly" }),
      note({ id: "c", reminder: 1000, reminderRepeat: "daily", reminderRepeatUntil: 9000 }),
    ], noChildren);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.patch.reminder).toBe(1000);
    expect(r.plan.patch.reminderRepeat).toBe("daily");
    expect(r.plan.patch.reminderRepeatUntil).toBe(9000);
  });

  it("termin pierwszej notatki wygrywa", () => {
    const r = planMerge([note({ id: "a", reminder: 5000 }), note({ id: "b", reminder: 1000 })], noChildren);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.patch.reminder).toBeUndefined();
  });

  it("folder: pierwszej, a gdy go nie ma — pierwszy z pozostałych", () => {
    const r = planMerge([note({ id: "a" }), note({ id: "b", folderId: "f1" })], noChildren);
    if (!r.ok) throw new Error(r.reason);
    expect(r.plan.patch.folderId).toBe("f1");
  });
});

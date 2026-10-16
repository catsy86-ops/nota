import { describe, expect, it } from "vitest";
import { fullBackupSchema, noteSchema } from "./noteSchema";

const base = { id: "n1", title: "T", content: "", color: "default", pinned: false, archived: false, trashed: false, trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null, order: 0, createdAt: 1, updatedAt: 1 };

describe("kopia — właściwości", () => {
  it("notatka bez pola props dostaje brak wartości", () => {
    const note = noteSchema.parse(base);
    expect(note).not.toHaveProperty("props");
  });

  it("zły wpis w props jest pomijany, notatka zostaje", () => {
    const note = noteSchema.parse({ ...base, props: { k: "Jan", a: Number.NaN, x: { zagnieżdżone: 1 } } });
    expect(note.props).toEqual({ k: "Jan" });
    expect(note.title).toBe("T");
  });

  it("sekcja propDefs jest czyszczona, a uszkodzona nie odrzuca całej kopii", () => {
    const backup = fullBackupSchema.parse({
      version: 3,
      exportedAt: 1,
      notes: [base],
      labels: [],
      folders: [],
      propDefs: [
        { id: "k", name: "Klient", type: "text", order: 0 },
        { id: "bad", name: "", type: "text", order: 1 },
        { id: "s", name: "Status", type: "select", options: ["A", "A", "B"], order: 2 },
      ],
    });
    expect(backup.propDefs?.map((d) => d.id)).toEqual(["k", "s"]);
    expect(backup.propDefs?.[1].options).toEqual(["A", "B"]);
  });

  it("stara kopia bez propDefs nie ma sekcji", () => {
    const backup = fullBackupSchema.parse({ version: 2, exportedAt: 1, notes: [], labels: [], folders: [] });
    expect(backup.propDefs).toBeUndefined();
  });

  it("uszkodzona sekcja propDefs (nie tablica) daje pustą listę, bez odrzucenia pliku", () => {
    const backup = fullBackupSchema.parse({ version: 3, exportedAt: 1, notes: [], labels: [], folders: [], propDefs: "zepsute" });
    expect(backup.propDefs).toEqual([]);
  });
});

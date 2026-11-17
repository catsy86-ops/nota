import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { yjsStore } from "@/lib/yjsStore";
import { commitImportPlan, IMPORT_BATCH, readLastImport, undoImport } from "./commit";
import type { ImportPlan, PlannedNote } from "./plan";

// Z-18.8 audytu 2: sprawdzanie przed zapisem, zapis porcjami, lista do cofnięcia przed pierwszym zapisem.

const planned = (i: number, over: Partial<PlannedNote> = {}): PlannedNote => ({
  origin: "markdown", source: `n${i}.md`, title: `Notatka ${i}`, content: `treść ${i}`, checklist: [], labels: ["import"],
  color: "default", pinned: false, archived: false, trashed: false, createdAt: 1_700_000_000_000 + i, updatedAt: null,
  folderPath: i % 2 ? ["Z importu"] : [], attachments: [], images: [], ...over,
});

const planOf = (notes: PlannedNote[]): ImportPlan => ({
  notes, labels: ["import"], folders: [["Z importu"]], imageCount: 0,
  counts: { keep: 0, markdown: notes.length, duplicates: 0, trashed: 0, empty: 0, failed: 0, ignored: 0 },
  warnings: [], failures: [],
} as ImportPlan);

beforeEach(async () => {
  await yjsStore.ready();
  await yjsStore.resetForTests();
  await yjsStore.ready();
  localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("import porcjami (Z-18.8)", () => {
  it("notatka nr 300 niepoprawna: bez wyjątku, licznik failed, reszta zapisana", async () => {
    const notes = Array.from({ length: 400 }, (_, i) => planned(i, i === 299 ? { title: 5 as never } : {}));
    const result = await commitImportPlan(planOf(notes));
    expect(result.failed).toBe(1);
    expect(result.noteIds).toHaveLength(399);
    expect(yjsStore.projectNotes()).toHaveLength(399);
  });

  it("liczba transakcji nie większa niż liczba porcji", async () => {
    const notes = Array.from({ length: IMPORT_BATCH * 2 + 10 }, (_, i) => planned(i));
    let updates = 0;
    const count = () => { updates++; };
    yjsStore.doc.on("update", count);
    try {
      await commitImportPlan(planOf(notes));
    } finally {
      yjsStore.doc.off("update", count);
    }
    expect(updates).toBeLessThanOrEqual(3);
    expect(yjsStore.projectNotes()).toHaveLength(notes.length);
  });

  it("przerwanie po pierwszej porcji: lista z Ustawień cofa dokładnie to, co zapisano, i nic więcej", async () => {
    const own = { ...planned(9999), title: "Moja" };
    await commitImportPlan(planOf([own]));
    const mine = yjsStore.projectNotes().map((n) => n.id);
    localStorage.clear();

    const notes = Array.from({ length: IMPORT_BATCH + 100 }, (_, i) => planned(i));
    const real = yjsStore.importBatch;
    let calls = 0;
    vi.spyOn(yjsStore, "importBatch").mockImplementation((batch) => {
      if (++calls === 2) throw new Error("karta zamknięta");
      real(batch);
    });
    await expect(commitImportPlan(planOf(notes))).rejects.toThrow("karta zamknięta");
    expect(yjsStore.projectNotes()).toHaveLength(IMPORT_BATCH + 1);

    const last = readLastImport();
    expect(last?.noteIds).toHaveLength(IMPORT_BATCH + 100);
    undoImport(last!);
    expect(yjsStore.projectNotes().map((n) => n.id)).toEqual(mine);
    // Folder „Z importu” powstał przy pierwszym imporcie i używa go „Moja” — zostaje.
    expect(yjsStore.projectFolders().map((f) => f.name)).toEqual(["Z importu"]);
    expect(readLastImport()).toBeNull();
  });

  it("zapis ostatniego importu wygasa po dobie", async () => {
    await commitImportPlan(planOf([planned(1)]));
    const last = readLastImport()!;
    expect(readLastImport(last.at + 23 * 3_600_000)).not.toBeNull();
    expect(readLastImport(last.at + 25 * 3_600_000)).toBeNull();
  });
});

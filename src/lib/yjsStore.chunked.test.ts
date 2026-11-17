import { beforeEach, describe, expect, it } from "vitest";
import { yjsStore } from "@/lib/yjsStore";
import type { Folder, Note } from "@/lib/types/note";

// Z-16.2 (`docs/plan-dane-lokalne.md` §2.2): wymiana notatek porcjami, każdy stan pośredni to nadzbiór.

const note = (id: string, title = id, folderId: string | null = null): Note => ({
  id, title, content: `treść ${id}`, color: "default", pinned: false, archived: false, trashed: false, trashedAt: null,
  labels: ["kopia"], reminder: null, priority: "none", images: [], checklist: [], folderId, order: 0, createdAt: 1, updatedAt: 1,
});
const folder: Folder = { id: "f1", name: "Z kopii", color: "default", emoji: null, parentId: null, order: 0, createdAt: 1, updatedAt: 1 };
const ids = () => yjsStore.projectNotes().map((n) => n.id).sort();

beforeEach(async () => {
  await yjsStore.ready();
  await yjsStore.resetForTests();
  await yjsStore.ready();
});

describe("replaceAllChunked (Z-16.2)", () => {
  it("wynik końcowy jak replaceAll: te same notatki, foldery, etykiety", async () => {
    const backup = Array.from({ length: 60 }, (_, i) => note(`k${i}`, `Kopia ${i}`, i % 2 ? "f1" : null));
    yjsStore.upsertNote(note("stara"));
    yjsStore.addLabel("stara-etykieta");
    let calls = 0;
    await yjsStore.replaceAllChunked(backup, [folder], ["kopia"], [], { budgetMs: 0, onProgress: () => { calls++; } });
    const chunked = { notes: yjsStore.projectNotes().map((n) => [n.id, n.title, n.folderId]).sort(), folders: yjsStore.projectFolders(), labels: yjsStore.projectLabels() };
    expect(calls).toBeGreaterThan(1);

    await yjsStore.resetForTests();
    await yjsStore.ready();
    yjsStore.upsertNote(note("stara"));
    yjsStore.replaceAll(backup, [folder], ["kopia"], []);
    expect(chunked).toEqual({ notes: yjsStore.projectNotes().map((n) => [n.id, n.title, n.folderId]).sort(), folders: yjsStore.projectFolders(), labels: yjsStore.projectLabels() });
  });

  it("przerwanie po kilku porcjach: nadzbiór, nic nie usunięte; ponowny import kończy wymianę", async () => {
    yjsStore.upsertNote(note("stara"));
    const backup = Array.from({ length: 40 }, (_, i) => note(`k${i}`));
    const ctrl = new AbortController();
    await expect(yjsStore.replaceAllChunked(backup, [], ["kopia"], [], {
      budgetMs: 0, signal: ctrl.signal, onProgress: (done) => { if (done >= 5) ctrl.abort(); },
    })).rejects.toThrow("Przerwano");
    const mid = ids();
    expect(mid).toContain("stara");
    expect(mid.length).toBeGreaterThan(1);
    expect(mid.length).toBeLessThan(41);

    await yjsStore.replaceAllChunked(backup, [], ["kopia"], [], { budgetMs: 0 });
    expect(ids()).toEqual(backup.map((n) => n.id).sort());
  });

  it("notatka dodana w trakcie wymiany zostaje", async () => {
    yjsStore.upsertNote(note("stara"));
    const backup = Array.from({ length: 20 }, (_, i) => note(`k${i}`));
    let added = false;
    await yjsStore.replaceAllChunked(backup, [], [], [], {
      budgetMs: 0,
      onProgress: () => { if (!added) { added = true; yjsStore.upsertNote(note("w-trakcie")); } },
    });
    expect(ids()).toEqual([...backup.map((n) => n.id), "w-trakcie"].sort());
  });

  it("`final` wykonuje się w transakcji końcowej, razem z usunięciem starych notatek", async () => {
    yjsStore.upsertNote(note("stara"));
    let seenOld: boolean | null = null;
    await yjsStore.replaceAllChunked([note("k1")], [], [], [], {
      final: () => { seenOld = yjsStore.notesMap.has("stara"); },
    });
    expect(seenOld).toBe(true);
    expect(ids()).toEqual(["k1"]);
  });
});

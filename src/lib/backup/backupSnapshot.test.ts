import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildFullBackup } from "@/lib/backup/build";
import { FULL_BACKUP_KEYS } from "@/lib/noteSchema";
import { yjsStore } from "@/lib/yjsStore";
import { versionsStore } from "@/lib/versionsStore";
import { clearAllStorage } from "@/lib/notesStore";
import { setDayShift } from "@/lib/shifts/store";
import { addSupplement } from "@/lib/supplements/store";
import type { Note } from "@/lib/types/note";

/** A3.1: migawka pełnej kopii z danych wzorcowych — podział `exportNotes.ts` nie może zmienić formatu. */
function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "n1", title: "T", content: "C", color: "default", pinned: false, archived: false, trashed: false,
    trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
    order: 0, createdAt: 0, updatedAt: 0, ...overrides,
  };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-25T10:00:00Z"));
  localStorage.clear();
  await clearAllStorage();
  await yjsStore.resetForTests();
  versionsStore.replaceAll([]);
});

afterEach(() => vi.useRealTimers());

describe("migawka pełnej kopii (A3.1)", () => {
  it("kopia z danych wzorcowych ma niezmienny kształt", async () => {
    yjsStore.upsertNote(makeNote({ id: "a", title: "Pierwsza", content: "Treść ąęś", labels: ["praca"] }));
    yjsStore.upsertNote(makeNote({ id: "b", title: "Lista", checklist: [{ id: "c1", text: "mleko", checked: true }], order: 1 }));
    localStorage.setItem("kaczy:review.day", "5");
    setDayShift("2026-10-01", "d");
    addSupplement({ name: "D3", when: "rano" } as never);
    const backup = await buildFullBackup();
    // Identyfikatory losowe (np. odżywek) zastąpione stałym znakiem — porównujemy kształt i treść.
    const text = JSON.stringify(backup, null, 2).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>");
    await expect(text).toMatchFileSnapshot("./__snapshots__/fullBackup.json");
  });

  it("każda sekcja eksportu jest w schemacie wczytywania — inaczej przywracanie gubi ją po cichu (Z-18.2, `weight`)", async () => {
    const backup = await buildFullBackup();
    expect(Object.keys(backup).filter((k) => !FULL_BACKUP_KEYS.includes(k))).toEqual([]);
    expect(backup.sections).toEqual(Object.keys(backup).filter((k) => k !== "sections"));
  });
});

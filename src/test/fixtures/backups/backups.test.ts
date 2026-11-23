import { beforeEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildFullBackup, MAX_BACKUP_VERSION, parseFullBackup, restoreFullBackup } from "@/lib/exportNotes";
import { yjsStore } from "@/lib/yjsStore";
import { versionsStore } from "@/lib/versionsStore";
import { clearAllStorage } from "@/lib/notesStore";
import { setDayShift, shiftStore } from "@/lib/shifts/store";
import type { Note } from "@/lib/types/note";

/**
 * D3.5: wzorce kopii JSON w każdej wersji koperty (1–3) wczytywane bieżącym kodem. Dane syntetyczne.
 * v3 powstaje z bieżącego kodu (`GEN_BACKUP_FIXTURE=1 npx vitest run src/test/fixtures/backups`), v2 i v1 to ta sama
 * kopia bez sekcji, których dana wersja nie miała (v1: notatki, etykiety, foldery; v2: + historia, ustawienia, Grafik,
 * Nauka). Podniesienie `MAX_BACKUP_VERSION` dokłada wzorzec w tym samym commicie.
 */
const DIR = resolve(process.cwd(), "src/test/fixtures/backups");
const file = (v: number) => resolve(DIR, `v${v}.json`);
const V2_SECTIONS = ["version", "exportedAt", "notes", "labels", "folders", "versions", "settings", "achievements", "shifts", "study"];
const V1_SECTIONS = ["version", "exportedAt", "notes", "labels", "folders"];
const T = Date.UTC(2026, 10, 1, 12);

const note = (id: string, over: Partial<Note> = {}): Note => ({
  id, title: `Notatka ${id}`, content: `Treść ${id}`, color: "default", pinned: false, archived: false, trashed: false,
  trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
  order: 0, createdAt: T, updatedAt: T, ...over,
});

const ALL = { versions: true, settings: true, achievements: true, shifts: true, study: true };

beforeEach(async () => {
  localStorage.clear();
  await clearAllStorage();
  await yjsStore.resetForTests();
  versionsStore.replaceAll([]);
});

it.runIf(process.env.GEN_BACKUP_FIXTURE)("generator wzorców kopii", async () => {
  yjsStore.upsertFolder({ id: "f1", name: "Dom", color: "default", emoji: null, parentId: null, order: 0, createdAt: T, updatedAt: T });
  yjsStore.addLabel("pilne");
  yjsStore.upsertNote(note("k1", { pinned: true, labels: ["pilne"], folderId: "f1" }));
  yjsStore.upsertNote(note("k2", { checklist: [{ id: "c1", text: "rury", checked: true }], archived: true }));
  setDayShift("2026-11-01", "d");
  const full = { ...(await buildFullBackup()), exportedAt: T };
  const pick = (keys: string[], version: number) =>
    Object.fromEntries([...Object.entries(full).filter(([k]) => keys.includes(k)), ["version", version]]);
  writeFileSync(file(3), JSON.stringify({ ...full, version: 3 }, null, 2) + "\n");
  writeFileSync(file(2), JSON.stringify(pick(V2_SECTIONS, 2), null, 2) + "\n");
  writeFileSync(file(1), JSON.stringify(pick(V1_SECTIONS, 1), null, 2) + "\n");
});

describe("wzorce kopii (D3.5)", () => {
  it("każda wersja koperty do bieżącej ma wzorzec", () => {
    for (let v = 1; v <= MAX_BACKUP_VERSION; v++) expect(existsSync(file(v)), `v${v}.json`).toBe(true);
  });

  it.each([1, 2, 3])("v%i: wczytanie i przywrócenie bez utraty notatek, folderów i etykiet", async (v) => {
    const backup = await parseFullBackup(readFileSync(file(v), "utf8"));
    expect(backup.version).toBe(v);
    expect((await restoreFullBackup(backup, ALL)).failed).toEqual([]);
    const notes = Object.fromEntries(yjsStore.projectNotes().map((n) => [n.id, n]));
    expect(Object.keys(notes).sort()).toEqual(["k1", "k2"]);
    expect(notes.k1).toMatchObject({ pinned: true, labels: ["pilne"], folderId: "f1" });
    expect(notes.k2).toMatchObject({ archived: true, checklist: [{ id: "c1", text: "rury", checked: true }] });
    expect(yjsStore.projectFolders().map((f) => f.id)).toEqual(["f1"]);
    expect(yjsStore.projectLabels()).toContain("pilne");
    // Grafik jest w kopii od v2 — v1 go nie rusza.
    if (v >= 2) expect(shiftStore.get().days["2026-11-01"]?.type).toBe("d");
    else expect(shiftStore.get().days["2026-11-01"]).toBeUndefined();
  });
});

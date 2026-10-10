import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildFullBackup, buildFullBackupWithReport, describeSkippedAttachments, parseFullBackup, restoreFullBackup, SETTINGS_KEYS, ACHIEVEMENTS_KEY } from "./exportNotes";
import { setDayShift, shiftStore } from "./shifts/store";
import { yjsStore } from "./yjsStore";
import { versionsStore } from "./versionsStore";
import { clearAllStorage } from "./notesStore";
import { imageStore } from "./imageStore";
import type { Note } from "@/hooks/useNotes";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "n1", title: "T", content: "C", color: "default", pinned: false, archived: false, trashed: false,
    trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
    order: 0, createdAt: 0, updatedAt: 0, ...overrides,
  };
}

const ALL = { versions: true, settings: true, achievements: true, shifts: true };

beforeEach(async () => {
  localStorage.clear();
  await clearAllStorage();
  await yjsStore.resetForTests();
  versionsStore.replaceAll([]);
});

describe("pełny backup v2", () => {
  it("niesie i przywraca Grafik zmian", async () => {
    setDayShift("2026-10-01", "d");
    const backup = await parseFullBackup(JSON.stringify(await buildFullBackup()));
    expect(JSON.parse(backup.shifts!).days).toEqual({ "2026-10-01": { type: "d" } });

    setDayShift("2026-10-01", "n");
    await restoreFullBackup(backup, { ...ALL, shifts: false });
    expect(shiftStore.get().days["2026-10-01"].type).toBe("n");
    await restoreFullBackup(backup, ALL);
    expect(shiftStore.get().days["2026-10-01"].type).toBe("d");
  });

  it("carries versions, settings and achievements — but never the pairing code", async () => {
    yjsStore.upsertNote(makeNote());
    versionsStore.add("n1", "stara wersja", "…");
    localStorage.setItem("kaczy.viewPrefs.v1", JSON.stringify({ layout: "list" }));
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify({ streak: 7 }));
    localStorage.setItem("kaczy.sync.v1", JSON.stringify({ code: "TAJNYKOD" }));

    const text = JSON.stringify(await buildFullBackup());
    expect(text).not.toContain("TAJNYKOD");
    const backup = await parseFullBackup(text);
    expect(backup.version).toBe(3);
    expect(backup.versions?.map((v) => v.title)).toEqual(["stara wersja"]);
    expect(backup.settings?.["kaczy.viewPrefs.v1"]).toContain("list");
    expect(backup.achievements).toContain("7");
  });

  it("restores only the chosen sections", async () => {
    versionsStore.add("n1", "z pliku", "");
    localStorage.setItem("kaczy-theme", "dark");
    localStorage.setItem(ACHIEVEMENTS_KEY, "odznaki-z-pliku");
    const backup = await parseFullBackup(JSON.stringify(await buildFullBackup()));

    versionsStore.replaceAll([]);
    localStorage.setItem("kaczy-theme", "light");
    localStorage.setItem(ACHIEVEMENTS_KEY, "lokalne");
    await restoreFullBackup(backup, { versions: true, settings: true, achievements: false, shifts: false });

    expect(versionsStore.get("n1").map((v) => v.title)).toEqual(["z pliku"]);
    expect(localStorage.getItem("kaczy-theme")).toBe("dark");
    expect(localStorage.getItem(ACHIEVEMENTS_KEY)).toBe("lokalne");
  });

  it("reads a v1 file and leaves missing sections untouched", async () => {
    versionsStore.add("x", "lokalna", "");
    localStorage.setItem("kaczy-theme", "light");
    const v1 = { version: 1, exportedAt: 1, notes: [makeNote({ id: "old" })], labels: [], folders: [] };
    const backup = await parseFullBackup(JSON.stringify(v1));
    await restoreFullBackup(backup, ALL);
    expect(yjsStore.projectNotes().map((n) => n.id)).toEqual(["old"]);
    expect(versionsStore.get("x")).toHaveLength(1);
    expect(localStorage.getItem("kaczy-theme")).toBe("light");
  });

  it("ignores unknown setting keys smuggled into the file", async () => {
    const backup = await parseFullBackup(JSON.stringify({
      version: 2, exportedAt: 1, notes: [], labels: [], folders: [],
      settings: { "kaczy.sync.v1": "podmieniony", [SETTINGS_KEYS[0]]: "{}" },
    }));
    await restoreFullBackup(backup, ALL);
    expect(localStorage.getItem("kaczy.sync.v1")).toBeNull();
    expect(localStorage.getItem(SETTINGS_KEYS[0])).toBe("{}");
  });

  it("drops a corrupted optional section instead of rejecting the file", async () => {
    const backup = await parseFullBackup(JSON.stringify({ version: 2, exportedAt: 1, notes: [], labels: [], folders: [], versions: "zepsute" }));
    expect(backup.versions).toBeUndefined();
  });
});

describe("pełny backup — obrazy", () => {
  const IMG = "data:image/png;base64,AAAA";

  it("embeds image bytes in the file and restores them into the store on another device", async () => {
    const ref = await imageStore.putDataUrl(IMG);
    yjsStore.upsertNote(makeNote({ images: [ref] }));
    const text = JSON.stringify(await buildFullBackup());
    expect(text).toContain(IMG);

    await imageStore.resetForTests(); // „inne urządzenie”: obrazu jeszcze nie ma
    await restoreFullBackup(await parseFullBackup(text), ALL);
    expect(yjsStore.projectNotes()[0].images).toEqual([ref]);
    expect(await imageStore.getDataUrl(ref)).toBe(IMG);
  });

  it("keeps the current notes when the images cannot be saved", async () => {
    yjsStore.upsertNote(makeNote({ id: "local" }));
    const backup = await parseFullBackup(JSON.stringify({ version: 2, exportedAt: 1, notes: [makeNote({ id: "z-pliku", images: [IMG] })], labels: [], folders: [] }));
    const spy = vi.spyOn(imageStore, "ingest").mockRejectedValue(new Error("QuotaExceededError"));
    await expect(restoreFullBackup(backup, ALL)).rejects.toThrow();
    spy.mockRestore();
    expect(yjsStore.projectNotes().map((n) => n.id)).toEqual(["local"]);
  });
});

describe("pełny backup v3 — załączniki", () => {
  async function addFile(name: string, text: string, type = "text/plain") {
    const bytes = new TextEncoder().encode(text);
    const hash = await imageStore.putBytes(bytes, type);
    return { hash, name, size: bytes.length, type };
  }

  it("embeds attachment bytes once and restores them on another device", async () => {
    const att = await addFile("notatki.txt", "treść pliku");
    yjsStore.upsertNote(makeNote({ id: "a", attachments: [att] }));
    yjsStore.upsertNote(makeNote({ id: "b", attachments: [att] }));
    const { backup, attachments } = await buildFullBackupWithReport();
    expect(backup.version).toBe(3);
    expect(Object.keys(backup.attachmentBlobs ?? {})).toEqual([att.hash]);
    expect(describeSkippedAttachments(attachments)).toBeNull();

    const text = JSON.stringify(backup);
    await imageStore.resetForTests();
    await restoreFullBackup(await parseFullBackup(text), ALL);
    expect(imageStore.has(att.hash)).toBe(true);
    const note = yjsStore.projectNotes().find((n) => n.id === "a")!;
    expect(note.attachments).toEqual([att]);
  });

  it("reads a v2 file without attachments (notes get no manifest)", async () => {
    const v2 = { version: 2, exportedAt: 1, notes: [makeNote({ id: "old" })], labels: [], folders: [] };
    const backup = await parseFullBackup(JSON.stringify(v2));
    expect(backup.attachmentBlobs).toBeUndefined();
    expect(backup.notes[0].attachments).toBeUndefined();
    await restoreFullBackup(backup, ALL);
    expect(yjsStore.projectNotes()[0].attachments).toBeUndefined();
  });

  it("drops malformed manifest entries instead of rejecting the note", async () => {
    const raw = { version: 3, exportedAt: 1, labels: [], folders: [], notes: [{
      ...makeNote({ id: "x" }),
      attachments: [{ hash: "nie-hash", name: "a", size: 1, type: "" }, { hash: "c".repeat(64), name: "plik.txt", size: 5, type: "text/plain" }, 7],
    }] };
    const backup = await parseFullBackup(JSON.stringify(raw));
    expect(backup.notes[0].attachments).toEqual([{ hash: "c".repeat(64), name: "plik.txt", size: 5, type: "text/plain" }]);
  });

  it("reports attachments whose bytes are not on this device", async () => {
    yjsStore.upsertNote(makeNote({ id: "m", attachments: [{ hash: "d".repeat(64), name: "obcy.pdf", size: 10, type: "application/pdf" }] }));
    const { attachments } = await buildFullBackupWithReport();
    expect(attachments.missing.map((a) => a.name)).toEqual(["obcy.pdf"]);
    expect(describeSkippedAttachments(attachments)).toContain("nieobecne");
  });
});

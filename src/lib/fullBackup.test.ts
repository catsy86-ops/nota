import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildFullBackup, parseFullBackup, restoreFullBackup, SETTINGS_KEYS, ACHIEVEMENTS_KEY } from "./exportNotes";
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

const ALL = { versions: true, settings: true, achievements: true };

beforeEach(async () => {
  localStorage.clear();
  await clearAllStorage();
  await yjsStore.resetForTests();
  versionsStore.replaceAll([]);
});

describe("pełny backup v2", () => {
  it("carries versions, settings and achievements — but never the pairing code", async () => {
    yjsStore.upsertNote(makeNote());
    versionsStore.add("n1", "stara wersja", "…");
    localStorage.setItem("kaczy.viewPrefs.v1", JSON.stringify({ layout: "list" }));
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify({ streak: 7 }));
    localStorage.setItem("kaczy.sync.v1", JSON.stringify({ code: "TAJNYKOD" }));

    const text = JSON.stringify(await buildFullBackup());
    expect(text).not.toContain("TAJNYKOD");
    const backup = parseFullBackup(text);
    expect(backup.version).toBe(2);
    expect(backup.versions?.map((v) => v.title)).toEqual(["stara wersja"]);
    expect(backup.settings?.["kaczy.viewPrefs.v1"]).toContain("list");
    expect(backup.achievements).toContain("7");
  });

  it("restores only the chosen sections", async () => {
    versionsStore.add("n1", "z pliku", "");
    localStorage.setItem("kaczy-theme", "dark");
    localStorage.setItem(ACHIEVEMENTS_KEY, "odznaki-z-pliku");
    const backup = parseFullBackup(JSON.stringify(await buildFullBackup()));

    versionsStore.replaceAll([]);
    localStorage.setItem("kaczy-theme", "light");
    localStorage.setItem(ACHIEVEMENTS_KEY, "lokalne");
    await restoreFullBackup(backup, { versions: true, settings: true, achievements: false });

    expect(versionsStore.get("n1").map((v) => v.title)).toEqual(["z pliku"]);
    expect(localStorage.getItem("kaczy-theme")).toBe("dark");
    expect(localStorage.getItem(ACHIEVEMENTS_KEY)).toBe("lokalne");
  });

  it("reads a v1 file and leaves missing sections untouched", async () => {
    versionsStore.add("x", "lokalna", "");
    localStorage.setItem("kaczy-theme", "light");
    const v1 = { version: 1, exportedAt: 1, notes: [makeNote({ id: "old" })], labels: [], folders: [] };
    const backup = parseFullBackup(JSON.stringify(v1));
    await restoreFullBackup(backup, ALL);
    expect(yjsStore.projectNotes().map((n) => n.id)).toEqual(["old"]);
    expect(versionsStore.get("x")).toHaveLength(1);
    expect(localStorage.getItem("kaczy-theme")).toBe("light");
  });

  it("ignores unknown setting keys smuggled into the file", async () => {
    const backup = parseFullBackup(JSON.stringify({
      version: 2, exportedAt: 1, notes: [], labels: [], folders: [],
      settings: { "kaczy.sync.v1": "podmieniony", [SETTINGS_KEYS[0]]: "{}" },
    }));
    await restoreFullBackup(backup, ALL);
    expect(localStorage.getItem("kaczy.sync.v1")).toBeNull();
    expect(localStorage.getItem(SETTINGS_KEYS[0])).toBe("{}");
  });

  it("drops a corrupted optional section instead of rejecting the file", () => {
    const backup = parseFullBackup(JSON.stringify({ version: 2, exportedAt: 1, notes: [], labels: [], folders: [], versions: "zepsute" }));
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
    await restoreFullBackup(parseFullBackup(text), ALL);
    expect(yjsStore.projectNotes()[0].images).toEqual([ref]);
    expect(await imageStore.getDataUrl(ref)).toBe(IMG);
  });

  it("keeps the current notes when the images cannot be saved", async () => {
    yjsStore.upsertNote(makeNote({ id: "local" }));
    const backup = parseFullBackup(JSON.stringify({ version: 2, exportedAt: 1, notes: [makeNote({ id: "z-pliku", images: [IMG] })], labels: [], folders: [] }));
    const spy = vi.spyOn(imageStore, "ingest").mockRejectedValue(new Error("QuotaExceededError"));
    await expect(restoreFullBackup(backup, ALL)).rejects.toThrow();
    spy.mockRestore();
    expect(yjsStore.projectNotes().map((n) => n.id)).toEqual(["local"]);
  });
});

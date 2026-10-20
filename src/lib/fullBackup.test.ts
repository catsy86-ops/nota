import { describe, it, expect, beforeEach, vi } from "vitest";
import { describeBackupSkipped } from "./backupSkipped";
import { buildFullBackup, buildFullBackupWithReport, describeSkippedAttachments, parseFullBackup, restoreFullBackup, SETTINGS_KEYS, ACHIEVEMENTS_KEY } from "./exportNotes";
import { setDayShift, shiftStore } from "./shifts/store";
import { yjsStore } from "./yjsStore";
import { versionsStore } from "./versionsStore";
import { clearAllStorage } from "./notesStore";
import { imageStore } from "./imageStore";
import { yStudy } from "./study/data";
import { addSupplement, removeSupplement, setSupplementTaken, supplementDump } from "./supplements/store";
import { addMeal, dietDump, removeMeal, setDietGoals } from "./diet/store";
import { cleanDump } from "./study/yStudy";
import type { Note } from "@/hooks/useNotes";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "n1", title: "T", content: "C", color: "default", pinned: false, archived: false, trashed: false,
    trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
    order: 0, createdAt: 0, updatedAt: 0, ...overrides,
  };
}

const ALL = { versions: true, settings: true, achievements: true, shifts: true, study: true };

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
    await restoreFullBackup(backup, { versions: true, settings: true, achievements: false, shifts: false, study: false });

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

  it("reports journal photos left out of the backup instead of dropping them silently", async () => {
    yStudy.addEntry({ id: "j", at: 1, kind: "ok", topic: null, text: "x", site: "", checked: [], images: ["e".repeat(64)] });
    const { attachments } = await buildFullBackupWithReport();
    expect(attachments.journalPhotos).toBe(1);
    expect(describeSkippedAttachments(attachments)).toContain("zdjęcia dziennika");
  });

  it("przy przekroczonym budżecie liczy załączniki, zdjęcia dziennika i pliki budów osobno", async () => {
    const att = await addFile("duzy.txt", "0123456789");
    yjsStore.upsertNote(makeNote({ id: "z", attachments: [att] }));
    const photo = await imageStore.putDataUrl("data:image/png;base64,AAAA");
    yStudy.addEntry({ id: "j2", at: 1, kind: "ok", topic: null, text: "x", site: "", checked: [], images: [photo] });
    const plan = await imageStore.putDataUrl("data:image/png;base64,BBBB");
    yStudy.setSiteList("budowa-1", "docs", [{ id: plan, name: "rzut.png", size: 4, type: "image/png", at: 1 }], []);

    // Budżet 0: nic nie wchodzi; każdy pominięty bajt trafia do swojej kategorii.
    const { backup, attachments } = await buildFullBackupWithReport({ attachmentBudget: 0 });
    expect(attachments.tooLarge.map((a) => a.name)).toEqual(["duzy.txt"]);
    expect(attachments.journalPhotos).toBe(1);
    expect(attachments.siteDocs).toBe(1);
    // Ten sam raport trafia do pliku jako liczby, żeby okno przywracania mogło powiedzieć, czego w nim nie ma.
    expect(backup.skipped).toEqual({ tooLarge: 1, missing: 0, journalPhotos: 1, siteDocs: 1, recordings: 0 });
    expect(describeBackupSkipped(backup.skipped)).toBe(
      "Ten plik nie zawiera: załączniki za duże na backup: 1, zdjęcia dziennika z budowy: 1, pliki budów (plany, PDF): 1. " +
      "Zdjęcia dziennika i pliki budów zostały tylko na tamtym urządzeniu.",
    );
    expect(describeSkippedAttachments(attachments)).toBe(
      "Pominięte załączniki: 1 za duże na backup (limit 40 MB na wszystkie pliki). Zostaną w notatkach jako wpisy bez zawartości. " +
      "Pominięte zdjęcia dziennika z budowy: 1 — zostaną tylko na tym urządzeniu. " +
      "Pominięte pliki budów (plany, PDF): 1 — zostaną tylko na tym urządzeniu.",
    );
  });

  it("bez przekroczenia budżetu pliki budów wchodzą do kopii i nie są raportowane", async () => {
    const plan = await imageStore.putDataUrl("data:image/png;base64,CCCC");
    yStudy.setSiteList("budowa-2", "docs", [{ id: plan, name: "plan.png", size: 4, type: "image/png", at: 1 }], []);
    const { backup, attachments } = await buildFullBackupWithReport();
    expect(Object.keys(backup.attachmentBlobs ?? {})).toContain(plan);
    expect(attachments.siteDocs).toBe(0);
    expect(describeSkippedAttachments(attachments)).toBeNull();
    expect(backup.skipped).toEqual({ tooLarge: 0, missing: 0, journalPhotos: 0, siteDocs: 0, recordings: 0 });
    expect(describeBackupSkipped(backup.skipped)).toBeNull();
  });
});

describe("Nauka w pełnej kopii", () => {
  const entry = { id: "j1", at: 5, kind: "problem" as const, topic: "spadki", text: "Za mały spadek", site: "Leśna 4", checked: [], images: [] };

  it("niesie dziennik w sekcji study i w dawnym kształcie wśród ustawień; przywraca do Yjs", async () => {
    yStudy.addEntry(entry);
    yStudy.recordRound("dev-a", 80, "2026-10-14", [], []);
    yStudy.setSite("Leśna 4");
    const backup = await parseFullBackup(JSON.stringify(await buildFullBackup()));
    expect(cleanDump(JSON.parse(backup.study!)).journal).toEqual([entry]);
    expect(JSON.parse(backup.settings!["kaczy.study.v1"])).toMatchObject({ rounds: 1, bestPercent: 80, lastDay: "2026-10-14", streak: 1 });

    yStudy.removeEntry("j1");
    await restoreFullBackup(backup, { ...ALL, study: false });
    expect(yStudy.get().journal).toEqual([]);
    await restoreFullBackup(backup, ALL);
    expect(yStudy.get()).toMatchObject({ journal: [entry], rounds: 1, site: "Leśna 4" });
    expect(localStorage.getItem("kaczy.study.v1")).toBeNull();
  });

  it("wpis Nauki o nieznanym rodzaju odpada przy przywracaniu, a liczba odrzuconych wraca do UI", async () => {
    const bad = { ...entry, id: "bad", kind: "nieznany" };
    const old = { version: 3, exportedAt: 1, notes: [], labels: [], folders: [], study: JSON.stringify({ journal: [entry, bad] }) };
    const { studyDropped } = await restoreFullBackup(await parseFullBackup(JSON.stringify(old)), ALL);
    expect(studyDropped).toBe(1);
    expect(yStudy.get().journal).toEqual([entry]);
  });

  it("odżywki i odhaczenia wracają z kopii, a przywracanie nie kasuje tego, co dodano później", async () => {
    const s = addSupplement({ name: "Kreatyna", dose: "1 łyżka", when: "rano" });
    expect(s).not.toBeNull();
    setSupplementTaken(s!.id, true, "2026-10-20");
    const backup = await parseFullBackup(JSON.stringify(await buildFullBackup()));
    expect(JSON.parse(backup.supplements!).list.map((x: { name: string }) => x.name)).toEqual(["Kreatyna"]);

    removeSupplement(s!.id);
    expect(supplementDump().list).toEqual([]);
    await restoreFullBackup(backup, ALL);
    expect(supplementDump()).toMatchObject({ list: [{ name: "Kreatyna" }], taken: ["2026-10-20|" + s!.id] });

    // Odżywka dodana po kopii zostaje, gdy kopia ją przywraca (scalanie, nie zastępowanie).
    addSupplement({ name: "Omega", when: "wieczorem" });
    await restoreFullBackup(backup, ALL);
    expect(supplementDump().list.map((x) => x.name).sort()).toEqual(["Kreatyna", "Omega"]);
  });

  it("dieta: posiłki i cele wracają z kopii; przywracanie scala i nie kasuje", async () => {
    const m = addMeal({ text: "Owsianka", time: "08:00", kcal: 400, protein: 14, day: "2026-10-20" });
    expect(m).not.toBeNull();
    setDietGoals({ kcal: 2400 });
    const backup = await parseFullBackup(JSON.stringify(await buildFullBackup()));
    expect(JSON.parse(backup.diet!).meals.map((x: { text: string }) => x.text)).toEqual(["Owsianka"]);

    removeMeal(m!.id);
    expect(dietDump().meals).toEqual([]);
    await restoreFullBackup(backup, ALL);
    expect(dietDump()).toMatchObject({ meals: [{ text: "Owsianka", kcal: 400 }], goals: { kcal: 2400 } });

    addMeal({ text: "Kolacja", day: "2026-10-20" });
    await restoreFullBackup(backup, ALL);
    expect(dietDump().meals.map((x) => x.text).sort()).toEqual(["Kolacja", "Owsianka"]);
  });

  it("czyta starą kopię, w której Nauka była tylko wśród ustawień", async () => {
    const legacy = { journal: [entry], rounds: 3, bestPercent: 90, streak: 2, lastDay: "2026-10-12", board: { spadki: "doing" } };
    const old = { version: 3, exportedAt: 1, notes: [], labels: [], folders: [], settings: { "kaczy.study.v1": JSON.stringify(legacy) } };
    await restoreFullBackup(await parseFullBackup(JSON.stringify(old)), ALL);
    expect(yStudy.get()).toMatchObject({ journal: [entry], rounds: 3, bestPercent: 90, streak: 2, lastDay: "2026-10-12", board: { spadki: "doing" } });
  });
});

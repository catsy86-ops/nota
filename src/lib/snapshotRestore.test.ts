import { beforeEach, describe, expect, it } from "vitest";
import { createYjsStore, readDocState } from "@/lib/yjsStore";
import { createPrivateNotes } from "@/lib/privateNotes";
import { createVersionsStore } from "@/lib/versionsStore";
import { vaultDiffers, compareSnapshot, restoreSnapshotCopies, restoredFolderName, type RestoreDeps } from "@/lib/snapshotRestore";
import type { Note } from "@/lib/types/note";

// Z-16.1B (`docs/plan-dane-lokalne.md` §1.5): przywracanie z kopii dziennej jako kopie notatek.

const IT = 1000;
const PW = "hasło-do-testów-12345";
const DAY = new Date(2026, 10, 12, 7, 40).getTime();

const note = (id: string, over: Partial<Note> = {}): Note => ({
  id, title: `Tytuł ${id}`, content: `Treść ${id}`, color: "default", pinned: false, archived: false, trashed: false,
  trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
  order: 0, createdAt: 1_000, updatedAt: 1_000, ...over,
});

function fresh() {
  const store = createYjsStore(`snap-restore-${crypto.randomUUID()}`);
  const pn = createPrivateNotes(store, { iterations: IT, minIterations: IT, writeDelayMs: 5, versions: createVersionsStore(`snap.versions.${crypto.randomUUID()}.`) });
  let n = 0;
  const deps: RestoreDeps = {
    store, reencryptCopy: pn.reencryptCopy, adoptCopy: pn.adoptCopy, copySession: pn.copySession,
    newId: () => `nowy-${++n}`, now: () => 5_000, lock: (fn) => fn(),
  };
  return { store, pn, deps };
}

beforeEach(() => { localStorage.clear(); });

describe("compareSnapshot", () => {
  it("trzy grupy: usunięte od tamtej pory, zmienione, bez zmian", () => {
    const { store } = fresh();
    store.upsertNote(note("a"));
    store.upsertNote(note("b"));
    store.upsertNote(note("c"));
    const snap = readDocState(store.encodeSyncState());
    store.removeNote("a");
    store.patchNote("b", { title: "Nowy tytuł" });
    store.upsertNote(note("d")); // nowa od tamtej pory — nie ma jej w kopii, nie dotyczy
    const cmp = compareSnapshot(snap, store.projectNotes(), store.getVaultMeta(), false);
    expect(cmp.deleted.map((i) => i.note.id)).toEqual(["a"]);
    expect(cmp.changed.map((i) => [i.note.id, i.note.title, i.current?.title])).toEqual([["b", "Tytuł b", "Nowy tytuł"]]);
    expect(cmp.unchanged.map((i) => i.note.id)).toEqual(["c"]);
    expect(cmp.deleted[0].privacy).toBe("plain");
  });

  it("uszkodzona kopia rzuca przy odczycie", () => {
    expect(() => readDocState(new Uint8Array([1, 2, 3, 4, 5]))).toThrow();
  });
});

describe("restoreSnapshotCopies", () => {
  it("usunięta notatka wraca jako kopia z nowym id w folderze „Przywrócone DD.MM”; oryginały nietknięte", async () => {
    const { store, deps } = fresh();
    store.upsertNote(note("a", { labels: ["praca"], color: "sky", pinned: true, reminder: 9_999, parentId: "p" }));
    store.upsertNote(note("b"));
    const snap = readDocState(store.encodeSyncState());
    store.removeNote("a");
    store.removeLabelEverywhere("praca");
    store.patchNote("b", { content: "Dzisiejsza treść" });
    const cmp = compareSnapshot(snap, store.projectNotes(), undefined, false);

    const r = await restoreSnapshotCopies([...cmp.deleted, ...cmp.changed], snap, DAY, deps);
    expect(r).toMatchObject({ restored: 2, skipped: [] });
    const folder = store.projectFolders().find((f) => f.id === r.folderId);
    expect(folder?.name).toBe("Przywrócone 12.11");
    expect(restoredFolderName(DAY)).toBe("Przywrócone 12.11");

    const notes = store.projectNotes();
    const copyA = notes.find((n) => n.title === "Tytuł a")!;
    expect(copyA.id).not.toBe("a");
    expect(copyA).toMatchObject({ folderId: r.folderId, labels: ["praca"], color: "sky", pinned: false, reminder: null, content: "Treść a" });
    expect(copyA.parentId).toBeUndefined();
    expect(store.projectLabels()).toContain("praca");
    // „b” nadal ma dzisiejszą treść, obok kopia z treścią z kopii dziennej.
    expect(notes.find((n) => n.id === "b")?.content).toBe("Dzisiejsza treść");
    expect(notes.filter((n) => n.title === "Tytuł b").map((n) => n.content).sort()).toEqual(["Dzisiejsza treść", "Treść b"]);
  });

  it("kopia bez aliasów, gwiazdki i reguł przypomnienia oryginału", async () => {
    const { store, deps } = fresh();
    store.upsertNote(note("a", {
      aliases: ["Alias"], favorite: true, reminderRepeat: "daily", reminderRule: { kind: "weekdays" } as Note["reminderRule"],
      reminderRepeatUntil: 9, reminderBase: 9, snoozedUntil: 9,
    }));
    const snap = readDocState(store.encodeSyncState());
    store.removeNote("a");
    await restoreSnapshotCopies(compareSnapshot(snap, store.projectNotes(), undefined, false).deleted, snap, DAY, deps);
    const copy = store.projectNotes().find((n) => n.title === "Tytuł a")!;
    for (const k of ["aliases", "favorite", "reminderRepeat", "reminderRule", "reminderRepeatUntil", "reminderBase", "snoozedUntil"] as const) {
      expect(copy[k] ?? undefined, k).toBeUndefined();
    }
  });

  it("drugie przywracanie z tego samego dnia trafia do tego samego folderu", async () => {
    const { store, deps } = fresh();
    store.upsertNote(note("a"));
    const snap = readDocState(store.encodeSyncState());
    store.removeNote("a");
    const items = compareSnapshot(snap, store.projectNotes(), undefined, false).deleted;
    const first = await restoreSnapshotCopies(items, snap, DAY, deps);
    const second = await restoreSnapshotCopies(items, snap, DAY, deps);
    expect(second.folderId).toBe(first.folderId);
    expect(store.projectFolders().filter((f) => f.name === "Przywrócone 12.11")).toHaveLength(1);
  });

  it("notatka prywatna: ten sam klucz i odblokowany skarbiec — kopia pod nowym id da się odszyfrować", async () => {
    const { store, pn, deps } = fresh();
    store.upsertNote(note("s", { title: "SEKRET", content: "tajna treść" }));
    await pn.setup(PW);
    expect(await pn.lockNote("s")).toEqual({ ok: true });
    const snap = readDocState(store.encodeSyncState());
    store.removeNote("s");

    const cmp = compareSnapshot(snap, store.projectNotes(), store.getVaultMeta(), pn.isUnlocked());
    expect(cmp.deleted[0].privacy).toBe("ok");
    const r = await restoreSnapshotCopies(cmp.deleted, snap, DAY, deps);
    expect(r).toMatchObject({ restored: 1, skipped: [] });
    const copy = store.projectNotes().find((n) => n.locked)!;
    expect(copy.id).not.toBe("s");
    expect(copy.vault).not.toBe(snap.notes[0].vault);
    expect(pn.peek(copy.id)).toMatchObject({ title: "SEKRET", content: "tajna treść" });
    // Po zablokowaniu i odblokowaniu treść odszyfrowuje się z dokumentu (nie tylko z pamięci podręcznej).
    pn.lock();
    await pn.unlock(PW);
    await pn.ensureDecrypted(copy);
    expect(pn.isUndecryptable(copy.id)).toBe(false);
  });

  it("skarbiec zablokowany w trakcie szyfrowania kopii — kopia prywatna pominięta, jawne wstawione", async () => {
    const { store, pn, deps } = fresh();
    store.upsertNote(note("s"));
    store.upsertNote(note("j"));
    await pn.setup(PW);
    await pn.lockNote("s");
    const snap = readDocState(store.encodeSyncState());
    store.removeNote("s");
    store.removeNote("j");
    const items = compareSnapshot(snap, store.projectNotes(), store.getVaultMeta(), pn.isUnlocked()).deleted;
    const r = await restoreSnapshotCopies(items, snap, DAY, {
      ...deps, copySession: pn.copySession,
      reencryptCopy: async (...a) => { const out = await pn.reencryptCopy(...a); pn.lock(); return out; },
    });
    expect(r).toMatchObject({ restored: 1, skipped: ["s"] });
    expect(store.projectNotes().some((n) => n.locked)).toBe(false);
  });

  it("jawna w kopii, prywatna teraz (M3): przy zablokowanym skarbcu zablokowana, po odblokowaniu wraca zaszyfrowana", async () => {
    const { store, pn, deps } = fresh();
    store.upsertNote(note("s", { title: "SEKRET", content: "tajna treść", labels: ["x"] }));
    const snap = readDocState(store.encodeSyncState());
    await pn.setup(PW);
    expect(await pn.lockNote("s")).toEqual({ ok: true });
    pn.lock();
    const locked = compareSnapshot(snap, store.projectNotes(), store.getVaultMeta(), false).changed[0];
    expect(locked).toMatchObject({ sealed: true, privacy: "locked" });
    await pn.unlock(PW);
    const item = compareSnapshot(snap, store.projectNotes(), store.getVaultMeta(), true).changed[0];
    expect(item).toMatchObject({ sealed: true, privacy: "ok" });
    const r = await restoreSnapshotCopies([item], snap, DAY, { ...deps, sealCopy: pn.sealCopy });
    expect(r).toMatchObject({ restored: 1, skipped: [] });
    const copy = store.projectNotes().find((n) => n.id !== "s")!;
    expect(copy).toMatchObject({ locked: true, title: "", content: "", labels: [] });
    expect(JSON.stringify(store.readPlainNote(copy.id) ?? {})).not.toContain("tajna");
    pn.lock();
    await pn.unlock(PW);
    await pn.ensureDecrypted(copy);
    expect(pn.peek(copy.id)).toMatchObject({ title: "SEKRET", content: "tajna treść" });
  });

  it("notatka prywatna po zmianie hasła (inne metadane skarbca) albo przy zablokowanym skarbcu — wyszarzona i pominięta", async () => {
    const { store, pn, deps } = fresh();
    store.upsertNote(note("s"));
    await pn.setup(PW);
    await pn.lockNote("s");
    const snap = readDocState(store.encodeSyncState());
    store.removeNote("s");
    expect(compareSnapshot(snap, [], { inne: "metadane" }, true).deleted[0].privacy).toBe("other-key");
    expect(compareSnapshot(snap, [], store.getVaultMeta(), false).deleted[0].privacy).toBe("locked");
    const items = compareSnapshot(snap, [], { inne: "metadane" }, true).deleted;
    const r = await restoreSnapshotCopies(items, snap, DAY, deps);
    expect(r).toMatchObject({ restored: 0, skipped: ["s"] });
    expect(store.projectNotes()).toEqual([]);
  });
});

describe("vaultDiffers", () => {
  it("bez skarbca po obu stronach i ten sam skarbiec — nie; zmiana, założenie, usunięcie — tak", () => {
    expect(vaultDiffers(undefined, null)).toBe(false);
    expect(vaultDiffers({ a: 1 }, { a: 1 })).toBe(false);
    expect(vaultDiffers({ a: 1 }, { a: 2 })).toBe(true);
    expect(vaultDiffers(null, { a: 1 })).toBe(true);
    expect(vaultDiffers({ a: 1 }, null)).toBe(true);
  });
});

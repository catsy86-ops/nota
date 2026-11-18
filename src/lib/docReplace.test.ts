import { beforeEach, describe, expect, it, vi } from "vitest";

// Z-16.1B (`docs/plan-dane-lokalne.md` §1.6): wymiana całego dokumentu — ścieżka awaryjna.

const snapshotFile = vi.hoisted(() => ({ body: null as Uint8Array | null, fail: null as string | null }));
vi.mock("@/lib/dailySnapshot", async (orig) => ({
  ...(await orig<typeof import("@/lib/dailySnapshot")>()),
  readSnapshotFile: async () => {
    if (snapshotFile.fail) throw new Error(snapshotFile.fail);
    return { header: {}, body: snapshotFile.body };
  },
}));

import { createYjsStore, replacePersistedDoc } from "@/lib/yjsStore";
import { imageStore } from "@/lib/imageStore";
import {
  DATA_CLEARED_KEY, DOC_GENERATION_KEY, performDocReplace, readReplaceIntent, readReplaceResult, REPLACE_INTENT_KEY,
  startupReplace, watchDocGeneration, writeReplaceIntent,
} from "@/lib/docReplaceCore";
import { requestDocReplace, type ReplaceDeps } from "@/lib/docReplace";
import { startTabSync } from "@/lib/tabSync";
import * as Y from "yjs";
import type { Note } from "@/lib/types/note";

const note = (id: string): Note => ({
  id, title: `Tytuł ${id}`, content: `Treść ${id}`, color: "default", pinned: false, archived: false, trashed: false,
  trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
  order: 0, createdAt: 1_000, updatedAt: 1_000,
});

const dbName = () => `replace-${crypto.randomUUID()}`;
const ids = (s: ReturnType<typeof createYjsStore>) => s.projectNotes().map((n) => n.id).sort();
const settle = () => new Promise((r) => setTimeout(r, 50));

/** Dokument z notatkami zapisany w bazie `name`; zwraca stan V2 z chwili po `first` notatkach. */
async function seeded(name: string, first: string[], later: string[]) {
  const s = createYjsStore(name, imageStore);
  await s.ready();
  for (const id of first) s.upsertNote(note(id));
  const snapshot = s.encodeSyncState();
  for (const id of later) s.upsertNote(note(id));
  await settle();
  return { store: s, snapshot };
}

async function reopen(name: string) {
  const s = createYjsStore(name, imageStore);
  await s.ready();
  return s;
}

beforeEach(() => {
  localStorage.clear();
  snapshotFile.body = null;
  snapshotFile.fail = null;
});

describe("replacePersistedDoc — wymiana bazy jedną transakcją", () => {
  it("baza po wymianie zawiera dokładnie stan z kopii (późniejsze notatki znikają)", async () => {
    const name = dbName();
    const { snapshot } = await seeded(name, ["a", "b"], ["c"]);
    expect(ids(await reopen(name))).toEqual(["a", "b", "c"]);
    await replacePersistedDoc(name, snapshot);
    expect(ids(await reopen(name))).toEqual(["a", "b"]);
  });

  it("pusty dokument (`null`) — baza bez notatek", async () => {
    const name = dbName();
    await seeded(name, ["a"], []);
    await replacePersistedDoc(name, null);
    expect(ids(await reopen(name))).toEqual([]);
  });

  it("uszkodzona kopia rzuca przed zapisem — baza nietknięta", async () => {
    const name = dbName();
    await seeded(name, ["a"], []);
    await expect(replacePersistedDoc(name, new Uint8Array([9, 9, 9, 9]))).rejects.toThrow();
    expect(ids(await reopen(name))).toEqual(["a"]);
  });

  it("baza, której nie było, jest zakładana", async () => {
    const name = dbName();
    const { snapshot } = await seeded(dbName(), ["x"], []);
    await replacePersistedDoc(name, snapshot);
    expect(ids(await reopen(name))).toEqual(["x"]);
  });
});

describe("zamiar wymiany przy starcie", () => {
  it("bez zamiaru — hak zwraca null (start bez zmian)", () => {
    expect(startupReplace("x", async () => undefined)).toBeNull();
  });

  it("kopia z zamiaru wymienia bazę przed otwarciem; zamiar zdjęty, wynik zapisany", async () => {
    const name = dbName();
    const { snapshot } = await seeded(name, ["a"], ["b"]);
    snapshotFile.body = snapshot;
    expect(writeReplaceIntent({ kind: "snapshot", file: "kopie-dzienne/2026-11-12.nkopia", createdAt: 1, startedAt: Date.now(), leftGroup: true })).toBe(true);
    const s = createYjsStore(name, imageStore, { beforeOpen: (n) => startupReplace(n, replacePersistedDoc) });
    await s.ready();
    expect(ids(s)).toEqual(["a"]);
    expect(readReplaceIntent()).toBeNull();
    expect(readReplaceResult()).toMatchObject({ ok: true, intent: { kind: "snapshot", leftGroup: true } });
  });

  it("uszkodzona kopia nie rusza bazy: zamiar zdjęty, wynik „nie” z powodem", async () => {
    const name = dbName();
    await seeded(name, ["a", "b"], []);
    snapshotFile.fail = "Kopia jest uszkodzona";
    writeReplaceIntent({ kind: "snapshot", file: "kopie-dzienne/2026-11-12.nkopia", createdAt: 1, startedAt: Date.now(), leftGroup: false });
    const s = createYjsStore(name, imageStore, { beforeOpen: (n) => startupReplace(n, replacePersistedDoc) });
    await s.ready();
    expect(ids(s)).toEqual(["a", "b"]);
    expect(readReplaceIntent()).toBeNull();
    expect(readReplaceResult()).toMatchObject({ ok: false, reason: "Kopia jest uszkodzona" });
  });

  it("błąd wymiany: zamiar zdjęty, wynik „nie”, baza nietknięta (bez ponawiania przy kolejnym starcie)", async () => {
    const name = dbName();
    const { snapshot } = await seeded(name, ["a"], ["b"]);
    snapshotFile.body = snapshot;
    writeReplaceIntent({ kind: "snapshot", file: "kopie-dzienne/2026-11-12.nkopia", createdAt: 1, startedAt: Date.now(), leftGroup: false });
    await performDocReplace(name, async () => { throw new Error("karta zamknięta"); });
    expect(readReplaceIntent()).toBeNull();
    expect(readReplaceResult()).toMatchObject({ ok: false, reason: "karta zamknięta" });
    expect(ids(await reopen(name))).toEqual(["a", "b"]);
  });

  it("zamiar starszy niż godzina nie jest wykonywany", async () => {
    const name = dbName();
    const { snapshot } = await seeded(name, ["a"], ["b"]);
    snapshotFile.body = snapshot;
    writeReplaceIntent({ kind: "snapshot", file: "kopie-dzienne/2026-11-12.nkopia", createdAt: 1, startedAt: Date.now() - 2 * 60 * 60 * 1000, leftGroup: false });
    await performDocReplace(name, replacePersistedDoc);
    expect(readReplaceIntent()).toBeNull();
    expect(readReplaceResult()).toMatchObject({ ok: false, reason: "Zamiar wymiany danych wygasł" });
    expect(ids(await reopen(name))).toEqual(["a", "b"]);
  });

  it("„Zastąp danymi grupy”: pusty dokument, oznaczenie świadomego wyczyszczenia (bez banera „dane zniknęły”)", async () => {
    const name = dbName();
    await seeded(name, ["a"], []);
    writeReplaceIntent({ kind: "empty", join: "KOD", startedAt: Date.now() });
    const s = createYjsStore(name, imageStore, { beforeOpen: (n) => startupReplace(n, replacePersistedDoc) });
    await s.ready();
    expect(ids(s)).toEqual([]);
    expect(Number(localStorage.getItem(DATA_CLEARED_KEY))).toBeGreaterThan(0);
    expect(readReplaceResult()).toMatchObject({ ok: true, intent: { kind: "empty", join: "KOD" } });
  });
});

describe("requestDocReplace — kolejność przed przeładowaniem", () => {
  function deps(over: Partial<ReplaceDeps> = {}) {
    const calls: string[] = [];
    const d: ReplaceDeps = {
      saveBefore: async () => { calls.push("kopia"); return "kopie-przed-przywroceniem/x.nkopia"; },
      inGroup: () => true,
      leaveGroup: () => { calls.push("opuść grupę"); },
      clearRelay: async () => { calls.push("kolejki przekaźnika"); },
      writeIntent: (i) => { calls.push("zamiar"); return writeReplaceIntent(i); },
      announce: () => { calls.push("sygnał"); },
      reload: () => { calls.push("przeładowanie"); },
      now: () => 5,
      ...over,
    };
    return { d, calls };
  }

  it("kopia → zamiar → wyjście z grupy → kolejki → sygnał → przeładowanie", async () => {
    const { d, calls } = deps();
    const r = await requestDocReplace({ kind: "snapshot", file: "kopie-dzienne/2026-11-12.nkopia", createdAt: 1 }, d);
    expect(calls).toEqual(["kopia", "zamiar", "opuść grupę", "kolejki przekaźnika", "sygnał", "przeładowanie"]);
    expect(r.leftGroup).toBe(true);
    expect(readReplaceIntent()).toMatchObject({ kind: "snapshot", leftGroup: true, startedAt: 5 });
  });

  it("bez kopii obecnych danych nic się nie dzieje (grupa, zamiar, przeładowanie nietknięte)", async () => {
    const { d, calls } = deps({ saveBefore: async () => { throw new Error("brak miejsca"); } });
    await expect(requestDocReplace({ kind: "snapshot", file: "kopie-dzienne/a.nkopia", createdAt: 1 }, d)).rejects.toThrow("brak miejsca");
    expect(calls).toEqual([]);
    expect(localStorage.getItem(REPLACE_INTENT_KEY)).toBeNull();
  });

  it("poza grupą — bez wychodzenia i czyszczenia kolejek; zamiar zmienia pokolenie dokumentu", async () => {
    const { d, calls } = deps({ inGroup: () => false });
    const before = localStorage.getItem(DOC_GENERATION_KEY);
    await requestDocReplace({ kind: "empty", join: "KOD" }, d);
    expect(calls).toEqual(["kopia", "zamiar", "sygnał", "przeładowanie"]);
    expect(localStorage.getItem(DOC_GENERATION_KEY)).not.toBe(before);
  });
});

describe("pokolenie dokumentu między kartami", () => {
  const tick = () => new Promise((r) => setTimeout(r, 30));

  it("karta z innym pokoleniem nie odsyła stanu sprzed wymiany", async () => {
    const name = `gen-${Math.random()}`;
    const stale = new Y.Doc();
    stale.getMap("notes").set("stara", "sprzed wymiany");
    const fresh = new Y.Doc();
    const stopStale = startTabSync(stale, name, Promise.resolve(), () => false, "pokolenie-1");
    const stopFresh = startTabSync(fresh, name, Promise.resolve(), () => false, "pokolenie-2");
    await tick();
    expect(fresh.getMap("notes").has("stara")).toBe(false);
    fresh.getMap("notes").set("nowa", "po wymianie");
    await tick();
    expect(stale.getMap("notes").has("nowa")).toBe(false);
    // Ta sama generacja — zwykła wymiana stanu.
    const twin = new Y.Doc();
    const stopTwin = startTabSync(twin, name, Promise.resolve(), () => false, "pokolenie-2");
    await tick();
    expect(twin.getMap("notes").get("nowa")).toBe("po wymianie");
    [stopStale, stopFresh, stopTwin].forEach((s) => s());
  });

  it("zmiana pokolenia w innej karcie (zdarzenie storage) przeładowuje tę kartę", () => {
    const reload = vi.fn();
    const stop = watchDocGeneration(reload);
    localStorage.setItem(DOC_GENERATION_KEY, "inne");
    window.dispatchEvent(new StorageEvent("storage", { key: DOC_GENERATION_KEY }));
    expect(reload).toHaveBeenCalledTimes(1);
    stop();
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { createYjsStore } from "@/lib/yjsStore";
import { createPrivateNotes } from "@/lib/privateNotes";
import { createVersionsStore } from "@/lib/versionsStore";
import { setDeviceSource } from "@/lib/formatSchema";
import { decryptNoteString, decryptString, encryptString, noteAad, unlockWithPassword, type VaultMeta } from "@/lib/vault";
import type { Note } from "@/lib/types/note";

// K0 cz. 2 / C-14: nieznane pola najwyższego poziomu w treści szyfrogramu przeżywają zapisy starszej wersji.

const IT = 1000;
const PW = "hasło-do-testów-12345";

function makeNote(over: Partial<Note> = {}): Note {
  return {
    id: "n1", title: "Tytuł", content: "Treść", color: "default", pinned: false, archived: false, trashed: false,
    trashedAt: null, labels: [], reminder: null, priority: "none", images: [], checklist: [], folderId: null,
    order: 0, createdAt: 1_000, updatedAt: 1_000, ...over,
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Skarbiec z notatką v1, do której szyfrogramu „przyszła wersja” dopisała pole `extra`. Sesja zablokowana. */
async function withFuture(extra: Record<string, unknown>) {
  const store = createYjsStore(`k02-${crypto.randomUUID()}`);
  const versions = createVersionsStore(`k02.versions.${crypto.randomUUID()}.`);
  const pn = createPrivateNotes(store, { iterations: IT, minIterations: IT, writeDelayMs: 5, versions });
  store.upsertNote(makeNote());
  await pn.setup(PW);
  setDeviceSource(() => [{ schema: 1 }]); // bramka zamknięta: zapis v1
  await pn.lockNote("n1");
  await pn.lock();
  const meta = store.getVaultMeta() as VaultMeta;
  const key = await unlockWithPassword(meta, PW, IT);
  const plain = JSON.parse(await decryptString(key, store.getVault("n1")!, noteAad("n1")));
  store.setVault("n1", await encryptString(key, JSON.stringify({ ...plain, ...extra }), noteAad("n1")), false);
  const read = async (id: string) => JSON.parse(await decryptNoteString(key, store.getVault(id)!, id, meta.epoch));
  return { store, pn, read };
}

const FUTURE = { futureField: { a: [1, 2], b: "x" } };

beforeEach(() => { localStorage.clear(); setDeviceSource(() => []); });

describe("C-14: pole z przyszłości w treści notatki prywatnej", () => {
  it("przeżywa edycję (ujście zapisu + writeNow)", async () => {
    const { store, pn, read } = await withFuture(FUTURE);
    await pn.unlock(PW);
    store.patchNote("n1", { content: "po edycji" });
    await wait(30);
    await pn.flush();
    expect(await read("n1")).toMatchObject({ content: "po edycji", ...FUTURE });
  });

  it("przeżywa migrację v1→v2 przy odblokowaniu", async () => {
    const { store, pn, read } = await withFuture(FUTURE);
    setDeviceSource(() => []);
    await pn.unlock(PW);
    expect(store.getVault("n1")).toMatch(/^v2\./);
    expect(await read("n1")).toMatchObject(FUTURE);
  });

  it("przeżywa duplikat", async () => {
    const { pn, read } = await withFuture(FUTURE);
    await pn.unlock(PW);
    const id = await pn.duplicate("n1");
    expect(id).toBeTruthy();
    expect(await read(id!)).toMatchObject({ title: "Tytuł (kopia)", ...FUTURE });
  });

  it("zdjęcie blokady: jawny model nie ma miejsca na nieznane pole — pole znika, znane pola wracają", async () => {
    const { store, pn } = await withFuture(FUTURE);
    await pn.unlock(PW);
    expect(await pn.removeLock("n1")).toBe(true);
    const note = store.projectNotes().find((n) => n.id === "n1")!;
    expect(note).toMatchObject({ title: "Tytuł", content: "Treść" });
    expect(note).not.toHaveProperty("futureField");
  });

  it("peek pokazuje tylko znane pola — nieznane (np. `id`) nie nadpisują notatki w karcie, a zapis je zachowuje", async () => {
    const extra = { id: "inna-notatka", images: ["x"], futureField: 1 };
    const { store, pn, read } = await withFuture(extra);
    await pn.unlock(PW);
    await pn.ensureDecrypted(store.projectNotes().find((n) => n.id === "n1")!);
    const seen = pn.peek("n1")!;
    expect(Object.keys(seen).sort()).toEqual(["checklist", "content", "labels", "title"]);
    expect(pn.peek("n1")).toBe(seen);
    store.patchNote("n1", { content: "po edycji" });
    await wait(30);
    await pn.flush();
    expect(await read("n1")).toMatchObject({ content: "po edycji", ...extra });
  });

  it("nieznane pola ponad 64 KB JSON-u są odrzucane", async () => {
    const { store, pn, read } = await withFuture({ big: "x".repeat(70 * 1024) });
    await pn.unlock(PW);
    store.patchNote("n1", { content: "po edycji" });
    await wait(30);
    await pn.flush();
    const out = await read("n1");
    expect(out.content).toBe("po edycji");
    expect(out).not.toHaveProperty("big");
  });
});

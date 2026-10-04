import { describe, it, expect, beforeEach } from "vitest";
import { createYjsStore } from "./yjsStore";
import { buildSyncFile, parseSyncFile, mergeSyncFile, bytesToBase64, base64ToBytes } from "./yjsFileSync";
import { clearAllStorage } from "@/lib/notesStore";
import { createImageStore } from "@/lib/imageStore";
import { hashImage } from "@/lib/imageHash";
import type { Note } from "@/hooks/useNotes";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "1", title: "Tytuł", content: "Treść", color: "default", pinned: false, archived: false,
    trashed: false, trashedAt: null, labels: [], reminder: null, priority: "none", images: [],
    checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0, ...overrides,
  };
}

/** Każde „urządzenie” ma własny store obrazów — inaczej obraz byłby po obu stronach od początku. */
const store = (tag: string) => createYjsStore(`file-sync-${tag}-${crypto.randomUUID()}`, createImageStore(`file-sync-img-${tag}-${crypto.randomUUID()}`));
/** Plik przechodzi przez JSON — jak w prawdziwym pobraniu. */
const roundTrip = async (s: ReturnType<typeof store>) => parseSyncFile(JSON.stringify(await buildSyncFile(s)));

beforeEach(async () => {
  localStorage.clear();
  await clearAllStorage();
});

describe("yjsFileSync", () => {
  it("base64 round-trips binary data larger than one chunk", async () => {
    const bytes = new Uint8Array(100_000).map((_v, i) => (i * 31) % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it("merges two devices that were never online together, keeping changes from both", async () => {
    const a = store("a");
    const b = store("b");
    a.upsertNote(makeNote({ id: "shared", title: "Wspólna" }));
    await mergeSyncFile(await roundTrip(a), b); // wspólny punkt startu

    a.patchNote("shared", { title: "Tytuł z A" });
    a.upsertNote(makeNote({ id: "only-a", title: "Tylko A" }));
    b.patchNote("shared", { pinned: true });
    b.upsertNote(makeNote({ id: "only-b", title: "Tylko B" }));

    const fromA = await roundTrip(a);
    const res = await mergeSyncFile(fromA, b);
    await mergeSyncFile(await roundTrip(b), a);

    expect(res.newNotes).toBe(1);
    for (const s of [a, b]) {
      const notes = s.projectNotes();
      expect(notes.map((n) => n.id).sort()).toEqual(["only-a", "only-b", "shared"]);
      const shared = notes.find((n) => n.id === "shared")!;
      expect(shared.title).toBe("Tytuł z A");
      expect(shared.pinned).toBe(true);
    }
  });

  it("is idempotent — merging the same file twice changes nothing", async () => {
    const a = store("a");
    const b = store("b");
    a.upsertNote(makeNote({ id: "n1" }));
    const file = await roundTrip(a);
    await mergeSyncFile(file, b);
    expect((await mergeSyncFile(file, b)).newNotes).toBe(0);
    expect(b.projectNotes()).toHaveLength(1);
  });

  it("does not resurrect a note deleted after the file was made", async () => {
    const a = store("a");
    const b = store("b");
    a.upsertNote(makeNote({ id: "n1" }));
    const old = await roundTrip(a);
    await mergeSyncFile(old, b);
    b.removeNote("n1");
    await mergeSyncFile(old, b);
    expect(b.projectNotes()).toHaveLength(0);
  });

  it("carries image bytes once per hash (v2 blobs)", async () => {
    const a = store("a");
    const b = store("b");
    const img = "data:image/png;base64,AAAA";
    const ref = await a.images.putDataUrl(img);
    a.upsertNote(makeNote({ id: "n1", images: [ref] }));
    a.upsertNote(makeNote({ id: "n2", images: [ref] }));
    const file = await roundTrip(a);
    expect(file.version).toBe(2);
    expect(Object.keys(file.blobs)).toEqual([ref]);

    await mergeSyncFile(file, b);
    expect(b.projectNotes().find((n) => n.id === "n1")!.images).toEqual([ref]);
    expect(await b.images.getDataUrl(ref)).toBe(img);
  });

  it("reads a v1 file: per-note data URLs, FNV manifests rewritten to SHA-256", async () => {
    const a = store("a");
    const b = store("b");
    const img = "data:image/png;base64,AAAA";
    a.upsertNote(makeNote({ id: "n1" }));
    a.notesMap.get("n1")!.set("imageHashes", [hashImage(img)]);
    const v1 = { format: "kaczy-sync", version: 1, exportedAt: 1, update: bytesToBase64(a.encodeSyncState()), images: { n1: [img] } };

    await mergeSyncFile(parseSyncFile(JSON.stringify(v1)), b);
    const [ref] = b.projectNotes()[0].images;
    expect(await b.images.getDataUrl(ref)).toBe(img);
  });

  it("stores no image and touches no note when saving an image fails", async () => {
    const a = store("a");
    const b = store("b");
    a.upsertNote(makeNote({ id: "n1", images: [await a.images.putDataUrl("data:image/png;base64,AAAA")] }));
    const file = await roundTrip(a);
    b.images.ingest = async () => { throw new Error("QuotaExceededError"); };
    await expect(mergeSyncFile(file, b)).rejects.toThrow();
    expect(b.projectNotes()).toHaveLength(0);
  });

  it("rejects a full backup and files from a newer version", async () => {
    expect(() => parseSyncFile(JSON.stringify({ version: 1, notes: [] }))).toThrow(/pełny backup/);
    expect(() => parseSyncFile(JSON.stringify({ format: "kaczy-sync", version: 99, update: "" }))).toThrow(/nowszej/);
    expect(() => parseSyncFile("nie json")).toThrow(/JSON/);
  });

  it("reports a corrupted update instead of silently doing nothing", async () => {
    const b = store("b");
    await expect(mergeSyncFile({ format: "kaczy-sync", version: 2, exportedAt: 0, update: bytesToBase64(new Uint8Array([1, 2, 3, 250])), blobs: {} }, b)).rejects.toThrow(/scalić/);
  });
});

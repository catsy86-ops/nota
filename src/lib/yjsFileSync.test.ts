import { describe, it, expect, beforeEach } from "vitest";
import { createYjsStore } from "./yjsStore";
import { buildSyncFile, parseSyncFile, mergeSyncFile, bytesToBase64, base64ToBytes } from "./yjsFileSync";
import { clearAllStorage } from "@/lib/notesStore";
import type { Note } from "@/hooks/useNotes";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "1", title: "Tytuł", content: "Treść", color: "default", pinned: false, archived: false,
    trashed: false, trashedAt: null, labels: [], reminder: null, priority: "none", images: [],
    checklist: [], folderId: null, order: 0, createdAt: 0, updatedAt: 0, ...overrides,
  };
}

const store = (tag: string) => createYjsStore(`file-sync-${tag}-${crypto.randomUUID()}`);
/** Plik przechodzi przez JSON — jak w prawdziwym pobraniu. */
const roundTrip = (s: ReturnType<typeof store>) => parseSyncFile(JSON.stringify(buildSyncFile(s)));

beforeEach(async () => {
  localStorage.clear();
  await clearAllStorage();
});

describe("yjsFileSync", () => {
  it("base64 round-trips binary data larger than one chunk", () => {
    const bytes = new Uint8Array(100_000).map((_v, i) => (i * 31) % 256);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it("merges two devices that were never online together, keeping changes from both", () => {
    const a = store("a");
    const b = store("b");
    a.upsertNote(makeNote({ id: "shared", title: "Wspólna" }));
    mergeSyncFile(roundTrip(a), b); // wspólny punkt startu

    a.patchNote("shared", { title: "Tytuł z A" });
    a.upsertNote(makeNote({ id: "only-a", title: "Tylko A" }));
    b.patchNote("shared", { pinned: true });
    b.upsertNote(makeNote({ id: "only-b", title: "Tylko B" }));

    const fromA = roundTrip(a);
    const res = mergeSyncFile(fromA, b);
    mergeSyncFile(roundTrip(b), a);

    expect(res.newNotes).toBe(1);
    for (const s of [a, b]) {
      const notes = s.projectNotes();
      expect(notes.map((n) => n.id).sort()).toEqual(["only-a", "only-b", "shared"]);
      const shared = notes.find((n) => n.id === "shared")!;
      expect(shared.title).toBe("Tytuł z A");
      expect(shared.pinned).toBe(true);
    }
  });

  it("is idempotent — merging the same file twice changes nothing", () => {
    const a = store("a");
    const b = store("b");
    a.upsertNote(makeNote({ id: "n1" }));
    const file = roundTrip(a);
    mergeSyncFile(file, b);
    expect(mergeSyncFile(file, b).newNotes).toBe(0);
    expect(b.projectNotes()).toHaveLength(1);
  });

  it("does not resurrect a note deleted after the file was made", () => {
    const a = store("a");
    const b = store("b");
    a.upsertNote(makeNote({ id: "n1" }));
    const old = roundTrip(a);
    mergeSyncFile(old, b);
    b.removeNote("n1");
    mergeSyncFile(old, b);
    expect(b.projectNotes()).toHaveLength(0);
  });

  it("carries images addressed by hash", () => {
    const a = store("a");
    const b = store("b");
    const img = "data:image/png;base64,AAAA";
    a.upsertNote(makeNote({ id: "n1", images: [img] }));
    const res = mergeSyncFile(roundTrip(a), b);
    expect(res.imagesRestored).toBe(1);
    expect(b.getLocalImages("n1")).toEqual([img]);
  });

  it("rejects a full backup and files from a newer version", () => {
    expect(() => parseSyncFile(JSON.stringify({ version: 1, notes: [] }))).toThrow(/pełny backup/);
    expect(() => parseSyncFile(JSON.stringify({ format: "kaczy-sync", version: 99, update: "" }))).toThrow(/nowszej/);
    expect(() => parseSyncFile("nie json")).toThrow(/JSON/);
  });

  it("reports a corrupted update instead of silently doing nothing", () => {
    const b = store("b");
    expect(() => mergeSyncFile({ format: "kaczy-sync", version: 1, exportedAt: 0, update: bytesToBase64(new Uint8Array([1, 2, 3, 250])), images: {} }, b)).toThrow(/scalić/);
  });
});

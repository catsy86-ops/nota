import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import { yjsStore } from "@/lib/yjsStore";
import { clearAllStorage } from "@/lib/notesStore";
import { hashImage } from "@/lib/imageHash";
import type { Note } from "@/hooks/useNotes";

// NOTE: no vi.resetModules() in this file — imageSync.ts imports the yjsStore
// singleton, and resetting the module registry between tests would make
// imageSync.ts pick up a *different* yjsStore instance than the one these
// tests call directly, silently decoupling them. yjsStore.resetForTests()
// (in beforeEach) is what actually clears state between tests here.
import { startImageSync, stopImageSync } from "@/lib/imageSync";

// Real WebRTC isn't testable in vitest/jsdom — same approach as yjsSync.test.ts:
// mock the transport so the merge/reconcile logic (the actual thing worth
// testing) runs against a real Y.Doc, just without real network I/O. Because
// imageSync.ts constructs its own transport Y.Doc and hands it to
// `new WebrtcProvider(room, doc, opts)`, capturing that `doc` here gives direct
// access to the very same Y.Map imageSync.ts observes — mutating it here is
// equivalent to a real peer's update arriving over the wire.
// vi.mock is hoisted above imports, so the class/array it needs must be too.
const { MockProvider, providerInstances } = vi.hoisted(() => {
  class MockProvider {
    roomName: string;
    doc: Y.Doc;
    opts: unknown;
    destroyed = false;
    constructor(roomName: string, doc: Y.Doc, opts: unknown) {
      this.roomName = roomName;
      this.doc = doc;
      this.opts = opts;
      providerInstances.push(this);
    }
    on() { /* peer-count/status events not needed for these tests */ }
    destroy() { this.destroyed = true; }
  }
  const providerInstances: InstanceType<typeof MockProvider>[] = [];
  return { MockProvider, providerInstances };
});

vi.mock("y-webrtc", () => ({ WebrtcProvider: MockProvider }));

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "1", title: "Tytuł", content: "Treść", color: "default",
    pinned: false, archived: false, trashed: false, trashedAt: null,
    labels: [], reminder: null, priority: "none", images: [], checklist: [],
    folderId: null, order: 0, createdAt: 0, updatedAt: 0,
    ...overrides,
  };
}

beforeEach(async () => {
  localStorage.clear();
  await clearAllStorage();
  stopImageSync();
  await yjsStore.resetForTests();
  await yjsStore.ready();
  providerInstances.length = 0;
});

describe("imageSync", () => {
  it("mirrors a locally-owned image into the transport doc's blobs map, keyed by content hash", () => {
    const base64 = "data:image/png;base64,AAAA";
    yjsStore.upsertNote(makeNote({ id: "n1", images: [base64] }));

    startImageSync("TESTCODE");
    const transport = providerInstances[0];
    const blobs = transport.doc.getMap<string>("blobs");

    expect(blobs.get(hashImage(base64))).toBe(base64);
  });

  it("fills in a note's missing image once a matching hash appears in the transport doc (simulated peer)", () => {
    const base64 = "data:image/png;base64,BBBB";
    const hash = hashImage(base64);

    // Simulates a note synced in from the main doc: the manifest (imageHashes)
    // arrived, but this device never received the actual bytes (images travel
    // through the separate transport, not the main doc).
    yjsStore.upsertNote(makeNote({ id: "n1", images: [] }));
    yjsStore.notesMap.get("n1")!.set("imageHashes", [hash]);

    startImageSync("TESTCODE");
    expect(yjsStore.getLocalImages("n1")).toEqual([]);

    // A peer sends the blob — arrives as a change on the shared transport Y.Map.
    const transport = providerInstances[0];
    transport.doc.getMap<string>("blobs").set(hash, base64);

    expect(yjsStore.getLocalImages("n1")).toEqual([base64]);
  });

  it("does not touch notes whose local images already match their manifest", () => {
    const base64 = "data:image/png;base64,CCCC";
    yjsStore.upsertNote(makeNote({ id: "n1", images: [base64] }));

    startImageSync("TESTCODE");
    const transport = providerInstances[0];
    // A (harmless, identical) blob arrives for the same hash — already have it.
    transport.doc.getMap<string>("blobs").set(hashImage(base64), base64);

    expect(yjsStore.getLocalImages("n1")).toEqual([base64]);
  });

  it("stopImageSync destroys the transport and stops reacting to further changes", () => {
    const base64 = "data:image/png;base64,DDDD";
    const hash = hashImage(base64);
    yjsStore.upsertNote(makeNote({ id: "n1", images: [] }));
    yjsStore.notesMap.get("n1")!.set("imageHashes", [hash]);

    startImageSync("TESTCODE");
    const transport = providerInstances[0];
    stopImageSync();
    expect(transport.destroyed).toBe(true);

    // Mutating the now-detached doc must not throw and must not reach yjsStore.
    transport.doc.getMap<string>("blobs").set(hash, base64);
    expect(yjsStore.getLocalImages("n1")).toEqual([]);
  });
});

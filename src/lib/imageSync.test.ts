import { describe, it, expect, beforeEach, vi } from "vitest";
import * as Y from "yjs";
import { yjsStore } from "@/lib/yjsStore";
import { clearAllStorage } from "@/lib/notesStore";
import { dataUrlToBytes, sha256Hex } from "@/lib/imageStore";
import type { Note } from "@/hooks/useNotes";

// NOTE: no vi.resetModules() in this file — imageSync.ts imports the yjsStore
// singleton, and resetting the module registry between tests would make
// imageSync.ts pick up a *different* yjsStore instance than the one these
// tests call directly, silently decoupling them. yjsStore.resetForTests()
// (in beforeEach) is what actually clears state between tests here.
import { startImageSync, stopImageSync, imageSyncSettledForTests } from "@/lib/imageSync";

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

// startImageSync() now loads y-webrtc via dynamic import() so it's out of the
// eager main bundle — even mocked, that's still a real Promise tick before
// the provider exists. Wait for it instead of asserting synchronously.
async function waitForProvider(): Promise<void> {
  await vi.waitFor(() => {
    if (providerInstances.length === 0) throw new Error("provider not connected yet");
  });
}

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
  await yjsStore.images.resetForTests();
  await yjsStore.ready();
  providerInstances.length = 0;
});

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const GIF = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

function wire(dataUrl: string) {
  const { bytes, type } = dataUrlToBytes(dataUrl);
  return { t: type, b: bytes };
}

async function refOf(dataUrl: string): Promise<string> {
  return sha256Hex(dataUrlToBytes(dataUrl).bytes);
}

describe("imageSync", () => {
  it("mirrors a locally-owned image into the transport doc, keyed by SHA-256, on the -img2 room", async () => {
    const ref = await yjsStore.images.putDataUrl(PNG);
    yjsStore.upsertNote(makeNote({ id: "n1", images: [ref] }));

    startImageSync("TESTCODE");
    await waitForProvider();
    await imageSyncSettledForTests();
    const transport = providerInstances[0];
    expect(transport.roomName.endsWith("-img2")).toBe(true);
    const sent = transport.doc.getMap<{ t: string; b: Uint8Array }>("blobs").get(ref)!;
    expect(sent.t).toBe("image/png");
    expect(Array.from(sent.b)).toEqual(Array.from(wire(PNG).b));
  });

  it("stores an image a manifest expects once a peer sends it (simulated peer)", async () => {
    const ref = await refOf(GIF);
    yjsStore.upsertNote(makeNote({ id: "n1", images: [ref] }));

    startImageSync("TESTCODE");
    await waitForProvider();
    expect(yjsStore.images.has(ref)).toBe(false);

    providerInstances[0].doc.getMap("blobs").set(ref, wire(GIF));
    await vi.waitFor(() => { if (!yjsStore.images.has(ref)) throw new Error("not yet"); });
    expect(await yjsStore.images.getDataUrl(ref)).toBe(GIF);
  });

  it("rejects bytes that do not match the hash they were sent under", async () => {
    const ref = await refOf(GIF);
    yjsStore.upsertNote(makeNote({ id: "n1", images: [ref] }));

    startImageSync("TESTCODE");
    await waitForProvider();
    providerInstances[0].doc.getMap("blobs").set(ref, wire(PNG));
    await imageSyncSettledForTests();
    expect(yjsStore.images.has(ref)).toBe(false);
  });

  it("stopImageSync destroys the transport and stops reacting to further changes", async () => {
    const ref = await refOf(GIF);
    yjsStore.upsertNote(makeNote({ id: "n1", images: [ref] }));

    startImageSync("TESTCODE");
    await waitForProvider();
    const transport = providerInstances[0];
    stopImageSync();
    expect(transport.destroyed).toBe(true);

    // Mutating the now-detached doc must not throw and must not reach the store.
    transport.doc.getMap("blobs").set(ref, wire(GIF));
    await imageSyncSettledForTests();
    expect(yjsStore.images.has(ref)).toBe(false);
  });
});

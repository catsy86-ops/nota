import { describe, it, expect, beforeEach, vi } from "vitest";

// Real WebRTC peer-to-peer connections aren't testable in vitest/jsdom — mock
// the transport so we can exercise the state machine (pairing/join/pause/
// resume/forget) deterministically, same approach the project already takes
// for browser-only APIs.
const providerInstances: MockProvider[] = [];

class MockProvider {
  roomName: string;
  doc: unknown;
  opts: unknown;
  handlers: Record<string, ((arg: unknown) => void)[]> = {};
  destroyed = false;

  constructor(roomName: string, doc: unknown, opts: unknown) {
    this.roomName = roomName;
    this.doc = doc;
    this.opts = opts;
    providerInstances.push(this);
  }

  on(event: string, cb: (arg: unknown) => void) {
    (this.handlers[event] ??= []).push(cb);
  }

  emit(event: string, arg: unknown) {
    (this.handlers[event] ?? []).forEach((cb) => cb(arg));
  }

  destroy() {
    this.destroyed = true;
  }
}

vi.mock("y-webrtc", () => ({
  WebrtcProvider: MockProvider,
}));

// connect() opens two providers per call: the main text/metadata doc, and
// (via imageSync.ts) a separate transport for image blobs, room name suffixed
// "-img". Filter to the main one so provider-count assertions stay meaningful.
function mainProviders(): MockProvider[] {
  return providerInstances.filter((p) => !p.roomName.endsWith("-img"));
}

describe("yjsSync", () => {
  beforeEach(async () => {
    localStorage.clear();
    providerInstances.length = 0;
    vi.resetModules();
  });

  it("generates codes from the safe alphabet at the expected length", async () => {
    const { generateCode } = await import("./yjsSync");
    for (let i = 0; i < 20; i++) {
      const code = generateCode();
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it("derives a deterministic room name that never contains the code verbatim", async () => {
    const { roomNameFor } = await import("./yjsSync");
    const a = roomNameFor("ABCDEFGH");
    const b = roomNameFor("ABCDEFGH");
    const c = roomNameFor("ZZZZZZZZ");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toContain("ABCDEFGH");
  });

  it("startPairing generates a code, enables sync and connects", async () => {
    const { startPairing, getSyncState } = await import("./yjsSync");
    const code = startPairing();
    expect(code).toHaveLength(8);
    expect(getSyncState().code).toBe(code);
    expect(getSyncState().status).toBe("connecting");
    expect(mainProviders()).toHaveLength(1);
    expect(mainProviders()[0].opts).toEqual({ password: code });
  });

  it("also starts the separate image transport, sharing the same pairing code", async () => {
    const { startPairing } = await import("./yjsSync");
    const code = startPairing();
    const imageProviders = providerInstances.filter((p) => p.roomName.endsWith("-img"));
    expect(imageProviders).toHaveLength(1);
    expect(imageProviders[0].opts).toEqual({ password: code });
  });

  it("reflects connected status and peer count from provider events", async () => {
    const { startPairing, getSyncState } = await import("./yjsSync");
    startPairing();
    const provider = mainProviders()[0];

    provider.emit("status", { connected: true });
    expect(getSyncState().status).toBe("connected");

    provider.emit("peers", { webrtcPeers: ["a"], bcPeers: ["b", "c"] });
    expect(getSyncState().peerCount).toBe(3);
  });

  it("joinWithCode normalizes casing/whitespace", async () => {
    const { joinWithCode, getSyncState } = await import("./yjsSync");
    const code = joinWithCode("  abcdefgh  ");
    expect(code).toBe("ABCDEFGH");
    expect(getSyncState().code).toBe("ABCDEFGH");
  });

  it("pauseSync disconnects both providers but keeps the code; resumeSync reconnects to the same group", async () => {
    const { startPairing, pauseSync, resumeSync, getSyncState } = await import("./yjsSync");
    const code = startPairing();
    const [first, firstImage] = providerInstances;

    pauseSync();
    expect(first.destroyed).toBe(true);
    expect(firstImage.destroyed).toBe(true);
    expect(getSyncState().status).toBe("disabled");
    expect(getSyncState().code).toBe(code); // remembered

    resumeSync();
    expect(mainProviders()).toHaveLength(2);
    expect(mainProviders()[1].opts).toEqual({ password: code });
  });

  it("forgetPairing disconnects and clears the code entirely", async () => {
    const { startPairing, forgetPairing, getSyncState } = await import("./yjsSync");
    startPairing();
    const provider = mainProviders()[0];

    forgetPairing();
    expect(provider.destroyed).toBe(true);
    expect(getSyncState().code).toBeNull();
    expect(getSyncState().status).toBe("disabled");
  });

  it("initSync reconnects automatically when a prior session was enabled", async () => {
    const first = await import("./yjsSync");
    const code = first.startPairing();

    vi.resetModules();
    providerInstances.length = 0;
    const second = await import("./yjsSync");
    second.initSync();

    expect(mainProviders()).toHaveLength(1);
    expect(mainProviders()[0].opts).toEqual({ password: code });
    expect(second.getSyncState().code).toBe(code);
  });

  it("initSync does nothing when sync was never enabled", async () => {
    const mod = await import("./yjsSync");
    mod.initSync();
    expect(providerInstances).toHaveLength(0);
  });
});

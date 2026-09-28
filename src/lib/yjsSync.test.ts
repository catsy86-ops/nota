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

// connect() opens providers for the main text/metadata doc and (via imageSync.ts)
// a separate transport for image blobs, room name suffixed "-img". During the
// transition period each goes to TWO rooms: the new SHA-256 one ("kaczy2-…")
// and the legacy FNV one ("kaczy-…"). Filter to the main ones.
const ROOMS_PER_CONNECT = 2;

function mainProviders(): MockProvider[] {
  return providerInstances.filter((p) => !p.roomName.endsWith("-img"));
}

// connect()/startImageSync() now load y-webrtc via dynamic import() so it's
// out of the eager main bundle — even mocked, that's still a real Promise
// tick before the provider exists. Wait for it instead of asserting synchronously.
async function waitForMainProvider(countAtLeast = ROOMS_PER_CONNECT): Promise<void> {
  await vi.waitFor(() => {
    if (mainProviders().length < countAtLeast) throw new Error("provider not connected yet");
  });
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
      expect(code).toHaveLength(12);
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/);
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

  it("derives the new SHA-256 room name: deterministic, 128-bit, without the code", async () => {
    const { roomNameV2For, roomNameFor } = await import("./yjsSync");
    const a = await roomNameV2For("ABCDEFGHJKMN");
    expect(a).toBe(await roomNameV2For("ABCDEFGHJKMN"));
    expect(a).not.toBe(await roomNameV2For("ABCDEFGHJKMP"));
    expect(a).toMatch(/^kaczy2-[0-9a-f]{32}$/);
    expect(a).not.toContain("ABCDEFGHJKMN");
    expect(a).not.toBe(roomNameFor("ABCDEFGHJKMN"));
  });

  it("normalizes and groups codes for display", async () => {
    const { normalizeCode, formatCode } = await import("./yjsSync");
    expect(normalizeCode(" abcd-efgh jkmn ")).toBe("ABCDEFGHJKMN");
    expect(formatCode("ABCDEFGHJKMN")).toBe("ABCD EFGH JKMN");
    expect(formatCode("ABCDEFGH")).toBe("ABCD EFGH");
  });

  it("startPairing connects to the new room and, during the transition, the legacy one", async () => {
    const { startPairing, getSyncState, roomNameFor, roomNameV2For } = await import("./yjsSync");
    const code = startPairing();
    expect(getSyncState().code).toBe(code);
    expect(getSyncState().status).toBe("connecting");

    await waitForMainProvider();
    expect(mainProviders().map((p) => p.roomName)).toEqual([await roomNameV2For(code), roomNameFor(code)]);
    for (const p of mainProviders()) expect(p.opts).toEqual({ password: code });
  });

  it("also starts the separate image transport, sharing the same pairing code", async () => {
    const { startPairing } = await import("./yjsSync");
    const code = startPairing();

    await vi.waitFor(() => {
      if (providerInstances.filter((p) => p.roomName.endsWith("-img")).length === 0) {
        throw new Error("image provider not connected yet");
      }
    });
    await vi.waitFor(() => {
      if (providerInstances.filter((p) => p.roomName.endsWith("-img")).length < ROOMS_PER_CONNECT) {
        throw new Error("image providers not connected yet");
      }
    });
    const imageProviders = providerInstances.filter((p) => p.roomName.endsWith("-img"));
    expect(imageProviders).toHaveLength(ROOMS_PER_CONNECT);
    expect(imageProviders.map((p) => p.roomName.replace(/-img$/, ""))).toEqual(mainProviders().map((p) => p.roomName));
    for (const p of imageProviders) expect(p.opts).toEqual({ password: code });
  });

  it("is connected when any room is, and counts devices as the max over rooms", async () => {
    const { startPairing, getSyncState } = await import("./yjsSync");
    startPairing();
    await waitForMainProvider();
    const [v2, legacy] = mainProviders();

    legacy.emit("status", { connected: true });
    expect(getSyncState().status).toBe("connected");
    v2.emit("status", { connected: true });
    legacy.emit("status", { connected: false });
    expect(getSyncState().status).toBe("connected");
    v2.emit("status", { connected: false });
    expect(getSyncState().status).toBe("connecting");

    // Nowe urządzenie jest w obu pokojach, stare tylko w starym: razem 2, nie 3.
    v2.emit("peers", { webrtcPeers: ["new"], bcPeers: [] });
    legacy.emit("peers", { webrtcPeers: ["new", "old"], bcPeers: [] });
    expect(getSyncState().peerCount).toBe(2);
  });

  it("joinWithCode normalizes casing, whitespace and group separators", async () => {
    const { joinWithCode, getSyncState } = await import("./yjsSync");
    expect(joinWithCode("  abcdefgh  ")).toBe("ABCDEFGH");
    const code = joinWithCode("abcd efgh-jkmn");
    expect(code).toBe("ABCDEFGHJKMN");
    expect(getSyncState().code).toBe("ABCDEFGHJKMN");
  });

  it("pauseSync disconnects both providers but keeps the code; resumeSync reconnects to the same group", async () => {
    const { startPairing, pauseSync, resumeSync, getSyncState } = await import("./yjsSync");
    const code = startPairing();
    await waitForMainProvider();
    await vi.waitFor(() => { if (providerInstances.length < 2 * ROOMS_PER_CONNECT) throw new Error("not all up"); });
    const firstRound = providerInstances.slice();

    pauseSync();
    for (const p of firstRound) expect(p.destroyed).toBe(true);
    expect(getSyncState().status).toBe("disabled");
    expect(getSyncState().code).toBe(code); // remembered

    resumeSync();
    await waitForMainProvider(2 * ROOMS_PER_CONNECT);
    const resumed = mainProviders().slice(ROOMS_PER_CONNECT);
    expect(resumed).toHaveLength(ROOMS_PER_CONNECT);
    for (const p of resumed) expect(p.opts).toEqual({ password: code });
  });

  it("forgetPairing disconnects and clears the code entirely", async () => {
    const { startPairing, forgetPairing, getSyncState } = await import("./yjsSync");
    startPairing();
    await waitForMainProvider();

    forgetPairing();
    for (const p of mainProviders()) expect(p.destroyed).toBe(true);
    expect(getSyncState().code).toBeNull();
    expect(getSyncState().status).toBe("disabled");
  });

  it("initSync reconnects automatically when a prior session was enabled", async () => {
    const first = await import("./yjsSync");
    const code = first.startPairing();
    await waitForMainProvider();

    vi.resetModules();
    providerInstances.length = 0;
    const second = await import("./yjsSync");
    second.initSync();

    await waitForMainProvider();
    expect(mainProviders()).toHaveLength(ROOMS_PER_CONNECT);
    for (const p of mainProviders()) expect(p.opts).toEqual({ password: code });
    expect(second.getSyncState().code).toBe(code);
  });

  it("initSync does nothing when sync was never enabled", async () => {
    const mod = await import("./yjsSync");
    mod.initSync();
    expect(providerInstances).toHaveLength(0);
  });
});

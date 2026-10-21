import { describe, it, expect, beforeEach, vi } from "vitest";

// Real WebRTC peer-to-peer connections aren't testable in vitest/jsdom — mock
// the transport so we can exercise the state machine (pairing/join/pause/
// resume/forget) deterministically, same approach the project already takes
// for browser-only APIs.
const providerInstances: MockProvider[] = [];

/** Awareness y-protocols w pigułce: stany per clientID i `remote()` udający innego peera. */
class MockAwareness {
  clientID: number;
  states = new Map<number, Record<string, unknown>>();
  private changeHandlers: (() => void)[] = [];

  constructor(clientID: number) {
    this.clientID = clientID;
    this.states.set(clientID, {});
  }

  setLocalStateField(field: string, value: unknown) {
    this.states.set(this.clientID, { ...this.states.get(this.clientID), [field]: value });
  }

  getStates() {
    return this.states;
  }

  on(_event: string, cb: () => void) {
    this.changeHandlers.push(cb);
  }

  remote(clientID: number, state: Record<string, unknown>) {
    this.states.set(clientID, state);
    this.changeHandlers.forEach((cb) => cb());
  }
}

class MockProvider {
  roomName: string;
  doc: unknown;
  opts: unknown;
  handlers: Record<string, ((arg: unknown) => void)[]> = {};
  destroyed = false;
  awareness: MockAwareness;

  constructor(roomName: string, doc: unknown, opts: unknown) {
    this.roomName = roomName;
    this.doc = doc;
    this.opts = opts;
    this.awareness = new MockAwareness(1000 + providerInstances.length);
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
// a separate transport for image blobs, room name suffixed "-img2". During the
// transition period each goes to TWO rooms: the new SHA-256 one ("kaczy2-…")
// and the legacy FNV one ("kaczy-…"). Filter to the main ones.
const ROOMS_PER_CONNECT = 2;

function mainProviders(): MockProvider[] {
  return providerInstances.filter((p) => !p.roomName.endsWith("-img2"));
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
    // Większość testów dotyczy maszynerii dwóch pokoi, więc zgodność ze starą
    // wersją jest tu włączona jawnie; domyślne zachowanie sprawdza blok niżej.
    localStorage.setItem("kaczy.sync.v1", JSON.stringify({ enabled: false, code: null, signaling: [], legacyRoom: true }));
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
      if (providerInstances.filter((p) => p.roomName.endsWith("-img2")).length === 0) {
        throw new Error("image provider not connected yet");
      }
    });
    await vi.waitFor(() => {
      if (providerInstances.filter((p) => p.roomName.endsWith("-img2")).length < ROOMS_PER_CONNECT) {
        throw new Error("image providers not connected yet");
      }
    });
    const imageProviders = providerInstances.filter((p) => p.roomName.endsWith("-img2"));
    expect(imageProviders).toHaveLength(ROOMS_PER_CONNECT);
    expect(imageProviders.map((p) => p.roomName.replace(/-img2$/, ""))).toEqual(mainProviders().map((p) => p.roomName));
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
    // Krótkie 8-znakowe kody nie są przyjmowane.
    expect(joinWithCode("  abcdefgh  ")).toBeNull();
    const code = joinWithCode("abcd efgh-jkmn");
    expect(code).toBe("ABCDEFGHJKMN");
    expect(getSyncState().code).toBe("ABCDEFGHJKMN");
  });

  it("pauseSync disconnects both providers but keeps the code; resumeSync reconnects to the same group", async () => {
    const { startPairing, pauseSync, resumeSync, getSyncState, roomNamesFor } = await import("./yjsSync");
    const code = startPairing();
    // Pokoje tego kodu. Asercje tylko na nich: asynchroniczny connect z poprzedniego testu
    // (po vi.resetModules) może jeszcze dołożyć providery z innego kodu, których ten test nie kontroluje.
    const rooms = (await roomNamesFor(code)).flatMap((r) => [r, `${r}-img2`]);
    const mine = () => providerInstances.filter((p) => rooms.includes(p.roomName));
    await vi.waitFor(() => { if (mine().length < 2 * ROOMS_PER_CONNECT) throw new Error("not all up"); });
    const firstRound = mine();

    pauseSync();
    for (const p of firstRound) expect(p.destroyed).toBe(true);
    expect(getSyncState().status).toBe("disabled");
    expect(getSyncState().code).toBe(code); // remembered

    resumeSync();
    await vi.waitFor(() => { if (mine().filter((p) => !p.destroyed).length < 2 * ROOMS_PER_CONNECT) throw new Error("not resumed yet"); });
    const resumed = mine().filter((p) => !p.destroyed && !firstRound.includes(p));
    expect(resumed.filter((p) => !p.roomName.endsWith("-img2"))).toHaveLength(ROOMS_PER_CONNECT);
    for (const p of resumed.filter((p) => !p.roomName.endsWith("-img2"))) expect(p.opts).toEqual({ password: code });
  });

  it("forgetPairing disconnects and clears the code entirely", async () => {
    const { startPairing, forgetPairing, getSyncState } = await import("./yjsSync");
    const before = mainProviders().length;
    startPairing();
    await waitForMainProvider(before + ROOMS_PER_CONNECT);

    forgetPairing();
    for (const p of mainProviders().slice(before)) expect(p.destroyed).toBe(true);
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

  it("parses the signaling list: ws/wss only, deduplicated, rejects the rest", async () => {
    const { parseSignalingList } = await import("./yjsSync");
    const r = parseSignalingList(["wss://a.example.com", " ws://localhost:4444, wss://a.example.com", "https://nope.example", "foo"].join("\n"));
    expect(r.valid).toEqual(["wss://a.example.com", "ws://localhost:4444"]);
    expect(r.invalid).toEqual(["https://nope.example", "foo"]);
  });

  it("passes no signaling option by default (y-webrtc public servers)", async () => {
    const { startPairing } = await import("./yjsSync");
    startPairing();
    await waitForMainProvider();
    for (const p of providerInstances) expect((p.opts as { signaling?: string[] }).signaling).toBeUndefined();
  });

  it("custom servers go to BOTH text and image providers and reconnect", async () => {
    const { startPairing, setSignalingServers, getSignalingServers } = await import("./yjsSync");
    const code = startPairing();
    await waitForMainProvider();
    const before = [...providerInstances];
    setSignalingServers(["wss://sig.example.com", "not a url"]);
    expect(getSignalingServers()).toEqual(["wss://sig.example.com"]);
    await vi.waitFor(() => {
      const fresh = providerInstances.filter((p) => !before.includes(p));
      if (fresh.filter((p) => p.roomName.endsWith("-img2")).length < ROOMS_PER_CONNECT) throw new Error("image providers not yet");
      if (fresh.filter((p) => !p.roomName.endsWith("-img2")).length < ROOMS_PER_CONNECT) throw new Error("main providers not yet");
    });
    expect(before.every((p) => p.destroyed)).toBe(true);
    const fresh = providerInstances.filter((p) => !before.includes(p));
    for (const p of fresh) expect(p.opts).toEqual({ password: code, signaling: ["wss://sig.example.com"] });
  });

  it("keeps the servers after forgetting the pairing", async () => {
    const { setSignalingServers, forgetPairing, joinWithCode, getSignalingServers } = await import("./yjsSync");
    setSignalingServers(["wss://sig.example.com"]);
    joinWithCode("ABCDEFGHJKMN");
    forgetPairing();
    expect(getSignalingServers()).toEqual(["wss://sig.example.com"]);
  });
});

describe("yjsSync - urządzenia w grupie (faza 4)", () => {
  beforeEach(() => {
    localStorage.clear();
    providerInstances.length = 0;
    vi.resetModules();
  });

  it("nazwa domyślna zależy od przeglądarki, a własna jest zapamiętana i rozgłaszana", async () => {
    const { startPairing, setDeviceName, getDeviceName, defaultDeviceName } = await import("./yjsSync");
    expect(defaultDeviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe("Telefon");
    expect(defaultDeviceName("Mozilla/5.0 (Windows NT 10.0)")).toBe("Komputer");

    startPairing();
    // Tryb zgodności jest wyłączony domyślnie, więc działa tylko pokój v2.
    await waitForMainProvider(1);
    const v2 = mainProviders()[0];
    expect(v2.awareness.getStates().get(v2.awareness.clientID)).toMatchObject({ device: { name: getDeviceName() } });

    setDeviceName("  Tablet kuchnia  ");
    expect(getDeviceName()).toBe("Tablet kuchnia");
    expect(v2.awareness.getStates().get(v2.awareness.clientID)).toMatchObject({ device: { name: "Tablet kuchnia" } });
  });

  it("pusta nazwa wraca do domyślnej, a nazwa jest przycinana do 40 znaków", async () => {
    const { setDeviceName, getDeviceName } = await import("./yjsSync");
    setDeviceName("x".repeat(60));
    expect(getDeviceName()).toHaveLength(40);
    setDeviceName("   ");
    expect(localStorage.getItem("kaczy.sync.deviceName")).toBeNull();
    expect(getDeviceName()).toMatch(/^(Telefon|Komputer)$/);
  });

  it("lista pokazuje innych peerów z nazwą (bez siebie) i czyści się przy odłączeniu", async () => {
    const { startPairing, forgetPairing, getSyncState } = await import("./yjsSync");
    startPairing();
    // Tryb zgodności jest wyłączony domyślnie, więc działa tylko pokój v2.
    await waitForMainProvider(1);
    const v2 = mainProviders()[0];

    v2.awareness.remote(7, { device: { name: "Telefon" } });
    v2.awareness.remote(8, {});
    expect(getSyncState().devices).toEqual([{ id: 7, name: "Telefon" }]);

    forgetPairing();
    expect(getSyncState().devices).toEqual([]);
  });
});

describe("yjsSync - bezpieczne domyślne (A02)", () => {
  beforeEach(() => {
    localStorage.clear();
    providerInstances.length = 0;
    vi.resetModules();
  });

  it("domyślnie dołącza tylko do pokoju SHA-256 (stary pokój FNV ujawnia kod serwerowi sygnalizacyjnemu)", async () => {
    const { startPairing, roomNameV2For, getLegacyRoom } = await import("./yjsSync");
    expect(getLegacyRoom()).toBe(false);
    const code = startPairing();
    await waitForMainProvider(1);
    expect(mainProviders().map((p) => p.roomName)).toEqual([await roomNameV2For(code)]);
    expect(mainProviders().every((p) => !/^kaczy-[0-9a-f]{16}$/.test(p.roomName))).toBe(true);
  });

  it("zgodność można włączyć jawnie i jest zapamiętana", async () => {
    const { setLegacyRoom, getLegacyRoom, roomNamesFor, roomNameFor } = await import("./yjsSync");
    setLegacyRoom(true);
    expect(getLegacyRoom()).toBe(true);
    expect(await roomNamesFor("ABCDEFGHJKMN")).toContain(roomNameFor("ABCDEFGHJKMN"));
  });

  it("uszkodzone ustawienia w localStorage nie wywracają synchronizacji", async () => {
    localStorage.setItem("kaczy.sync.v1", JSON.stringify({ enabled: true, code: { evil: 1 }, signaling: [5, "wss://ok.example.com", "javascript:alert(1)"], legacyRoom: "yes" }));
    const { getSyncState, getSignalingServers, getLegacyRoom } = await import("./yjsSync");
    expect(getSyncState().code).toBeNull();
    expect(getSignalingServers()).toEqual(["wss://ok.example.com"]);
    expect(getLegacyRoom()).toBe(false);
  });

  it("codeFromPaste wyciąga kod z linku i grup", async () => {
    const { codeFromPaste } = await import("./yjsSync");
    expect(codeFromPaste("abcd efgh-jkmn")).toBe("ABCDEFGHJKMN");
    expect(codeFromPaste("https://x.pl/app/?pair=ABCDEFGHJKMN#n")).toBe("ABCDEFGHJKMN");
    expect(codeFromPaste(" ABCD EFGH.")).toBe("ABCDEFGH");
    expect(codeFromPaste("ABCDEFGHJKMNPQRS")).toBe("ABCDEFGHJKMN");
  });

  it("isShortCode rozpoznaje stare 8-znakowe kody", async () => {
    const { isShortCode } = await import("./yjsSync");
    expect(isShortCode("ABCDEFGH")).toBe(true);
    expect(isShortCode("ABCDEFGHJKMN")).toBe(false);
    expect(isShortCode(null)).toBe(false);
  });

  it("zapisany krótki kod jest usuwany: sync wyłączony, komunikat zostaje do ponownego sparowania", async () => {
    localStorage.setItem("kaczy.sync.v1", JSON.stringify({ enabled: true, code: "ABCDEFGH", signaling: [], legacyRoom: false }));
    const { wasShortCodeDropped, getSyncState } = await import("./yjsSync");
    expect(wasShortCodeDropped()).toBe(true);
    expect(getSyncState().code).toBeNull();
  });
});

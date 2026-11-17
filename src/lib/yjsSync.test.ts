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
// Pod obciążeniem (pełny przebieg Vitesta) liczenie PBKDF2 pokoju v3 potrafi przekroczyć domyślne 5 s testu.
vi.setConfig({ testTimeout: 30_000 });

// Pokój v3 liczy PBKDF2 (200 tys. iteracji), więc połączenie pod obciążeniem trwa dłużej niż domyślna sekunda.
const waitFor = (fn: () => void) => vi.waitFor(fn, { timeout: 8000 });

async function waitForMainProvider(countAtLeast = ROOMS_PER_CONNECT): Promise<void> {
  await waitFor(() => {
    if (mainProviders().length < countAtLeast) throw new Error("provider not connected yet");
  });
}

describe("yjsSync", () => {
  beforeEach(async () => {
    localStorage.clear();
    // Większość testów dotyczy maszynerii dwóch pokoi, więc zgodność ze starą wersją jest w nich włączana
    // jawnie po startPairing (nowy kod ją zeruje); domyślne zachowanie sprawdza blok niżej.
    localStorage.setItem("kaczy.sync.v1", JSON.stringify({ enabled: false, code: null, signaling: [], legacyRoom: true }));
    providerInstances.length = 0;
    vi.resetModules();
  });

  it("generates codes from the safe alphabet at the expected length", async () => {
    const { generateCode, parseCode } = await import("./yjsSync");
    for (let i = 0; i < 20; i++) {
      const long = generateCode();
      expect(long).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{28}$/);
      expect(parseCode(long)).toEqual({ code: long, kind: "long" });
      expect(generateCode("short")).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{12}$/);
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
    const { startPairing, getSyncState, roomNameFor, roomNameV3For } = await import("./yjsSync");
    const code = startPairing("short"); (await import("./yjsSync")).setLegacyRoom(true); // nowy kod zeruje zgodność
    expect(getSyncState().code).toBe(code);
    expect(getSyncState().status).toBe("connecting");

    await waitForMainProvider();
    expect(mainProviders().map((p) => p.roomName)).toEqual([await roomNameV3For(code), roomNameFor(code)]);
    for (const p of mainProviders()) expect(p.opts).toEqual({ password: code });
  });

  it("also starts the separate image transport, sharing the same pairing code", async () => {
    const { startPairing } = await import("./yjsSync");
    const code = startPairing("short"); (await import("./yjsSync")).setLegacyRoom(true); // nowy kod zeruje zgodność

    await waitFor(() => {
      if (providerInstances.filter((p) => p.roomName.endsWith("-img2")).length === 0) {
        throw new Error("image provider not connected yet");
      }
    });
    await waitFor(() => {
      if (providerInstances.filter((p) => p.roomName.endsWith("-img2")).length < ROOMS_PER_CONNECT) {
        throw new Error("image providers not connected yet");
      }
    });
    await waitForMainProvider();
    const imageProviders = providerInstances.filter((p) => p.roomName.endsWith("-img2"));
    expect(imageProviders).toHaveLength(ROOMS_PER_CONNECT);
    expect(imageProviders.map((p) => p.roomName.replace(/-img2$/, ""))).toEqual(mainProviders().map((p) => p.roomName));
    for (const p of imageProviders) expect(p.opts).toEqual({ password: code });
  });

  it("is connected when any room is, and counts devices as the max over rooms", async () => {
    const { startPairing, getSyncState } = await import("./yjsSync");
    startPairing("short"); (await import("./yjsSync")).setLegacyRoom(true); // nowy kod zeruje zgodność
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
    const code = startPairing("short"); (await import("./yjsSync")).setLegacyRoom(true); // nowy kod zeruje zgodność
    // Pokoje tego kodu. Asercje tylko na nich: asynchroniczny connect z poprzedniego testu
    // (po vi.resetModules) może jeszcze dołożyć providery z innego kodu, których ten test nie kontroluje.
    const rooms = (await roomNamesFor(code)).flatMap((r) => [r, `${r}-img2`]);
    const mine = () => providerInstances.filter((p) => rooms.includes(p.roomName));
    await waitFor(() => { if (mine().length < 2 * ROOMS_PER_CONNECT) throw new Error("not all up"); });
    const firstRound = mine();

    pauseSync();
    for (const p of firstRound) expect(p.destroyed).toBe(true);
    expect(getSyncState().status).toBe("disabled");
    expect(getSyncState().code).toBe(code); // remembered

    resumeSync();
    await waitFor(() => { if (mine().filter((p) => !p.destroyed).length < 2 * ROOMS_PER_CONNECT) throw new Error("not resumed yet"); });
    const resumed = mine().filter((p) => !p.destroyed && !firstRound.includes(p));
    expect(resumed.filter((p) => !p.roomName.endsWith("-img2"))).toHaveLength(ROOMS_PER_CONNECT);
    for (const p of resumed.filter((p) => !p.roomName.endsWith("-img2"))) expect(p.opts).toEqual({ password: code });
  });

  it("forgetPairing disconnects and clears the code entirely", async () => {
    const { startPairing, forgetPairing, getSyncState } = await import("./yjsSync");
    const before = mainProviders().length;
    startPairing("short"); (await import("./yjsSync")).setLegacyRoom(true); // nowy kod zeruje zgodność
    await waitForMainProvider(before + ROOMS_PER_CONNECT);

    forgetPairing();
    for (const p of mainProviders().slice(before)) expect(p.destroyed).toBe(true);
    expect(getSyncState().code).toBeNull();
    expect(getSyncState().status).toBe("disabled");
  });

  it("initSync reconnects automatically when a prior session was enabled", async () => {
    const first = await import("./yjsSync");
    const code = first.startPairing("short");
    (await import("./yjsSync")).setLegacyRoom(true); // nowy kod zeruje zgodność
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
    startPairing("short"); (await import("./yjsSync")).setLegacyRoom(true); // nowy kod zeruje zgodność
    await waitForMainProvider();
    for (const p of providerInstances) expect((p.opts as { signaling?: string[] }).signaling).toBeUndefined();
  });

  it("custom servers go to BOTH text and image providers and reconnect", async () => {
    const { startPairing, setSignalingServers, getSignalingServers } = await import("./yjsSync");
    const code = startPairing("short"); (await import("./yjsSync")).setLegacyRoom(true); // nowy kod zeruje zgodność
    await waitForMainProvider();
    const before = [...providerInstances];
    setSignalingServers(["wss://sig.example.com", "not a url"]);
    expect(getSignalingServers()).toEqual(["wss://sig.example.com"]);
    await waitFor(() => {
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

  it("domyślnie dołącza tylko do pokoju PBKDF2 (stare pokoje FNV i SHA-256 ujawniają kod serwerowi sygnalizacyjnemu)", async () => {
    const { startPairing, roomNameV3For, getLegacyRoom } = await import("./yjsSync");
    expect(getLegacyRoom()).toBe(false);
    const code = startPairing();
    await waitForMainProvider(1);
    expect(mainProviders().map((p) => p.roomName)).toEqual([await roomNameV3For(code)]);
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
    // Bez cichego obcinania do 12 (kod długi ma 28 znaków) — 16 znaków odrzuci dopiero parseCode.
    expect(codeFromPaste("ABCDEFGHJKMNPQRS")).toBe("ABCDEFGHJKMNPQRS");
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

describe("pokój v3 (S3)", () => {
  beforeEach(() => {
    localStorage.clear();
    providerInstances.length = 0;
    vi.resetModules();
  });

  it("nazwa v3: deterministyczna, 128 bitów, bez kodu i inna niż v2", async () => {
    const { roomNameV3For, roomNameV2For } = await import("./yjsSync");
    const a = await roomNameV3For("ABCDEFGHJKMN");
    expect(a).toBe(await roomNameV3For("ABCDEFGHJKMN"));
    expect(a).not.toBe(await roomNameV3For("ABCDEFGHJKMP"));
    expect(a).toMatch(/^kaczy3-[0-9a-f]{32}$/);
    expect(a).not.toContain("ABCDEFGHJKMN");
    expect(a).not.toBe(await roomNameV2For("ABCDEFGHJKMN"));
  });

  it("istniejąca grupa (zapis bez v2Until) dostaje po initSync 30 dni na pokój v2", async () => {
    localStorage.setItem("kaczy.sync.v1", JSON.stringify({ enabled: true, code: "ABCDEFGHJKMN", signaling: [], legacyRoom: false }));
    const { initSync, v2CompatActive, roomNamesFor, roomNameV3For, roomNameV2For } = await import("./yjsSync");
    initSync();
    expect(v2CompatActive()).toBe(true);
    expect(await roomNamesFor("ABCDEFGHJKMN")).toEqual([await roomNameV3For("ABCDEFGHJKMN"), await roomNameV2For("ABCDEFGHJKMN")]);
    expect(v2CompatActive(Date.now() + 31 * 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("nowa grupa nie dołącza do v2, a dołączenie po kodzie otwiera okno zgodności", async () => {
    const { startPairing, joinWithCode, v2CompatActive } = await import("./yjsSync");
    startPairing();
    expect(v2CompatActive()).toBe(false);
    joinWithCode("ABCDEFGHJKMN");
    expect(v2CompatActive()).toBe(true);
  });
});

const DAY = 24 * 60 * 60 * 1000;
const SHORT = "ABCDEFGHJKMN";
const setPrefs = (p: Record<string, unknown>) =>
  localStorage.setItem("kaczy.sync.v1", JSON.stringify({ enabled: false, code: null, signaling: [], legacyRoom: false, ...p }));
const storedPrefs = () => JSON.parse(localStorage.getItem("kaczy.sync.v1") ?? "{}") as Record<string, unknown>;

describe("kod długi i koniec pokoi v2 (Z-15.1, Z-15.2)", () => {
  beforeEach(() => {
    localStorage.clear();
    providerInstances.length = 0;
    vi.resetModules();
  });

  it("wektory zgodności: kod 12-znakowy daje te same pokoje i klucze co przed kodem długim", async () => {
    const { roomNameV3For } = await import("./yjsSync");
    const { deriveRelayKeys } = await import("./sync/relayKeys");
    // Policzone na wyprowadzeniu sprzed Z-15.1 — zmiana któregokolwiek rozdzieliłaby istniejące grupy.
    expect(await roomNameV3For(SHORT)).toBe("kaczy3-8c80e6226002702a84238cf780813e3e");
    const keys = await deriveRelayKeys(SHORT);
    expect(keys.roomId).toBe("1b319f26014f5db8dec80f1f9bed0cacc8828510b6bcc8f79f3265574cd44ac1");
    expect(keys.token).toBe("4cSUSmWWvBXruT9CM-fcLB1DzT7Vu-Q8ADyxNOubvs8");
  });

  it("tabela pokoi: kod krótki/długi × okno trwa/minęło × zgodność ze starszą wersją", async () => {
    const { roomNamesFor, roomNameFor, roomNameV2For, roomNameV3For, generateCode } = await import("./yjsSync");
    const LONG = generateCode("long");
    const now = Date.now();
    for (const kind of ["short", "long"] as const) {
      const code = kind === "short" ? SHORT : LONG;
      for (const windowOpen of [true, false]) {
        for (const legacyRoom of [false, true]) {
          setPrefs({ code, v2Until: windowOpen ? now + DAY : now - DAY, legacyRoom });
          const expected = [await roomNameV3For(code)];
          if (kind === "short" && windowOpen) expected.push(await roomNameV2For(code));
          if (kind === "short" && legacyRoom) expected.push(roomNameFor(code));
          expect(await roomNamesFor(code), `${kind} okno=${windowOpen} zgodność=${legacyRoom}`).toEqual(expected);
        }
      }
    }
  });

  it("dołączenie: link z v=3 i kod długi bez okna v2; zwykły kod krótki — 30 dni; zły kod odrzucony", async () => {
    const { joinWithCode, getV2Until, generateCode } = await import("./yjsSync");
    expect(joinWithCode(SHORT, { v3: true })).toBe(SHORT);
    expect(getV2Until()).toBeNull();
    expect(joinWithCode(generateCode("long"))).not.toBeNull();
    expect(getV2Until()).toBeNull();
    joinWithCode("ABCDEFGHJKMP");
    expect(getV2Until()).toBeGreaterThan(Date.now() + 29 * DAY);
    const long = generateCode("long");
    const typo = long.slice(0, 5) + (long[5] === "A" ? "B" : "A") + long.slice(6);
    expect(joinWithCode(typo)).toBeNull();
    expect(joinWithCode("ABCDEFGH")).toBeNull();
  });

  it("propozycja nowego kodu po końcu okna, gdy kod bywał w starszych pokojach", async () => {
    const now = Date.now();
    setPrefs({ code: SHORT, v2Until: now - DAY, v2Exposed: true, legacyExposed: false });
    const mod = await import("./yjsSync");
    expect(mod.newCodeProposal()).toBe("v2");
    setPrefs({ code: SHORT, v2Until: now - DAY, v2Exposed: true, legacyExposed: true });
    expect(mod.newCodeProposal()).toBe("legacy");
    setPrefs({ code: SHORT, v2Until: now + DAY, v2Exposed: true });
    expect(mod.newCodeProposal()).toBeNull(); // okno trwa
    setPrefs({ code: SHORT, v2Until: null, v2Exposed: false, legacyExposed: false });
    expect(mod.newCodeProposal()).toBeNull(); // nigdy w starszych pokojach
    setPrefs({ code: mod.generateCode("long"), v2Until: now - DAY, v2Exposed: true });
    expect(mod.newCodeProposal()).toBeNull(); // kod długi
    // Zapis sprzed tych pól: kod krótki z oknem v2 był w pokoju v2.
    setPrefs({ code: SHORT, v2Until: now - DAY });
    expect(mod.newCodeProposal()).toBe("v2");
    mod.dismissNewCodeHint();
    expect(storedPrefs().newCodeHint).toBe("dismissed");
    // Zmiana kodu zeruje propozycję i baner.
    mod.joinWithCode("ABCDEFGHJKMP");
    expect(storedPrefs()).toMatchObject({ v2Exposed: false, legacyExposed: false, newCodeHint: "open", ignoredRekey: [] });
  });

  it("połączenie z pokojem v2 zapisuje v2Exposed", async () => {
    const { joinWithCode } = await import("./yjsSync");
    joinWithCode(SHORT);
    await waitForMainProvider(2);
    await waitFor(() => { if (storedPrefs().v2Exposed !== true) throw new Error("not yet"); });
  });

  it("okno v2 przedłuża się, gdy stare urządzenie było w v2 w ostatnich 14 dniach", async () => {
    const now = Date.now();
    setPrefs({ enabled: true, code: SHORT, v2Until: now - 1000, v2Start: now - 31 * DAY });
    localStorage.setItem("kaczy.sync.v2only.v1", JSON.stringify({ Tablet: now - DAY }));
    const { initSync, getV2Until, roomNamesFor } = await import("./yjsSync");
    initSync();
    expect(getV2Until()).toBeGreaterThan(now + 28 * DAY);
    expect(storedPrefs().v2Start).toBe(now - 31 * DAY);
    expect(await roomNamesFor(SHORT)).toHaveLength(2);
    await waitForMainProvider(2); // połączenie dokończone tu, nie w następnym teście
  });

  it("urządzenie tylko w pokoju v2 przez minutę trafia do v2Only; po pojawieniu się w v3 znika", async () => {
    const { joinWithCode, roomNameV2For } = await import("./yjsSync");
    const { getV2Only } = await import("./sync/v2Window");
    joinWithCode(SHORT);
    await waitForMainProvider(2);
    const v2Name = await roomNameV2For(SHORT);
    const v2 = mainProviders().filter((p) => p.roomName === v2Name).at(-1)!;
    const v3 = mainProviders().filter((p) => p.roomName !== v2Name).at(-1)!;
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      v2.awareness.remote(50, { device: { name: "Tablet" } });
      expect(getV2Only()).toEqual({});
      vi.setSystemTime(Date.now() + 61_000);
      v2.awareness.remote(50, { device: { name: "Tablet" } });
      expect(Object.keys(getV2Only())).toEqual(["Tablet"]);
      v3.awareness.remote(51, { device: { name: "Tablet" } });
      expect(getV2Only()).toEqual({});
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("wymiana kodu — zatrzymanie po znaczniku (D2)", () => {
  beforeEach(() => {
    localStorage.clear();
    providerInstances.length = 0;
    vi.resetModules();
  });

  async function markerFor(code: string) {
    const { roomNameV3For } = await import("./yjsSync");
    const { buildMarkerUpdate, newRekeyId, rekeyTag } = await import("./sync/rekey");
    const marker = { id: newRekeyId(), tag: await rekeyTag(await roomNameV3For(code)), at: Date.now() };
    return { marker, update: buildMarkerUpdate(marker) };
  }

  it("znacznik dla obecnego kodu zatrzymuje synchronizację; „Synchronizuj dalej” ją wznawia", async () => {
    const mod = await import("./yjsSync");
    const { yjsStore } = await import("./yjsStore");
    const Y = await import("yjs");
    mod.joinWithCode(SHORT, { v3: true });
    await waitForMainProvider(1);
    const first = mainProviders();
    const { marker, update } = await markerFor(SHORT);
    Y.applyUpdate(yjsStore.doc, update);
    await waitFor(() => { if (mod.getSyncState().status !== "rekeyed") throw new Error("not halted"); });
    for (const p of first) expect(p.destroyed).toBe(true);
    expect(storedPrefs().enabled).toBe(true); // §3.3 p. 4: enabled zostaje

    mod.continueOnOldCode();
    expect(storedPrefs().ignoredRekey).toEqual([marker.id]);
    await waitFor(() => { if (mainProviders().filter((p) => !p.destroyed).length < 1) throw new Error("not resumed"); });
    expect(mod.getSyncState().status).not.toBe("rekeyed");
  });

  it("znacznik już w dokumencie: połączenie nie startuje żadnego dostawcy", async () => {
    const mod = await import("./yjsSync");
    const { yjsStore } = await import("./yjsStore");
    const Y = await import("yjs");
    Y.applyUpdate(yjsStore.doc, (await markerFor(SHORT)).update);
    mod.joinWithCode(SHORT, { v3: true });
    await waitFor(() => { if (mod.getSyncState().status !== "rekeyed") throw new Error("not halted"); });
    await new Promise((r) => setTimeout(r, 50));
    expect(mainProviders().filter((p) => !p.destroyed)).toHaveLength(0);
  });

  it("znacznik innego kodu jest ignorowany", async () => {
    const mod = await import("./yjsSync");
    const { yjsStore } = await import("./yjsStore");
    const Y = await import("yjs");
    Y.applyUpdate(yjsStore.doc, (await markerFor("ABCDEFGHJKMP")).update);
    // Znaczniki z poprzednich testów zostają w dokumencie (trwały zapis), więc tu kod, którego nikt nie oznaczył.
    mod.joinWithCode("ABCDEFGHJKMQ", { v3: true });
    await waitForMainProvider(1);
    expect(mod.getSyncState().status).toBe("connecting");
  });

  it("dołączenie nowym kodem po zatrzymaniu łączy normalnie", async () => {
    const mod = await import("./yjsSync");
    const { yjsStore } = await import("./yjsStore");
    const Y = await import("yjs");
    Y.applyUpdate(yjsStore.doc, (await markerFor(SHORT)).update);
    mod.joinWithCode(SHORT, { v3: true });
    await waitFor(() => { if (mod.getSyncState().status !== "rekeyed") throw new Error("not halted"); });
    const fresh = mod.generateCode("long");
    mod.joinWithCode(fresh);
    await waitForMainProvider(1);
    expect(mod.getSyncState()).toMatchObject({ code: fresh, status: "connecting" });
  });

  it("I-5: kod zmieniony w innej karcie — ta karta łączy się nowym; wyłączenie — rozłącza", async () => {
    setPrefs({ enabled: true, code: "ABCDEFGHJKMS", v2Until: null });
    const mod = await import("./yjsSync");
    mod.initSync();
    await waitForMainProvider(1);
    const fresh = mod.generateCode("long");
    setPrefs({ enabled: true, code: fresh, v2Until: null });
    window.dispatchEvent(new StorageEvent("storage", { key: "kaczy.sync.v1" }));
    expect(mod.getSyncState().code).toBe(fresh);
    setPrefs({ enabled: false, code: null });
    window.dispatchEvent(new StorageEvent("storage", { key: "kaczy.sync.v1" }));
    expect(mod.getSyncState()).toMatchObject({ status: "disabled", code: null });
  });

  it("nowy kod zeruje zgodność ze starszą wersją (pokój FNV nie przechodzi na nowy kod)", async () => {
    setPrefs({ enabled: false, code: SHORT, legacyRoom: true, v2Until: null });
    const mod = await import("./yjsSync");
    mod.joinWithCode("ABCDEFGHJKMP");
    expect(storedPrefs().legacyRoom).toBe(false);
    mod.setLegacyRoom(true);
    mod.startPairing("short");
    expect(storedPrefs().legacyRoom).toBe(false);
  });

  it("od kroku marked własny znacznik zatrzymuje połączenie starym kodem (przełączenie się nie udało)", async () => {
    const { rekeyTag } = await import("./sync/rekey");
    const mod = await import("./yjsSync");
    const { yjsStore } = await import("./yjsStore");
    const Y = await import("yjs");
    const { buildMarkerUpdate } = await import("./sync/rekey");
    const code = "ABCDEFGHJKMT";
    const tag = await rekeyTag(await mod.roomNameV3For(code));
    const id = "c".repeat(32);
    Y.applyUpdate(yjsStore.doc, buildMarkerUpdate({ id, tag, at: Date.now() }));
    // Zapis w kroku marked, ale ustawienia wciąż ze starym kodem (np. inna karta trzyma blokadę wymiany).
    localStorage.setItem("kaczy.sync.rekey.v1", JSON.stringify({
      v: 1, id, step: "marked", oldCode: code, newCode: mod.generateCode("long"), tag, relay: null, startedAt: Date.now(), devices: [],
    }));
    mod.joinWithCode(code, { v3: true });
    await waitFor(() => { if (mod.getSyncState().status !== "rekeyed") throw new Error("not halted"); });
  });

  it("I-6: start w kroku `marked` kończy przełączenie i łączy się nowym kodem", async () => {
    const { generateCode } = await import("./sync/pairCode");
    const newCode = generateCode("long");
    setPrefs({ enabled: true, code: SHORT, v2Until: null, legacyRoom: true });
    localStorage.setItem("kaczy.sync.rekey.v1", JSON.stringify({
      v: 1, id: "a".repeat(32), step: "marked", oldCode: SHORT, newCode, tag: "b".repeat(32), relay: null, startedAt: Date.now(), devices: [],
    }));
    const mod = await import("./yjsSync");
    mod.initSync();
    await waitFor(() => { if (mod.getSyncState().code !== newCode) throw new Error("not switched"); });
    expect(storedPrefs()).toMatchObject({ code: newCode, enabled: true, v2Until: null, legacyRoom: false });
    await waitFor(() => {
      const r = JSON.parse(localStorage.getItem("kaczy.sync.rekey.v1") ?? "{}") as { step?: string };
      if (r.step !== "done") throw new Error(`step ${r.step}`);
    });
    // Starym kodem nie połączyło się ani razu (I-2).
    const oldRoom = await mod.roomNameV3For(SHORT);
    expect(providerInstances.some((p) => p.roomName === oldRoom)).toBe(false);
  });
});

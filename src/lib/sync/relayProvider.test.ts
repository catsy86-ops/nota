import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";
import { RelayProvider, COMPACT_AFTER, KEEPALIVE_MS, type RelayState, type RelayStatus, type RelayStore } from "@/lib/sync/relayProvider";
import { deriveRelayKeys, type RelayKeys } from "@/lib/sync/relayKeys";

/** Atrapa serwera o tym samym protokole co `relay-server/server.js` (bez limitów rozmiaru). */
const PAGE = 500;
interface FakeRoom {
  token: string;
  last: number;
  entries: { seq: number; data: string }[];
}

function fakeServer() {
  const rooms = new Map<string, FakeRoom>();
  const control = { down: false, requests: 0 };
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    control.requests++;
    if (control.down) throw new TypeError("Failed to fetch");
    const url = new URL(String(input));
    const auth = new Headers(init?.headers).get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const m = url.pathname.match(/^\/rooms\/([a-f0-9]{64})\/(updates|snapshot)$/);
    if (!m) return json(404, { error: "trasa" });
    const [, id, action] = m;
    const method = init?.method ?? "GET";

    let room = rooms.get(id);
    if (method === "POST" && action === "updates" && !room) {
      room = { token, last: 0, entries: [] };
      rooms.set(id, room);
    }
    if (!room) return json(404, { error: "Nie ma takiego pokoju" });
    if (room.token !== token) return json(403, { error: "Zły token" });

    if (method === "GET" && action === "updates") {
      const since = Number(url.searchParams.get("since") ?? 0);
      const after = room.entries.filter((e) => e.seq > since);
      const entries = after.slice(0, PAGE);
      return json(200, { entries, last: room.last, hasMore: after.length > PAGE });
    }
    if (method === "POST" && action === "updates") {
      const body = JSON.parse(String(init?.body));
      room.last += 1;
      room.entries.push({ seq: room.last, data: body.data });
      return json(200, { seq: room.last, last: room.last });
    }
    if (method === "PUT" && action === "snapshot") {
      const body = JSON.parse(String(init?.body));
      if (!Number.isSafeInteger(body.upto) || body.upto < 1 || body.upto > room.last) return json(400, { error: "upto" });
      room.entries = [{ seq: body.upto, data: body.data }, ...room.entries.filter((e) => e.seq > body.upto)];
      return json(200, { seq: body.upto, last: room.last });
    }
    return json(405, { error: "metoda" });
  }) as typeof fetch;

  return { fetchFn, rooms, control };
}

class MemStore implements RelayStore {
  pending: Uint8Array | null = null;
  state: RelayState = { cursor: 0, compactedAt: 0 };
  async loadPending() {
    return this.pending;
  }
  async savePending(bytes: Uint8Array | null) {
    this.pending = bytes;
  }
  async loadState() {
    return { ...this.state };
  }
  async saveState(state: RelayState) {
    this.state = { ...state };
  }
}

const ITER = 1000; // w testach zamiast 200 000 — tylko wyprowadzenie kluczy
const CODE = "ABCDEFGHJKMN";

async function device(keys: RelayKeys, server: ReturnType<typeof fakeServer>, opts: { store?: MemStore; statuses?: RelayStatus[] } = {}) {
  const doc = new Y.Doc();
  const store = opts.store ?? new MemStore();
  const provider = new RelayProvider({
    baseUrl: "https://relay.test",
    keys,
    doc,
    store,
    fetch: server.fetchFn,
    flushMs: 5,
    onStatus: (s) => opts.statuses?.push(s),
  });
  await provider.start();
  return { doc, store, provider, text: doc.getText("t") };
}

async function until(cond: () => boolean, ms = 3000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("klucze przekaźnika", () => {
  it("są deterministyczne i zależą od kodu", async () => {
    const a = await deriveRelayKeys(CODE, ITER);
    const b = await deriveRelayKeys(CODE, ITER);
    const c = await deriveRelayKeys("ZZZZZZZZZZZZ", ITER);
    expect(a.roomId).toMatch(/^[a-f0-9]{64}$/);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(b.roomId).toBe(a.roomId);
    expect(b.token).toBe(a.token);
    expect(c.roomId).not.toBe(a.roomId);
    expect(c.token).not.toBe(a.token);
  });

  it("identyfikator i token nie zawierają kodu", async () => {
    const k = await deriveRelayKeys(CODE, ITER);
    expect(k.roomId.toUpperCase()).not.toContain(CODE);
    expect(k.token).not.toContain(CODE);
  });
});

describe("RelayProvider", () => {
  it("zmiana z jednego urządzenia trafia na drugie", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const a = await device(keys, server);
    const b = await device(keys, server);

    a.doc.transact(() => a.text.insert(0, "Dziś na budowie"));
    await until(() => b.text.toString() === "Dziś na budowie");
    expect(b.provider.cursor).toBe(1);
    a.provider.stop();
    b.provider.stop();
  });

  it("nowe urządzenie dostaje całą historię, także gdy nadawca już wyłączony", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const a = await device(keys, server);
    a.doc.transact(() => a.text.insert(0, "raz "));
    await until(() => server.rooms.size === 1 && [...server.rooms.values()][0].last === 1);
    a.provider.stop();

    const c = await device(keys, server);
    await until(() => c.text.toString() === "raz ");
    c.provider.stop();
  });

  it("zapis offline trafia na serwer po powrocie łączności", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const statuses: RelayStatus[] = [];
    const a = await device(keys, server, { statuses });
    server.control.down = true;
    a.doc.transact(() => a.text.insert(0, "w pociągu"));
    await until(() => statuses.includes("offline"));

    server.control.down = false;
    const b = await device(keys, server);
    // Ponowienie idzie z rosnącą przerwą; wymuszamy je, zamiast czekać minutami.
    a.provider.sync();
    await until(() => b.text.toString() === "w pociągu");
    a.provider.stop();
    b.provider.stop();
  });

  it("kolejka offline przeżywa restart (zapisana w magazynie)", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const store = new MemStore();
    // Zmiana sprzed restartu: w magazynie leży jej jeszcze niewysłany zapis.
    const before = new Y.Doc();
    before.getText("t").insert(0, "przed zamknięciem");
    store.pending = Y.encodeStateAsUpdate(before);

    const a = await device(keys, server, { store });
    await until(() => server.rooms.size === 1 && [...server.rooms.values()][0].last === 1);
    expect(store.pending).toBeNull();
    const b = await device(keys, server);
    await until(() => b.text.toString() === "przed zamknięciem");
    a.provider.stop();
    b.provider.stop();
  });

  it("zły klucz danych daje błąd, a kursor nie idzie dalej", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const a = await device(keys, server);
    a.doc.transact(() => a.text.insert(0, "tajne"));
    await until(() => [...server.rooms.values()][0]?.last === 1);
    a.provider.stop();

    const other = await deriveRelayKeys("ZZZZZZZZZZZZ", ITER);
    // Ten sam pokój, obcy klucz szyfrujący: symulacja uszkodzonego wpisu lub zmiany kodu.
    const wrongKeys: RelayKeys = { ...keys, dataKey: other.dataKey };
    const statuses: RelayStatus[] = [];
    const c = await device(wrongKeys, server, { statuses });
    await until(() => statuses.includes("error"));
    expect(c.text.toString()).toBe("");
    expect(c.provider.cursor).toBe(0);
    c.provider.stop();
  });

  it("zły token: status błędu, nic nie zapisane w dokumencie", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const a = await device(keys, server);
    a.doc.transact(() => a.text.insert(0, "x"));
    await until(() => [...server.rooms.values()][0]?.last === 1);
    a.provider.stop();

    const statuses: RelayStatus[] = [];
    const bad = await deriveRelayKeys(CODE, ITER);
    const c = await device({ ...bad, token: "B".repeat(43) }, server, { statuses });
    await until(() => statuses.includes("error"));
    expect(c.text.toString()).toBe("");
    c.provider.stop();
  });

  it(`po ${COMPACT_AFTER} wpisach robi snapshot, a nowe urządzenie nadal dostaje pełny stan`, async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const a = await device(keys, server);
    for (let i = 0; i < COMPACT_AFTER + 2; i++) {
      a.doc.transact(() => a.text.insert(a.text.length, "."));
      a.provider.flushNow();
      // Czekamy na wysłanie każdej partii, żeby numery się zgadzały.
      await until(() => a.store.pending === null);
    }
    await until(() => a.provider.cursor > 0 && a.store.state.compactedAt > 0);

    const room = [...server.rooms.values()][0];
    expect(room.entries.some((e) => e.seq === a.store.state.compactedAt)).toBe(true);
    expect(room.entries.length).toBeLessThan(COMPACT_AFTER);

    const c = await device(keys, server);
    await until(() => c.text.toString() === a.text.toString(), 10_000);
    a.provider.stop();
    c.provider.stop();
  }, 60_000);

  it("onRemoteChange: tylko przy realnej zmianie od innego urządzenia, nie przy echu własnego wpisu", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const doc = new Y.Doc();
    let remote = 0;
    const a = new RelayProvider({
      baseUrl: "https://relay.test", keys, doc, store: new MemStore(), fetch: server.fetchFn, flushMs: 5,
      onRemoteChange: () => remote++,
    });
    await a.start();
    const b = await device(keys, server);

    doc.transact(() => doc.getText("t").insert(0, "moje"));
    await until(() => [...server.rooms.values()][0]?.last === 1);
    a.sync(); // pobranie własnego wpisu: echo, bez zmiany dokumentu
    await new Promise((r) => setTimeout(r, 50));
    expect(remote).toBe(0);

    b.doc.transact(() => b.text.insert(0, "obce "));
    b.provider.flushNow();
    // Bez gniazda (brak WS w teście) pobiera się ręcznie; czekanie na ponowienie byłoby kruche.
    await until(() => [...server.rooms.values()][0]?.last === 2);
    a.sync();
    // Kolejność dwóch wstawek na tej samej pozycji zależy od identyfikatorów klientów Yjs — sprawdzamy obecność obu.
    await until(() => doc.getText("t").toString().includes("obce"));
    expect(doc.getText("t").toString()).toContain("moje");
    expect(remote).toBeGreaterThan(0);
    a.stop();
    b.provider.stop();
  });

  it("schowana karta pinguje gniazdo, a powrót wyłącza ping", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    try {
      const server = fakeServer();
      const keys = await deriveRelayKeys(CODE, ITER);
      const sent: string[] = [];
      const socket = { readyState: 1, send: (m: string) => sent.push(m), close: () => {}, onopen: null, onmessage: null, onclose: null };
      const doc = new Y.Doc();
      const p = new RelayProvider({
        baseUrl: "https://relay.test", keys, doc, store: new MemStore(), fetch: server.fetchFn,
        openSocket: () => socket as unknown as WebSocket,
      });
      await p.start();
      p.setHidden(true);
      vi.advanceTimersByTime(KEEPALIVE_MS * 2);
      expect(sent.filter((m) => m.includes('"ping"')).length).toBe(2);
      p.setHidden(false);
      sent.length = 0;
      vi.advanceTimersByTime(KEEPALIVE_MS * 2);
      expect(sent.filter((m) => m.includes('"ping"')).length).toBe(0);
      p.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stop() odpina nasłuch: późniejsze zmiany nie wychodzą", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const a = await device(keys, server);
    a.provider.stop();
    const before = server.control.requests;
    a.doc.transact(() => a.text.insert(0, "po stopie"));
    await new Promise((r) => setTimeout(r, 30));
    expect(server.control.requests).toBe(before);
  });
});

export type { RelayState };

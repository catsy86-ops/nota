import { describe, it, expect, vi } from "vitest";
import * as Y from "yjs";
import { RelayProvider, COMPACT_AFTER, KEEPALIVE_MS, MAX_ENTRY_CHARS, MAX_ENTRY_RAW_BYTES, packPending, splitByAuthor, takeBatch, type RelayState, type RelayStatus, type RelayStore } from "@/lib/sync/relayProvider";
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

async function device(keys: RelayKeys, server: ReturnType<typeof fakeServer>, opts: { store?: MemStore; statuses?: RelayStatus[]; codes?: (string | undefined)[] } = {}) {
  const doc = new Y.Doc();
  const store = opts.store ?? new MemStore();
  const provider = new RelayProvider({
    baseUrl: "https://relay.test",
    keys,
    doc,
    store,
    fetch: server.fetchFn,
    flushMs: 5,
    onStatus: (s, _d, c) => { opts.statuses?.push(s); opts.codes?.push(c); },
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

/**
 * Testy nie mają gniazda, a pusty pokój (404) nie jest już błędem z ponowieniem — urządzenie, które
 * wystartowało przed pierwszym zapisem, pobiera dopiero na `sync()` (w aplikacji: gniazdo, powrót do karty).
 */
async function untilPulled(provider: RelayProvider, cond: () => boolean, ms = 3000) {
  await until(() => {
    if (cond()) return true;
    provider.sync();
    return false;
  }, ms);
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
    await untilPulled(b.provider, () => b.text.toString() === "Dziś na budowie");
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

  it("przekaźnik stracił dane (pusty pokój): urządzenie dosyła pełny stan, nowe dostaje wszystko (S4.7)", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const store = new MemStore();
    const a = await device(keys, server, { store });
    a.doc.transact(() => a.text.insert(0, "przed awarią"));
    await until(() => [...server.rooms.values()][0]?.last === 1);
    a.provider.stop();

    server.rooms.clear(); // dysk przekaźnika przepadł, kopii nie ma

    const a2 = new RelayProvider({ baseUrl: "https://relay.test", keys, doc: a.doc, store, fetch: server.fetchFn, flushMs: 5 });
    await a2.start();
    a.doc.transact(() => a.text.insert(a.text.length, " i po"));
    await untilPulled(a2, () => server.rooms.size === 1);
    a2.stop();

    const b = await device(keys, server);
    await untilPulled(b.provider, () => b.text.toString() === "przed awarią i po");
    b.provider.stop();
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
    await untilPulled(b.provider, () => b.text.toString() === "w pociągu");
    a.provider.stop();
    b.provider.stop();
  });

  it("zmiany zrobione przed startem przekaźnika też trafiają na serwer", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    // Notatka powstała, zanim włączono synchronizację — bez wysłania przy starcie zostałaby lokalnie.
    const early = new Y.Doc();
    early.getText("t").insert(0, "sprzed startu");
    const store = new MemStore();
    const a = new RelayProvider({ baseUrl: "https://relay.test", keys, doc: early, store, fetch: server.fetchFn, flushMs: 5 });
    await a.start();
    const b = await device(keys, server);
    await untilPulled(b.provider, () => b.text.toString() === "sprzed startu");
    a.stop();
    b.provider.stop();
  });

  it("kolejny start wysyła tylko różnicę względem zapamiętanego stanu", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const doc = new Y.Doc();
    const store = new MemStore();
    doc.getText("t").insert(0, "pierwsze");
    const a1 = new RelayProvider({ baseUrl: "https://relay.test", keys, doc, store, fetch: server.fetchFn, flushMs: 5 });
    await a1.start();
    await until(() => [...server.rooms.values()][0]?.last === 1);
    a1.stop();
    doc.getText("t").insert(0, "drugie ");
    const a2 = new RelayProvider({ baseUrl: "https://relay.test", keys, doc, store, fetch: server.fetchFn, flushMs: 5 });
    await a2.start();
    await until(() => [...server.rooms.values()][0]?.last === 2);
    const room = [...server.rooms.values()][0];
    // Druga wysyłka to tylko „drugie ”, nie cały dokument od nowa.
    const second = room.entries[1].data;
    expect(second.length).toBeLessThan(room.entries[0].data.length + 60);
    a2.stop();
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

describe("Z-5.T: przerwania, błędy w połowie, kompaktowanie, 409, limit czasu, za duży wpis", () => {
  type Hook = (url: URL, method: string) => Promise<Response> | Response | undefined;
  /** Nakładka na atrapę serwera: `hook` może odpowiedzieć sam (albo zawiesić żądanie), inaczej idzie do serwera. */
  function hooked(server: ReturnType<typeof fakeServer>, hook: Hook) {
    const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const r = hook(new URL(String(input)), init?.method ?? "GET");
      return r ? await r : server.fetchFn(input, init);
    }) as typeof fetch;
    return { ...server, fetchFn };
  }
  const never = () => new Promise<Response>(() => {});
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("karta zamknięta w trakcie wysyłki: po ponownym starcie zmiana trafia na serwer", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    let hang = true;
    let inFlight = 0;
    const a = await device(keys, hooked(server, (_u, m) => (m === "POST" && hang ? (inFlight++, never()) : undefined)));
    a.doc.transact(() => a.text.insert(0, "w locie"));
    // Żądanie wisi; zaległość w magazynie bywa już pusta, ale `sv` przesuwa się dopiero po udanej wysyłce,
    // więc po restarcie różnica względem niego idzie jeszcze raz.
    await until(() => inFlight > 0);
    a.provider.stop();
    hang = false;
    const doc2 = new Y.Doc();
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(a.doc));
    const again = new RelayProvider({ baseUrl: "https://relay.test", keys, doc: doc2, store: a.store, fetch: server.fetchFn, flushMs: 5 });
    await again.start();
    const c = await device(keys, server);
    await untilPulled(c.provider, () => c.text.toString() === "w locie");
    again.stop();
    c.provider.stop();
  });

  it("uszkodzony wpis w połowie strony: błąd, kursor na ostatnim dobrym wpisie, wcześniejsze nałożone", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const a = await device(keys, server);
    for (const ch of ["1", "2", "3"]) {
      a.doc.transact(() => a.text.insert(a.text.length, ch));
      a.provider.flushNow();
      await until(() => a.store.pending === null && server.rooms.size > 0 && [...server.rooms.values()][0].last >= Number(ch));
    }
    const room = [...server.rooms.values()][0];
    const good = room.entries[1].data;
    room.entries[1] = { ...room.entries[1], data: good.slice(0, -8) + (good.endsWith("AAAAAAAA") ? "BBBBBBBB" : "AAAAAAAA") };
    const statuses: RelayStatus[] = [];
    const b = await device(keys, server, { statuses });
    b.provider.sync();
    await until(() => statuses.includes("error"));
    expect(b.text.toString()).toBe("1");
    expect(b.store.state.cursor).toBe(room.entries[0].seq);
    a.provider.stop();
    b.provider.stop();
  });

  it("klient z kursorem sprzed migawki dostaje pełny stan", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const a = await device(keys, server);
    a.doc.transact(() => a.text.insert(0, "początek "));
    a.provider.flushNow();
    await until(() => a.store.pending === null && a.provider.cursor > 0);
    const b = await device(keys, server);
    await untilPulled(b.provider, () => b.text.toString() === "początek ");
    const oldCursor = b.store.state.cursor;
    b.provider.stop();
    for (let i = 0; i < COMPACT_AFTER + 2; i++) {
      a.doc.transact(() => a.text.insert(a.text.length, "."));
      a.provider.flushNow();
      await until(() => a.store.pending === null);
    }
    await until(() => a.store.state.compactedAt > oldCursor);
    // Wpisy zaraz po starym kursorze zniknęły w migawce.
    expect([...server.rooms.values()][0].entries[0].seq).toBeGreaterThan(oldCursor + 1);
    const back = new RelayProvider({ baseUrl: "https://relay.test", keys, doc: b.doc, store: b.store, fetch: server.fetchFn, flushMs: 5 });
    await back.start();
    await untilPulled(back, () => b.text.toString() === a.text.toString(), 10_000);
    a.provider.stop();
    back.stop();
  }, 60_000);

  it("dwa urządzenia kompaktują naraz: trzecie dostaje pełny, zgodny stan", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const a = await device(keys, server);
    const b = await device(keys, server);
    for (let i = 0; i < COMPACT_AFTER + 2; i++) {
      const d = i % 2 ? a : b;
      d.doc.transact(() => d.text.insert(0, i % 2 ? "a" : "b"));
      d.provider.flushNow();
      await until(() => d.store.pending === null);
    }
    await untilPulled(a.provider, () => a.store.state.compactedAt > 0, 10_000);
    await untilPulled(b.provider, () => b.store.state.compactedAt > 0 && b.text.toString() === a.text.toString(), 10_000);
    const c = await device(keys, server);
    await untilPulled(c.provider, () => c.text.length === COMPACT_AFTER + 2, 10_000);
    expect(c.text.toString()).toBe(a.text.toString());
    a.provider.stop();
    b.provider.stop();
    c.provider.stop();
  }, 60_000);

  it("serwer odpowiada 409 (log pełny): migawka i ponowienie wysyłki", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const a0 = await device(keys, server);
    a0.doc.transact(() => a0.text.insert(0, "x"));
    a0.provider.flushNow();
    await until(() => a0.store.pending === null && a0.provider.cursor > 0);
    a0.provider.stop();
    let full = true;
    let puts = 0;
    const a = await device(keys, hooked(server, (u, m) => {
      if (m === "PUT" && u.pathname.endsWith("/snapshot")) { puts++; full = false; return undefined; }
      if (m === "POST" && full) return json(409, { error: "Log pełny" });
      return undefined;
    }));
    await untilPulled(a.provider, () => a.text.toString() === "x");
    a.doc.transact(() => a.text.insert(1, "y"));
    a.provider.flushNow();
    await until(() => a.store.pending === null && !full);
    expect(puts).toBe(1);
    const c = await device(keys, server);
    await untilPulled(c.provider, () => c.text.toString() === "xy");
    a.provider.stop();
    c.provider.stop();
  });

  it("409 także po migawce: stan „błąd” bez ponowień, zaległość zostaje", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const a0 = await device(keys, server);
    a0.doc.transact(() => a0.text.insert(0, "x"));
    a0.provider.flushNow();
    await until(() => a0.store.pending === null && a0.provider.cursor > 0);
    a0.provider.stop();
    let posts = 0;
    let puts = 0;
    const statuses: RelayStatus[] = [];
    const codes: (string | undefined)[] = [];
    const a = await device(keys, hooked(server, (u, m) => {
      if (m === "PUT" && u.pathname.endsWith("/snapshot")) puts++;
      if (m === "POST") { posts++; return json(409, { error: "Pokój pełny — zrób snapshot" }); }
      return undefined;
    }), { statuses, codes });
    await untilPulled(a.provider, () => a.text.toString() === "x");
    a.doc.transact(() => a.text.insert(1, "z"));
    a.provider.flushNow();
    await until(() => statuses.includes("error"));
    await new Promise((r) => setTimeout(r, 300));
    expect(posts).toBe(2);
    expect(puts).toBe(1);
    expect(statuses).not.toContain("offline");
    expect(codes[statuses.indexOf("error")]).toBe("ROOM_FULL");
    expect(a.store.pending).not.toBeNull();
    a.provider.stop();
  });

  it("żądanie bez odpowiedzi: po limicie czasu „offline”, kolejka rusza dalej", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    let hangs = 1;
    const statuses: RelayStatus[] = [];
    const doc = new Y.Doc();
    const store = new MemStore();
    const fetchFn = hooked(server, (_u, m) => (m === "POST" && hangs-- > 0 ? never() : undefined)).fetchFn;
    const p = new RelayProvider({ baseUrl: "https://relay.test", keys, doc, store, fetch: fetchFn, flushMs: 5, requestTimeoutMs: 50, onStatus: (s) => statuses.push(s) });
    await p.start();
    doc.transact(() => doc.getText("t").insert(0, "po czasie"));
    p.flushNow();
    await until(() => statuses.includes("offline"));
    await until(() => store.pending === null && [...server.rooms.values()].some((r) => r.last > 0), 10_000);
    p.stop();
  });

  it("za duży wpis: jedna próba, stan „błąd”, nic nie wysłane, zaległość zostaje", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    let posts = 0;
    const statuses: RelayStatus[] = [];
    const a = await device(keys, hooked(server, (_u, m) => { if (m === "POST") posts++; return undefined; }), { statuses });
    // Szyfrogram w base64url ma ~4/3 długości bajtów; tekst powyżej limitu po odkodowaniu.
    const chunk = "abcdefghijklmnopqrstuvwxyz0123456789".repeat(1000);
    const big = chunk.repeat(Math.ceil((MAX_ENTRY_CHARS * 3) / 4 / chunk.length) + 1);
    a.doc.transact(() => a.text.insert(0, big));
    a.provider.flushNow();
    await until(() => statuses.includes("error"), 30_000);
    expect(posts).toBe(0);
    await until(() => a.store.pending !== null);
    a.provider.stop();
  }, 60_000);
});

export type { RelayState };

describe("U2.5: duże zaległości i schowana karta", () => {
  it("takeBatch: kolejne zmiany do limitu, co najmniej jedna, kolejność zachowana", () => {
    const p = (n: number) => new Uint8Array(n);
    const parts = [p(4), p(4), p(4), p(10)];
    expect(takeBatch(parts, 9).batch.map((x) => x.length)).toEqual([4, 4]);
    expect(takeBatch(parts, 9).rest.map((x) => x.length)).toEqual([4, 10]);
    expect(takeBatch([p(10)], 9).batch.map((x) => x.length)).toEqual([10]);
    expect(takeBatch([], 9)).toEqual({ batch: [], rest: [] });
  });

  it("limit surowych bajtów po zaszyfrowaniu i base64 mieści się w limicie wpisu", () => {
    expect(Math.ceil(((MAX_ENTRY_RAW_BYTES + 28) * 4) / 3)).toBeLessThanOrEqual(MAX_ENTRY_CHARS);
  });

  it("przy schowanej karcie mała wysyłka idzie z keepalive", async () => {
    const server = fakeServer();
    const keys = await deriveRelayKeys(CODE, ITER);
    const seen: (boolean | undefined)[] = [];
    const fetchSpy = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") seen.push(init.keepalive);
      return server.fetchFn(input, init);
    }) as typeof fetch;
    const doc = new Y.Doc();
    const provider = new RelayProvider({ baseUrl: "https://relay.test", keys, doc, store: new MemStore(), fetch: fetchSpy, flushMs: 5 });
    await provider.start();
    provider.setHidden(true);
    doc.transact(() => doc.getText("t").insert(0, "przed zamknięciem"));
    provider.flushNow();
    await until(() => seen.includes(true));
    provider.stop();
  });
});

describe("U2.5: dzielenie zaległości (po przeglądzie)", () => {
  function twoAuthors() {
    const a = new Y.Doc(); const b = new Y.Doc();
    a.getText("t").insert(0, "A".repeat(2000));
    b.getText("u").insert(0, "B".repeat(2000));
    b.getText("t").delete(0, 0);
    return Y.mergeUpdates([Y.encodeStateAsUpdate(a), Y.encodeStateAsUpdate(b)]);
  }

  it("splitByAuthor: za duża aktualizacja dzieli się na autorów, a części odtwarzają ten sam dokument", () => {
    const merged = twoAuthors();
    const parts = splitByAuthor(merged, 1000);
    expect(parts.length).toBe(2);
    const doc = new Y.Doc();
    for (const p of [...parts].reverse()) Y.applyUpdate(doc, p);
    expect(doc.getText("t").toString()).toBe("A".repeat(2000));
    expect(doc.getText("u").toString()).toBe("B".repeat(2000));
    expect(splitByAuthor(merged, 1_000_000)).toEqual([merged]);
  });

  it("packPending: grupy pod limitem, a jedna scalona zaległość z dysku rozcina się na części", () => {
    const small = Array.from({ length: 6 }, (_, i) => { const d = new Y.Doc(); d.getText("t").insert(0, String(i).repeat(300)); return Y.encodeStateAsUpdate(d); });
    const packed = packPending(small, 700);
    expect(packed.length).toBeGreaterThan(1);
    expect(packed.every((p) => p.length <= 700)).toBe(true);
    expect(packPending([twoAuthors()], 3000).length).toBe(2);
  });
});

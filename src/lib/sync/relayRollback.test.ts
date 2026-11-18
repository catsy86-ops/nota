import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { RelayProvider, WARNING_TTL_MS, type RelayState, type RelayStore, type RelayWarning } from "@/lib/sync/relayProvider";
import { deriveRelayKeys, type RelayKeys } from "@/lib/sync/relayKeys";
import { HEAD_GRACE_MS, HEAD_PAGE, RelayHeadCompare, cleanPeerHead, relayUrlTag } from "@/lib/sync/relayHeadCompare";

/**
 * S2.3 (`docs/plan-wiadomosci-i-cofniecia.md` §2.2, Z-15.6): cofnięcie i powtórzenie na przekaźniku.
 * Atrapa serwera z epokami; `rollbackTo` udaje serwer odtworzony z kopii bez zmiany epoki.
 */
const PAGE = 500;
const EPOCH_A = "a".repeat(32);
const EPOCH_B = "b".repeat(32);

function fakeServer() {
  const room = { epoch: EPOCH_A, last: 0, entries: [] as { seq: number; data: string }[], exists: false };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const action = url.pathname.split("/").pop();
    if (method === "POST" && action === "updates") {
      const body = JSON.parse(String(init?.body));
      if (room.exists && body.epoch && body.epoch !== room.epoch) return json(412, { error: "epoka" });
      room.exists = true;
      room.last += 1;
      room.entries.push({ seq: room.last, data: body.data });
      return json(200, { seq: room.last, last: room.last, epoch: room.epoch });
    }
    if (!room.exists) return json(404, { error: "brak" });
    if (method === "GET") {
      const since = Number(url.searchParams.get("since") ?? 0);
      const after = room.entries.filter((e) => e.seq > since);
      return json(200, { entries: after.slice(0, PAGE), last: room.last, hasMore: after.length > PAGE, epoch: room.epoch });
    }
    if (method === "PUT") {
      const body = JSON.parse(String(init?.body));
      if (body.epoch !== room.epoch) return json(412, { error: "epoka" });
      room.entries = [{ seq: body.upto, data: body.data }, ...room.entries.filter((e) => e.seq > body.upto)];
      return json(200, { seq: body.upto, last: room.last, epoch: room.epoch });
    }
    return json(405, {});
  }) as typeof fetch;
  return {
    fetchFn,
    room,
    /** Serwer odtworzony z kopii bez nowej epoki: wpisy i `last` cofnięte. */
    rollbackTo(n: number) {
      room.entries = room.entries.filter((e) => e.seq <= n);
      room.last = n;
    },
    /** Pokój założony od nowa (nowa epoka, numery od zera). */
    recreate(epoch: string) {
      room.epoch = epoch;
      room.entries = [];
      room.last = 0;
    },
  };
}

class MemStore implements RelayStore {
  pending: Uint8Array | null = null;
  state: RelayState = { cursor: 0, compactedAt: 0 };
  async loadPending() {
    return this.pending;
  }
  async savePending(b: Uint8Array | null) {
    this.pending = b;
  }
  async loadState() {
    return { ...this.state };
  }
  async saveState(s: RelayState) {
    this.state = { ...s };
  }
}

let keys: RelayKeys;
const clock = { t: 1_000_000 };

async function device(server: ReturnType<typeof fakeServer>, store = new MemStore()) {
  keys ??= await deriveRelayKeys("ABCDEFGHJKMN", 1000);
  const doc = new Y.Doc();
  const warnings: RelayWarning[] = [];
  const provider = new RelayProvider({
    baseUrl: "https://relay.test",
    keys,
    doc,
    store,
    fetch: server.fetchFn,
    flushMs: 5,
    now: () => clock.t,
    onWarning: (k) => warnings.push(k),
  });
  await provider.start();
  return { doc, text: doc.getText("t"), provider, store, warnings };
}

async function until(cond: () => boolean, ms = 3000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** Kilka wpisów od urządzenia, każdy potwierdzony. */
async function write(dev: Awaited<ReturnType<typeof device>>, n: number) {
  for (let i = 0; i < n; i++) {
    dev.text.insert(dev.text.length, "x");
    await dev.provider.settle();
  }
}

describe("S2.3: cofnięcie na przekaźniku (relayProvider)", () => {
  it("wiersz 1: zwykła praca — bez ostrzeżenia", async () => {
    const server = fakeServer();
    const a = await device(server);
    await write(a, 3);
    a.provider.sync();
    await a.provider.settle();
    expect(a.provider.warning).toBeNull();
    expect(a.warnings).toEqual([]);
    a.provider.stop();
  });

  it("wiersz 2: migawka zmniejsza liczbę wpisów, numery rosną — bez ostrzeżenia", async () => {
    const server = fakeServer();
    const a = await device(server);
    await write(a, 5);
    // Migawka po stronie serwera (F2): jeden wpis zamiast pięciu, `last` bez zmian.
    server.room.entries = [{ seq: 5, data: server.room.entries[4].data }];
    const b = await device(server);
    await b.provider.settle();
    a.provider.sync();
    await a.provider.settle();
    expect(a.provider.warning).toBeNull();
    expect(b.provider.warning).toBeNull();
    expect(a.warnings).toEqual([]);
    a.provider.stop();
    b.provider.stop();
  });

  it("wiersz 3: inna epoka to reset bez ostrzeżenia; trzy resety w dobie dają ostrzeżenie, dwa nie", async () => {
    const server = fakeServer();
    const a = await device(server);
    await write(a, 2);
    for (const [i, epoch] of [EPOCH_B, EPOCH_A].entries()) {
      server.recreate(epoch);
      a.provider.sync();
      await a.provider.settle();
      expect(server.room.last, `reset ${i + 1} wysłał pełny stan`).toBeGreaterThan(0);
    }
    expect(a.store.state.resets).toHaveLength(2);
    expect(a.provider.warning).toBeNull();
    server.recreate(EPOCH_B);
    a.provider.sync();
    await a.provider.settle();
    expect(a.provider.warning).toBe("reset-loop");
    expect(a.warnings).toContain("reset-loop");
    a.provider.stop();
  });

  it("wiersz 3: resety rozłożone ponad dobę nie dają ostrzeżenia", async () => {
    const server = fakeServer();
    const a = await device(server);
    await write(a, 1);
    for (const epoch of [EPOCH_B, EPOCH_A, EPOCH_B]) {
      clock.t += 13 * 60 * 60 * 1000;
      server.recreate(epoch);
      a.provider.sync();
      await a.provider.settle();
    }
    expect(a.provider.warning).toBeNull();
    a.provider.stop();
  });

  it("wiersz 4: ta sama epoka, `last` poniżej kursora → ostrzeżenie i pełny stan z powrotem na serwerze", async () => {
    const server = fakeServer();
    const a = await device(server);
    await write(a, 6);
    expect(a.provider.cursor).toBe(6);
    server.rollbackTo(2);
    a.provider.sync();
    await a.provider.settle();
    expect(a.warnings).toEqual(["rollback"]);
    expect(a.provider.warning).toBe("rollback");
    // Serwer naprawiony treścią z urządzenia: nowe urządzenie dostaje całość.
    const b = await device(server);
    await until(() => {
      b.provider.sync();
      return b.text.toString() === "xxxxxx";
    });
    // Zmiany lokalne nietknięte.
    expect(a.text.toString()).toBe("xxxxxx");
    a.provider.stop();
    b.provider.stop();
  });

  it("wiersz 4 przy wysyłce: numer nowego wpisu nie wyprzedza kursora → ostrzeżenie", async () => {
    const server = fakeServer();
    const a = await device(server);
    await write(a, 4);
    server.rollbackTo(1);
    await write(a, 1);
    expect(a.warnings).toContain("rollback");
    a.provider.stop();
  });

  it("ostrzeżenie gaśnie po „Rozumiem” i samo po 7 dniach; przeżywa restart", async () => {
    const server = fakeServer();
    const store = new MemStore();
    const a = await device(server, store);
    await write(a, 3);
    server.rollbackTo(1);
    a.provider.sync();
    await a.provider.settle();
    a.provider.stop();
    const again = await device(server, store);
    expect(again.provider.warning).toBe("rollback");
    clock.t += WARNING_TTL_MS + 1;
    expect(again.provider.warning).toBeNull();
    clock.t -= WARNING_TTL_MS + 1;
    await again.provider.acknowledgeWarning();
    expect(again.provider.warning).toBeNull();
    expect(store.state.warning).toBeUndefined();
    again.provider.stop();
  });

  it("wiersz 6: powtórzenie starego szyfrogramu pod nowym numerem nic nie zmienia i nie ostrzega", async () => {
    const server = fakeServer();
    const a = await device(server);
    await write(a, 2);
    const b = await device(server);
    await until(() => {
      b.provider.sync();
      return b.text.toString() === "xx";
    });
    server.room.last += 1;
    server.room.entries.push({ seq: server.room.last, data: server.room.entries[0].data });
    b.provider.sync();
    await b.provider.settle();
    expect(b.text.toString()).toBe("xx");
    expect(b.provider.warning).toBeNull();
    a.provider.stop();
    b.provider.stop();
  });
});

describe("S2.3 §2.3: porównanie głowy pokoju przez awareness", () => {
  const u = relayUrlTag("https://relay.test");
  const own = (last: number, pulledAt: number, epoch = EPOCH_A) => ({ epoch, last, pulledAt, u });

  it("czyści deklarację sąsiada", () => {
    expect(cleanPeerHead({ epoch: EPOCH_A, last: 3, u })).toEqual({ epoch: EPOCH_A, last: 3, u });
    expect(cleanPeerHead({ epoch: "zz", last: 3, u })).toBeNull();
    expect(cleanPeerHead({ epoch: EPOCH_A, last: -1, u })).toBeNull();
    expect(cleanPeerHead({ epoch: EPOCH_A, last: 1.5, u })).toBeNull();
    expect(cleanPeerHead({ epoch: EPOCH_A, last: 3, u: "<script>" })).toBeNull();
    expect(cleanPeerHead("x")).toBeNull();
  });

  it("zgodne głowy — bez ostrzeżenia", () => {
    const c = new RelayHeadCompare();
    for (let t = 0; t <= 5 * HEAD_GRACE_MS; t += 15_000) {
      expect(c.observe(1, { epoch: EPOCH_A, last: 10 + HEAD_PAGE, u }, own(10, t), t)).toBe(false);
    }
  });

  it("rozjechane krótko (następne pobranie dogania) — bez ostrzeżenia", () => {
    const c = new RelayHeadCompare();
    expect(c.observe(1, { epoch: EPOCH_A, last: 2000, u }, own(10, 0), 0)).toBe(false);
    expect(c.observe(1, { epoch: EPOCH_A, last: 2000, u }, own(2000, 20_000), 30_000)).toBe(false);
    expect(c.observe(1, { epoch: EPOCH_A, last: 2000, u }, own(2000, 80_000), 90_000)).toBe(false);
  });

  it("rozjechane trwale mimo nowego pobrania — jedno ostrzeżenie", () => {
    const c = new RelayHeadCompare();
    const peer = { epoch: EPOCH_A, last: 2000, u };
    expect(c.observe(1, peer, own(10, 0), 0)).toBe(false);
    expect(c.observe(1, peer, own(10, 50_000), 55_000)).toBe(false);
    expect(c.observe(1, peer, own(10, 61_000), 61_500)).toBe(true);
    expect(c.observe(1, peer, own(10, 75_000), 76_000)).toBe(false);
  });

  it("różne epoki trwale — ostrzeżenie; inny serwer albo stare pobranie — bez porównania", () => {
    const c = new RelayHeadCompare();
    const peer = { epoch: EPOCH_B, last: 1, u };
    c.observe(1, peer, own(1, 0), 0);
    expect(c.observe(1, peer, own(1, 70_000), 70_000)).toBe(true);
    const d = new RelayHeadCompare();
    const other = { epoch: EPOCH_B, last: 1, u: relayUrlTag("https://inny.test") };
    d.observe(1, other, own(1, 0), 0);
    expect(d.observe(1, other, own(1, 70_000), 70_000)).toBe(false);
    const e = new RelayHeadCompare();
    e.observe(1, peer, own(1, 0), 0);
    expect(e.observe(1, peer, own(1, 0), 70_000)).toBe(false);
  });
});

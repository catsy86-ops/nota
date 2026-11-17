import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as Y from "yjs";
import { RelayProvider, type RelayState, type RelayStore } from "@/lib/sync/relayProvider";
import { deriveRelayKeys } from "@/lib/sync/relayKeys";
import { buildMarkerUpdate, readMarkers, stoppingMarker } from "@/lib/sync/rekey";
import { dropRekeyRoom, postRekeyMarker, retireRekeyRoom, seedRekeyRoom } from "@/lib/sync/rekeyRelay";

/**
 * Zgodność klienta z prawdziwym `relay-server/server.js` (nie z atrapą): serwer startuje
 * jako proces na wolnym porcie, klient rozmawia z nim zwykłym `fetch`.
 */

// Vitest działa z katalogu projektu; w jsdom import.meta.url nie jest ścieżką pliku.
const SERVER = resolve(process.cwd(), "relay-server/server.js");
const PORT = 4700 + Math.floor(Math.random() * 200);
const BASE = `http://127.0.0.1:${PORT}`;
const CODE = "ABCDEFGHJKMN";
const ITER = 1000;

let child: ChildProcess | null = null;
let dataDir = "";

async function waitForHealth(timeoutMs = 10_000) {
  const t0 = Date.now();
  for (;;) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch {
      // jeszcze nie słucha
    }
    if (Date.now() - t0 > timeoutMs) throw new Error("serwer przekaźnika nie wystartował");
    await new Promise((r) => setTimeout(r, 100));
  }
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

async function device(code: string, reuse: { doc?: Y.Doc; store?: MemStore; canSend?: (doc: Y.Doc) => boolean } = {}) {
  const keys = await deriveRelayKeys(code, ITER);
  const doc = reuse.doc ?? new Y.Doc();
  const store = reuse.store ?? new MemStore();
  const canSend = reuse.canSend ? () => reuse.canSend!(doc) : undefined;
  const provider = new RelayProvider({ baseUrl: BASE, keys, doc, store, flushMs: 5, canSend });
  await provider.start();
  return { doc, text: doc.getText("t"), provider, store, keys };
}

/** Pobiera, aż warunek będzie spełniony (testy nie mają gniazda, więc nikt nie budzi urządzenia). */
async function untilSynced(dev: { provider: RelayProvider }, cond: () => boolean, ms = 8000) {
  let n = 0;
  await until(() => {
    if (cond()) return true;
    if (n++ % 10 === 0) dev.provider.sync();
    return false;
  }, ms);
}

async function deleteRoom(keys: { roomId: string; token: string }) {
  const res = await fetch(`${BASE}/rooms/${keys.roomId}`, { method: "DELETE", headers: { Authorization: `Bearer ${keys.token}` } });
  expect(res.ok).toBe(true);
}

async function until(cond: () => boolean, ms = 8000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe("klient przekaźnika ↔ prawdziwy serwer", () => {
  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "relay-it-"));
    child = spawn(process.execPath, [SERVER], {
      env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir },
      stdio: "ignore",
    });
    await waitForHealth();
  }, 15_000);

  afterAll(() => {
    child?.kill();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  it("dwa urządzenia wymieniają zmiany przez serwer", async () => {
    const a = await device(CODE);
    const b = await device(CODE);
    a.doc.transact(() => a.text.insert(0, "z przekaźnika"));
    // Zmiana z tego procesu nie wywołuje WebSocketa (brak gniazda w teście), więc B pobiera ręcznie.
    await new Promise((r) => setTimeout(r, 300));
    b.provider.sync();
    await until(() => b.text.toString() === "z przekaźnika");
    expect(b.text.toString()).toBe("z przekaźnika");
    a.provider.stop();
    b.provider.stop();
  }, 20_000);

  it("kod z innym pokojem nic nie widzi", async () => {
    const a = await device(CODE);
    a.doc.transact(() => a.text.insert(0, "sekret"));
    await new Promise((r) => setTimeout(r, 200));
    const other = await device("ZZZZZZZZZZZZ");
    await new Promise((r) => setTimeout(r, 300));
    expect(other.text.toString()).toBe("");
    a.provider.stop();
    other.provider.stop();
  }, 20_000);

  it("zapis po nieprawidłowym tokenie jest odrzucany przez serwer", async () => {
    const keys = await deriveRelayKeys(CODE, ITER);
    const res = await fetch(`${BASE}/rooms/${keys.roomId}/updates`, {
      method: "POST",
      headers: { Authorization: "Bearer " + "B".repeat(43), "Content-Type": "application/json" },
      body: JSON.stringify({ data: "QUJD" }),
    });
    expect(res.status).toBe(403);
  });

  it("pokój usunięty z serwera: następny zapis wysyła pełny stan, nowe urządzenie dostaje całość (R-11)", async () => {
    const code = "EPOKAEPOKAAA";
    const a = await device(code);
    const b = await device(code);
    a.doc.transact(() => a.text.insert(0, "stare"));
    await untilSynced(b, () => b.text.toString() === "stare");
    expect(a.store.state.epoch).toMatch(/^[a-f0-9]{32}$/);
    const before = a.store.state.epoch;

    await deleteRoom(a.keys);
    a.doc.transact(() => a.text.insert(5, " nowe"));
    b.doc.transact(() => b.doc.getText("b").insert(0, "od B"));

    const c = await device(code);
    await untilSynced(c, () => c.text.toString() === "stare nowe" && c.doc.getText("b").toString() === "od B");
    await untilSynced(a, () => a.doc.getText("b").toString() === "od B");
    await untilSynced(b, () => b.text.toString() === "stare nowe");
    expect(a.store.state.epoch).toMatch(/^[a-f0-9]{32}$/);
    expect(a.store.state.epoch).not.toBe(before);
    expect(b.store.state.epoch).toBe(a.store.state.epoch);
    for (const d of [a, b, c]) d.provider.stop();
  }, 30_000);

  it("pokój założony od nowa, który przegonił stary kursor, też jest rozpoznany", async () => {
    const code = "EPOKADRUGAAA";
    const a = await device(code);
    a.doc.transact(() => a.text.insert(0, "A"));
    await until(() => a.provider.cursor === 1);
    a.provider.stop();

    await deleteRoom(a.keys);
    // Inne urządzenie zakłada pokój od nowa i zapisuje więcej wpisów, niż A zdążyło pobrać.
    const d = await device(code);
    for (const word of ["x", "y", "z"]) {
      d.doc.transact(() => d.doc.getText("d").insert(0, word));
      const want = d.provider.cursor + 1;
      await until(() => d.provider.cursor === want);
    }
    expect(d.provider.cursor).toBeGreaterThan(1);

    const a2 = await device(code, { doc: a.doc, store: a.store });
    await untilSynced(a2, () => a2.doc.getText("d").toString() === "zyx");
    await untilSynced(d, () => d.text.toString() === "A");
    const c = await device(code);
    await untilSynced(c, () => c.text.toString() === "A" && c.doc.getText("d").toString() === "zyx");
    for (const dev of [a2, d, c]) dev.provider.stop();
  }, 30_000);

  it("po resecie pokoju najpierw pobranie: wpis zatrzymujący wysyłkę działa, zanim pójdzie pełny stan", async () => {
    const code = "NAGROBEKAAAA";
    const stopped = (doc: Y.Doc) => doc.getMap("syncControl").size === 0;
    const c = await device(code, { canSend: stopped });
    c.doc.transact(() => c.text.insert(0, "dane C"));
    await until(() => c.provider.cursor === 1);

    // Pokój wycofany; w jego miejscu zostaje jeden wpis z osobnego, pustego dokumentu.
    await deleteRoom(c.keys);
    const t = await device(code);
    t.doc.transact(() => t.doc.getMap("syncControl").set("rekey:1", true));
    await until(() => t.provider.cursor === 1);
    t.provider.stop();

    // C nie wie o niczym i wysyła różnicę: 412 → reset → pobranie → znacznik → cisza.
    c.doc.transact(() => c.text.insert(6, " i jeszcze"));
    await until(() => c.doc.getMap("syncControl").size === 1);
    await new Promise((r) => setTimeout(r, 400));
    c.provider.sync();
    await new Promise((r) => setTimeout(r, 400));

    const res = await fetch(`${BASE}/rooms/${c.keys.roomId}/updates?since=0`, { headers: { Authorization: `Bearer ${c.keys.token}` } });
    const page = (await res.json()) as { entries: unknown[] };
    expect(page.entries).toHaveLength(1);
    // Kolejka nie zginęła: po zdjęciu blokady pełny stan idzie do pokoju.
    expect(c.store.pending).not.toBeNull();
    c.doc.transact(() => c.doc.getMap("syncControl").delete("rekey:1"));
    const fresh = await device(code);
    await untilSynced(fresh, () => fresh.text.toString() === "dane C i jeszcze");
    c.provider.stop();
    fresh.provider.stop();
  }, 30_000);

  it("urządzenie w pustym pokoju jest „online”, nie „offline” (R-17)", async () => {
    const keys = await deriveRelayKeys("PUSTYPUSTYAA", ITER);
    const statuses: string[] = [];
    const provider = new RelayProvider({ baseUrl: BASE, keys, doc: new Y.Doc(), store: new MemStore(), flushMs: 5, onStatus: (s) => statuses.push(s) });
    await provider.start();
    await until(() => statuses.includes("online"));
    expect(statuses).not.toContain("offline");
    provider.stop();
  }, 20_000);

  it("dokument 2 MB synchronizuje się od zera (limit wpisu 16 MB)", async () => {
    const code = "BIGBIGBIGBIG";
    const a = await device(code);
    const big = Array.from({ length: 2048 }, (_, i) => `${i.toString(36)}${Math.random().toString(36).repeat(60)}`.slice(0, 1024)).join("");
    a.doc.transact(() => a.text.insert(0, big));
    await new Promise((r) => setTimeout(r, 1500));
    const b = await device(code);
    await until(() => b.text.length === big.length, 15_000);
    expect(b.text.toString()).toBe(big);
    a.provider.stop();
    b.provider.stop();
  }, 40_000);

  describe("wymiana kodu", () => {
    const relay = { baseUrl: BASE, iterations: ITER };
    const TAG = "a".repeat(32);
    const marker = { id: "1".repeat(32), tag: TAG, at: 1 };

    async function roomEntries(keys: { roomId: string; token: string }) {
      const res = await fetch(`${BASE}/rooms/${keys.roomId}/updates?since=0`, { headers: { Authorization: `Bearer ${keys.token}` } });
      if (res.status === 404) return null;
      return ((await res.json()) as { entries: unknown[] }).entries.length;
    }

    it("nowy pokój dostaje pełny stan; powtórzenie niczego nie dokłada, a zwykłe połączenie zaczyna od kursora", async () => {
      const code = "NOWYPOKOJAAA";
      const doc = new Y.Doc();
      doc.getText("t").insert(0, "wszystko, co mam");
      const store = new MemStore();
      await seedRekeyRoom(relay, code, doc, store);
      const keys = await deriveRelayKeys(code, ITER);
      const after = await roomEntries(keys);
      expect(after).toBe(1);
      await seedRekeyRoom(relay, code, doc, store);
      expect(await roomEntries(keys)).toBe(after);

      const fresh = await device(code);
      await untilSynced(fresh, () => fresh.text.toString() === "wszystko, co mam");
      fresh.provider.stop();

      // To samo urządzenie łączy się potem nowym kodem z tym samym magazynem: nic nie wysyła drugi raz.
      const same = await device(code, { doc, store });
      await same.provider.settle();
      expect(await roomEntries(keys)).toBe(after);
      same.provider.stop();

      await dropRekeyRoom(relay, code);
      expect(await roomEntries(keys)).toBeNull();
      await dropRekeyRoom(relay, code); // brak pokoju to też sukces
    }, 30_000);

    it("znacznik wysłany wprost do pokoju zatrzymuje urządzenie, które go pobierze", async () => {
      const code = "ZNACZNIKAAAA";
      const a = await device(code, { canSend: (doc) => !stoppingMarker(doc, TAG) });
      a.doc.transact(() => a.text.insert(0, "przed"));
      expect(await a.provider.settle()).toBe(true);
      await postRekeyMarker(relay, code, buildMarkerUpdate(marker));
      await untilSynced(a, () => readMarkers(a.doc).length === 1);
      const before = await roomEntries(a.keys);
      a.doc.transact(() => a.text.insert(0, "po znaczniku "));
      expect(await a.provider.settle()).toBe(false);
      expect(await roomEntries(a.keys)).toBe(before);
      a.provider.stop();
    }, 30_000);

    it("wycofany pokój zawiera sam znacznik; spóźnione urządzenie zatrzymuje się i nic nie wysyła", async () => {
      const code = "WYCOFANYAAAA";
      const a = await device(code);
      a.doc.transact(() => a.text.insert(0, "stare dane grupy"));
      expect(await a.provider.settle()).toBe(true);
      a.provider.stop();

      // Spóźnione urządzenie: ma stan i własne niewysłane zmiany, o wymianie nic nie wie.
      const lateDoc = new Y.Doc();
      Y.applyUpdate(lateDoc, Y.encodeStateAsUpdate(a.doc));
      const lateStore = new MemStore();
      const warm = await device(code, { doc: lateDoc, store: lateStore });
      await warm.provider.settle();
      warm.provider.stop();
      lateDoc.getText("t").insert(0, "niewysłane ");

      const update = buildMarkerUpdate(marker);
      expect(await retireRekeyRoom(relay, code, update)).toBe(true);
      expect(await roomEntries(a.keys)).toBe(1);

      const late = await device(code, { doc: lateDoc, store: lateStore, canSend: (doc) => !stoppingMarker(doc, TAG) });
      await untilSynced(late, () => readMarkers(late.doc).length === 1);
      expect(await late.provider.settle()).toBe(false);
      expect(await roomEntries(a.keys)).toBe(1);
      expect(late.text.toString()).toBe("niewysłane stare dane grupy");
      late.provider.stop();

      // Powtórzone wycofanie daje ten sam wynik.
      expect(await retireRekeyRoom(relay, code, update)).toBe(true);
      expect(await roomEntries(a.keys)).toBe(1);
    }, 30_000);
  });
});

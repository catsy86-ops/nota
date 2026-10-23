import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import * as Y from "yjs";
import { RelayProvider, type RelayState, type RelayStore } from "@/lib/sync/relayProvider";
import { deriveRelayKeys } from "@/lib/sync/relayKeys";

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

async function device(code: string) {
  const keys = await deriveRelayKeys(code, ITER);
  const doc = new Y.Doc();
  const provider = new RelayProvider({ baseUrl: BASE, keys, doc, store: new MemStore(), flushMs: 5 });
  await provider.start();
  return { doc, text: doc.getText("t"), provider };
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
});

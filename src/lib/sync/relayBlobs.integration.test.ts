import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { deriveRelayKeys } from "@/lib/sync/relayKeys";
import { RelayBlobs, packBlob, unpackBlob, type BlobImages } from "@/lib/sync/relayBlobs";
import { sha256Hex } from "@/lib/imageStore";

/** Bloby przeciw prawdziwemu `relay-server/server.js` (proces), z prostym magazynem obrazów w pamięci. */

const SERVER = resolve(process.cwd(), "relay-server/server.js");
const PORT = 4900 + Math.floor(Math.random() * 90);
const BASE = `http://127.0.0.1:${PORT}`;
const CODE = "ABCDEFGHJKMN";
const ITER = 1000;

let child: ChildProcess | null = null;
let dataDir = "";

type MemImages = BlobImages & { map: Map<string, { bytes: Uint8Array; type: string }> };

function memImages(): MemImages {
  const map = new Map<string, { bytes: Uint8Array; type: string }>();
  const images: MemImages = {
    map,
    has: (h: string) => map.has(h),
    async get(h: string) {
      const r = map.get(h);
      return r ? { bytes: r.bytes.slice().buffer as ArrayBuffer, type: r.type, addedAt: 0 } : undefined;
    },
    async putBytes(bytes: Uint8Array, type: string, expected?: string) {
      const hash = await sha256Hex(bytes);
      if (expected !== undefined && hash !== expected) throw new Error("Obraz nie pasuje do swojego hasha");
      map.set(hash, { bytes: bytes.slice(), type });
      return hash;
    },
  };
  return images;
}

async function waitHealth() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return;
    } catch {
      // jeszcze nie słucha
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("serwer nie wstał");
}

describe("pakowanie blobu", () => {
  it("przechodzi w obie strony i odrzuca zły nagłówek", () => {
    const body = new Uint8Array([1, 2, 3, 4, 5]);
    const back = unpackBlob(packBlob("image/png", body));
    expect(back.type).toBe("image/png");
    expect(Array.from(back.bytes)).toEqual([1, 2, 3, 4, 5]);
    expect(() => unpackBlob(new Uint8Array([0, 0, 0, 0]))).toThrow();
    expect(() => unpackBlob(new Uint8Array([0, 0, 0, 200, 1]))).toThrow();
  });

  it("niebezpieczny typ MIME zamienia się na binarny", () => {
    const back = unpackBlob(packBlob('text/html"; x', new Uint8Array([1])));
    expect(back.type).toBe("application/octet-stream");
  });
});

describe("bloby ↔ prawdziwy serwer", () => {
  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "relay-blob-it-"));
    child = spawn(process.execPath, [SERVER], { env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir }, stdio: "ignore" });
    await waitHealth();
  }, 15_000);

  afterAll(() => {
    child?.kill();
    if (dataDir) rmSync(dataDir, { recursive: true, force: true });
  });

  it("obraz z urządzenia A trafia na B, bajt w bajt, i nie wysyła się drugi raz", async () => {
    const keys = await deriveRelayKeys(CODE, ITER);
    const a = memImages();
    const b = memImages();
    const pixels = new Uint8Array(200_000).map((_, i) => (i * 31) & 0xff);
    const hash = await sha256Hex(pixels);
    a.map.set(hash, { bytes: pixels, type: "image/png" });

    const refs = [hash];
    const sendA = new RelayBlobs({ baseUrl: BASE, keys, refs: () => refs, images: a });
    const got = new RelayBlobs({ baseUrl: BASE, keys, refs: () => refs, images: b });

    expect(await sendA.sync()).toEqual({ uploaded: 1, downloaded: 0, failed: 0 });
    expect(await sendA.sync()).toEqual({ uploaded: 0, downloaded: 0, failed: 0 });
    expect(await got.sync()).toEqual({ uploaded: 0, downloaded: 1, failed: 0 });
    expect(b.map.get(hash)?.type).toBe("image/png");
    expect(Array.from(b.map.get(hash)!.bytes.slice(0, 16))).toEqual(Array.from(pixels.slice(0, 16)));
  }, 30_000);

  it("obcy klucz nie odczyta bloba (nie ma go w pokoju innego kodu)", async () => {
    const keys = await deriveRelayKeys(CODE, ITER);
    const other = await deriveRelayKeys("ZZZZZZZZZZZZ", ITER);
    const a = memImages();
    const bytes = new Uint8Array([9, 9, 9]);
    const hash = await sha256Hex(bytes);
    a.map.set(hash, { bytes, type: "image/jpeg" });
    await new RelayBlobs({ baseUrl: BASE, keys, refs: () => [hash], images: a }).sync();

    const b = memImages();
    const res = await new RelayBlobs({ baseUrl: BASE, keys: other, refs: () => [hash], images: b }).sync();
    expect(res.downloaded).toBe(0);
    expect(res.failed).toBe(0);
    expect(b.map.size).toBe(0);
  }, 30_000);

  it("brak bloba na serwerze to nie błąd — po prostu jeszcze nie ma", async () => {
    const keys = await deriveRelayKeys(CODE, ITER);
    const b = memImages();
    const missing = "f".repeat(64);
    const res = await new RelayBlobs({ baseUrl: BASE, keys, refs: () => [missing], images: b }).sync();
    expect(res).toEqual({ uploaded: 0, downloaded: 0, failed: 0 });
  }, 30_000);
});

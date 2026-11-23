import { describe, it, expect, beforeEach, vi } from "vitest";
import { createImageStore, dataUrlToBytes, bytesToDataUrl, isImageRef, GC_GRACE_MS } from "./imageStore";

const PNG = "data:image/png;base64,iVBORw0KGgo=";
const GIF = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

let store: ReturnType<typeof createImageStore>;

beforeEach(async () => {
  store = createImageStore(`images-test-${crypto.randomUUID()}`);
  await store.resetForTests();
});

describe("imageStore", () => {
  it("round-trips a data URL through bytes", () => {
    const { bytes, type } = dataUrlToBytes(PNG);
    expect(type).toBe("image/png");
    expect(bytesToDataUrl(bytes.slice().buffer, type)).toBe(PNG);
  });

  it("addresses images by SHA-256 of their bytes, so the same image is stored once", async () => {
    const a = await store.putDataUrl(PNG);
    const b = await store.putDataUrl(PNG);
    expect(isImageRef(a)).toBe(true);
    expect(b).toBe(a);
    expect(store.has(a)).toBe(true);
    expect(await store.getDataUrl(a)).toBe(PNG);
  });

  it("survives a fresh instance on the same database", async () => {
    const name = `images-reopen-${crypto.randomUUID()}`;
    const ref = await createImageStore(name).putDataUrl(GIF);
    const reopened = createImageStore(name);
    await reopened.load();
    expect(reopened.has(ref)).toBe(true);
    expect(await reopened.getDataUrl(ref)).toBe(GIF);
  });

  it("rejects bytes that do not match the expected hash (untrusted peer)", async () => {
    const ref = await store.putDataUrl(PNG);
    const { bytes, type } = dataUrlToBytes(GIF);
    await expect(store.putBytes(bytes, type, ref)).rejects.toThrow(/hash/);
    expect(await store.getDataUrl(ref)).toBe(PNG);
  });

  it("ingest turns data URLs into refs, keeps other refs and skips malformed images", async () => {
    const out = await store.ingest([PNG, "0123456789abcdef12", "data:image/png;base64,%%%"]);
    expect(out).toHaveLength(2);
    expect(isImageRef(out[0])).toBe(true);
    expect(out[1]).toBe("0123456789abcdef12");
  });

  it("resolve embeds stored images and leaves unknown refs untouched", async () => {
    const ref = await store.putDataUrl(PNG);
    const missing = "f".repeat(64);
    expect(await store.resolve([ref, missing])).toEqual([PNG, missing]);
  });

  it("notifies listeners when a new image arrives", async () => {
    const seen: string[] = [];
    const off = store.onAdded((h) => seen.push(h));
    const ref = await store.putDataUrl(PNG);
    await store.putDataUrl(PNG); // już jest — bez powiadomienia
    off();
    expect(seen).toEqual([ref]);
  });

  it("Z-6.5: touch odnawia karencję — stary sierota po trwałym usunięciu notatki zostaje", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const old = await store.putDataUrl(GIF);
      vi.setSystemTime(Date.now() + GC_GRACE_MS + 1000);
      await store.touch([old, "0".repeat(64)]);
      expect(await store.collectGarbage(new Set())).toBe(0);
      expect(await store.collectGarbage(new Set(), Date.now() + GC_GRACE_MS + 1)).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("garbage-collects only unreferenced images older than the grace period", async () => {
    const kept = await store.putDataUrl(PNG);
    const orphan = await store.putDataUrl(GIF);
    expect(await store.collectGarbage(new Set([kept]))).toBe(0); // świeży sierota zostaje
    expect(await store.collectGarbage(new Set([kept]), Date.now() + GC_GRACE_MS + 1)).toBe(1);
    expect(store.has(kept)).toBe(true);
    expect(store.has(orphan)).toBe(false);
    expect(await store.getDataUrl(orphan)).toBeUndefined();
  });
});

describe("niezaufane dane obrazu (A03/A04)", () => {
  it("safeMime przepuszcza tylko typ/podtyp", async () => {
    const { safeMime } = await import("./imageStore");
    expect(safeMime("image/PNG")).toBe("image/png");
    expect(safeMime('x" onerror="a')).toBe("application/octet-stream");
    expect(safeMime("text/html;charset=x")).toBe("application/octet-stream");
    expect(safeMime(undefined)).toBe("application/octet-stream");
  });

  it("dataUrlToBytes czyści zły typ MIME", async () => {
    const { dataUrlToBytes } = await import("./imageStore");
    expect(dataUrlToBytes('data:a"b;base64,AAAA').type).toBe("application/octet-stream");
    expect(dataUrlToBytes("data:image/png;base64,AAAA").type).toBe("image/png");
  });

  it("odrzuca obraz od peera ponad limit rozmiaru", async () => {
    const { createImageStore, MAX_PEER_BLOB_BYTES, sha256Hex } = await import("./imageStore");
    const store = createImageStore(`peer-limit-${crypto.randomUUID()}`);
    const big = new Uint8Array(MAX_PEER_BLOB_BYTES + 1);
    await expect(store.putBytes(big, "image/png", await sha256Hex(big))).rejects.toThrow(/zbyt duży/);
  });

  // B5.5: miniatura obok oryginału. jsdom nie ma createImageBitmap, więc to ścieżka „nie da się” — zawsze oryginał.
  it("miniatura: bez możliwości jej utworzenia daje oryginał i pamięta to (false), a zwolnienie zwalnia oryginał", async () => {
    const ref = await store.putDataUrl(PNG);
    const u1 = await store.acquireThumbUrl(ref);
    const full = await store.acquireUrl(ref);
    expect(u1).toBeTruthy();
    expect(u1).toBe(full); // współdzielony object URL oryginału
    store.releaseThumbUrl(ref);
    store.releaseUrl(ref);
    expect(await store.acquireThumbUrl("a".repeat(64))).toBeNull(); // brak obrazu
  });

  it("miniatura: GC kasuje ją razem z oryginałem", async () => {
    const ref = await store.putDataUrl(PNG);
    await store.acquireThumbUrl(ref);
    store.releaseThumbUrl(ref);
    const removed = await store.collectGarbage(new Set(), Date.now() + GC_GRACE_MS + 1);
    expect(removed).toBe(1);
    expect(store.has(ref)).toBe(false);
  });

  // W10: to samo zdjęcie dodane ponownie w trakcie odśmiecania nie może zniknąć.
  it("GC: zdjęcie dodane ponownie podczas sprzątania zostaje", async () => {
    const ref = await store.putDataUrl(PNG);
    const later = Date.now() + GC_GRACE_MS + 1;
    const gc = store.collectGarbage(new Set(), later); // zdjęcie nieużywane i po karencji: kandydat do usunięcia
    const again = store.putDataUrl(PNG); // użytkownik dodaje je ponownie w tej samej chwili
    await Promise.all([gc, again]);
    expect(store.has(ref)).toBe(true);
    expect(await store.getDataUrl(ref)).toBe(PNG);
  });

  it("GC: zdjęcie dodane ponownie tuż po sprzątaniu jest zapisane od nowa", async () => {
    const ref = await store.putDataUrl(PNG);
    await store.collectGarbage(new Set(), Date.now() + GC_GRACE_MS + 1);
    expect(store.has(ref)).toBe(false);
    await store.putDataUrl(PNG);
    expect(await store.getDataUrl(ref)).toBe(PNG);
  });
});


describe("ręczne sprzątanie nieużywanych plików (Z-6.6)", () => {
  /** `n` różnych plików (inne bajty = inny klucz). */
  async function files(n: number): Promise<string[]> {
    const refs: string[] = [];
    for (let i = 0; i < n; i++) refs.push(await store.putBytes(new Uint8Array([i, i + 1, i + 2, 7]), "image/png"));
    return refs;
  }

  it("unusedFiles liczy tylko pliki bez odwołania i starsze niż karencja, z rozmiarem", async () => {
    const [used, orphan] = await files(2);
    expect(await store.unusedFiles(new Set([used]))).toEqual({ count: 0, bytes: 0 });
    expect(await store.unusedFiles(new Set([used]), Date.now() + GC_GRACE_MS + 1)).toEqual({ count: 1, bytes: 4 });
    expect(await store.has(orphan)).toBe(true);
  });

  it("bezpiecznik zostawia większość magazynu bez właściciela; `force` (zlecone przez użytkownika) ją usuwa, używane zostają", async () => {
    const refs = await files(30);
    const used = new Set(refs.slice(0, 5));
    const later = Date.now() + GC_GRACE_MS + 1;
    expect(await store.collectGarbage(used, later)).toBe(0);
    expect(await store.collectGarbage(used, later, GC_GRACE_MS, { force: true })).toBe(25);
    for (const r of refs.slice(0, 5)) expect(store.has(r)).toBe(true);
    expect(store.has(refs[29])).toBe(false);
  });
});

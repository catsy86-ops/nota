import { describe, it, expect, beforeEach } from "vitest";
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

import { createStore, get as idbGet, set as idbSet, del as idbDel, keys as idbKeys, getMany as idbGetMany, type UseStore } from "idb-keyval";
import { logDiag } from "@/lib/diagnostics";

/**
 * Content-addressed store obrazów: klucz = SHA-256 bajtów obrazu (hex),
 * wartość = bajty + typ MIME. `Note.images` to lista takich kluczy — ten sam
 * obraz w dwóch notatkach (duplikat, przywrócony backup) zajmuje miejsce raz,
 * a referencje w `Y.Doc` są małe i synchronizują się razem z notatką.
 *
 * Bajty jako `ArrayBuffer`, nie `Blob`: Blob w IndexedDB bywał zawodny
 * w Safari, a `ArrayBuffer` klonuje się wszędzie. Bez narzutu base64.
 *
 * Wpisy nie są kasowane przy usuwaniu notatki (cofnij, szkic w pasku
 * dodawania, notatka w drodze od peera) — sprząta `collectGarbage` przy
 * starcie, tylko nieużywane i starsze niż karencja.
 */

export interface StoredImage {
  bytes: ArrayBuffer;
  type: string;
  addedAt: number;
}

const REF_RE = /^[0-9a-f]{64}$/;

/** Czy napis to klucz tego store'a (a nie data URL czy stary hash FNV). */
export function isImageRef(s: string): boolean {
  return REF_RE.test(s);
}

export function isDataUrl(s: string): boolean {
  return s.startsWith("data:");
}

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; type: string } {
  const comma = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || comma < 0) throw new Error("Nieprawidłowy data URL");
  const header = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  const type = header.split(";")[0] || "application/octet-stream";
  if (header.endsWith(";base64")) {
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, type };
  }
  return { bytes: new TextEncoder().encode(decodeURIComponent(payload)), type };
}

export function bytesToDataUrl(bytes: ArrayBuffer, type: string): string {
  const view = new Uint8Array(bytes);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < view.length; i += CHUNK) bin += String.fromCharCode(...view.subarray(i, i + CHUNK));
  return `data:${type};base64,${btoa(bin)}`;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Karencja GC: nieużywany obraz młodszy niż to zostaje (szkic, cofnij, sync w drodze). */
export const GC_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

export function createImageStore(dbName: string) {
  const db: UseStore = createStore(dbName, "images");
  /** Klucze obecne na dysku — synchroniczne `has` dla projekcji i P2P. */
  const known = new Set<string>();
  let loadPromise: Promise<void> | null = null;
  const listeners = new Set<(hash: string) => void>();
  const urls = new Map<string, { url: string; refs: number }>();
  const pendingUrls = new Map<string, Promise<string | null>>();

  function load(): Promise<void> {
    if (!loadPromise) {
      loadPromise = idbKeys(db)
        .then((ks) => { for (const k of ks) if (typeof k === "string") known.add(k); })
        .catch((err) => { logDiag("error", "imageStore", "cannot list images", err); });
    }
    return loadPromise;
  }

  function has(hash: string): boolean {
    return known.has(hash);
  }

  /**
   * Zapisuje bajty, zwraca klucz. Idempotentne — ten sam obraz drugi raz nic nie pisze.
   * `expected` (bajty od peera): niezgodny hash = odrzucenie, nic nie trafia na dysk.
   */
  async function putBytes(bytes: Uint8Array, type: string, expected?: string): Promise<string> {
    await load();
    const hash = await sha256Hex(bytes);
    if (expected !== undefined && hash !== expected) throw new Error("Obraz nie pasuje do swojego hasha");
    if (known.has(hash)) return hash;
    const value: StoredImage = { bytes: bytes.slice().buffer, type, addedAt: Date.now() };
    await idbSet(hash, value, db);
    known.add(hash);
    listeners.forEach((l) => l(hash));
    return hash;
  }

  function putDataUrl(dataUrl: string): Promise<string> {
    const { bytes, type } = dataUrlToBytes(dataUrl);
    return putBytes(bytes, type);
  }

  async function putBlob(blob: Blob): Promise<string> {
    return putBytes(new Uint8Array(await blob.arrayBuffer()), blob.type || "application/octet-stream");
  }

  /**
   * Zamienia data URL-e na klucze, resztę (klucze, stare hashe FNV) zostawia.
   * Granica dla wszystkiego, co przychodzi z zewnątrz: backup, import, plik sync.
   * Uszkodzony data URL jest pomijany; błąd zapisu (np. brak miejsca) leci
   * dalej — wołający przerywa, zanim cokolwiek nadpisze.
   */
  async function ingest(images: string[]): Promise<string[]> {
    const out: string[] = [];
    for (const img of images) {
      if (!isDataUrl(img)) { out.push(img); continue; }
      let parsed: ReturnType<typeof dataUrlToBytes>;
      try { parsed = dataUrlToBytes(img); }
      catch (err) { logDiag("warn", "imageStore", "skipping malformed image", err); continue; }
      out.push(await putBytes(parsed.bytes, parsed.type));
    }
    return out;
  }

  async function getRecord(hash: string): Promise<StoredImage | undefined> {
    if (!known.has(hash)) await load();
    try { return await idbGet<StoredImage>(hash, db); }
    catch (err) { logDiag("error", "imageStore", "cannot read image", err); return undefined; }
  }

  async function getDataUrl(hash: string): Promise<string | undefined> {
    const rec = await getRecord(hash);
    return rec ? bytesToDataUrl(rec.bytes, rec.type) : undefined;
  }

  /** Klucze → data URL-e (eksporty, backup). Brakujących obrazów nie da się
   *  osadzić — zostają jako klucz, żeby referencja nie zginęła. */
  async function resolve(images: string[]): Promise<string[]> {
    return Promise.all(images.map(async (img) => (isImageRef(img) ? (await getDataUrl(img)) ?? img : img)));
  }

  /**
   * Object URL współdzielony przez wszystkie miejsca pokazujące ten obraz,
   * zwalniany, gdy ostatnie przestanie. `null` = obrazu nie ma na tym urządzeniu.
   */
  async function acquireUrl(hash: string): Promise<string | null> {
    const cached = urls.get(hash);
    if (cached) { cached.refs++; return cached.url; }
    let pending = pendingUrls.get(hash);
    if (!pending) {
      pending = getRecord(hash).then((rec) => {
        pendingUrls.delete(hash);
        if (!rec) return null;
        const url = URL.createObjectURL(new Blob([rec.bytes], { type: rec.type }));
        urls.set(hash, { url, refs: 0 });
        return url;
      });
      pendingUrls.set(hash, pending);
    }
    const url = await pending;
    const entry = urls.get(hash);
    if (url && entry) entry.refs++;
    return url;
  }

  function releaseUrl(hash: string): void {
    const entry = urls.get(hash);
    if (!entry) return;
    entry.refs--;
    if (entry.refs <= 0) {
      urls.delete(hash);
      URL.revokeObjectURL(entry.url);
    }
  }

  /** Powiadamia, gdy obraz pojawi się w store (np. dociągnięty od peera). */
  function onAdded(listener: (hash: string) => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  /**
   * Kasuje obrazy, do których nie odwołuje się żadna notatka i które leżą
   * dłużej niż karencja. Zwraca liczbę usuniętych.
   */
  async function collectGarbage(referenced: Set<string>, now = Date.now(), graceMs = GC_GRACE_MS): Promise<number> {
    await load();
    const candidates = [...known].filter((h) => !referenced.has(h));
    if (!candidates.length) return 0;
    let removed = 0;
    try {
      const records = await idbGetMany<StoredImage | undefined>(candidates, db);
      for (let i = 0; i < candidates.length; i++) {
        const rec = records[i];
        if (rec && now - rec.addedAt < graceMs) continue;
        await idbDel(candidates[i], db);
        known.delete(candidates[i]);
        removed++;
      }
    } catch (err) { logDiag("error", "imageStore", "garbage collection failed", err); }
    return removed;
  }

  /** Test-only. */
  async function resetForTests(): Promise<void> {
    for (const k of await idbKeys(db)) await idbDel(k, db);
    known.clear();
    urls.forEach((e) => URL.revokeObjectURL(e.url));
    urls.clear();
    pendingUrls.clear();
    loadPromise = null;
  }

  return {
    load, has, putBytes, putDataUrl, putBlob, ingest, get: getRecord, getDataUrl, resolve,
    acquireUrl, releaseUrl, onAdded, collectGarbage, resetForTests,
  };
}

export type ImageStore = ReturnType<typeof createImageStore>;

export const IMAGE_DB_NAME = "kaczy-images-v1";
export const imageStore = createImageStore(IMAGE_DB_NAME);

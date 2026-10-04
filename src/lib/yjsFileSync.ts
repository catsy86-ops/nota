import { format } from "date-fns";
import { yjsStore, type YjsStore } from "@/lib/yjsStore";
import { download } from "@/lib/exportNotes";
import { logDiag } from "@/lib/diagnostics";
import { hashImage } from "@/lib/imageHash";

/**
 * Sync „sneakernet”: pełny stan CRDT w pliku. Wczytanie go na drugim
 * urządzeniu to merge (Y.applyUpdateV2), nie nadpisanie — dwa urządzenia,
 * które nigdy nie były razem online, godzą zmiany obu stron.
 *
 * Ryzyko: bardzo stary plik może wskrzesić notatkę usuniętą na stałe po
 * odśmieceniu jej tombstone'a przez Yjs.
 */
export const SYNC_FILE_FORMAT = "kaczy-sync";
/** v2: obrazy jako `blobs` (SHA-256 → data URL), każdy raz. v1: `images` per notatka. */
export const SYNC_FILE_VERSION = 2;
const MAX_SYNC_FILE_SIZE = 100 * 1024 * 1024;

export interface SyncFile {
  format: typeof SYNC_FILE_FORMAT;
  version: number;
  exportedAt: number;
  update: string;
  blobs: Record<string, string>;
  /** Tylko pliki v1: data URL-e per notatka, manifesty z hashami FNV. */
  images?: Record<string, string[]>;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Stan dokumentu + bajty wszystkich obrazów, które ma to urządzenie i do których odwołuje się notatka. */
export async function buildSyncFile(store: YjsStore = yjsStore): Promise<SyncFile> {
  const update = store.encodeSyncState();
  const blobs: Record<string, string> = {};
  for (const ref of store.referencedImages()) {
    const dataUrl = await store.images.getDataUrl(ref);
    if (dataUrl) blobs[ref] = dataUrl;
  }
  return { format: SYNC_FILE_FORMAT, version: SYNC_FILE_VERSION, exportedAt: Date.now(), update: bytesToBase64(update), blobs };
}

export function parseSyncFile(text: string): SyncFile {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("Plik nie jest poprawnym JSON-em"); }
  const r = raw as Partial<SyncFile> | null;
  if (!r || r.format !== SYNC_FILE_FORMAT) {
    throw new Error("To nie jest plik synchronizacji aplikacji NOTKI (pełny backup przywraca się osobnym przyciskiem)");
  }
  if (typeof r.version !== "number" || r.version > SYNC_FILE_VERSION) {
    throw new Error("Plik pochodzi z nowszej wersji aplikacji — zaktualizuj aplikację");
  }
  if (typeof r.update !== "string") throw new Error("Uszkodzony plik synchronizacji");
  const blobs: Record<string, string> = {};
  if (r.blobs && typeof r.blobs === "object") {
    for (const [hash, dataUrl] of Object.entries(r.blobs)) if (typeof dataUrl === "string") blobs[hash] = dataUrl;
  }
  const images: Record<string, string[]> = {};
  if (r.images && typeof r.images === "object") {
    for (const [id, imgs] of Object.entries(r.images)) {
      if (Array.isArray(imgs)) images[id] = imgs.filter((x): x is string => typeof x === "string");
    }
  }
  return { format: SYNC_FILE_FORMAT, version: r.version, exportedAt: Number(r.exportedAt) || 0, update: r.update, blobs, images };
}

/**
 * Najpierw obrazy do `imageStore` (błąd zapisu przerywa, zanim ruszymy
 * dokument), potem merge. Plik v1 niesie manifesty z hashami FNV — po
 * merge'u podmieniamy je na SHA-256 obrazów, które przyszły w pliku.
 */
export async function mergeSyncFile(file: SyncFile, store: YjsStore = yjsStore): Promise<{ newNotes: number }> {
  let update: Uint8Array;
  try { update = base64ToBytes(file.update); } catch { throw new Error("Uszkodzony plik synchronizacji"); }
  for (const [hash, dataUrl] of Object.entries(file.blobs)) {
    const [ref] = await store.images.ingest([dataUrl]);
    if (ref && ref !== hash) logDiag("warn", "fileSync", "image in sync file does not match its hash");
  }
  const fnvToSha = new Map<string, string>();
  for (const imgs of Object.values(file.images ?? {})) {
    for (const img of imgs) {
      const [ref] = await store.images.ingest([img]);
      if (ref && ref !== img) fnvToSha.set(hashImage(img), ref);
    }
  }
  let result: { newNotes: number };
  try {
    result = store.mergeSyncState(update);
  } catch (err) {
    logDiag("error", "fileSync", "cannot apply sync file", err);
    throw new Error("Nie udało się scalić pliku — jest uszkodzony albo niezgodny");
  }
  store.remapImageRefs(fnvToSha);
  return result;
}

export async function exportSyncFile(): Promise<{ filename: string; size: number }> {
  await yjsStore.ready();
  const data = JSON.stringify(await buildSyncFile());
  const filename = `kaczy-sync-${format(new Date(), "yyyy-MM-dd-HHmm")}.json`;
  download(data, filename, "application/json");
  return { filename, size: new Blob([data]).size };
}

/** Wybór pliku + merge. Nic nie jest usuwane ani nadpisywane. */
export function importSyncFile(): Promise<{ newNotes: number }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return reject(new Error("Nie wybrano pliku"));
      if (f.size > MAX_SYNC_FILE_SIZE) return reject(new Error("Plik jest zbyt duży (max 100 MB)"));
      try {
        const file = parseSyncFile(await f.text());
        await yjsStore.ready();
        resolve(await mergeSyncFile(file));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Nieprawidłowy plik"));
      }
    };
    input.click();
  });
}

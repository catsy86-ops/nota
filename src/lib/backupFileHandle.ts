import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { DANE } from "@/lib/storage/names";

// File System Access API: TS's lib.dom.d.ts has FileSystemFileHandle itself
// but not window.showSaveFilePicker() or the permission methods yet.
declare global {
  interface FileSystemHandlePermissionDescriptor {
    mode?: "read" | "readwrite";
  }
  interface FileSystemHandle {
    queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }
  interface Window {
    showSaveFilePicker?(options?: {
      suggestedName?: string;
      types?: { description: string; accept: Record<string, string[]> }[];
    }): Promise<FileSystemFileHandle>;
  }
}

const HANDLE_KEY = DANE.backupFileHandle;

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && typeof window.showSaveFilePicker === "function";
}

/** Opens the native "Save as" picker once and remembers the chosen file for future overwrites. */
export async function pickBackupFile(suggestedName: string): Promise<boolean> {
  if (!isFileSystemAccessSupported()) return false;
  try {
    const handle = await window.showSaveFilePicker!({
      suggestedName,
      types: [{ description: "Backup JSON", accept: { "application/json": [".json"] } }],
    });
    await idbSet(HANDLE_KEY, handle);
    return true;
  } catch {
    return false; // user cancelled the picker
  }
}

export async function clearBackupFile(): Promise<void> {
  await idbDel(HANDLE_KEY);
  try { localStorage.removeItem(LAST_WRITE_KEY); } catch { /* ignore */ }
}

/** QL-2: ostatni udany zapis do wybranego pliku (data, rozmiar) — pokazywany w Ustawieniach. Lokalnie, poza kopią. */
const LAST_WRITE_KEY = DANE.backupFileLast;
export interface BackupFileWrite { at: number; bytes: number }

export function readLastFileWrite(): BackupFileWrite | null {
  try {
    const v = JSON.parse(localStorage.getItem(LAST_WRITE_KEY) ?? "null") as Partial<BackupFileWrite> | null;
    return v && typeof v.at === "number" && typeof v.bytes === "number" ? { at: v.at, bytes: v.bytes } : null;
  } catch {
    return null;
  }
}

function recordFileWrite(content: string) {
  try { localStorage.setItem(LAST_WRITE_KEY, JSON.stringify({ at: Date.now(), bytes: new Blob([content]).size })); } catch { /* tryb prywatny */ }
}

export async function hasBackupFile(): Promise<boolean> {
  if (!isFileSystemAccessSupported()) return false;
  return !!(await idbGet<FileSystemFileHandle>(HANDLE_KEY));
}

export async function getBackupFileName(): Promise<string | null> {
  const handle = await idbGet<FileSystemFileHandle>(HANDLE_KEY);
  return handle?.name ?? null;
}

/**
 * Overwrites the remembered file with `content`. Returns false (caller should
 * fall back to a normal download) when unsupported, nothing is remembered
 * yet, or the browser no longer grants write access to it.
 */
export async function tryWriteBackupToFile(content: string): Promise<boolean> {
  if (!isFileSystemAccessSupported()) return false;
  const handle = await idbGet<FileSystemFileHandle>(HANDLE_KEY);
  if (!handle) return false;
  try {
    const query = (await handle.queryPermission?.({ mode: "readwrite" })) ?? "granted";
    const granted = query === "granted"
      ? true
      : (await handle.requestPermission?.({ mode: "readwrite" })) === "granted";
    if (!granted) return false;

    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    recordFileWrite(content);
    return true;
  } catch {
    return false;
  }
}

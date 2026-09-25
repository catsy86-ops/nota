import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";

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

const HANDLE_KEY = "kaczy.backupFileHandle";

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
    return true;
  } catch {
    return false;
  }
}

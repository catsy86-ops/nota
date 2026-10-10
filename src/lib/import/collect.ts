import { IMPORT_LIMITS } from "./limits";
import type { SourceFile } from "./types";
import { listZip } from "./zip";

const decoder = new TextDecoder("utf-8");

function decodeText(bytes: Uint8Array): string {
  return decoder.decode(bytes).replace(/^\uFEFF/, "");
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").split("/").filter((s) => s !== "" && s !== ".").join("/");
}

/** Plik z gotową zawartością — dla testów i dla wpisów, które już mamy w pamięci. */
export function memorySource(path: string, content: string | Uint8Array, lastModified = 0): SourceFile {
  const norm = normalizePath(path);
  const data = typeof content === "string" ? new TextEncoder().encode(content) : content;
  return {
    path: norm,
    name: norm.split("/").pop() ?? norm,
    size: data.length,
    lastModified,
    bytes: async () => data,
    text: async () => decodeText(data),
  };
}

/** `Blob.arrayBuffer` z zapasem na FileReader (starsze silniki, jsdom). */
function readBuffer(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error ?? new Error("Nie udało się odczytać pliku"));
    r.readAsArrayBuffer(file);
  });
}

function fromFile(file: File): SourceFile {
  const path = normalizePath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name);
  return {
    path,
    name: file.name,
    size: file.size,
    lastModified: file.lastModified || 0,
    bytes: async () => new Uint8Array(await readBuffer(file)),
    text: async () => decodeText(new Uint8Array(await readBuffer(file))),
  };
}

export interface CollectResult {
  sources: SourceFile[];
  warnings: string[];
  /** Pliki ZIP, których nie dało się odczytać. */
  failures: { path: string; reason: string }[];
}

/**
 * Zamienia wybrane `File` na płaską listę źródeł, rozpakowując archiwa ZIP.
 * Nic tu nie parsuje notatek; limity liczby i rozmiaru są egzekwowane tutaj.
 */
export async function collectSources(files: File[]): Promise<CollectResult> {
  const sources: SourceFile[] = [];
  const warnings: string[] = [];
  const failures: CollectResult["failures"] = [];
  let totalBytes = 0;
  let truncated = false;

  const push = (s: SourceFile) => {
    if (sources.length >= IMPORT_LIMITS.maxFiles || totalBytes + s.size > IMPORT_LIMITS.maxTotalBytes) { truncated = true; return; }
    totalBytes += s.size;
    sources.push(s);
  };

  for (const file of files) {
    const isZip = /\.zip$/i.test(file.name) || file.type === "application/zip" || file.type === "application/x-zip-compressed";
    if (!isZip) { push(fromFile(file)); continue; }
    try {
      if (file.size > IMPORT_LIMITS.maxZipBytes) throw new Error(`Archiwum jest zbyt duże (max ${IMPORT_LIMITS.maxZipBytes / (1024 * 1024)} MB)`);
      const { entries, skipped } = listZip(new Uint8Array(await readBuffer(file)), { maxEntries: IMPORT_LIMITS.maxFiles, maxEntryBytes: IMPORT_LIMITS.maxImageBytes });
      if (skipped) warnings.push(`${file.name}: pominięto ${skipped} pozycji (zaszyfrowane, zbyt duże lub nieobsługiwana kompresja)`);
      const modified = file.lastModified || 0;
      for (const e of entries) {
        const path = e.name;
        const name = path.split("/").pop() ?? path;
        push({
          path, name, size: e.size, lastModified: modified,
          bytes: () => e.read(),
          text: async () => decodeText(await e.read(IMPORT_LIMITS.maxNoteFileBytes)),
        });
      }
    } catch (err) {
      failures.push({ path: file.name, reason: err instanceof Error ? err.message : "Nie udało się odczytać archiwum" });
    }
  }
  if (truncated) warnings.push(`Przekroczono limit importu (${IMPORT_LIMITS.maxFiles} plików / ${IMPORT_LIMITS.maxTotalBytes / (1024 * 1024)} MB) — część plików pominięto`);
  return { sources, warnings, failures };
}

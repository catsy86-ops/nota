/**
 * Minimalny czytnik ZIP (bez zależności): central directory + metody
 * 0 (stored) i 8 (deflate, przez `DecompressionStream`). Bez ZIP64 i szyfrowania.
 */

export interface ZipEntry {
  name: string;
  /** Rozmiar po rozpakowaniu deklarowany w nagłówku. */
  size: number;
  read(maxBytes?: number): Promise<Uint8Array>;
}

export class ZipError extends Error {}

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);

async function inflateRaw(data: Uint8Array, maxBytes: number): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new ZipError("Ta przeglądarka nie potrafi rozpakować ZIP — rozpakuj archiwum ręcznie i wybierz folder");
  }
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  // Zapis i odczyt idą równolegle — inaczej dłuższy strumień zakleszcza się na kolejce.
  void writer.write(data as unknown as BufferSource).then(() => writer.close()).catch(() => { /* błąd wyjdzie z odczytu */ });
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      void reader.cancel().catch(() => { /* ignore */ });
      throw new ZipError("Plik w archiwum jest zbyt duży");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

/** Normalizuje ścieżkę z archiwum; `null` = podejrzana (`..`, absolutna) lub katalog. */
export function safeZipPath(raw: string): string | null {
  const p = raw.replace(/\\/g, "/");
  if (p.endsWith("/")) return null;
  if (p.startsWith("/") || /^[a-zA-Z]:/.test(p)) return null;
  const parts = p.split("/").filter((s) => s !== "" && s !== ".");
  if (!parts.length || parts.includes("..")) return null;
  return parts.join("/");
}

export function listZip(buf: Uint8Array, opts: { maxEntries?: number; maxEntryBytes?: number } = {}): { entries: ZipEntry[]; skipped: number } {
  const maxEntries = opts.maxEntries ?? 5000;
  const maxEntryBytes = opts.maxEntryBytes ?? 50 * 1024 * 1024;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // EOCD leży w ostatnich 22 + 65535 bajtach.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (u32(view, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new ZipError("To nie jest poprawne archiwum ZIP");
  const total = u16(view, eocd + 10);
  const cdOffset = u32(view, eocd + 16);
  if (total === 0xffff || cdOffset === 0xffffffff) throw new ZipError("Archiwa ZIP64 nie są obsługiwane");
  const entries: ZipEntry[] = [];
  let skipped = 0;
  let p = cdOffset;
  const decoder = new TextDecoder("utf-8");
  for (let i = 0; i < total; i++) {
    if (p + 46 > buf.length || u32(view, p) !== 0x02014b50) throw new ZipError("Uszkodzony spis treści archiwum ZIP");
    const flags = u16(view, p + 8);
    const method = u16(view, p + 10);
    const compSize = u32(view, p + 20);
    const size = u32(view, p + 24);
    const nameLen = u16(view, p + 28);
    const extraLen = u16(view, p + 30);
    const commentLen = u16(view, p + 32);
    const localOffset = u32(view, p + 42);
    const rawName = decoder.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    const name = safeZipPath(rawName);
    if (!name) continue; // katalog albo ścieżka spoza archiwum
    if ((flags & 1) !== 0 || (method !== 0 && method !== 8) || size > maxEntryBytes || compSize > maxEntryBytes) { skipped++; continue; }
    if (entries.length >= maxEntries) { skipped++; continue; }
    entries.push({
      name,
      size,
      async read(maxBytes = maxEntryBytes) {
        if (localOffset + 30 > buf.length || u32(view, localOffset) !== 0x04034b50) throw new ZipError("Uszkodzony wpis archiwum ZIP");
        const start = localOffset + 30 + u16(view, localOffset + 26) + u16(view, localOffset + 28);
        if (start + compSize > buf.length) throw new ZipError("Uszkodzony wpis archiwum ZIP");
        const raw = buf.subarray(start, start + compSize);
        if (method === 0) return raw.slice();
        return inflateRaw(raw, Math.min(maxBytes, maxEntryBytes));
      },
    });
  }
  return { entries, skipped };
}

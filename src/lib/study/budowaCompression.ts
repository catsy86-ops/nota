/**
 * B5.2: Kompresja `.budowa` i archiwum budowy (gzip CompressionStream).
 * Paczka z dużą liczbą wpisów kilka razy mniejsza w WhatsApp.
 * Nowy format v2 (header + gzip), stary v1 (JSON) nadal się wczytuje.
 */

import { SITE_PACKAGE_MAX_BYTES } from "./sitePackage";

const COMPRESSION_VERSION = 2;
/** Górny limit tekstu po rozpakowaniu — taki sam jak w `parseSitePackage` (chroni przed bombą gzip). */
export const DECOMPRESSED_MAX_BYTES = Math.floor(SITE_PACKAGE_MAX_BYTES * 1.4);
const COMPRESSION_MAGIC = new Uint8Array([0x42, 0x44, 0x57]); // "BDW" (Budowa compressed)

export interface CompressionMetadata {
  version: number;
  timestamp: number;
  originalSize: number;
}

export async function compressBudowa(jsonData: string): Promise<Blob> {
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonData);

  const metadata: CompressionMetadata = {
    version: COMPRESSION_VERSION,
    timestamp: Date.now(),
    originalSize: data.byteLength,
  };

  // Header: magic + metadata
  const metadataJson = JSON.stringify(metadata);
  const metadataBytes = encoder.encode(metadataJson);
  const metadataLength = new Uint8Array(2);
  new DataView(metadataLength.buffer).setUint16(0, metadataBytes.byteLength, true);

  // Kompresja: data → gzip
  const dataBlob = new Blob([data]);
  const compressedStream = dataBlob
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const compressedArrays: Uint8Array[] = [];
  const reader = compressedStream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      compressedArrays.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  // Złożenie: magic + metadataLength + metadata + compressedData
  const parts: Uint8Array[] = [
    COMPRESSION_MAGIC,
    metadataLength,
    metadataBytes,
  ];

  for (const arr of compressedArrays) {
    parts.push(arr);
  }

  return new Blob(parts, { type: "application/budowa-compressed" });
}

export async function decompressBudowa(blob: Blob): Promise<string | null> {
  try {
    const data = new Uint8Array(await blob.arrayBuffer());

    // Sprawdzenie magic
    if (
      data[0] !== COMPRESSION_MAGIC[0] ||
      data[1] !== COMPRESSION_MAGIC[1] ||
      data[2] !== COMPRESSION_MAGIC[2]
    ) {
      // Stary format v1 — zwykły JSON
      return new TextDecoder().decode(data);
    }

    // Odczyt metadataLength (little-endian, bez wyrównania — Uint16Array wymagałby parzystego offsetu)
    if (data.length < 5) return null;
    const metadataLength = new DataView(data.buffer, data.byteOffset).getUint16(3, true);
    const metadataStart = 5;
    const metadataEnd = metadataStart + metadataLength;
    if (metadataEnd > data.length) return null;

    // Metadane
    const metadataBytes = data.slice(metadataStart, metadataEnd);
    const metadata = JSON.parse(new TextDecoder().decode(metadataBytes)) as CompressionMetadata;
    if (metadata.version !== COMPRESSION_VERSION) return null;
    if (typeof metadata.originalSize !== "number" || metadata.originalSize > DECOMPRESSED_MAX_BYTES) return null;

    // Dekompresja gzip z licznikiem: przerywamy, gdy wynik przekroczy limit lub deklarację z nagłówka
    const compressedBlob = new Blob([data.slice(metadataEnd)]);
    const decompressedStream = compressedBlob
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));

    const chunks: Uint8Array[] = [];
    const reader = decompressedStream.getReader();
    let total = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > metadata.originalSize) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    if (total !== metadata.originalSize) return null;

    const decompressed = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      decompressed.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new TextDecoder().decode(decompressed);
  } catch {
    return null;
  }
}

export function compressionRatio(originalSize: number, compressedSize: number): number {
  if (originalSize === 0) return 0;
  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
}

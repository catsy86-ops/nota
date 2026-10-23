import { safeMime, MAX_PEER_BLOB_BYTES, type ImageStore } from "@/lib/imageStore";
import { blobAad, blobIdOf, openRaw, sealRaw, type RelayKeys } from "@/lib/sync/relayKeys";

/**
 * Obrazy i załączniki przez przekaźnik. Blob to zaszyfrowany plik (surowe bajty, bez
 * base64, bo obraz może mieć 20 MB, a wpis przekaźnika ma 512 KB). Serwer widzi tylko
 * identyfikator (HMAC z hasha treści) i rozmiar.
 *
 * Zawartość przed szyfrowaniem: 4 bajty długości nagłówka (big-endian), nagłówek JSON
 * `{"t": typ MIME}`, potem bajty pliku. Typ jest więc też zaszyfrowany.
 *
 * Kierunki:
 * - wysyłanie: lokalny obraz z referencji notatek, którego serwer jeszcze nie ma (HEAD → PUT);
 * - pobieranie: referencja bez lokalnego obrazu → GET, odszyfrowanie, `putBytes` z weryfikacją
 *   SHA-256 (`expected`) i limitem rozmiaru. Obcy blob o złym hashu jest odrzucany.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();
const MAX_HEADER_BYTES = 1024;

export type BlobImages = Pick<ImageStore, "has" | "get" | "putBytes">;

export interface RelayBlobsOptions {
  baseUrl: string;
  keys: RelayKeys;
  /** Hashe obrazów, które notatki wskazują (`yjsStore.syncableRefs()`). */
  refs: () => Iterable<string>;
  images: BlobImages;
  fetch?: typeof fetch;
}

export interface BlobSyncResult {
  uploaded: number;
  downloaded: number;
  failed: number;
}

export function packBlob(type: string, bytes: Uint8Array): Uint8Array {
  const head = enc.encode(JSON.stringify({ t: safeMime(type) }));
  const out = new Uint8Array(4 + head.length + bytes.length);
  new DataView(out.buffer).setUint32(0, head.length);
  out.set(head, 4);
  out.set(bytes, 4 + head.length);
  return out;
}

export function unpackBlob(buf: Uint8Array): { type: string; bytes: Uint8Array } {
  if (buf.length < 4) throw new Error("blob: za krótki");
  const n = new DataView(buf.buffer, buf.byteOffset, buf.byteLength).getUint32(0);
  if (n <= 0 || n > MAX_HEADER_BYTES || 4 + n > buf.length) throw new Error("blob: zły nagłówek");
  const meta = JSON.parse(dec.decode(buf.subarray(4, 4 + n))) as { t?: unknown };
  return { type: safeMime(meta.t), bytes: buf.subarray(4 + n) };
}

export class RelayBlobs {
  /** Identyfikatory, o których wiemy, że są na serwerze (cache sesji, żeby nie pytać ciągle). */
  private readonly known = new Set<string>();
  private readonly base: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opts: RelayBlobsOptions) {
    this.base = opts.baseUrl.replace(/\/+$/, "");
    this.fetchFn = opts.fetch ?? fetch.bind(globalThis); // natywny fetch wymaga właściwego this
  }

  async sync(): Promise<BlobSyncResult> {
    const result: BlobSyncResult = { uploaded: 0, downloaded: 0, failed: 0 };
    for (const hash of this.opts.refs()) {
      try {
        const id = await blobIdOf(this.opts.keys, hash);
        if (this.opts.images.has(hash)) {
          if (await this.upload(hash, id)) result.uploaded++;
        } else if (await this.download(hash, id)) {
          result.downloaded++;
        }
      } catch {
        result.failed++;
      }
    }
    return result;
  }

  /** true, jeśli wysłano; false, jeśli serwer już ma. */
  private async upload(hash: string, id: string): Promise<boolean> {
    if (this.known.has(id)) return false;
    const path = `/rooms/${this.opts.keys.roomId}/blobs/${id}`;
    const exists = await this.fetchFn(`${this.base}${path}`, { method: "HEAD", headers: this.auth(), cache: "no-store" });
    if (exists.ok) {
      this.known.add(id);
      return false;
    }
    const rec = await this.opts.images.get(hash);
    if (!rec) throw new Error("blob: obraz zniknął lokalnie");
    const plain = packBlob(rec.type, new Uint8Array(rec.bytes));
    const sealed = await sealRaw(this.opts.keys.dataKey, plain, blobAad(this.opts.keys.roomId, id));
    const res = await this.fetchFn(`${this.base}${path}`, {
      method: "PUT",
      headers: { ...this.auth(), "Content-Type": "application/octet-stream" },
      body: sealed,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`blob: wysyłanie odrzucone (${res.status})`);
    this.known.add(id);
    return true;
  }

  /** true, jeśli pobrano i zapisano; false, jeśli serwer jeszcze nie ma. */
  private async download(hash: string, id: string): Promise<boolean> {
    const res = await this.fetchFn(`${this.base}/rooms/${this.opts.keys.roomId}/blobs/${id}`, {
      method: "GET",
      headers: this.auth(),
      cache: "no-store",
    });
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`blob: pobieranie odrzucone (${res.status})`);
    const sealed = new Uint8Array(await res.arrayBuffer());
    const plain = await openRaw(this.opts.keys.dataKey, sealed, blobAad(this.opts.keys.roomId, id));
    const { type, bytes } = unpackBlob(plain);
    if (bytes.length > MAX_PEER_BLOB_BYTES) throw new Error("blob: za duży");
    // putBytes sprawdza SHA-256 względem `hash` i odrzuca niezgodne bajty.
    await this.opts.images.putBytes(bytes, type, hash);
    this.known.add(id);
    return true;
  }

  private auth(): Record<string, string> {
    return { Authorization: `Bearer ${this.opts.keys.token}` };
  }
}


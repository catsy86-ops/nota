import { fromB64u, toB64u } from "@/lib/vault";

/**
 * Klucze przekaźnika wyprowadzane z kodu synchronizacji. Wszystko idzie z jednego
 * PBKDF2, bo kod ma ok. 59 bitów: sam HKDF nie chroniłby go przed zgadywaniem
 * przez operatora serwera, który zna identyfikator pokoju i token.
 *
 *   kod ──PBKDF2-SHA-256 (sól stała, 200 000)──▶ master (32 B)
 *   master ──SHA-256("notki-relay-room:" ‖ master)──▶ roomId (hex, 64 znaki)
 *   master ──HKDF("notki-relay-auth-v1")──▶ token (base64url, 43 znaki)
 *   master ──HKDF("notki-relay-data-v1")──▶ klucz AES-GCM (niewyodrębnialny)
 *
 * Serwer dostaje tylko `roomId` i `token` (przechowuje hash tokenu). Klucz danych
 * nie opuszcza przeglądarki.
 */

const enc = new TextEncoder();
const SALT = enc.encode("notki-relay-v1");
/** Koszt wyprowadzenia z kodu. Raz na połączenie, nie na zapis. */
export const RELAY_KDF_ITERATIONS = 200_000;
const IV_BYTES = 12;

export interface RelayKeys {
  roomId: string;
  token: string;
  dataKey: CryptoKey;
  /** HMAC do wyliczania identyfikatorów blobów z hasha treści (serwer nie zna hasha). */
  blobIdKey: CryptoKey;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function deriveRelayKeys(code: string, iterations: number = RELAY_KDF_ITERATIONS): Promise<RelayKeys> {
  const password = await crypto.subtle.importKey("raw", enc.encode(code), "PBKDF2", false, ["deriveBits"]);
  const master = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: SALT, iterations }, password, 256),
  );

  const roomId = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", concat(enc.encode("notki-relay-room:"), master))));

  const hkdf = await crypto.subtle.importKey("raw", master, "HKDF", false, ["deriveBits", "deriveKey"]);
  const hkdfParams = (info: string) => ({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: enc.encode(info) });
  const token = toB64u(new Uint8Array(await crypto.subtle.deriveBits(hkdfParams("notki-relay-auth-v1"), hkdf, 256)));
  const dataKey = await crypto.subtle.deriveKey(
    hkdfParams("notki-relay-data-v1"),
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  const blobIdKey = await crypto.subtle.deriveKey(
    hkdfParams("notki-relay-blobid-v1"),
    hkdf,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    ["sign"],
  );

  return { roomId, token, dataKey, blobIdKey };
}

/** Identyfikator bloba na serwerze: HMAC(klucz pokoju, SHA-256 treści). Bez klucza nie da się go sprawdzić. */
export async function blobIdOf(keys: RelayKeys, contentHash: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", keys.blobIdKey, enc.encode(contentHash));
  return hex(new Uint8Array(sig));
}

export const blobAad = (roomId: string, blobId: string) => `notki:relay:blob:v1:${roomId}:${blobId}`;

/** Szyfrowanie surowych bajtów (bloby) bez base64: wynik to IV ‖ szyfrogram. */
export async function sealRaw(key: CryptoKey, plain: Uint8Array, aad: string): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, key, plain));
  return concat(iv, ct);
}

export async function openRaw(key: CryptoKey, raw: Uint8Array, aad: string): Promise<Uint8Array> {
  if (raw.length <= IV_BYTES) throw new Error("relay: za krótki blob");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: raw.subarray(0, IV_BYTES), additionalData: enc.encode(aad) },
    key,
    raw.subarray(IV_BYTES),
  );
  return new Uint8Array(plain);
}

/** Szyfruje bajty; wynik to base64url(IV ‖ szyfrogram). AAD wiąże wpis z pokojem. */
export async function sealBytes(key: CryptoKey, plain: Uint8Array, aad: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, key, plain));
  return toB64u(concat(iv, ct));
}

/** Odwrotność `sealBytes`. Rzuca, gdy klucz, AAD albo treść nie pasują. */
export async function openBytes(key: CryptoKey, token: string, aad: string): Promise<Uint8Array> {
  const raw = fromB64u(token);
  if (raw.length <= IV_BYTES) throw new Error("relay: za krótki wpis");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: raw.subarray(0, IV_BYTES), additionalData: enc.encode(aad) },
    key,
    raw.subarray(IV_BYTES),
  );
  return new Uint8Array(plain);
}

export const relayAad = (roomId: string) => `notki:relay:v1:${roomId}`;

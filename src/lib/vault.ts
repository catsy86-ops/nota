/**
 * Skarbiec prywatnych notatek — czysta warstwa kryptograficzna (WebCrypto,
 * zero zależności). Nie zna notatek ani Yjs; dostaje klucze i napisy.
 *
 * Model kluczy:
 *   hasło ──PBKDF2-SHA-256 (sól 16 B, ≥ 600 000 iteracji)──▶ KEK (AES-GCM, niewyodrębnialny)
 *   KEK ──AES-GCM──▶ `wrapped` = zaszyfrowany losowy klucz danych DK (32 B)
 *   kod awaryjny ──HKDF──▶ klucz awaryjny ──AES-GCM──▶ `recovery` = ten sam DK
 *   DK szyfruje treść notatek (AES-256-GCM, IV 12 B losowy na każdy zapis,
 *   AAD = id notatki, format `v1.<iv>.<szyfrogram>` w base64url).
 *
 * Dlaczego klucz danych, a nie wprost klucz z hasła: zmiana hasła i kod
 * awaryjny to wtedy tylko przepakowanie DK. Hasło nie jest nigdzie
 * przechowywane; weryfikatorem jest tag GCM przy odpakowaniu DK (plus
 * `check` — znany tekst pod DK).
 *
 * Klucz używany do pracy (DK) istnieje wyłącznie jako `CryptoKey` z
 * `extractable: false`. Surowe bajty DK żyją w pamięci tylko w chwili
 * zakładania skarbca / zmiany hasła / odpakowania i są zerowane.
 */

export const VAULT_VERSION = "v1";
/** OWASP 2023 dla PBKDF2-HMAC-SHA256. */
export const KDF_ITERATIONS = 600_000;
/**
 * Górna granica `iter` z metadanych. Metadane przychodzą z dokumentu (peer, plik,
 * backup) — `iter: 2e9` zawiesiłoby kartę na odblokowaniu (DoS), a to wartość,
 * której uczciwy klient nigdy nie zapisze.
 */
export const MAX_KDF_ITERATIONS = 10_000_000;
export const SALT_BYTES = 16;
export const IV_BYTES = 12;
const DK_BYTES = 32;
const RECOVERY_BYTES = 20; // 160 bitów = 32 znaki base32

const AAD_DK = "notki:vault:dk";
const AAD_DK_RECOVERY = "notki:vault:dk:recovery";
const AAD_CHECK = "notki:vault:check";
const CHECK_PLAINTEXT = "notki-vault-ok";

export type VaultErrorCode = "bad-format" | "unsupported-version" | "decrypt-failed" | "bad-password" | "bad-recovery" | "weak-params";

export class VaultError extends Error {
  constructor(public readonly code: VaultErrorCode, message?: string) {
    super(message ?? code);
    this.name = "VaultError";
  }
}

// ── base64url ────────────────────────────────────────────────────────────────

export function toB64u(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64u(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new VaultError("bad-format");
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** AAD notatki: szyfrogram jednej notatki nie odszyfruje się pod id innej. */
export const noteAad = (noteId: string) => `notki:note:${noteId}`;

/** Format v2 (V-3): AAD wiąże szyfrogram z epoką skarbca — szyfrogram z innej epoki albo innego skarbca nie odszyfruje się. */
export const VAULT_VERSION_V2 = "v2";
export const noteAadV2 = (noteId: string, epoch: number) => `notki:v2:${epoch}:${noteId}`;

// ── szyfrowanie ──────────────────────────────────────────────────────────────

async function encryptBytes(key: CryptoKey, plain: Uint8Array, aad: string, version: string = VAULT_VERSION): Promise<string> {
  const iv = randomBytes(IV_BYTES);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, key, plain));
  return `${version}.${toB64u(iv)}.${toB64u(ct)}`;
}

async function decryptBytes(key: CryptoKey, token: string, aad: string): Promise<Uint8Array> {
  if (typeof token !== "string") throw new VaultError("bad-format");
  const parts = token.split(".");
  if (parts.length !== 3) throw new VaultError("bad-format");
  if (parts[0] !== VAULT_VERSION && parts[0] !== VAULT_VERSION_V2) throw new VaultError("unsupported-version", `Nieobsługiwana wersja formatu: ${parts[0].slice(0, 8)}`);
  let iv: Uint8Array;
  let ct: Uint8Array;
  try { iv = fromB64u(parts[1]); ct = fromB64u(parts[2]); } catch { throw new VaultError("bad-format"); }
  if (iv.length !== IV_BYTES || ct.length < 16) throw new VaultError("bad-format");
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, key, ct));
  } catch {
    // Zły klucz, zmieniony szyfrogram i zły AAD są nie do odróżnienia — celowo.
    throw new VaultError("decrypt-failed");
  }
}

export function encryptString(key: CryptoKey, plaintext: string, aad: string): Promise<string> {
  return encryptBytes(key, enc.encode(plaintext), aad);
}

export async function decryptString(key: CryptoKey, token: string, aad: string): Promise<string> {
  return dec.decode(await decryptBytes(key, token, aad));
}

/** Rozpoznaje token wersji 1 bez odszyfrowywania (np. przy imporcie). */
export function looksLikeVaultToken(s: unknown): s is string {
  return typeof s === "string" && /^v[12]\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/.test(s);
}

// ── klucze ───────────────────────────────────────────────────────────────────

/** KEK z hasła. `iterations` poniżej progu dopuszcza tylko wołający (testy). */
export async function deriveKek(password: string, salt: Uint8Array, iterations: number = KDF_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function deriveRecoveryKek(code: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", code, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: enc.encode("notki-vault-recovery-v1") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Surowe bajty DK → niewyodrębnialny CryptoKey. */
export function importDataKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

// ── kod awaryjny (base32, grupy po 4) ────────────────────────────────────────

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function encodeRecoveryCode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out.match(/.{1,4}/g)!.join("-");
}

export function decodeRecoveryCode(code: string): Uint8Array {
  const clean = code.toUpperCase().replace(/[\s-]/g, "").replace(/0/g, "O").replace(/1/g, "I");
  if (!/^[A-Z2-7]+$/.test(clean)) throw new VaultError("bad-recovery");
  const out: number[] = [];
  let bits = 0, value = 0;
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  const bytes = Uint8Array.from(out).slice(0, RECOVERY_BYTES);
  if (bytes.length !== RECOVERY_BYTES) throw new VaultError("bad-recovery");
  return bytes;
}

// ── metadane skarbca (synchronizowane; nie zawierają niczego tajnego) ────────

export interface VaultMeta {
  v: 1;
  /** Sól PBKDF2 (base64url, 16 B). Nie jest tajna. */
  salt: string;
  iter: number;
  /** DK zaszyfrowany kluczem z hasła. */
  wrapped: string;
  /** Znany tekst pod DK — potwierdza, że odpakowany klucz jest właściwy. */
  check: string;
  /** DK zaszyfrowany kodem awaryjnym (brak, gdy użytkownik go nie chce). */
  recovery?: string;
  /** Licznik zmian klucza — inne urządzenie po zmianie hasła widzi, że jego sesja jest nieaktualna. */
  epoch: number;
}

export interface CreatedVault {
  meta: VaultMeta;
  dataKey: CryptoKey;
  /** Pokazywany raz; nigdzie nie zapisywany. */
  recoveryCode: string | null;
}

export interface VaultOptions {
  /** Domyślnie `KDF_ITERATIONS`; niższe wartości są dla testów. */
  iterations?: number;
}

export function isValidMeta(m: unknown): m is VaultMeta {
  if (!m || typeof m !== "object") return false;
  const x = m as Record<string, unknown>;
  return x.v === 1 && typeof x.salt === "string" && x.salt.length <= 64 && typeof x.iter === "number" && Number.isInteger(x.iter)
    && x.iter > 0 && x.iter <= MAX_KDF_ITERATIONS
    && typeof x.wrapped === "string" && x.wrapped.length <= 256 && typeof x.check === "string" && x.check.length <= 256
    && (x.recovery === undefined || (typeof x.recovery === "string" && x.recovery.length <= 256))
    && typeof x.epoch === "number" && Number.isFinite(x.epoch);
}

/** Nowy skarbiec (albo nowy klucz danych przy zmianie hasła). */
export async function createVault(password: string, { iterations = KDF_ITERATIONS, withRecovery = true, epoch = 1 }: VaultOptions & { withRecovery?: boolean; epoch?: number } = {}): Promise<CreatedVault> {
  const salt = randomBytes(SALT_BYTES);
  const raw = randomBytes(DK_BYTES);
  try {
    const [kek, dataKey] = await Promise.all([deriveKek(password, salt, iterations), importDataKey(raw)]);
    const wrapped = await encryptBytes(kek, raw, AAD_DK);
    const check = await encryptString(dataKey, CHECK_PLAINTEXT, AAD_CHECK);
    let recovery: string | undefined;
    let recoveryCode: string | null = null;
    if (withRecovery) {
      const code = randomBytes(RECOVERY_BYTES);
      recovery = await encryptBytes(await deriveRecoveryKek(code), raw, AAD_DK_RECOVERY);
      recoveryCode = encodeRecoveryCode(code);
      code.fill(0);
    }
    return { meta: { v: 1, salt: toB64u(salt), iter: iterations, wrapped, check, ...(recovery ? { recovery } : {}), epoch }, dataKey, recoveryCode };
  } finally {
    raw.fill(0);
  }
}

async function finishUnlock(meta: VaultMeta, raw: Uint8Array): Promise<CryptoKey> {
  try {
    if (raw.length !== DK_BYTES) throw new VaultError("decrypt-failed");
    const key = await importDataKey(raw);
    if ((await decryptString(key, meta.check, AAD_CHECK)) !== CHECK_PLAINTEXT) throw new VaultError("decrypt-failed");
    return key;
  } finally {
    raw.fill(0);
  }
}

/**
 * Klucz danych z hasła. `minIterations` chroni przed metadanymi z dokumentu,
 * które ktoś obniżył, żeby ułatwić zgadywanie.
 */
export async function unlockWithPassword(meta: VaultMeta, password: string, minIterations: number = KDF_ITERATIONS): Promise<CryptoKey> {
  if (meta.iter < minIterations) throw new VaultError("weak-params", "Skarbiec ma zbyt słabe parametry KDF");
  const kek = await deriveKek(password, fromB64u(meta.salt), meta.iter);
  let raw: Uint8Array;
  try { raw = await decryptBytes(kek, meta.wrapped, AAD_DK); } catch (e) {
    if (e instanceof VaultError && e.code === "decrypt-failed") throw new VaultError("bad-password");
    throw e;
  }
  return finishUnlock(meta, raw);
}

export async function unlockWithRecovery(meta: VaultMeta, recoveryCode: string): Promise<CryptoKey> {
  if (!meta.recovery) throw new VaultError("bad-recovery", "Ten skarbiec nie ma kodu awaryjnego");
  const code = decodeRecoveryCode(recoveryCode);
  let raw: Uint8Array;
  try { raw = await decryptBytes(await deriveRecoveryKek(code), meta.recovery, AAD_DK_RECOVERY); } catch (e) {
    if (e instanceof VaultError && e.code === "decrypt-failed") throw new VaultError("bad-recovery");
    throw e;
  } finally { code.fill(0); }
  return finishUnlock(meta, raw);
}

// ── miernik hasła ────────────────────────────────────────────────────────────

/** Minimum dla nowych haseł (V-1). Stare, krótsze hasła dalej odblokowują skarbiec — minimum dotyczy tylko zapisu. */
export const MIN_PASSWORD_LENGTH = 12;

export interface PasswordStrength {
  /** 0–4. */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  ok: boolean;
}

/** Najczęstsze hasła (PL/EN) i hasła „z nazwy aplikacji”; porównanie po zdjęciu cyfr/znaków z końca. */
const COMMON_PASSWORDS = new Set([
  "password", "passw0rd", "haslo", "haslo123", "qwerty", "qwertyui", "qwertyuiop", "qwerty123", "asdfghjk", "zxcvbnm",
  "12345678", "123456789", "1234567890", "11111111", "00000000", "1q2w3e4r", "1qaz2wsx", "zaq12wsx", "admin", "admin123",
  "letmein", "welcome", "iloveyou", "monkey", "dragon", "master", "abc12345", "polska", "kocham", "notatnik", "notki",
  "skarbiec", "sekret", "tajne", "tajnehaslo", "mojehaslo", "superhaslo", "trustno1", "changeme",
]);

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890", "qazwsxedcrfvtgbyhnujmik"];

/**
 * Hasła, które przechodzą długość, a łamie się je w sekundach: ≤ 3 różne znaki,
 * powtarzany wzorzec („abababab”), ciąg kolejnych znaków („abcdefgh”, „87654321”,
 * „qwertyui”) albo pozycja z listy najczęstszych haseł (też z doklejoną cyfrą/rokiem).
 */
export function isTrivialPassword(pw: string): boolean {
  const p = pw.normalize("NFKC").toLowerCase();
  const chars = [...p];
  if (chars.length === 0) return false;
  if (new Set(chars).size <= 3) return true;
  for (let period = 1; period <= 4; period++) {
    const unit = chars.slice(0, period).join("");
    if (chars.length % period === 0 && unit.repeat(chars.length / period) === p) return true;
  }
  const stripped = p.replace(/[\d\W_]+$/u, "");
  if (COMMON_PASSWORDS.has(p) || COMMON_PASSWORDS.has(stripped)) return true;
  // Ciąg kolejnych kodów znaków (rosnąco lub malejąco) albo fragment rzędu klawiatury.
  const codes = chars.map((c) => c.codePointAt(0)!);
  const steps = new Set(codes.slice(1).map((c, i) => c - codes[i]));
  if (steps.size === 1 && (steps.has(1) || steps.has(-1))) return true;
  const rev = [...p].reverse().join("");
  if (KEYBOARD_ROWS.some((row) => row.includes(p) || row.includes(rev))) return true;
  return false;
}

/** Prosty szacunek: długość i różnorodność znaków; bez słownika, więc tylko wskazówka. */
export function passwordStrength(pw: string): PasswordStrength {
  const len = [...pw].length;
  if (len === 0) return { score: 0, label: "", ok: false };
  if (len >= MIN_PASSWORD_LENGTH && isTrivialPassword(pw)) return { score: 0, label: "Zbyt oczywiste", ok: false };
  const classes = [/[a-ząćęłńóśźż]/, /[A-ZĄĆĘŁŃÓŚŹŻ]/, /\d/, /[^A-Za-z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/].filter((r) => r.test(pw)).length;
  const unique = new Set(pw).size;
  let score = 0;
  if (len >= MIN_PASSWORD_LENGTH) score = 1;
  if (len >= 12 && classes >= 2 && unique >= 6) score = 2;
  if (len >= 14 && classes >= 3 && unique >= 8) score = 3;
  if (len >= 20 || (len >= 16 && classes >= 3 && unique >= 10)) score = 4;
  if (len < MIN_PASSWORD_LENGTH) return { score: 0, label: "Za krótkie", ok: false };
  const label = ["Za krótkie", "Słabe", "Średnie", "Dobre", "Mocne"][score];
  // „Słabe” nie przechodzi: przy minimum 12 znaków liczy się różnorodność (score ≥ 2).
  return { score: score as PasswordStrength["score"], label, ok: score >= 2 };
}

/** Szyfruje notatkę w formacie v2 (V-3): AAD z epoką. Zapis v2 jest wyłączony, dopóki nie ma bramki wersji. */
export function encryptNoteStringV2(key: CryptoKey, plaintext: string, noteId: string, epoch: number): Promise<string> {
  return encryptBytes(key, enc.encode(plaintext), noteAadV2(noteId, epoch), VAULT_VERSION_V2);
}

/** Odszyfrowuje notatkę v1 albo v2: wersja z prefiksu tokenu wybiera AAD. */
export async function decryptNoteString(key: CryptoKey, token: string, noteId: string, epoch: number): Promise<string> {
  const version = typeof token === "string" ? token.split(".")[0] : "";
  const aad = version === VAULT_VERSION_V2 ? noteAadV2(noteId, epoch) : noteAad(noteId);
  return decryptString(key, token, aad);
}

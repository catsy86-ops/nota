import { deriveKek, decryptString, encryptString, fromB64u, KDF_ITERATIONS, MAX_KDF_ITERATIONS, passwordStrength, randomBytes, SALT_BYTES, toB64u, VaultError } from "@/lib/vault";
import { invoicesDump, mergeInvoicesDump } from "./invoicesStore";
import { cleanRecord, type InvoicesDump } from "./yInvoices";

/**
 * Szyfrowany eksport faktur (KSeF, ADR-6). Kopia JSON jest jawna, a faktury zawierają dane osobowe nabywców, więc
 * dla nich jest osobny plik: PBKDF2-SHA-256 (sól 16 B, 600 000 iteracji) → klucz AES-256-GCM, jak w Skarbcu.
 * Plik to JSON z polami jawnymi (format, sól, liczba iteracji) i jednym szyfrogramem całego zrzutu; AAD wiąże
 * szyfrogram z formatem, więc nie da się go podstawić jako innego rodzaju danych.
 */

export const INVOICE_EXPORT_FORMAT = "notki-invoices";
const AAD = "notki:invoices:v1";

export interface EncryptedInvoicesFile {
  format: typeof INVOICE_EXPORT_FORMAT;
  v: 1;
  /** Sól PBKDF2 (base64url). */
  salt: string;
  iter: number;
  data: string;
}

export const invoiceExportName = (now: Date = new Date()): string => `faktury-${now.toISOString().slice(0, 10)}.notki-faktury.json`;

export type ExportProblem = "weak-password";

/** Szyfruje podany zrzut hasłem; `iterations` poniżej progu tylko w testach. */
export async function encryptInvoices(dump: InvoicesDump, password: string, iterations: number = KDF_ITERATIONS): Promise<EncryptedInvoicesFile> {
  if (!passwordStrength(password).ok && iterations >= KDF_ITERATIONS) throw new Error("weak-password");
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKek(password, salt, iterations);
  return { format: INVOICE_EXPORT_FORMAT, v: 1, salt: toB64u(salt), iter: iterations, data: await encryptString(key, JSON.stringify(dump), AAD) };
}

/** Odszyfrowuje plik; zły format → `bad-format`, złe hasło lub zmieniony plik → `decrypt-failed`. */
export async function decryptInvoices(file: unknown, password: string, minIterations: number = KDF_ITERATIONS): Promise<InvoicesDump> {
  const f = file as Partial<EncryptedInvoicesFile> | null;
  if (!f || typeof f !== "object" || f.format !== INVOICE_EXPORT_FORMAT || f.v !== 1 || typeof f.salt !== "string" || typeof f.data !== "string") throw new VaultError("bad-format");
  if (typeof f.iter !== "number" || !Number.isInteger(f.iter) || f.iter < minIterations || f.iter > MAX_KDF_ITERATIONS) throw new VaultError("weak-params");
  let salt: Uint8Array;
  try { salt = fromB64u(f.salt); } catch { throw new VaultError("bad-format"); }
  if (salt.length !== SALT_BYTES) throw new VaultError("bad-format");
  const key = await deriveKek(password, salt, f.iter);
  const text = await decryptString(key, f.data, AAD);
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new VaultError("bad-format"); }
  const list = (raw as Partial<InvoicesDump> | null)?.invoices;
  if (!Array.isArray(list)) throw new VaultError("bad-format");
  return { invoices: list.flatMap((r) => { const c = cleanRecord(r); return c ? [c] : []; }) };
}

/** Wszystkie faktury z tego telefonu jako zaszyfrowany plik JSON (Blob). */
export async function exportInvoicesEncrypted(password: string): Promise<Blob> {
  const file = await encryptInvoices(invoicesDump(), password);
  return new Blob([JSON.stringify(file)], { type: "application/json" });
}

/** Wczytuje zaszyfrowany plik i dokłada faktury, których tu nie ma (istniejące nie są nadpisywane). Zwraca liczbę nowych. */
export async function importInvoicesEncrypted(text: string, password: string): Promise<number> {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new VaultError("bad-format"); }
  const dump = await decryptInvoices(parsed, password);
  const have = new Set(invoicesDump().invoices.map((r) => r.id));
  const fresh = dump.invoices.filter((r) => !have.has(r.id)).length;
  mergeInvoicesDump(dump);
  return fresh;
}

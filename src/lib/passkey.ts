import { fromB64u, toB64u } from "@/lib/vault";

/**
 * Passkey z rozszerzeniem PRF (V-4). Tylko przeglądarka: WebAuthn. Wynik PRF to 32 bajty, które owijają
 * klucz danych skarbca (`wrapDataKeyForPasskey`). Bez PRF w przeglądarce funkcje zgłaszają `prf-unsupported`.
 */

export type PasskeyErrorCode = "unsupported" | "prf-unsupported" | "cancelled" | "failed";

export class PasskeyError extends Error {
  constructor(readonly code: PasskeyErrorCode) {
    super(code);
  }
}

/** Czy przeglądarka ma API passkeys w ogóle (sama obecność nie gwarantuje PRF — to sprawdza rejestracja). */
export function passkeyApiAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.PublicKeyCredential === "function" && typeof navigator.credentials?.create === "function";
}

/** Czy platforma ma authenticator z weryfikacją użytkownika (odcisk, twarz). */
export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!passkeyApiAvailable()) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** Ewaluacja PRF dla istniejącego passkeya (jeden podpis biometryczny). Zwraca wynik `first`. */
async function evaluatePrf(ids: string[], salt: Uint8Array): Promise<{ id: string; prf: Uint8Array }> {
  const options = {
    publicKey: {
      challenge: rnd(32),
      allowCredentials: ids.map((id) => ({ type: "public-key" as const, id: fromB64u(id) })),
      userVerification: "required" as const,
      timeout: 60000,
      extensions: { prf: { eval: { first: salt } } },
    },
  } as unknown as CredentialRequestOptions;
  const cred = (await navigator.credentials.get(options).catch(() => null)) as PublicKeyCredential | null;
  if (!cred) throw new PasskeyError("cancelled");
  const res = (cred.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } }).prf?.results?.first;
  if (!res) throw new PasskeyError("prf-unsupported");
  return { id: toB64u(new Uint8Array(cred.rawId)), prf: new Uint8Array(res) };
}

/** Tworzy nowy passkey z PRF i od razu liczy wynik PRF dla `salt`. */
export async function registerPasskey(userName: string, salt: Uint8Array): Promise<{ id: string; prf: Uint8Array }> {
  if (!passkeyApiAvailable()) throw new PasskeyError("unsupported");
  const options = {
    publicKey: {
      rp: { name: "NOTKI" },
      user: { id: rnd(16), name: userName, displayName: userName },
      challenge: rnd(32),
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: { residentKey: "required", userVerification: "required" },
      timeout: 60000,
      extensions: { prf: {} },
    },
  } as unknown as CredentialCreationOptions;
  const cred = (await navigator.credentials.create(options).catch(() => null)) as PublicKeyCredential | null;
  if (!cred) throw new PasskeyError("cancelled");
  const ext = cred.getClientExtensionResults() as { prf?: { enabled?: boolean } };
  if (!ext.prf?.enabled) throw new PasskeyError("prf-unsupported");
  return evaluatePrf([toB64u(new Uint8Array(cred.rawId))], salt);
}

/** Odblokowanie: podpis jednym z zapisanych passkeyów, wynik PRF dla wspólnej soli. */
export async function assertPasskey(ids: string[], salt: Uint8Array): Promise<{ id: string; prf: Uint8Array }> {
  if (!passkeyApiAvailable()) throw new PasskeyError("unsupported");
  return evaluatePrf(ids, salt);
}

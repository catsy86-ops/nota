import { createPersistedStore } from "@/lib/persistedStore";
import { FINGERPRINT_MIN_HEX, normalizeFingerprintInput } from "./documentFingerprint";

/**
 * B4.4 Zapis odcisków wystawionych dokumentów — na tym urządzeniu, nie w dokumencie Pracy. Kod w stopce PDF
 * sam niczego nie dowodzi (ktoś mógłby przerobić PDF i wpisać inny kod), dopiero porównanie z zapisem
 * wystawcy mówi, czy PDF, który ktoś pokazuje, jest tym wystawionym. Wpisy nie synchronizują się.
 */
export const FINGERPRINTS_KEY = "kaczy.study.fingerprints.v1";
export const FINGERPRINTS_MAX = 300;

export interface StoredFingerprint {
  /** Pełny SHA-256 (hex, małe litery). */
  hash: string;
  /** Nazwa budowy w chwili wystawienia. */
  site: string;
  /** Rodzaj dokumentu, np. „protokół odbioru”. */
  kind: string;
  /** Moment wystawienia (ms). */
  at: number;
}

export function cleanFingerprints(raw: unknown): StoredFingerprint[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredFingerprint[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    if (typeof o.hash !== "string" || !/^[0-9a-f]{64}$/.test(o.hash)) continue;
    if (typeof o.at !== "number" || !Number.isFinite(o.at) || o.at <= 0) continue;
    out.push({
      hash: o.hash,
      site: typeof o.site === "string" ? o.site.slice(0, 80) : "",
      kind: typeof o.kind === "string" ? o.kind.slice(0, 40) : "",
      at: o.at,
    });
  }
  return out.slice(-FINGERPRINTS_MAX);
}

export const fingerprintStore = createPersistedStore<StoredFingerprint[]>(FINGERPRINTS_KEY, [], {
  merge: (_def, stored) => cleanFingerprints(stored),
});

export const useFingerprints = () => fingerprintStore.use();

/** Dopisuje odcisk (najnowsze na końcu, ostatnie `FINGERPRINTS_MAX`); ten sam skrót nie dubluje wpisu. */
export function registerFingerprint(entry: StoredFingerprint): void {
  const cur = fingerprintStore.get();
  if (cur.some((f) => f.hash === entry.hash)) return;
  fingerprintStore.set(cleanFingerprints([...cur, entry]));
}

export type FingerprintLookup =
  | { state: "empty" }
  | { state: "short" }
  | { state: "found"; entry: StoredFingerprint }
  | { state: "missing" };

/** Wpis z kodu wpisanego przez użytkownika (min. 12 znaków hex, początek skrótu). */
export function lookupFingerprint(input: string, list: readonly StoredFingerprint[]): FingerprintLookup {
  if (input.trim() === "") return { state: "empty" };
  const hex = normalizeFingerprintInput(input);
  if (hex.length < FINGERPRINT_MIN_HEX) return { state: "short" };
  const entry = list.find((f) => f.hash.toUpperCase().startsWith(hex));
  return entry ? { state: "found", entry } : { state: "missing" };
}

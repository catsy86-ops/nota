import type { VaultMeta } from "@/lib/vault";

/**
 * Lokalny odcisk skarbca (przegląd V-3, W-1): zapamiętany na tym urządzeniu przy zakładaniu, odblokowaniu
 * i zmianie hasła. Metadane w dokumencie Yjs są niezaufane — insider z kodem synchronizacji może je podmienić.
 * Pin wykrywa taką zmianę, zanim urządzenie jej zaufa.
 */
export interface VaultPin {
  epoch: number;
  salt: string;
  wrapped: string;
  check: string;
}

export type PinVerdict =
  /** Brak pinu (pierwsze użycie na tym urządzeniu) — zaufanie do dokumentu, jak dotąd. */
  | "none"
  /** Zgodne z pinem. */
  | "same"
  /** Ten sam klucz, inny numer epoki — nie da się tego wytłumaczyć rotacją hasła: odrzucamy. */
  | "epoch-only"
  /** Zmienione opakowanie klucza: zwykła zmiana hasła na innym urządzeniu albo podmiana. Przyjmujemy tylko po poprawnym haśle. */
  | "changed";

const KEY = "kaczy.vault.pin.v1";

export function readVaultPin(): VaultPin | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<VaultPin> | null;
    if (!r || typeof r.epoch !== "number" || typeof r.salt !== "string" || typeof r.wrapped !== "string" || typeof r.check !== "string") return null;
    return { epoch: r.epoch, salt: r.salt, wrapped: r.wrapped, check: r.check };
  } catch {
    return null;
  }
}

export function writeVaultPin(m: VaultMeta): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ epoch: m.epoch, salt: m.salt, wrapped: m.wrapped, check: m.check }));
  } catch {
    // Bez zapisu pin nie działa na tym urządzeniu — wykrywanie zmian jest wtedy słabsze, nie fałszywe.
  }
}

export function comparePin(pin: VaultPin | null, m: VaultMeta): PinVerdict {
  if (!pin) return "none";
  const sameKey = pin.salt === m.salt && pin.wrapped === m.wrapped && pin.check === m.check;
  if (sameKey) return pin.epoch === m.epoch ? "same" : "epoch-only";
  return "changed";
}

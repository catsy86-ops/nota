import { logDiag } from "@/lib/diagnostics";

/**
 * D6.1 (`docs/plan-migracje-yjs-2026-11-15.md`): rejestr kluczy `localStorage`. Każdy klucz ma walidator, wartość
 * domyślną i dwie flagi: `backup` (wchodzi do pełnej kopii JSON — D6.5, lista sekcji kopii czyta ją stąd) i
 * `sensitive` (nigdy do kopii ani do raportu diagnostycznego). Odczyt i zapis przez `readKey`/`writeKey`: brak
 * dostępu do pamięci albo zły kształt dają wartość domyślną i wpis w diagnostyce, nie wyjątek przy starcie.
 *
 * Moduły przechodzą na rejestr działami (D6.2). Do tego czasu klucze kopii są tu zarejestrowane jako `rawKey` —
 * wartość to surowy tekst, a kształt nadal sprawdza moduł, który go czyta.
 */
export interface KeyDef<T> {
  key: string;
  /** Tekst z pamięci → wartość albo `null`, gdy kształt jest zły. */
  parse(raw: string): T | null;
  serialize(value: T): string;
  fallback: T;
  backup: boolean;
  sensitive: boolean;
}

type Flags = { backup?: boolean; sensitive?: boolean };

const registry = new Map<string, KeyDef<unknown>>();

export function defineKey<T>(def: { key: string; parse(raw: string): T | null; serialize(value: T): string; fallback: T } & Flags): KeyDef<T> {
  if (registry.has(def.key)) throw new Error(`klucz ${def.key} już jest w rejestrze`);
  if (def.backup && def.sensitive) throw new Error(`klucz ${def.key}: wrażliwy nie może wchodzić do kopii`);
  const full: KeyDef<T> = { ...def, backup: def.backup ?? false, sensitive: def.sensitive ?? false };
  registry.set(def.key, full as KeyDef<unknown>);
  return full;
}

/** Wartość JSON sprawdzana przez `check` (zwraca wartość po czyszczeniu albo `null`). */
export function jsonKey<T>(key: string, check: (value: unknown) => T | null, fallback: T, flags: Flags = {}): KeyDef<T> {
  return defineKey({ key, parse: (raw) => { try { return check(JSON.parse(raw)); } catch { return null; } }, serialize: (v) => JSON.stringify(v), fallback, ...flags });
}

/** Surowy tekst bez sprawdzania kształtu — tylko na czas przejścia (D6.2) albo dla wartości, które są dowolnym tekstem. */
export function rawKey(key: string, flags: Flags = {}): KeyDef<string | null> {
  return defineKey<string | null>({ key, parse: (raw) => raw, serialize: (v) => v ?? "", fallback: null, ...flags });
}

function storage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}

export function readKey<T>(def: KeyDef<T>): T {
  const s = storage();
  if (!s) return def.fallback;
  let raw: string | null;
  try { raw = s.getItem(def.key); } catch { return def.fallback; }
  if (raw === null) return def.fallback;
  const value = def.parse(raw);
  if (value === null) {
    logDiag("warn", "storage", `zły kształt ${def.key} — użyto wartości domyślnej`);
    return def.fallback;
  }
  return value;
}

/** `false`, gdy zapis się nie udał (brak miejsca, tryb prywatny) — wpis w diagnostyce. */
export function writeKey<T>(def: KeyDef<T>, value: T): boolean {
  const s = storage();
  if (!s) return false;
  try {
    s.setItem(def.key, def.serialize(value));
    return true;
  } catch (err) {
    logDiag("error", "storage", `nie zapisano ${def.key}`, err);
    return false;
  }
}

export function removeKey(def: KeyDef<unknown>): void {
  try { storage()?.removeItem(def.key); } catch { /* bez dostępu */ }
}

export const registeredKeys = (): readonly KeyDef<unknown>[] => [...registry.values()];
export const backupKeyNames = (): string[] => registeredKeys().filter((d) => d.backup).map((d) => d.key);
export const isSensitiveKey = (key: string): boolean => registry.get(key)?.sensitive ?? false;

// ── Klucze pełnej kopii (D6.5). Kolejność = kolejność w kopii. ─────────────────────────────────────────────────

export * from "./names";
import { APPEARANCE_KEYS } from "./names";

const BACKUP_KEYS = [
  "kaczy.viewPrefs.v1", "kaczy.motion.v1", "kaczy.confirmPrefs.v1",
  "kaczy.effectsSettings.v1", "kaczy.seasonTheme.v1", "kaczy.templates.v1", "kaczy.siteMode.v1",
  ...APPEARANCE_KEYS,
  // Dzień przeglądu, odznaka, auto-blokada skarbca — zwykłe preferencje, bez sekretów.
  "kaczy:review.day", "kaczy:badge.enabled", "kaczy.vault.autolock.v1",
  // Skarbiec 1.6 i 2.4: blokada po schowaniu karty i daty sprawdzenia kodu awaryjnego (bez kodu) — na tym urządzeniu.
  "kaczy.vault.hiddenLock.v1", "kaczy.vault.recoveryCheck.v1",
  // Dane firmy wykonawcy (Praca, W14/D10 audytu): nazwa na PDF-ach, kilometrówka dla księgowej, cennik usług i cennik
  // kształtek, imię autora wpisów. Bez wpływu na sekrety; czyszczone przy odczycie przez swoje magazyny. Numer konta
  // (`kaczy.study.bankAccount.v1`) i odciski dokumentów (`…fingerprints.v1`) zostają poza kopią — to dane tego urządzenia.
  "kaczy.study.companyName.v1", "kaczy.study.seller.v1", "kaczy.study.mileage.v1", "kaczy.study.pricing.v1", "kaczy.study.quoteTerms.v1", "kaczy.study.prices.v1", "kaczy.study.author.v1",
  // R4.4: wzorce budów (etapy i pomieszczenia bez stanów) — ustawienie tego urządzenia.
  "kaczy.study.sitePatterns.v1",
  // Flagi funkcji w przygotowaniu (src/lib/featureFlags.ts) — zwykłe przełączniki.
  "kaczy.features.v1",
  // Auto-aktualizacja aplikacji (lib/autoUpdate.ts) — zwykła preferencja.
  "kaczy.autoUpdate.v1",
  // Push: wpis jest, ale przy przywracaniu push wyłączamy (`src/lib/backup/merge.ts`) — subskrypcja jest na urządzeniu.
  "kaczy.push.v1",
];
for (const key of new Set(BACKUP_KEYS)) rawKey(key, { backup: true });

// Wrażliwe: nigdy do kopii ani raportu (sekrety synchronizacji, push, skarbiec, dane urządzenia).
for (const key of ["kaczy.sync.v1", "kaczy.push.token.v1", "kaczy.vault.pin.v1", "kaczy.vault.attempts.v1", "kaczy.relay.v1", "kaczy.study.bankAccount.v1", "kaczy.study.fingerprints.v1", "kaczy.debts.payment.v1"]) rawKey(key, { sensitive: true });

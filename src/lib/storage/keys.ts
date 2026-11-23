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

/**
 * Nazwy kluczy Wyglądu (D6.2: moduły biorą nazwę stąd, nie z literału). Kolejność = kolejność w kopii i w kodzie
 * wyglądu (`appearanceCode.ts`, plan motywów 3.5).
 */
export const APPEARANCE = {
  skin: "kaczy.skin.v1",
  theme: "kaczy-theme",
  skinScheme: "kaczy.skinScheme.v1",
  accent: "kaczy.accent.v1",
  shape: "kaczy.shape.v1",
  backdrop: "kaczy.backdrop.v1",
  font: "kaczy.font.v1",
  textSize: "kaczy.textSize.v1",
  skinSchedule: "kaczy.skinSchedule.v1",
  // Ramki i poświata: siła ramek, kolor krawędzi i tło kart, siła i barwa poświaty.
  frames: "kaczy.frames.v1",
  frameLook: "kaczy.frames.look.v1",
  glow: "kaczy.glow.v1",
  // Plan motywów 2026-10-30 (1.5): tryb budowa, ruch i pora roku też są wyglądem.
  siteMode: "kaczy.siteMode.v1",
  motion: "kaczy.motion.v1",
  seasonTheme: "kaczy.seasonTheme.v1",
  // Czarne tło w ciemnym (3.3), podkreślenia działów (3.4), gęstość (4.2), własny motyw (4.1).
  oled: "kaczy.oled.v1",
  sectionColors: "kaczy.sectionColors.v1",
  uiDensity: "kaczy.uiDensity.v1",
  customTheme: "kaczy.customTheme.v1",
} as const;

/** Nazwy kluczy Pracy (D6.2): magazyn wpisów, firma, cennik, KSeF, przypomnienia raportów, widok tablicy. */
export const PRACA = {
  entryPick: "kaczy.study.entryPick.v1",
  levelOffset: "kaczy.level.offset.v1",
  siteArrivalAsked: "kaczy.study.siteArrivalAsked.v1",
  boardColumn: "kaczy.study.boardColumn.v1",
  seller: "kaczy.study.seller.v1",
  ksefSeries: "kaczy.ksef.series.v1",
  ksefDeviceId: "kaczy.ksef.deviceId.v1",
  catalog: "kaczy.study.catalog.v1",
  companyName: "kaczy.study.companyName.v1",
  bankAccount: "kaczy.study.bankAccount.v1",
  quoteTerms: "kaczy.study.quoteTerms.v1",
  mileage: "kaczy.study.mileage.v1",
  author: "kaczy.study.author.v1",
  fingerprints: "kaczy.study.fingerprints.v1",
  store: "kaczy.study.v1",
  journalDraft: "kaczy.study.draft.v1",
  pricing: "kaczy.study.pricing.v1",
  prices: "kaczy.study.prices.v1",
  reportNudged: "kaczy.study.reportNudged.v1",
  weekReportNudged: "kaczy.study.weekReportNudged.v1",
  reportNudges: "kaczy.study.reportNudges.v1",
  siteArrival: "kaczy.study.siteArrival.v1",
  tab: "kaczy.study.tab.v1",
  usage: "kaczy.study.usage.v1",
} as const;

/** Miejsca na zapisane zestawy wyglądu (poza kopią — dane tego urządzenia). */
export const appearanceSlotKey = (n: number): string => `kaczy.appearance.slot.${n}.v1`;

export const APPEARANCE_KEYS = Object.values(APPEARANCE);

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
  // Flagi funkcji w przygotowaniu (src/lib/featureFlags.ts) — zwykłe przełączniki.
  "kaczy.features.v1",
  // Push: wpis jest, ale przy przywracaniu push wyłączamy (`exportNotes.ts`) — subskrypcja jest na urządzeniu.
  "kaczy.push.v1",
];
for (const key of new Set(BACKUP_KEYS)) rawKey(key, { backup: true });

// Wrażliwe: nigdy do kopii ani raportu (sekrety synchronizacji, push, skarbiec, dane urządzenia).
for (const key of ["kaczy.sync.v1", "kaczy.push.token.v1", "kaczy.vault.pin.v1", "kaczy.vault.attempts.v1", "kaczy.relay.v1", "kaczy.study.bankAccount.v1", "kaczy.study.fingerprints.v1"]) rawKey(key, { sensitive: true });

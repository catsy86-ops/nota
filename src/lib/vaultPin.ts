import { MAX_KDF_ITERATIONS, type VaultMeta } from "@/lib/vault";
import { SKARBIEC } from "@/lib/storage/names";

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
  /** Lista passkeyów i kod awaryjny (przegląd V-4, M-1), w postaci kanonicznej — patrz `extraOf`. */
  extra: string;
  /**
   * K1 (pin v2): iteracje KDF. Bez nich do KDF szła wartość z dokumentu — podmiana `iter` dawała fałszywe „złe hasło”
   * i dławienie (P4). Pin sprzed K1 nie ma pola: zgodny przy pierwszym odczycie, uzupełniany po udanym odblokowaniu.
   */
  iter?: number;
}

export type PinVerdict =
  /** Brak pinu (pierwsze użycie na tym urządzeniu) — zaufanie do dokumentu, jak dotąd. */
  | "none"
  /** Zgodne z pinem. */
  | "same"
  /** Ten sam klucz, inny numer epoki — nie da się tego wytłumaczyć rotacją hasła: odrzucamy. */
  | "epoch-only"
  /** K1: ten sam klucz, inne `iter` niż w pinie — KDF liczony z `iter` z pinu (`withPinnedIter`), bez dławienia. */
  | "iter-only"
  /**
   * Zmienione opakowanie klucza, passkeye albo kod awaryjny: zwykła zmiana hasła na innym urządzeniu, dopisany
   * passkey albo podmiana. Przyjmujemy tylko po dowodzie znajomości hasła (lub kodu awaryjnego), nie biometrią.
   */
  | "changed";

const KEY = SKARBIEC.pin;

/** Pola spoza klucza, które też są pod pinem: passkeye i kod awaryjny. */
function extraOf(m: VaultMeta): string {
  // Klucze obiektów sortowane: ten sam stan z synchronizacji może mieć inną kolejność pól.
  const sorted = (_: string, v: unknown) => (v && typeof v === "object" && !Array.isArray(v)
    ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : v);
  return JSON.stringify({ passkeys: m.passkeys ?? null, recovery: m.recovery ?? null }, sorted);
}

export function readVaultPin(): VaultPin | null {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<VaultPin> | null;
    if (!r || typeof r.epoch !== "number" || typeof r.salt !== "string" || typeof r.wrapped !== "string" || typeof r.check !== "string") return null;
    // Pin sprzed tego pola nie ma `extra` — dostaje wartość, której nigdy nie da się porównać: następne
    // odblokowanie hasłem ustawia pin od nowa, a biometria czeka na hasło.
    return { epoch: r.epoch, salt: r.salt, wrapped: r.wrapped, check: r.check, extra: typeof r.extra === "string" ? r.extra : "", ...(validIter(r.iter) ? { iter: r.iter } : {}) };
  } catch {
    return null;
  }
}

/**
 * `iterVerified` — `iter` potwierdzone KDF z hasłem (odblokowanie hasłem, nowy skarbiec, zmiana hasła). Biometria i kod
 * awaryjny nie używają `iter`, więc wtedy zostaje to, co pin już miał (pin sprzed K1 — dalej bez `iter`).
 */
export function writeVaultPin(m: VaultMeta, { iterVerified = true }: { iterVerified?: boolean } = {}): void {
  try {
    // Stare `iter` tylko przy tym samym kluczu — nowy klucz bez potwierdzonego `iter` czeka na odblokowanie hasłem.
    const old = readVaultPin();
    const sameKey = !!old && old.salt === m.salt && old.wrapped === m.wrapped && old.check === m.check;
    const iter = iterVerified ? m.iter : sameKey ? old.iter : undefined;
    localStorage.setItem(KEY, JSON.stringify({ epoch: m.epoch, salt: m.salt, wrapped: m.wrapped, check: m.check, extra: extraOf(m), ...(iter !== undefined ? { iter } : {}) }));
  } catch {
    // Bez zapisu pin nie działa na tym urządzeniu — wykrywanie zmian jest wtedy słabsze, nie fałszywe.
  }
}

export function comparePin(pin: VaultPin | null, m: VaultMeta): PinVerdict {
  if (!pin) return "none";
  const sameKey = pin.salt === m.salt && pin.wrapped === m.wrapped && pin.check === m.check;
  if (sameKey && pin.epoch !== m.epoch) return "epoch-only";
  if (sameKey && pin.iter !== undefined && pin.iter !== m.iter) return "iter-only";
  if (sameKey && pin.extra === extraOf(m)) return "same";
  return "changed";
}

const validIter = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0 && v <= MAX_KDF_ITERATIONS;

/**
 * K1: metadane do KDF. Przy werdykcie `iter-only` (klucz ten sam co w pinie, `iter` podmienione w dokumencie) —
 * `iter` z pinu; `rejected` mówi wołającemu, żeby zapisał zdarzenie bezpieczeństwa. Inaczej metadane bez zmian.
 */
export function withPinnedIter(m: VaultMeta, pin: VaultPin | null = readVaultPin()): { meta: VaultMeta; rejected: boolean } {
  // Przy kluczu zgodnym z pinem `iter` zawsze z pinu — także gdy zmieniono razem z nim epokę albo passkeye; inaczej
  // jedna dodatkowa zmiana pola omijała poprawkę i nabijała licznik prób.
  const sameKey = !!pin && pin.salt === m.salt && pin.wrapped === m.wrapped && pin.check === m.check;
  if (!sameKey || pin.iter === undefined || pin.iter === m.iter) return { meta: m, rejected: false };
  return { meta: { ...m, iter: pin.iter }, rejected: true };
}

// ── Poprzednie nagłówki (K1 → odzysk w K4, plan Skarbca krypto §3.5.2) ─────────────────────────────────────

/** Nagłówek skarbca sprzed werdyktu `changed`: do odzysku notatek drugiego skarbca hasłem albo kodem awaryjnym. */
export interface PrevHeader {
  epoch: number;
  salt: string;
  wrapped: string;
  check: string;
  /** `extra` z pinu — tam jest opakowanie kodem awaryjnym. */
  extra: string;
  /** Brak (pin sprzed K1) — KDF ze stałej `KDF_ITERATIONS`, nigdy z dokumentu. */
  iter?: number;
  /** Chwila zapisu nagłówka (ms). */
  at: number;
}

const PREV_KEY = SKARBIEC.pinPrev;
/** Twardy limit przed odblokowaniem — wtedy nie wiadomo jeszcze, który nagłówek jest potrzebny. */
export const PREV_HARD_LIMIT = 4;
/** Po udanym odblokowaniu bez notatek w `failed`. */
export const PREV_KEEP = 2;
export const PREV_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Górna granica wieku niezależnie od `failed` — jedna podrzucona, nieczytelna notatka nie trzyma nagłówków bez końca. */
export const PREV_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

const headerKey = (h: { epoch: number; salt: string; wrapped: string; check: string }) => [h.epoch, h.salt, h.wrapped, h.check].join("|");
const isStr = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;

export function readPrevHeaders(): PrevHeader[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PREV_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((r): PrevHeader[] => {
      if (!r || typeof r !== "object") return [];
      const h = r as Record<string, unknown>;
      if (!Number.isSafeInteger(h.epoch) || !isStr(h.salt, 64) || !isStr(h.wrapped, 256) || !isStr(h.check, 256)) return [];
      if (typeof h.extra !== "string" || h.extra.length > 4096 || !Number.isSafeInteger(h.at)) return [];
      return [{ epoch: h.epoch as number, salt: h.salt, wrapped: h.wrapped, check: h.check, extra: h.extra, at: h.at as number, ...(validIter(h.iter) ? { iter: h.iter } : {}) }];
    }).slice(0, PREV_HARD_LIMIT);
  } catch {
    return [];
  }
}

function writePrevHeaders(list: readonly PrevHeader[]): void {
  try {
    if (list.length) localStorage.setItem(PREV_KEY, JSON.stringify(list));
    else localStorage.removeItem(PREV_KEY);
  } catch { /* bez zapisu odzysk drugiego skarbca nie zadziała na tym urządzeniu */ }
}

/**
 * Przed nadpisaniem pinu przy werdykcie `changed`: obecny pin trafia do poprzednich nagłówków — tylko gdy zmienił się
 * klucz (sól, opakowanie, `check`; sam dopisany passkey nie wypiera potrzebnego nagłówka), bez duplikatów. Zapis jest
 * przed odblokowaniem, więc nic nie jest wypierane: przy pełnym limicie nowy nagłówek odpada (`false`).
 */
export function rememberPrevHeader(pin: VaultPin | null, m: VaultMeta, now = Date.now()): boolean {
  if (!pin || (pin.salt === m.salt && pin.wrapped === m.wrapped && pin.check === m.check)) return true;
  const list = readPrevHeaders();
  if (list.some((h) => headerKey(h) === headerKey(pin))) return true;
  if (list.length >= PREV_HARD_LIMIT) return false;
  writePrevHeaders([...list, { epoch: pin.epoch, salt: pin.salt, wrapped: pin.wrapped, check: pin.check, extra: pin.extra, at: now, ...(pin.iter !== undefined ? { iter: pin.iter } : {}) }]);
  return true;
}

/**
 * Po udanym odblokowaniu: zawsze bez nagłówków starszych niż 180 dni; gdy żadna notatka nie czeka w `failed` — też bez
 * starszych niż 30 dni i najwyżej 2 najnowsze.
 */
export function trimPrevHeaders(failedEmpty: boolean, now = Date.now()): void {
  const list = readPrevHeaders();
  const young = list.filter((h) => now - h.at <= PREV_MAX_AGE_MS);
  const kept = failedEmpty ? young.filter((h) => now - h.at <= PREV_TTL_MS).sort((a, b) => b.at - a.at).slice(0, PREV_KEEP) : young;
  if (kept.length !== list.length) writePrevHeaders(kept);
}

import { useCallback, useSyncExternalStore } from "react";
import { cleanSchemaClaim, SCHEMA_VERSION } from "@/lib/formatSchema";
import { logSecurity } from "@/lib/diagnostics";
import { DANE } from "@/lib/storage/names";
import { readDevices } from "@/lib/deviceRegistry";

/**
 * Wymaganie wersji zapisane w dokumencie (D1.3, `docs/plan-migracje-yjs-2026-11-15.md`). Mapa `docFormat`: klucz =
 * cecha danych (np. `vault-files`), wartość = najniższa wersja formatu (`SCHEMA_VERSION`), która tę cechę rozumie.
 * Cecha dopisuje się przy pierwszym użyciu i nigdy nie znika; zapis tylko w górę, więc dwa urządzenia dopisujące
 * równolegle tę samą cechę dają ten sam wynik.
 *
 * Wymaganie liczy się na cechę. Aplikacja starsza niż wymaganie: mapy objęte cechą tylko do odczytu (`docWritable`)
 * i baner „zaktualizuj aplikację”; cecha nieznana z nazwy daje sam baner. Wspólnego punktu zapisu nie ma, więc blokadę
 * dostaje każdy magazyn osobno, razem z cechą, która jej wymaga — pierwsze wydanie tylko zapisuje, czyta i pokazuje baner.
 *
 * Wartości z dokumentu są niezaufane: znający kod synchronizacji mógłby wpisać wysokie wymaganie i zablokować zapis
 * wszystkim. Stąd czyszczenie (`cleanSchemaClaim`), wpis bezpieczeństwa przy wymaganiu ponad najwyższą wersję z rejestru
 * urządzeń (D4.1, `claimCeiling`; pusty rejestr — ponad `SCHEMA_VERSION + 1`) i ręczne „Ignoruj i pisz” (`ignoreDocFormat`).
 *
 * D1.4 — granica: wersje wydane przed 2026-11-18 tej mapy nie znają. Zmiany niszczące dla starszych klientów dopiero
 * po D4 (rejestr urządzeń).
 */

export const DOC_FORMAT_MAP = "docFormat";
const FEATURE_RE = /^[a-z][a-z0-9-]{0,31}$/;
const MAX_FEATURES = 50;
const IGNORE_KEY = DANE.docformatIgnore;

/** Cechy znane z nazwy: które mapy obejmuje blokada zapisu. Pusta do pierwszej cechy (planowo `vault-files`). */
export const KNOWN_FEATURES: Readonly<Record<string, readonly string[]>> = {};

interface MapLike {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  forEach(fn: (value: unknown, key: string) => void): void;
  observe(fn: () => void): void;
  unobserve(fn: () => void): void;
}
interface DocLike {
  getMap(name: string): unknown;
  transact(fn: () => void, origin?: unknown): void;
}
const formatMap = (doc: DocLike) => doc.getMap(DOC_FORMAT_MAP) as MapLike;

/** Wymagania z dokumentu po czyszczeniu: najwyżej 50 cech o poprawnych nazwach i wartościach. */
export function readDocFormat(doc: DocLike): Map<string, number> {
  const out = new Map<string, number>();
  formatMap(doc).forEach((value, key) => {
    if (out.size >= MAX_FEATURES || !FEATURE_RE.test(key)) return;
    const v = cleanSchemaClaim(value);
    if (v !== undefined) out.set(key, v);
  });
  return out;
}

/** Dopisuje wymaganie cechy (tylko w górę). `false` — nazwa albo wartość niepoprawna. */
export function requireFeature(doc: DocLike, feature: string, minSchema: number): boolean {
  const v = cleanSchemaClaim(minSchema);
  if (!FEATURE_RE.test(feature) || v === undefined) return false;
  const map = formatMap(doc);
  doc.transact(() => {
    const cur = cleanSchemaClaim(map.get(feature));
    if (cur === undefined || v > cur) map.set(feature, v);
  });
  return true;
}

function ignored(): boolean {
  try { return localStorage.getItem(IGNORE_KEY) === "1"; } catch { return false; }
}

/** „Ignoruj i pisz” (Ustawienia → Diagnostyka): ręczne obejście blokady przy podejrzanym wymaganiu. */
export function ignoreDocFormat(on: boolean): void {
  try {
    if (on) localStorage.setItem(IGNORE_KEY, "1");
    else localStorage.removeItem(IGNORE_KEY);
  } catch { /* prywatne okno — obejście działa do końca sesji */ }
  memIgnore = on;
  emit();
}
let memIgnore = false;

/** Czy ta wersja aplikacji może zapisywać mapy objęte cechą. */
export function docWritable(doc: DocLike, feature: string, current: number = SCHEMA_VERSION): boolean {
  if (memIgnore || ignored()) return true;
  const required = readDocFormat(doc).get(feature);
  return required === undefined || required <= current;
}

export interface DocFormatStatus {
  /** Cechy wymagające nowszej wersji niż ta aplikacja. */
  tooNew: { feature: string; required: number; known: boolean }[];
  /** Ręczne obejście włączone. */
  ignored: boolean;
}

const reported = new Set<string>();

/**
 * Najwyższe wymaganie, które nie jest podejrzane: najnowsza wersja formatu wśród urządzeń w rejestrze (i ta aplikacja).
 * Bez rejestru (jedno urządzenie, grupa sprzed D4.1) — o jedną wersję więcej niż ta aplikacja, jak przed D4.1.
 * Rejestr też jest w dokumencie, więc to tylko próg wpisu bezpieczeństwa, nie zabezpieczenie.
 */
export function claimCeiling(doc: DocLike, current: number = SCHEMA_VERSION): number {
  const schemas = readDevices(doc as Parameters<typeof readDevices>[0]).map((d) => d.schema).filter((s): s is number => s !== undefined);
  return schemas.length ? Math.max(current, ...schemas) : current + 1;
}

/** Stan dla banera; przy wymaganiu podejrzanie wysokim — jeden wpis bezpieczeństwa na cechę i wartość. */
export function docFormatStatus(doc: DocLike, current: number = SCHEMA_VERSION): DocFormatStatus {
  const tooNew: DocFormatStatus["tooNew"] = [];
  let ceiling: number | undefined;
  for (const [feature, required] of readDocFormat(doc)) {
    if (required <= current) continue;
    tooNew.push({ feature, required, known: feature in KNOWN_FEATURES });
    const tag = `${feature}:${required}`;
    ceiling ??= claimCeiling(doc, current);
    if (required > ceiling && !reported.has(tag)) {
      reported.add(tag);
      logSecurity("doc-format-claim", `${feature} wymaga wersji ${required}, ta aplikacja ma ${current}`);
    }
  }
  return { tooNew, ignored: memIgnore || ignored() };
}

// ── subskrypcja dla interfejsu ───────────────────────────────────────────────

const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

/** Stan banera dla dokumentu; odświeża się przy zmianie mapy `docFormat` (też z innego urządzenia). */
export function useDocFormatStatus(doc: DocLike): DocFormatStatus {
  const subscribe = useCallback((cb: () => void) => {
    const map = formatMap(doc);
    listeners.add(cb);
    map.observe(cb);
    return () => { listeners.delete(cb); map.unobserve(cb); };
  }, [doc]);
  // Migawka jako napis: `useSyncExternalStore` wymaga stabilnej wartości między renderami.
  const snap = useSyncExternalStore(subscribe, () => JSON.stringify(docFormatStatus(doc)));
  return JSON.parse(snap) as DocFormatStatus;
}

/** Test-only. */
export function resetDocFormatForTests(): void {
  reported.clear();
  memIgnore = false;
  try { localStorage.removeItem(IGNORE_KEY); } catch { /* */ }
}

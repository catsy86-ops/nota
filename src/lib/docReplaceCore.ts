import { MIGRATION_LOCK, withExclusiveLock } from "@/lib/tabLock";
import { logDiag } from "@/lib/diagnostics";
import { DANE } from "@/lib/storage/names";

/**
 * Wymiana całego dokumentu — ścieżka awaryjna (Z-16.1B, `docs/plan-dane-lokalne.md` §1.6). Część wykonywana przy
 * starcie, **zanim** powstanie `IndexeddbPersistence`: dokumentu w pamięci nie da się cofnąć, więc zamiar zapisany przed
 * przeładowaniem jest wykonywany na bazie, a dopiero potem baza wczytuje się do dokumentu.
 *
 * Moduł bez zależności od `yjsStore` (import w drugą stronę) — plik kopii czyta leniwym importem.
 */

export const REPLACE_INTENT_KEY = DANE.restorePending;
export const REPLACE_RESULT_KEY = DANE.restoreResult;
/** Pokolenie dokumentu: inne po każdej wymianie — karty z innym pokoleniem nie wymieniają stanu (`tabSync`). */
export const DOC_GENERATION_KEY = DANE.docGeneration;

export type ReplaceIntent =
  | { kind: "snapshot"; file: string; createdAt: number; startedAt: number; leftGroup: boolean }
  /** „Zastąp dane na tym urządzeniu danymi grupy”: pusty dokument, potem dołączenie kodem. */
  | { kind: "empty"; join: string; v3?: boolean; startedAt: number };

export type ReplaceResult =
  | { ok: true; at: number; intent: ReplaceIntent }
  | { ok: false; at: number; intent: ReplaceIntent; reason: string };

function readJson<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") as T | null; } catch { return null; }
}

export function readReplaceIntent(): ReplaceIntent | null {
  const v = readJson<ReplaceIntent>(REPLACE_INTENT_KEY);
  if (!v || typeof v.startedAt !== "number") return null;
  if (v.kind === "snapshot" && typeof v.file === "string") return v;
  if (v.kind === "empty" && typeof v.join === "string") return v;
  return null;
}

/** Zapis zamiaru i nowego pokolenia; `false`, gdy `localStorage` nie przyjął (wtedy nie wolno przeładować). */
export function writeReplaceIntent(intent: ReplaceIntent): boolean {
  try {
    localStorage.setItem(REPLACE_INTENT_KEY, JSON.stringify(intent));
    localStorage.setItem(DOC_GENERATION_KEY, crypto.randomUUID());
    return readReplaceIntent() !== null;
  } catch {
    return false;
  }
}

/** Wynik po kształcie — zepsuta wartość (inna wersja aplikacji, uszkodzenie) nie może wywrócić widoku. */
export function readReplaceResult(): ReplaceResult | null {
  const v = readJson<ReplaceResult>(REPLACE_RESULT_KEY);
  if (!v || typeof v !== "object" || typeof v.ok !== "boolean" || typeof v.at !== "number" || !v.intent) return null;
  const i = v.intent as Partial<ReplaceIntent>;
  if (i.kind === "snapshot" && typeof i.createdAt !== "number") return null;
  if (i.kind !== "snapshot" && i.kind !== "empty") return null;
  if (!v.ok && typeof v.reason !== "string") return null;
  return v;
}

export function clearReplaceResult(): void {
  try { localStorage.removeItem(REPLACE_RESULT_KEY); } catch { /* ignore */ }
}

/** Pokolenie dokumentu tej karty — czytane raz, przy starcie. */
let generationAtStart: string | null = null;
export function docGeneration(): string {
  if (generationAtStart === null) {
    try { generationAtStart = localStorage.getItem(DOC_GENERATION_KEY) ?? "0"; } catch { generationAtStart = "0"; }
  }
  return generationAtStart;
}

/** Świadome wyczyszczenie danych (czas) — baner „dane zniknęły” go nie zgłasza. */
export const DATA_CLEARED_KEY = DANE.dataCleared;

/** Zamiar starszy niż to nie jest wykonywany: wymiana ma nastąpić zaraz po potwierdzeniu, nie po dniach pracy. */
const INTENT_MAX_AGE_MS = 60 * 60 * 1000;
/** Czekanie na blokadę migracji przy starcie — dłużej start nie może stać. */
const LOCK_TIMEOUT_MS = 10_000;

/**
 * Najpierw zdjęcie zamiaru (`removeItem` nie zawodzi przy braku miejsca), potem wynik. Odwrotna kolejność przy pełnym
 * `localStorage` zostawiłaby zamiar i wymianę powtarzaną przy każdym starcie. Kod grupy nie trafia do wyniku porażki.
 */
function finish(result: ReplaceResult) {
  try { localStorage.removeItem(REPLACE_INTENT_KEY); } catch { /* ignore */ }
  const stored: ReplaceResult = !result.ok && result.intent.kind === "empty" ? { ...result, intent: { ...result.intent, join: "" } } : result;
  try {
    if (result.ok && result.intent.kind === "empty") localStorage.setItem(DATA_CLEARED_KEY, String(result.at));
    localStorage.setItem(REPLACE_RESULT_KEY, JSON.stringify(stored));
  } catch { /* bez wyniku — brak komunikatu, ale zamiar już zdjęty */ }
}

function withLockTimeout(fn: () => Promise<void>): Promise<void> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request || typeof AbortSignal?.timeout !== "function") return withExclusiveLock(MIGRATION_LOCK, fn);
  return locks.request(MIGRATION_LOCK, { mode: "exclusive", signal: AbortSignal.timeout(LOCK_TIMEOUT_MS) }, fn) as Promise<void>;
}

/**
 * Wykonanie zamiaru pod `MIGRATION_LOCK` (druga karta czeka i zastaje zamiar już zdjęty). Kolejność:
 * 1. odczyt i sprawdzenie pliku kopii (nagłówek, skrót);
 * 2. wyczyszczenie kolejek przekaźnika (karta prowadząca przekaźnik mogła je odtworzyć przed przeładowaniem);
 * 3. wymiana bazy jedną transakcją (`replace`);
 * 4. zdjęcie zamiaru i wynik.
 * **Każda porażka** (uszkodzona kopia, zajęta blokada, błąd bazy, wygasły zamiar) kończy się wynikiem „nie” i zdjętym
 * zamiarem: baza zostaje taka, jaka jest, a użytkownik widzi komunikat — bez cichego ponawiania, które przy późniejszym
 * starcie zastąpiłoby pracę z międzyczasu. Zamiar zostaje tylko po awarii procesu w trakcie (wtedy następny start
 * powtarza wymianę od razu, zanim ktokolwiek coś zmieni).
 */
export async function performDocReplace(dbName: string, replace: (dbName: string, updateV2: Uint8Array | null) => Promise<void>): Promise<void> {
  const failed = (intent: ReplaceIntent, err: unknown, reason: string) => {
    logDiag("error", "docReplace", reason, err);
    finish({ ok: false, at: Date.now(), intent, reason: err instanceof Error && err.message ? err.message : reason });
  };
  const first = readReplaceIntent();
  try {
    await withLockTimeout(async () => {
      const intent = readReplaceIntent();
      if (!intent) return;
      if (Date.now() - intent.startedAt > INTENT_MAX_AGE_MS) return failed(intent, null, "Zamiar wymiany danych wygasł");
      let body: Uint8Array | null = null;
      try {
        if (intent.kind === "snapshot") {
          const { readSnapshotFile } = await import("@/lib/dailySnapshot");
          body = (await readSnapshotFile(intent.file)).body;
        }
        const { clearRelayState } = await import("@/lib/sync/relayRuntime");
        await clearRelayState().catch((err) => logDiag("warn", "docReplace", "kolejki przekaźnika", err));
        await replace(dbName, body);
      } catch (err) {
        return failed(intent, err, "Nie udało się wymienić danych");
      }
      finish({ ok: true, at: Date.now(), intent });
    });
  } catch (err) {
    // Blokada nie przyszła w czasie (inna karta zajęta) — start idzie dalej na obecnej bazie.
    const intent = readReplaceIntent() ?? first;
    if (intent) failed(intent, err, "Inna karta aplikacji jest zajęta — spróbuj jeszcze raz");
  }
}

/**
 * Hak startowy dla `createYjsStore`: bez zamiaru — `null` od razu (start bez zmian, trwałość tworzona synchronicznie);
 * z zamiarem — obietnica, po której wolno otworzyć bazę. Nie rzuca i kończy się w ograniczonym czasie.
 */
export function startupReplace(dbName: string, replace: (dbName: string, updateV2: Uint8Array | null) => Promise<void>): Promise<void> | null {
  if (typeof localStorage === "undefined" || !readReplaceIntent()) return null;
  return performDocReplace(dbName, replace).catch((err) => logDiag("error", "docReplace", "wymiana dokumentu", err));
}

const REPLACE_CHANNEL = "kaczy-doc-replace";

/** Sygnał do pozostałych kart: dokument zostanie wymieniony — przeładujcie się. */
export function announceDocReplace(): void {
  try {
    const ch = new BroadcastChannel(REPLACE_CHANNEL);
    ch.postMessage("reload");
    ch.close();
  } catch { /* bez BroadcastChannel zostaje zdarzenie `storage` */ }
}

/**
 * Karta z nieaktualnym pokoleniem dokumentu przeładowuje się: po sygnale, po zdarzeniu `storage` i po powrocie do
 * widoczności (zamrożona karta nie dostaje sygnałów). Bez tego jej `tabSync` albo zapis dosłałby stan sprzed wymiany.
 */
export function watchDocGeneration(reload: () => void = () => window.location.reload()): () => void {
  const start = docGeneration();
  let done = false;
  const check = () => {
    if (done) return;
    let now: string;
    try { now = localStorage.getItem(DOC_GENERATION_KEY) ?? "0"; } catch { return; }
    if (now !== start) { done = true; reload(); }
  };
  const onStorage = (e: StorageEvent) => { if (e.key === DOC_GENERATION_KEY) check(); };
  const onVisible = () => { if (document.visibilityState === "visible") check(); };
  window.addEventListener("storage", onStorage);
  document.addEventListener("visibilitychange", onVisible);
  let ch: BroadcastChannel | null = null;
  try {
    ch = new BroadcastChannel(REPLACE_CHANNEL);
    // Sygnał przychodzi przed zmianą pokolenia w tej samej chwili — chwilę czekamy, aż zapis do localStorage dojdzie.
    ch.onmessage = () => { setTimeout(check, 50); };
  } catch { /* bez BroadcastChannel */ }
  return () => {
    window.removeEventListener("storage", onStorage);
    document.removeEventListener("visibilitychange", onVisible);
    ch?.close();
  };
}

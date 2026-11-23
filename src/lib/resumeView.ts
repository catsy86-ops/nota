/**
 * Q3.4 (decyzja QL-3): wznowienie zainstalowanej aplikacji. Po co najmniej 4 h przerwy start na „Dziś”, wcześniej
 * ostatni dział (także przy zimnym starcie z ikony, który zawsze otwiera `start_url` = „/”). Czyste decyzje —
 * zapis i nawigację robi `useResumeView`.
 */

export const RESUME_TODAY_AFTER_MS = 4 * 60 * 60 * 1000;
export const TODAY_PATH = "/dzis";
const KEY = "kaczy.lastSeen.v1";
/** Adres nie dłuższy niż to — zabezpieczenie przed śmieciem w `localStorage`. */
const MAX_PATH = 300;

export interface LastSeen {
  /** Kiedy aplikacja przestała być widoczna (ms). */
  at: number;
  /** Ścieżka z zapytaniem, np. „/praca?budowa=x”. */
  path: string;
}

/** Ścieżka nadaje się do przywrócenia: wewnętrzna, nie udostępnianie i nie jednorazowe wejście z parametrem akcji. */
function restorable(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && path.length <= MAX_PATH
    && !path.startsWith("/share") && !/[?&](new|szukaj|skrzynka|inbox|akcja)=/.test(path);
}

export function readLastSeen(storage: Pick<Storage, "getItem"> = localStorage): LastSeen | null {
  try {
    const v = JSON.parse(storage.getItem(KEY) ?? "null") as Partial<LastSeen> | null;
    if (!v || typeof v.at !== "number" || !Number.isFinite(v.at) || typeof v.path !== "string") return null;
    return { at: v.at, path: v.path };
  } catch {
    return null;
  }
}

export function writeLastSeen(seen: LastSeen, storage: Pick<Storage, "setItem"> = localStorage): void {
  try { storage.setItem(KEY, JSON.stringify(seen)); } catch { /* tryb prywatny — bez wznowienia */ }
}

/**
 * Zimny start: tylko wejście z ikony (dokładnie „/” bez zapytania — skróty i udostępnianie mają parametry).
 * Zwraca, dokąd przejść, albo `null` (zostajemy).
 */
export function launchTarget(current: { pathname: string; search: string }, last: LastSeen | null, now: number): string | null {
  if (current.pathname !== "/" || current.search !== "" || !last) return null;
  if (now - last.at >= RESUME_TODAY_AFTER_MS) return TODAY_PATH;
  return last.path !== "/" && restorable(last.path) ? last.path : null;
}

/** Powrót do schowanej aplikacji: po 4 h na „Dziś”, chyba że już tam jest. */
export function resumeTarget(hiddenAt: number | null, now: number, currentPath: string): string | null {
  if (hiddenAt === null || now - hiddenAt < RESUME_TODAY_AFTER_MS) return null;
  return currentPath === TODAY_PATH ? null : TODAY_PATH;
}

export { restorable as isRestorablePath };

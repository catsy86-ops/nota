import { logDiag } from "@/lib/diagnostics";
import { SKARBIEC } from "@/lib/storage/names";

/** Licznik nieudanych prób hasła skarbca (localStorage `SKARBIEC.attempts`) i opóźnienie po nich. A3.3: wydzielone z `privateNotes.ts`. */

const THROTTLE_KEY = SKARBIEC.attempts;
const FREE_ATTEMPTS = 2;
const MAX_DELAY_MS = 5 * 60_000;

/** Opóźnienie po `fails` nieudanych próbach z rzędu: 0, 0, 2 s, 4 s, 8 s … max 5 min. */
export function throttleDelayMs(fails: number): number {
  if (fails <= FREE_ATTEMPTS) return 0;
  return Math.min(MAX_DELAY_MS, 2000 * 2 ** (fails - FREE_ATTEMPTS - 1));
}

export function readThrottle(): { fails: number; until: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(THROTTLE_KEY) || "null");
    if (raw && typeof raw.fails === "number" && typeof raw.until === "number") return raw;
  } catch (err) {
    // Uszkodzony licznik prób zeruje ochronę przed zgadywaniem hasła — musi zostawić ślad.
    logDiag("warn", "vault", "uszkodzony licznik prób", err);
  }
  return { fails: 0, until: 0 };
}

export function writeThrottle(v: { fails: number; until: number } | null) {
  try {
    if (v && v.fails > 0) localStorage.setItem(THROTTLE_KEY, JSON.stringify(v));
    else localStorage.removeItem(THROTTLE_KEY);
  } catch { /* brak miejsca — limit działa tylko w pamięci karty */ }
}

import type { JournalEntry } from "./yStudy";
import { entrySiteId } from "./siteKey";

/**
 * P2.3 Usterki ze statusem (decyzja P-7: rozbudowany problem). Usterka to problem bez `resolved`,
 * z odpowiedzialnym, terminem i zdjęciami przed (`images`) i po naprawie (`after`).
 * Czysta logika — zapis w `yStudy.setFault`, widok w `SiteFaultsPanel`.
 */

export type FaultStatus = "open" | "overdue" | "no-date";

/** Otwarte usterki jednej budowy, od najstarszej. */
export function openFaults(journal: readonly JournalEntry[], siteId: string): JournalEntry[] {
  return journal
    .filter((e) => e.kind === "problem" && e.resolved === undefined && entrySiteId(e) === siteId)
    .sort((a, b) => a.at - b.at);
}

/** Status terminu względem dnia `today` (`YYYY-MM-DD`). Brak terminu nie jest przeterminowany. */
export function faultStatus(e: Pick<JournalEntry, "due">, today: string): FaultStatus {
  if (!e.due) return "no-date";
  return e.due < today ? "overdue" : "open";
}

/** Ile dni zostało do terminu (ujemne = po terminie); `null` bez terminu. */
export function daysToDue(due: string | undefined, today: string): number | null {
  if (!due) return null;
  const [y, m, d] = due.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
}

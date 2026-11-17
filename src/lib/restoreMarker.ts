/**
 * Znacznik przywracania kopii w toku (Z-18.1 audytu 2): ustawiany przed fazą zapisu, zdejmowany po ostatnim kroku.
 * Został po starcie aplikacji = przywracanie przerwane (zamknięta karta, wywrócona przeglądarka) — część danych
 * pochodzi z kopii, część sprzed niej. Osobny, mały moduł: baner przy starcie nie ładuje kodu kopii.
 */
export const RESTORE_MARKER_KEY = "kaczy.restore.running.v1";

export interface RestoreMarker {
  startedAt: number;
  /** Data kopii (`exportedAt`) — baner mówi, którą kopię wczytać ponownie. */
  exportedAt: number;
}

export function readRestoreMarker(): RestoreMarker | null {
  try {
    const v = JSON.parse(localStorage.getItem(RESTORE_MARKER_KEY) ?? "null") as Partial<RestoreMarker> | null;
    return v && typeof v.startedAt === "number" && typeof v.exportedAt === "number" ? { startedAt: v.startedAt, exportedAt: v.exportedAt } : null;
  } catch {
    return null;
  }
}

export function setRestoreMarker(marker: RestoreMarker): void {
  try { localStorage.setItem(RESTORE_MARKER_KEY, JSON.stringify(marker)); } catch { /* bez localStorage — bez znacznika */ }
}

export function clearRestoreMarker(): void {
  try { localStorage.removeItem(RESTORE_MARKER_KEY); } catch { /* bez localStorage nie było też znacznika */ }
}

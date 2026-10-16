import { useSyncExternalStore } from "react";

/**
 * Prośba „otwórz raport dnia” z zewnątrz działu Praca: przypomnienie po zmianie (dymek albo
 * powiadomienie systemowe z adresem `/praca?raport=dzis`). Dziennik zużywa prośbę przy montażu
 * albo od razu, jeśli jest już otwarty — wtedy otwiera okno raportu na dzisiejszych wpisach.
 */

/** Parametr adresu z powiadomienia systemowego (`/praca?raport=dzis`). */
export const JOURNAL_REPORT_PARAM = "raport";

let pending = false;
const listeners = new Set<() => void>();

export function requestJournalReport(): void {
  pending = true;
  listeners.forEach((l) => l());
}

/** Zwraca `true` i czyści prośbę, jeśli była. */
export function consumeJournalReportRequest(): boolean {
  if (!pending) return false;
  pending = false;
  listeners.forEach((l) => l());
  return true;
}

export const useJournalReportRequest = () => useSyncExternalStore(
  (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
  () => pending,
);

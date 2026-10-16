import { useSyncExternalStore } from "react";

/**
 * Prośba „otwórz raport” z zewnątrz działu Praca: przypomnienie po zmianie (dymek albo
 * powiadomienie systemowe z adresem `/praca?raport=…`). Dziennik zużywa prośbę przy montażu
 * albo od razu, jeśli jest już otwarty — wtedy otwiera okno raportu z zadanym zakresem.
 */

/** Parametr adresu z powiadomienia systemowego (`/praca?raport=dzis`). */
export const JOURNAL_REPORT_PARAM = "raport";

export interface JournalReportRequest {
  /** Wszystkie budowy (kilka budów tego dnia / tygodnia); `false` = ostatnia budowa. */
  allSites: boolean;
  /** Dzień ostatniego wpisu albo ostatnie 7 dni. */
  range: "day" | "week";
}

/** Wartość parametru adresu ↔ prośba: `dzis`, `dzis-wszystkie`, `tydzien`, `tydzien-wszystkie`. */
export const reportParam = (r: JournalReportRequest) => `${r.range === "week" ? "tydzien" : "dzis"}${r.allSites ? "-wszystkie" : ""}`;
export const parseReportParam = (v: string): JournalReportRequest => ({
  range: v.startsWith("tydzien") ? "week" : "day",
  allSites: v.endsWith("-wszystkie"),
});

let pending: JournalReportRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function requestJournalReport(req: Partial<JournalReportRequest> = {}): void {
  pending = { allSites: req.allSites ?? false, range: req.range ?? "day" };
  emit();
}

/** Zwraca prośbę i ją czyści; `null` = nie było prośby. */
export function consumeJournalReportRequest(): JournalReportRequest | null {
  const req = pending;
  if (!req) return null;
  pending = null;
  emit();
  return req;
}

export const useJournalReportRequest = () => useSyncExternalStore(
  (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
  () => pending !== null,
);

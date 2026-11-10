/**
 * Zapamiętana zakładka działu Praca (na tym urządzeniu — telefon i komputer
 * służą do czego innego). Bez zapisu: telefon zaczyna od „Budowy” (bieżąca budowa i trzy duże
 * przyciski, plan B2.1), komputer od Quizu.
 *
 * Pasek zakładek ma cztery pozycje: Budowa, Dziennik, Plany i Nauka. „Nauka” grupuje Quiz, Tablicę
 * i Listę kontrolną (podzakładki); zapamiętana jest zawsze zakładka najniższego poziomu.
 */
export const STUDY_TABS = ["site", "quiz", "board", "list", "journal", "plans"] as const;
export type StudyTab = (typeof STUDY_TABS)[number];

/** Zakładki zgrupowane pod „Nauką”. */
export const LEARN_TABS: readonly string[] = ["quiz", "board", "list"];
/** Pozycja głównego paska dla zakładki: Quiz, Tablica i Lista to „learn”. */
export const studyTabGroup = (tab: string): string => (LEARN_TABS.includes(tab) ? "learn" : tab);
export const STUDY_TAB_KEY = "kaczy.study.tab.v1";

/**
 * Zakładka z adresu: `/praca?zakladka=plany`. Plany są zakładką Pracy (2026-11-05), więc `go("plans")`, paleta,
 * skrót `g r` i stary adres `/plany` prowadzą tutaj. Praca zdejmuje parametr po otwarciu zakładki.
 */
export const STUDY_TAB_PARAM = "zakladka";
export const PLANS_TAB_VALUE = "plany";

export function readStudyTab(phone: boolean): StudyTab {
  try {
    const v = localStorage.getItem(STUDY_TAB_KEY);
    if (v && (STUDY_TABS as readonly string[]).includes(v)) return v as StudyTab;
  } catch {
    /* prywatne okno — domyślna */
  }
  return phone ? "site" : "quiz";
}

export function writeStudyTab(tab: string): void {
  if (!(STUDY_TABS as readonly string[]).includes(tab)) return;
  try {
    localStorage.setItem(STUDY_TAB_KEY, tab);
  } catch {
    /* bez zapisu — następnym razem domyślna */
  }
}

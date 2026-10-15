/**
 * Zapamiętana zakładka działu Praca (na tym urządzeniu — telefon i komputer
 * służą do czego innego). Bez zapisu: telefon zaczyna od Dziennika (wpis z budowy),
 * komputer od Quizu.
 */
export const STUDY_TABS = ["quiz", "board", "list", "journal"] as const;
export type StudyTab = (typeof STUDY_TABS)[number];
export const STUDY_TAB_KEY = "kaczy.study.tab.v1";

export function readStudyTab(phone: boolean): StudyTab {
  try {
    const v = localStorage.getItem(STUDY_TAB_KEY);
    if (v && (STUDY_TABS as readonly string[]).includes(v)) return v as StudyTab;
  } catch {
    /* prywatne okno — domyślna */
  }
  return phone ? "journal" : "quiz";
}

export function writeStudyTab(tab: string): void {
  if (!(STUDY_TABS as readonly string[]).includes(tab)) return;
  try {
    localStorage.setItem(STUDY_TAB_KEY, tab);
  } catch {
    /* bez zapisu — następnym razem domyślna */
  }
}

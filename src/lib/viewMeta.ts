import type { View } from "@/hooks/useFilteredNotes";

/**
 * Jedna tabela nazw widoków (Powłoka 1.3, decyzja PW-1: „Grafik”, „Terminy”). Pasek boczny, paleta, skróty „g”
 * i kopia biorą nazwę stąd, żeby nie rozjeżdżała się między miejscami.
 */
export const VIEW_LABEL: Partial<Record<View, string>> = {
  notes: "Notatki",
  inbox: "Skrzynka",
  today: "Dziś",
  week: "Ten tydzień",
  reminders: "Terminy",
  calendar: "Kalendarz",
  shifts: "Grafik",
  study: "Praca",
  debts: "Długi",
  cwiczenia: "Ćwiczenia",
  plans: "Plany",
  archive: "Archiwum",
  trash: "Kosz",
};

export function viewLabel(view: View): string {
  return VIEW_LABEL[view] ?? view;
}

/**
 * Działy-aplikacje: własny widok zamiast listy notatek — bez wyszukiwarki notatek, kontrolek widoku,
 * pustego stanu listy i gestów zaznaczania. Jedno miejsce zamiast łańcuchów `view !== …` w kilku plikach.
 */
export const APP_VIEWS: ReadonlySet<View> = new Set<View>(["calendar", "shifts", "study", "debts", "cwiczenia", "plans"]);

export const isAppView = (view: View): boolean => APP_VIEWS.has(view);

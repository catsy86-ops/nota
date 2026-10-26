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
  archive: "Archiwum",
  trash: "Kosz",
};

export function viewLabel(view: View): string {
  return VIEW_LABEL[view] ?? view;
}

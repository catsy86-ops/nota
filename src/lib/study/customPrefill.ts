/**
 * Zamiana rozwiązanego problemu budowy w szkic własnego pytania (Etap 4 § 4.2).
 * Problem wysyła zdarzenie; jedyny egzemplarz dialogu „Moje pytania” (w `StudyView`) je odbiera.
 * Trzy błędne odpowiedzi zostają puste — nie ma ich w danych problemu.
 */
export const CUSTOM_PREFILL_EVENT = "kaczy:study-custom-prefill";

export interface CustomPrefill {
  topic: string | null;
  question: string;
  correct: string;
}

export function requestCustomPrefill(prefill: CustomPrefill): void {
  window.dispatchEvent(new CustomEvent<CustomPrefill>(CUSTOM_PREFILL_EVENT, { detail: prefill }));
}

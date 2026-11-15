export const CONSENT_KEY = "kaczy.dictation.consent";

/** Czy użytkownik zgodził się na dyktowanie (usługa przeglądarki). */
export function hasDictationConsent(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === "1"; } catch { return false; }
}

/** Cofa zgodę: następne dyktowanie znowu zapyta. Nie rusza uprawnienia mikrofonu w przeglądarce. */
export function withdrawDictationConsent(): void {
  try { localStorage.removeItem(CONSENT_KEY); } catch { /* bez localStorage nie ma czego cofać */ }
}

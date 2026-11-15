/**
 * Czytanie tekstu na głos (`speechSynthesis`) — do podsumowania dnia, gdy ręce są brudne. Wszystko opcjonalne:
 * brak API albo błąd silnika to ciche „nie da się”, nigdy wyjątek.
 */

export const speechAvailable = (): boolean =>
  typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** Czyta `text` po polsku; wcześniejsze czytanie jest przerywane. `onEnd` wołane raz, także po błędzie. Zwraca `false`, gdy się nie da. */
export function speak(text: string, onEnd?: () => void): boolean {
  if (!speechAvailable() || !text.trim()) return false;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pl-PL";
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      onEnd?.();
    };
    u.onend = end;
    u.onerror = end;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking(): void {
  if (!speechAvailable()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // nic do zatrzymania
  }
}

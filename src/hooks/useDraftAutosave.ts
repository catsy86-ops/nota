import { useEffect, useRef } from "react";

interface DraftAutosaveOptions {
  /** Czy sesja edycji jest otwarta. Gdy `false`, hook nic nie robi. */
  active: boolean;
  /**
   * Odcisk bieżącej treści szkicu. Każda zmiana tej wartości restartuje
   * odliczanie, więc zapis następuje po przerwie w pisaniu, a nie w trakcie.
   */
  draftKey: string;
  /** Odstęp z Ustawień (`prefs.autosaveSeconds`); 0 = bez zapisu cyklicznego. */
  intervalSeconds: number;
  /** Zatwierdzenie szkicu. Musi być idempotentne i nie zamykać edytora. */
  onSave: () => void;
}

/**
 * Dwie niezależne siatki bezpieczeństwa dla edytowanej notatki:
 *
 * 1. Zapis po przerwie w pisaniu — tylko gdy użytkownik włączył autosave.
 * 2. Zapis przy odmontowaniu — **zawsze**, niezależnie od ustawienia.
 *    To ta druga jest właściwą naprawą utraty danych: kafel notatki potrafi
 *    zniknąć w trakcie edycji (wypadnięcie z filtra wyszukiwania, zmiana
 *    widoku, przesortowanie), a wtedy nikt nie klika „Zapisz”.
 */
export function useDraftAutosave({ active, draftKey, intervalSeconds, onSave }: DraftAutosaveOptions) {
  // Zapis czytamy z refów, żeby cleanup przy odmontowaniu nie widział
  // zestarzałego domknięcia nad szkicem.
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!active || intervalSeconds <= 0) return;
    const timer = setTimeout(() => saveRef.current(), intervalSeconds * 1000);
    return () => clearTimeout(timer);
  }, [active, intervalSeconds, draftKey]);

  useEffect(() => {
    return () => {
      if (activeRef.current) saveRef.current();
    };
  }, []);
}

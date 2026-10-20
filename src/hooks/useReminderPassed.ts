import { useEffect, useState } from "react";

/** Najdłuższy pojedynczy `setTimeout` (ok. 24,8 dnia); dłuższe terminy dochodzą w kilku krokach. */
const MAX_TIMEOUT_MS = 2_147_483_647;

/**
 * Czy termin `at` już minął — i przełącza się w chwili, gdy minie, bez zmiany listy notatek.
 * Zwykłe `at < Date.now()` w renderze nie odświeża się, dopóki coś innego nie wywoła renderu.
 */
export function useReminderPassed(at: number): boolean {
  const [passed, setPassed] = useState(() => at <= Date.now());

  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const left = at - Date.now();
      if (left <= 0) {
        setPassed(true);
        return;
      }
      setPassed(false);
      id = setTimeout(check, Math.min(left, MAX_TIMEOUT_MS));
    };
    check();
    return () => clearTimeout(id);
  }, [at]);

  return passed;
}

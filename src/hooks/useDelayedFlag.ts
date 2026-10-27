import { useEffect, useState } from "react";

/**
 * Zwraca `true` dopiero, gdy `active` trwa dłużej niż `delayMs` (plan UI 3.3).
 * Szybka operacja nie pokazuje wskaźnika wcale, więc nie ma mignięcia.
 */
export function useDelayedFlag(active: boolean, delayMs = 300): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!active) {
      setOn(false);
      return;
    }
    const timer = window.setTimeout(() => setOn(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);
  return on;
}

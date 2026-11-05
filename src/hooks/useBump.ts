import { useState } from "react";

/**
 * Licznik zmian `value` do pulsu plakietki (`count-bump` w src/styles/motion.css).
 * Zwraca 0 przy pierwszym renderze i +1 przy każdej zmianie wartości. Użycie:
 * `key={bump}` (nowy element = animacja od nowa) i klasa `count-bump`, gdy `bump > 0`,
 * więc licznik nie pulsuje przy otwarciu widoku. Stan poprawiany w trakcie
 * renderu (wzorzec Reacta „poprzednia wartość”), bez dodatkowego efektu.
 */
export function useBump(value: unknown): number {
  const [prev, setPrev] = useState(value);
  const [bump, setBump] = useState(0);
  if (!Object.is(prev, value)) {
    setPrev(value);
    setBump(bump + 1);
  }
  return bump;
}

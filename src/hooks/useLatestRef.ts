import { useCallback, useRef } from "react";

/**
 * Ref z zawsze najnowszą wartością. Pozwala callbackom czytać aktualne dane
 * bez wpisywania ich w zależności `useCallback` — inaczej każda zmiana listy
 * notatek tworzyłaby nowy callback i przerysowywała wszystkie karty mimo `memo`.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/**
 * Zwraca poprzedni obiekt, dopóki `key` się nie zmienił — dla wartości
 * liczonych od nowa przy każdej zmianie notatek, choć ich treść zmienia się rzadko.
 */
export function useStableByKey<T>(value: T, key: string): T {
  const ref = useRef<{ key: string; value: T } | null>(null);
  if (!ref.current || ref.current.key !== key) ref.current = { key, value };
  return ref.current.value;
}

/**
 * Funkcja o stałej tożsamości, która zawsze woła najnowszą wersję `fn` (bez przestarzałych domknięć).
 * Dla handlerów podawanych komponentom z `memo` — inaczej funkcja inline przerysowuje je przy każdym renderze rodzica.
 */
export function useStableFn<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useLatestRef(fn);
  return useCallback((...args: A) => ref.current(...args), [ref]);
}

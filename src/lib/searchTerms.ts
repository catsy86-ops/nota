import { useSyncExternalStore } from "react";

/**
 * Frazy wyszukiwania widoczne w kaflach (wyróżnianie trafień). Ustawia je Index przy zmianie
 * zapytania; kafle czytają je przez hook. Magazyn zamiast propsa, bo `NoteCard` jest zapamiętany
 * i zmiana zapytania nie musiałaby przechodzić przez `NoteGrid` do każdego kafla.
 */
let terms: readonly string[] = [];
const listeners = new Set<() => void>();

export function setSearchTerms(next: readonly string[]): void {
  if (next.length === terms.length && next.every((t, i) => t === terms[i])) return;
  terms = next;
  listeners.forEach((l) => l());
}

export function useSearchTerms(): readonly string[] {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => terms,
  );
}

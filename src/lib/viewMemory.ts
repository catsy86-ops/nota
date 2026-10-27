// Pamięć stanu widoku między wejściami (plan UI 3.6): ostatnia zakładka, wybrana przez użytkownika.
// Tylko localStorage, w try/catch — bez niego widok otwiera się jak dotąd (wartość startowa).

const PREFIX = "kaczy.viewMemory.v1:";

/** Zapamiętana wartość, o ile należy do dozwolonej listy; w przeciwnym razie `fallback`. */
export function readViewMemory<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Zapisuje wybór; brak miejsca lub zablokowany storage nie przerywa działania. */
export function writeViewMemory(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    /* pamięć działa tylko w tej sesji */
  }
}

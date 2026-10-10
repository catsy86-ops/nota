/**
 * Prośba „pokaż graf powiązań” — z palety poleceń do okna Statystyk, które
 * dopiero się ładuje (leniwy moduł). Ważna chwilę, a nie „raz”: w StrictMode
 * inicjalizator stanu woła się dwukrotnie i pierwszy odczyt zjadłby prośbę.
 */
const TTL_MS = 3000;
let requestedAt = 0;

export function requestLinkGraph(): void {
  requestedAt = Date.now();
}

export function takeLinkGraphRequest(): boolean {
  return Date.now() - requestedAt < TTL_MS;
}

/**
 * Błąd startu synchronizacji po ludzku (nowy plan 5.6). `lastError` w `yjsSync.ts` to surowy
 * komunikat wyjątku („Failed to fetch dynamically imported module…”) — tu zamieniamy go na
 * zdanie: co się stało i co zrobić. Surowy tekst zostaje w „Szczegółach” i w diagnostyce.
 */
export function syncErrorText(raw: string): string {
  const s = raw.toLowerCase();
  if (/dynamically imported module|importing a module script|failed to fetch|networkerror|load failed|chunk/.test(s)) {
    return "Nie udało się pobrać modułu synchronizacji — brak internetu albo aplikacja się zaktualizowała. Połącz się z siecią i odśwież stronę.";
  }
  if (/rtcpeerconnection|webrtc/.test(s)) {
    return "Ta przeglądarka nie obsługuje połączeń między urządzeniami (WebRTC). Użyj aktualnego Chrome, Edge, Firefoksa albo Safari.";
  }
  if (/crypto|subtle|secure context|securityerror/.test(s)) {
    return "Synchronizacja wymaga bezpiecznego połączenia (https). Otwórz aplikację pod adresem z https.";
  }
  if (/quota|storage/.test(s)) {
    return "Brakuje miejsca w pamięci przeglądarki. Zwolnij miejsce (karta „Kopia i dane”) i spróbuj ponownie.";
  }
  return "Nie udało się uruchomić synchronizacji. Wyłącz ją i włącz ponownie; jeśli to nie pomoże, odśwież stronę.";
}

# Plan: dopracowanie i rozbudowa synchronizacji (2026-10-18)

## Stan obecny (z kodu)

- Synchronizacja P2P przez WebRTC (`y-webrtc`, `src/lib/yjsSync.ts`), dokument Yjs. Obrazy osobnym kanałem (`imageSync.ts`), załączniki przez `yjsFileSync.ts`.
- Serwery sygnalizacyjne: publiczne z pakietu `y-webrtc`; własny serwer w `signaling-server/` jest gotowy, ale **nie wpięty** jako domyślny.
- **Brak TURN** (nie znaleziono `turn:` w kodzie). Połączenie przez NAT operatora komórkowego albo symetryczny NAT może się nie udać. Stan „connecting” bez komunikatu.
- Synchronizacja działa tylko, gdy oba urządzenia są jednocześnie online i w aplikacji. Brak kolejki dla nieobecnego peera.
- Parowanie: kod 12 znaków, QR z `?pair=`, 8-znakowe kody krótkie nadal przyjmowane (audyt S6: nazwa pokoju z szybkiego haszu, bez soli).
- Status w UI: liczba peerów, `lastSyncedAt`, `lastError`. Brak informacji „dlaczego nie działa”.
- Testy: `yjsSync.test.ts`, `yjsFileSync.test.ts`, e2e `sync-code.spec.ts`, `file-sync.spec.ts`.

## Faza 0 — diagnostyka (S, najpierw)

1. Panel „Dlaczego nie synchronizuje?”: stan sygnalizacji (który serwer odpowiada), czy ICE się udało, czy działa TURN, czas od ostatniej udanej wymiany.
2. Przycisk „Sprawdź połączenie” — testowy pokój, wynik po kilku sekundach z konkretną przyczyną (brak sieci, serwer nieosiągalny, brak połączenia P2P przez NAT).
3. Zachowanie logów diagnostycznych (`logDiag`) w eksporcie diagnostyki.

Kryterium: użytkownik wie, co naprawić, bez pytania autora.

## Faza 1 — niezawodność połączenia (M)

1. **TURN** (np. coturn na tym samym hostingu co sygnalizacja). Lista `iceServers` z ustawień, z domyślnym STUN i opcjonalnym TURN. Bez TURN nie obiecujemy działania przez każdą sieć.
2. **Reconnect z backoffem** i ponowne dołączenie po powrocie z tła (`visibilitychange`, `online`). Obecnie status może utknąć w „connecting”.
3. **Pauza przy ukryciu karty** na telefonie, żeby nie trzymać połączeń w tle; wznowienie przy wejściu.
4. Test: symulacja utraty sieci w e2e (dwa konteksty przeglądarki, `context.setOffline`) i przywrócenie synchronizacji.

Decyzja wymagana: **hosting** sygnalizacji i TURN (koszt, dostawca, czy zaakceptować ruch TURN — dane są szyfrowane, ale przekaźnik widzi ilość ruchu).

## Faza 2 — synchronizacja asynchroniczna (L, osobna decyzja)

Obecny model nie synchronizuje, gdy urządzenia nie są online równocześnie. Opcje:

- **A. Przekaźnik przechowujący zaszyfrowane aktualizacje Yjs** (serwer widzi tylko szyfrogram; klucz z kodu parowania). Wymaga hostingu z bazą, limitów i retencji. Największy zysk, największy koszt.
- **B. Zostać przy P2P i poprawić UX**: przypomnienie „synchronizuj przy następnym otwarciu obu urządzeń”, eksport/import pliku sync jako pomost (już są kopie zapasowe). Mały koszt.

Rekomendacja: **B teraz**, A dopiero jeśli użytkownik potwierdzi potrzebę w praktyce.

## Faza 3 — bezpieczeństwo parowania (S, z audytu)

1. Usunięcie 8-znakowych kodów krótkich i nazwy legacy z datą graniczną (audyt S6). Migracja: pokazać komunikat „ten kod jest przestarzały — sparuj ponownie”.
2. Nazwa pokoju z solą (np. HMAC kodu z sekretem aplikacji) zamiast szybkiego haszu.
3. Test jednostkowy: stare kody odrzucane, nowe przechodzą.

## Faza 4 — UX parowania i stanu (S–M)

1. Jeden przepływ parowania: „Dodaj urządzenie” → QR albo kod → „Połączono z: [nazwa urządzenia]”.
2. Lista sparowanych urządzeń z ostatnią synchronizacją i przyciskiem „Odłącz”.
3. Stan konfliktów: Yjs scala sam, ale użytkownik powinien wiedzieć, że zmiana z drugiego urządzenia się pojawiła (krótki toast z tytułem notatki).
4. Opis w ustawieniach po polsku, bez żargonu („WebRTC”, „peer”, „sygnalizacja”).

## Faza 5 — testy (S, równolegle)

- e2e z dwoma kontekstami: pełne parowanie QR i kodem, edycja na jednym, odczyt na drugim.
- e2e reconnect po `setOffline`.
- Test jednostkowy: `iceServers` z ustawień trafia do providera.
- Ustalić, które testy są flaky (`waitForTimeout` w `file-sync`, jeśli są).

## Kolejność

0 → 1 → 3 → 4 → 5. Faza 2 tylko po decyzji o hostingu i asynchronii.

## Decyzje potrzebne od Ciebie

1. Czy masz miejsce na hostingu na sygnalizację i TURN (np. Fly.io, Render, VPS)? Bez tego zostają publiczne serwery.
2. Czy synchronizacja musi działać, gdy urządzenia nie są online jednocześnie? To decyduje o fazie 2 (A) i o kosztach.
3. Czy akceptujesz zmianę kodów parowania (krótkie kody przestaną działać, trzeba sparować ponownie)?

## Status (2026-10-18, po decyzjach)

Decyzje użytkownika: brak hostingu (bez TURN, publiczne serwery), bez synchronizacji asynchronicznej, krótkie kody usunięte.

- ✅ Faza 0: diagnoza w ustawieniach (serwery sygnalizacji, stan połączenia), jedno zdanie zamiast „nie działa”.
- ✅ Faza 1 (bez TURN): ponowne łączenie po powrocie do karty i po odzyskaniu sieci, z progiem 10 s.
- ✅ Faza 3: krótkie kody odrzucone; zapisany krótki kod usuwany z komunikatem.
- ⏸ Faza 2: pominięta (decyzja: bez asynchronii).
- ⏳ Faza 4 (UX parowania: lista urządzeń, „odłącz”, komunikat o zmianie z drugiego urządzenia): do zrobienia.
- ⏳ Faza 5 (testy dwóch kontekstów, reconnect po `setOffline`): częściowo — brak nowego e2e.

Blokada: wejściowy JS przekracza próg o 186 B. Wymagana decyzja o progu albo oszczędnościach.

## Status 2026-10-20

- ✅ Faza 4 (bez commita): lista „Urządzenia w grupie” z nazwami (awareness), nazwa tego urządzenia, toast „Połączono z: …”, „Dodaj urządzenie”, „Odłącz to urządzenie” z potwierdzeniem, bez słowa „sygnalizacja” w UI.
- ⏸ Punkt 3 (toast z tytułem notatki) — nie zrobiony, wymaga porównania dokumentu przed i po zmianie.
- ⚠ Bundle: faza 4 dodaje ok. 700 B gzip do eager; próg `bundle.spec.ts` przekroczony. Decyzja: podnieść próg albo odchudzić `yjsSync`.

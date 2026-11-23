# Dane, synchronizacja i kopie

Część opisu technicznego Notatnika (spis: [`opis.md`](../../opis.md)). Stan bieżący, nie historia — przy zmianie funkcji poprawiaj jej opis.

## Synchronizacja — stan aktualny (parowanie, kody, urządzenia, diagnoza)

Dział opisany w jednym miejscu. Synchronizacja działa przez WebRTC (y-webrtc) na dokumencie Yjs notatek; bez własnego serwera danych.

### Co robi

- **Dwa rodzaje kodu (S2.2, Z-15.1).** Nowa grupa dostaje **kod długi: 28 znaków** (26 losowych ≈ 128 bitów + 2 kontrolne), pokazywany w zawijanych grupach po 4. Przycisk „Kod do przepisania ręcznie” (z ostrzeżeniem) tworzy **kod krótki, 12 znaków** — taki mają też wszystkie starsze grupy. Przy kodzie długim pod QR jest zdanie „Oba urządzenia muszą mieć aktualną wersję aplikacji.”
- **Pole kodu.** Domyślnie 12 kratek w trzech grupach po 4. Wklejenie dłuższego kodu albo linku przełącza pole na zwykłe pole tekstowe na 28 znaków (28 kratek nie mieści się na telefonie); przełącznik „Mam kod 28-znakowy / 12-znakowy” pod polem robi to ręcznie. Pole przyjmuje tylko znaki alfabetu kodu (bez I, L, O, 0, 1). Literówka w kodzie długim daje „Sprawdź kod — jeden ze znaków się nie zgadza.” „Dołącz” jest aktywne tylko dla kodu, który rozpoznaje `parseCode`.
- **Link z kodu QR** (`#pair=…`, stare `?pair=` też) otwiera Ustawienia → Sync z wypełnionym polem. Grupa bez pokoju v2 (kod długi albo `v2Until === null`) dostaje w linku `&v=3` — dołączający nie otwiera wtedy okna v2.
- **Krótkie kody odrzucone.** Zapisany kod, którego nie rozpoznaje `parseCode` (np. 8-znakowy), jest usuwany przy starcie i pokazuje komunikat „Synchronizacja wyłączona: kod był za krótki” z przyciskiem „Wygeneruj nowy kod”.
- **Koniec pokoi v2 i najstarszego (S2.6, Z-15.2).** Pokój v2 (szybki SHA-256 kodu) jest dołączany tylko dla kodu krótkiego w oknie zgodności (30 dni od dołączenia kodem bez `v=3` albo od aktualizacji). Gdy okno mija, a w ostatnich 14 dniach w pokoju v2 było urządzenie ze starą wersją, okno przedłuża się o 30 dni, najwyżej do 90 dni od początku. Karta „Urządzenia w grupie” pokazuje takie urządzenia: „«Tablet» ma starą wersję aplikacji. Zaktualizuj ją do 14.02…”, po końcu okna — komunikat do zamknięcia. Zgodność z najstarszym pokojem (FNV) wyłącza się najpóźniej 90 dni od włączenia; pod przełącznikiem jest data. Przy kodzie długim przełącznika nie ma.
- **Propozycja nowego kodu.** Kod krótki, okno v2 minęło, a kod bywał w pokoju v2 albo FNV → karta „Zalecamy nowy kod synchronizacji.” w Ustawieniach i jednorazowy baner na Dziś („×” = „Nie teraz”, na stałe). Karta odsyła do sekcji „Zmiana kodu”.
- **Zmiana kodu (S2.1, Z-15.3).** Sekcja „Zmiana kodu” w Ustawieniach → Sync: „Zmień kod” → ekran potwierdzenia z ostrzeżeniami z §3.7 (ponowne parowanie, dane już pobrane zostają, urządzenia bez znanej wersji, brak przekaźnika) i listą urządzeń (połączone + widziane w 90 dniach) → cztery kroki z postępem („Nowy pokój”, „Informacja dla urządzeń”, „Przełączenie”, „Sparuj urządzenia”). Błąd kroku pokazuje komunikat i „Spróbuj ponownie”; po 3 nieudanych wysyłkach znacznika — „Pomiń — urządzenia offline nie dostaną informacji”; anulowanie tylko przed wysłaniem znacznika. Po przełączeniu nowy kod jest w „Dodaj urządzenie”, a lista urządzeń do odhaczenia (same się odhaczają po połączeniu nowym kodem); z przekaźnikiem wiersz „Stary pokój zostanie usunięty DD.MM” i „Usuń teraz”. Odhaczenie ostatniego urządzenia albo „Zamknij listę” kończy wymianę.
- **Kod zmieniony na innym urządzeniu (D2).** Gdy dokument zawiera znacznik „kod zmieniony” dla obecnego kodu, synchronizacja staje w stanie `rekeyed`: karta w Ustawieniach („Sparuj ponownie”, „Synchronizuj dalej na starym kodzie” z potwierdzeniem), baner na Dziś, czerwona kropka w nagłówku. Dane lokalne zostają.
- **Diagnoza** (jedno zdanie w Ustawieniach): brak połączenia z serwerami, połączono bez drugiego urządzenia, albo łączenie (ile serwerów odpowiada). Po powrocie do karty albo odzyskaniu sieci sync łączy się ponownie, nie częściej niż co 10 s.
- **Urządzenia w grupie.** Karta „Urządzenia w grupie”: lista innych urządzeń połączonych teraz (nazwy) i pole „Nazwa tego urządzenia” (domyślnie „Telefon” albo „Komputer” wg przeglądarki). Po połączeniu nowego urządzenia pojawia się toast „Połączono z: [nazwa]”.
- **Odłączenie.** „Odłącz to urządzenie” (z potwierdzeniem: pozostałe urządzenia zostają w grupie). Sekcja kodu nazywa się „Dodaj urządzenie” (QR i kod).
- **Toast po zmianie z innego urządzenia** podaje tytuł notatki: „Zaktualizowano: …”. Notatki prywatne i bez tytułu pokazują zwykły komunikat.

### Gdzie jest

- `src/components/ui/input-otp.tsx` — `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator` (shadcn Input OTP na paczce `input-otp` 1.5). Animacja karetki `caret-blink` w `tailwind.config.ts`.
- `src/components/SyncSettings.tsx` — formularz „Dołącz do istniejącej grupy” (`joinReady`, `LEGACY_CODE_LENGTH`), diagnoza, lista urządzeń, nazwa urządzenia, potwierdzenia „Odłącz”.
- `src/lib/yjsSync.ts` — `CODE_LENGTH`, `CODE_PATTERN`, `readPrefs` (odrzucenie krótkiego kodu, pole `shortCodeDropped`), `joinWithCode` (`null` dla złej długości), `wasShortCodeDropped`, `SyncState.signalingUp/signalingTotal`, `reconnectIfNeeded` i listener `visibilitychange` w `initSync`, `SyncDevice`, `SyncState.devices`, `getDeviceName` / `setDeviceName` / `defaultDeviceName` (klucz `kaczy.sync.deviceName`), `refreshDevices` (awareness pokoju v3), `changedNoteTitle()` (porównuje `updatedAt` z `remoteSeenUpdated`, wołane w `yjsStore.doc.on("update")`).
- `src/pages/Index.tsx` — `settingsOpen` startuje jako `true`, gdy adres ma `?pair=`; `NewCodeBanner` na Dziś.
- `src/lib/sync/pairCode.ts` — `generateCode(kind)`, `checksumChars`, `parseCode` (jedyne miejsce rozpoznawania: `short` / `long` / błąd `length|checksum|chars`), `codeFromPaste` (bez obcinania do 12, najwyżej 28), `codeErrorText`. `yjsSync.ts` re-eksportuje te nazwy dla starszych importów. `qrScan.ts` (`codeFromScan`) korzysta z `parseCode`.
- `src/lib/sync/v2Window.ts` — `extendV2Window`, mapa `v2Only` (`kaczy.sync.v2only.v1`, najwyżej 20 nazw), `v2OnlyNotices`.
- `src/lib/pairLink.ts` — `pairLink(…, v3)`, `pairTextIsV3`, `pairCodeFromLocation`; `clearPairFromLocation` zdejmuje też `v`. Wszystkie (i `codeFromLinkOrText`) czytają link jednym parserem `pairParams` z `pairCode.ts`: fragment ma pierwszeństwo przed zapytaniem, `v=3` liczy się tylko w tej samej części co kod.
- `src/lib/legacyRoomIdle.ts` — `LEGACY_MAX_MS`, `legacyEndsAt` (min(ostatnie pojawienie + 30 dni, włączenie + 90 dni)).
- `src/lib/yjsSync.ts` — pola `v2Start`, `v2Exposed`, `legacyExposed`, `newCodeHint`, `ignoredRekey` w `kaczy.sync.v1`; `roomNamesFor` (kod długi → sam v3), `extendV2IfNeeded`, `observeV2Only`, `newCodeProposal` / `useNewCodeProposal` / `dismissNewCodeHint`, `groupIsV3Only`, `startPairing(kind)`, `joinWithCode(raw, { v3 })`; wymiana kodu: `rekeyStop`, `rekeyGate`, `haltRekeyed`, `onSyncControl`, `continueOnOldCode`, `restartRelay`, `followPrefs` (zdarzenie `storage`), `prepareCodeChange` / `runCodeChange` / `cancelCodeChange` (dla Z-15.3), `tickRekeyDevices`.
- `src/lib/sync/rekeyRuntime.ts` — zapis wymiany (`loadRekeyRecord`, `saveRekeyRecord`, `useRekeyRecord`) i porty produkcyjne `rekeyPorts(host)`; kod przekaźnika wymiany (`rekeyRelay.ts`) ładowany leniwie.
- `src/lib/sync/relayRuntime.ts` — `idbRelayStore` (eksport), `forgetRelayRoom`, `setRelayGate` (bramka `canSend` dla wpisów i blobów).
- `src/components/sync/CodeChangePanel.tsx` — `CodeChangePanel` (`Confirm`, `Repair`); stan wyłącznie z `useRekeyRecord`, więc druga karta widzi ten sam postęp, a działania z niej dostają „Zmianę kodu prowadzi inna karta”. `yjsSync.ts`: `markRekeyDevicePaired`, `dismissCodeChange`, `updateRekeyRecord` (czeka na blokadę `REKEY_LOCK` w kolejce — blokada „tylko gdy wolna” gubiła odhaczenie stuknięte w trakcie kroku sterownika; zakończona wymiana bez urządzeń do sparowania znika sama).
- `src/components/sync/JoinCodeField.tsx` (`JoinCodeField`, `GroupedCode`), `SyncCodeNotices.tsx` (`NewCodeCard`, `RekeyedCard`, `V2OnlyNotices`), `NewCodeBanner.tsx`; `SyncStatusDot` (ton `rekeyed`), `OfflineQueuePanel` (opis stanu).
- `src/lib/settingsDeepLink.ts` — `peekRequestedSettingsTab`: `SettingsDialog` tylko podgląda zamówioną kartę w inicjalizatorze, zużywa ją efekt (przerwany render współbieżny gubił kartę „Sync” po kliknięciu kropki).

### Jak działa i dlaczego

- **Pole kodu bez automatycznego dołączania.** Pod kratkami jest jedno niewidoczne `<input>` (`aria-label` „Kod z innego urządzenia”, podpowiedź przez `aria-describedby`), więc wklejanie, autouzupełnianie i czytniki działają jak w zwykłym polu; kratki są tylko obrazem wartości. Dołączenie zmienia grupę synchronizacji, więc zostaje świadome „Dołącz” (Enter też działa — to `<form>`).
- **Nazwa urządzenia przez awareness.** Nazwa idzie przez `setLocalStateField("device", …)`, więc nie zmienia protokołu ani danych w Yjs. Każde urządzenie ma własne `clientID`; lista pomija własne.
- **„Odłącz” działa tylko lokalnie.** Wspólny kod nie daje sposobu, by z zewnątrz wyrzucić jedno urządzenie, stąd rozdzielenie na „to urządzenie” i listę pozostałych.
- **Toast z tytułem** porównuje notatki z poprzednim zdalnym zapisem; nie jest wysyłany częściej niż co 30 s.
- **Wyprowadzenia bez zmian.** Nazwy pokoi, hasło WebRTC i klucze przekaźnika liczy się z całego napisu kodu, więc kod 12-znakowy daje te same pokoje co przed kodem długim (wektory w `yjsSync.test.ts`). Kod długi nigdy nie trafia do pokoju v2 ani FNV — starsza wersja i tak by go nie przyjęła.
- **v2Only.** Zaktualizowane urządzenie jest w obu pokojach, więc nazwa widziana w awareness pokoju v2, a nie v3, przez 60 s oznacza starą wersję. Zmiana kodu zeruje `v2Only`, `v2Exposed`, `legacyExposed`, `newCodeHint`, `ignoredRekey` i `legacyRoom` (`freshCode`).
- **Zatrzymanie po znaczniku (D2, `docs/plan-wymiana-kodu.md` §3.3).** `connect` najpierw liczy tag kodu (`rekeyTag` nazwy v3) i sprawdza mapę `syncControl`; obrazy, przekaźnik i WebRTC startują dopiero po tej bramce. Obserwator mapy działa synchronicznie w `applyUpdate`: bramka przekaźnika (`canSend`, także w przebiegu blobów) blokuje wysyłkę od razu, rozłączenie idzie w mikrozadaniu. Bramka jest zamknięta, dopóki tag nie jest policzony. Własny znacznik jest pomijany tylko w krokach `prepared`/`seeded`; od `marked` urządzenie nie łączy się już starym kodem.
- **Karty jednego urządzenia (I-5).** Zdarzenie `storage` dla `kaczy.sync.v1`: inna karta zmieniła kod → łączymy nowym; wyłączyła → rozłączamy (naprawia też „Opuść grupę” w drugiej karcie).
- **Start (I-6).** `initSync` w kroku `marked` najpierw kończy przełączenie (`runRekey`), dopiero potem łączy; inne kroki po potwierdzeniu wznawia po połączeniu i przy zdarzeniu `online`. Raz na start `pruneMarkers` usuwa znaczniki starsze niż 180 dni i wpisy `rekey:…` o złym kształcie (innych kluczy mapy nie rusza).

### Ograniczenia i pułapki

- Brak TURN (decyzja użytkownika, brak hostingu): połączenie przez część sieci komórkowych może się nie udać. Oba urządzenia muszą być online jednocześnie.
- Kody spoza alfabetu nie dadzą się wpisać — wszystkie generowane kody są z tego samego alfabetu.
- PIN skarbca nie korzysta z `InputOTP` (skarbiec ma hasło dowolnej długości).
- Lista urządzeń pokazuje tylko te w pokoju v3. Urządzenie ze starą wersją (tylko v2) widać w komunikacie `v2Only`; widoczne tylko w pokoju FNV — nigdzie.
- „Ostatnia synchronizacja” per urządzenie nie istnieje — awareness jej nie niesie; zostaje globalna z kafla diagnozy.
- Toast przy kilku zmianach naraz może wskazać lokalną notatkę (porównanie obejmuje lokalne edycje od ostatniego zdalnego zapisu).
- `fill()` w Playwright nie przechodzi przez `pasteTransformer` — w testach wpisuj `pressSequentially`.
- Starsza wersja aplikacji, do której wklei się kod długi, utnie go do 12 znaków i dołączy do pustej grupy bez komunikatu — w wydanej wersji tego nie naprawimy; stąd zdanie przy QR.
- **WebRTC po pierwszym pobraniu z przekaźnika (W4, 2026-11-18).** Gdy przekaźnik jest ustawiony, `connect` czeka na `relayFirstPull()` (`src/lib/sync/relayRuntime.ts`): koniec pierwszego pobrania (pierwszy stan inny niż `connecting`), rolę przekaźnika u innej karty, stop albo 15 s. Potem ponownie sprawdza znacznik (`rekeyStop`) i token połączenia — urządzenie wracające po wymianie kodu nie wyśle zaległych zmian przez WebRTC do starego pokoju. Limit 15 s: wolny albo niedostępny serwer nie blokuje połączeń bezpośrednich (wtedy ochrona jak dawniej tylko przez I-7). Testy: `src/lib/sync/relayFirstPull.test.ts`.
- Znacznik jest niezaufany: każdy, kto zna kod, może wstrzymać synchronizację albo usunąć znacznik z dokumentu. `ignoredRekey` trzyma najwyżej 20 identyfikatorów. `pruneMarkers` ufa zegarowi urządzenia.
- Kluczem `v2Only` jest nazwa urządzenia — dwa urządzenia o tej samej nazwie się zlewają.
- Ostrzeżenie „Stara wersja” dotyczy urządzeń bez znanej wersji (urządzenia z listy „ostatnio widziane” jej nie niosą).

### Testy

- `src/lib/sync/pairCode.test.ts`, `src/lib/sync/v2Window.test.ts`, `src/lib/legacyRoomIdle.test.ts`, `src/lib/pairLink.test.ts`, `src/lib/qrScan.test.ts`.
- `src/lib/yjsSync.test.ts` — wektory zgodności, tabela pokoi (krótki/długi × okno × zgodność), `v=3`, propozycja, przedłużenie okna, `v2Only`, zatrzymanie po znaczniku, „Synchronizuj dalej”, I-5, I-6, własny znacznik od `marked`, zerowanie `legacyRoom`.
- Wymiana kodu (Z-15.4): `src/lib/sync/rekey.test.ts` (m.in. przerwanie przy każdym zapisie kroku i wznowienie — jeden znacznik o tym samym id), `src/lib/sync/relayServer.integration.test.ts` (blok „wymiana kodu”: nowy pokój, znacznik zatrzymuje, nagrobek, B oddaje zmiany po ponownym sparowaniu, C wracające przed wycofaniem nic nie wysyła), `src/lib/fullBackup.test.ts` (zapis wymiany, `v2Only` i `syncControl` poza kopią). Raport diagnostyczny (`diagnosticsReport.ts`) zaciera też stary i nowy kod z zapisu wymiany.
- e2e: `sync-rekey.spec.ts` (przepływ bez przekaźnika, anulowanie, axe panelu), `sync-code.spec.ts`, `sync-qr-scan.spec.ts`, `sync-status-dot.spec.ts`, `a11y.spec.ts`.

### Commit

`dc54137a`, `de0a0a08`, `89ae0a28` (2026-11-17); `d1de623c` (Z-15.3); testy wymiany (Z-15.4) — commit po nim.
- Budżet: `yjsSync` jest w paczce startowej (`NotesProvider`); próg eager w `e2e/bundle.spec.ts`, ostatni pomiar 392,4 KB.

### Testy

- `src/lib/yjsSync.test.ts` — `codeFromPaste`, krótki kod, urządzenia w grupie (nazwa, lista bez siebie, czyszczenie przy odłączeniu), `changedNoteTitle`.
- `e2e/sync-code.spec.ts` — link `?pair=` wypełnia kratki; 8/12 znaków; odrzucanie „O” i „0”.
- `e2e/file-sync.spec.ts` — synchronizacja przez plik.
- E2E nie uruchamiano od zmian z 2026-10-20 (pełne e2e odłożone).

### Commity

- `75a026c` (2026-10-15) — pole kodu parowania (`InputOTP`).
- `adbe848` — krótkie kody odrzucone, diagnostyka, ponowne łączenie (plan synchronizacji, fazy 0, 1, 3).
- `842db18` (2026-10-20) — urządzenia w grupie i nazwy (faza 4).
- `89f1546` (2026-10-20) — toast z tytułem notatki (punkt 3).

## Synchronizacja — przekaźnik: limit czasu żądania, za duży wpis, testy przerwań (Z-5.T, 2026-11-18)

### Co robi

- Zawieszone żądanie do przekaźnika (serwer albo pośrednik nie odpowiada) nie blokuje już synchronizacji na zawsze: po 30 s jest traktowane jak błąd sieci, stan „offline”, ponowienie z rosnącą przerwą.
- Zmiana większa niż limit wpisu serwera (~16 MB) nie jest wysyłana ani ponawiana w kółko: stan „błąd” z komunikatem o limicie, zaległość zostaje na urządzeniu.

### Gdzie jest

- `src/lib/sync/relayProvider.ts` — `REQUEST_TIMEOUT_MS`, `MAX_ENTRY_CHARS`, opcja `requestTimeoutMs`; `http` (wyścig z limitem czasu i `AbortController`) i `request`; kontrola rozmiaru w `flushTask` przed wysyłką.

### Jak działa i dlaczego

- Wszystkie zadania klienta idą jednym łańcuchem obietnic (pobranie, wysyłka, migawka), więc jedno żądanie bez odpowiedzi zatrzymywało wszystko. Wyścig z zegarem zamiast samego `signal`, bo atrapy i starsze silniki potrafią zignorować przerwanie.
- Serwer przy ciele większym niż limit zrywa połączenie, zanim odpowie 413 — klient widział błąd sieci i ponawiał bez końca. Teraz szyfrogram jest mierzony przed wysyłką (`MAX_ENTRY_CHARS` jak w `relay-server/core.js`), a przekroczenie to `RelayFatalError`.
- Pokój pełny (suma szyfrogramów ponad `MAX_ROOM_CHARS`, 50 mln znaków) serwer zgłasza jako 409, tak samo jak log pełny (Z-5.6): klient robi wtedy wymuszoną migawkę i ponawia wysyłkę raz. Gdy po udanej migawce znów przyjdzie 409, `flushTask` rzuca `RelayFatalError` z komunikatem `ROOM_FULL` („Pokój na przekaźniku jest pełny — migawka nie zwolniła miejsca”): stan „błąd” w `onStatus` z kodem `"ROOM_FULL"` (trzeci argument, typ `RelayErrorCode`; `RelayFatalError.code`), bez ponowień; zaległość zostaje w magazynie. `relayRuntime` zapisuje kod w `RelayView.code`. UI (`SyncSettings.tsx`, karta „Przekaźnik”) rozpoznaje przypadek po kodzie, nie po tekście: `relayErrorHint(code)` (`src/lib/sync/relayErrorHint.ts`) daje wskazówkę zamiast surowego `detail` — miejsce na przekaźniku dla grupy się skończyło, zmiany z tego urządzenia nie wychodzą na przekaźnik, ale są zapisane lokalnie i idą bezpośrednio; pomoże zmiana kodu synchronizacji (nowe, puste miejsce), przedtem można pobrać kopię w „Kopia i dane”. Przycisk „Przejdź do zmiany kodu” (`RelayErrorAction`, `data-testid="relay-error-action"`) przewija do panelu `CodeChangePanel` (`data-testid="code-change"`) i ustawia fokus na jego pierwszym przycisku; bez panelu na stronie nic nie robi. Błędy bez kodu nadal pokazują `detail`. Wcześniej było 413, które klient traktuje jako „za duży wpis” (błąd trwały), choć migawka zwykle zwalnia miejsce.
- Ustalone przy testach: w trakcie wysyłki zaległość w magazynie bywa już pusta, ale nic nie ginie — wektor stanu `sv` przesuwa się dopiero po udanej wysyłce, więc po ponownym starcie różnica idzie jeszcze raz.

### Ograniczenia i pułapki

- Migawka (`PUT snapshot`) nie ma kontroli rozmiaru przed wysyłką; dokument większy niż limit kończy się błędem serwera przy kompaktowaniu.
- Przypadek „gniazdo zamknięte przy oczekującym ponowieniu” nie ma testu — atrapa nie ma gniazda.
- Zmiana 413→409 dla pełnego pokoju działa dopiero po wdrożeniu nowej wersji `relay-server`; stary serwer nadal odpowiada 413 („za duży wpis”).
- Błąd „pokój pełny” jest trwały do ponownego startu providera — sam z siebie nie wraca do pracy, nawet gdy miejsce się zwolni.

### Testy

- `src/lib/sync/relayProvider.test.ts`, blok „Z-5.T”: karta zamknięta w trakcie wysyłki, uszkodzony wpis w połowie strony (kursor na ostatnim dobrym), kursor sprzed migawki, dwa urządzenia kompaktujące naraz, 409 → migawka i ponowienie, 409 także po migawce → „błąd” bez ponowień (dwa POST-y, jedna migawka), żądanie bez odpowiedzi → „offline” i dalsza praca, za duży wpis → jedna próba i „błąd”; przy 409 po migawce test sprawdza też kod `ROOM_FULL`. Mapowanie kod → wskazówka: `src/lib/sync/relayErrorHint.test.ts`. Pokój usunięty i odtworzony z wyższym `last` są w `relayServer.integration.test.ts`. Serwer: `relay-server/core.test.js` — „pokój pełny (suma znaków): wpis odrzucany 409”.

### Commit

Z-5.T, 2026-11-18 — commit po tym wpisie.

## Synchronizacja — przekaźnik: cofnięcie, pętla resetów, rozjazd z sąsiadem (S2.3, Z-15.6, 2026-11-18)

### Co robi

- Gdy serwer pośredniczący wróci do starszego stanu (np. odtworzony z kopii bez nowych epok), urządzenie to zauważa, wysyła mu swój pełny stan i pokazuje w Ustawieniach → Sync → Przekaźnik ostrzeżenie z przyciskiem „Rozumiem”. Dane lokalne nie są ruszane.
- To samo ostrzeżenie (inna treść) przy trzech resetach jednego pokoju w ciągu doby i gdy urządzenie połączone bezpośrednio trwale widzi na tym samym serwerze inny stan pokoju niż to urządzenie.
- Ostrzeżenie gaśnie samo po 7 dniach bez nowego zdarzenia; każde zdarzenie trafia do dziennika bezpieczeństwa (`relay-rollback`, `relay-reset-loop`, `relay-split`).

### Gdzie jest

- `src/lib/sync/relayProvider.ts` — `RelayWarning`, `RelayHead`; w `RelayState` pola `resets`, `warning`, `warnedAt`; `rolledBack` + `onRollback` (pobieranie i wysyłka), licznik w `resetRoom(epoch, count)`; `warning` (z wygaśnięciem `WARNING_TTL_MS`), `head`, `acknowledgeWarning`, `raiseWarning`; opcje `onWarning`, `onHead`, `now`. Stałe `RESET_WINDOW_MS`, `RESET_LOOP_COUNT`, `RESET_KEEP`.
- `src/lib/sync/relayHeadCompare.ts` — `cleanPeerHead`, `relayUrlTag` (FNV-1a adresu, 8 znaków), `RelayHeadCompare` (śledzenie rozjazdu na sąsiada), `HEAD_PAGE`, `HEAD_GRACE_MS`.
- `src/lib/sync/relayRuntime.ts` — `RelayView.warning`, `acknowledgeRelayWarning`, `relayHeadClaim`, `onRelayHead`, `compareRelayHeads`; `onWarning` → `logSecurity` + `logDiag`.
- `src/lib/yjsSync.ts` — `publishRelayClaim` (pole awareness `relay` w pokoju v3, najwyżej co 15 s), `watchRelayHeads` (porównanie przy każdej aktualizacji awareness).
- `src/components/SyncSettings.tsx` — `RELAY_WARNING_TEXT`, ramka `role="alert"` z „Rozumiem” w `RelayServer`.
- `src/lib/diagnostics.ts` — trzy nowe rodzaje `SecurityEventKind`.

### Jak działa i dlaczego

- Tabela przypadków: `docs/plan-wiadomosci-i-cofniecia.md` §2.2. **Liczba wpisów nigdy nie jest sygnałem** (migawka ją zmniejsza); cofnięcie to wyłącznie `last` poniżej kursora przy tej samej epoce. Inna epoka albo `404` to uczciwy reset jak dotąd.
- Po cofnięciu klient robi to samo co przy resecie (kursor na zero, pełny stan do wysłania, najpierw pobranie) — serwer zostaje naprawiony treścią z urządzenia. Reset po cofnięciu nie liczy się do pętli resetów (już jest ostrzeżenie).
- Pętla resetów: czasy resetów w `RelayState.resets` (najwyżej 5, z ostatniej doby), trzy → `reset-loop`. Bez tego dwa urządzenia z różnym obrazem pokoju zakładałyby go sobie bez końca.
- Porównanie przez awareness (§2.3): deklaracja sąsiada `{ epoch, last, u }` jest niezaufana — czyszczona (`epoch` 32 hex, `last` bezpieczna liczba ≥ 0, `u` 8 hex) i daje wyłącznie ostrzeżenie. Porównujemy tylko ten sam serwer (`u`) i tylko przy własnym pobraniu młodszym niż 60 s. `split` dopiero, gdy rozjazd (inna epoka albo `last` sąsiada wyższe o ponad stronę = 500 wpisów) trwa ponad 60 s **i** nasze pobranie wykonane po jego zauważeniu go nie usunęło; jedno zgłoszenie na rozjazd sąsiada.
- Stan ostrzeżenia leży w `RelayState` (IndexedDB `kaczy-relay`), więc przeżywa przeładowanie; prowadzi go karta z rolą przekaźnika.

### Ograniczenia i pułapki

- Cofnięcie zamaskowane nowymi wpisami (wiersz 5), cenzura wpisów (wiersz 7) i powtórzenie (wiersz 6, nieszkodliwe) nie są wykrywane w etapie 1; etap 2 (łańcuch wpisów, §2.4) świadomie nie zrobiony. Grupy bez połączeń bezpośrednich nie mają porównania przez awareness.
- Licznik resetów ufa zegarowi urządzenia.
- Część po F2 (przełącznik nowych epok po odtworzeniu serwera, test monotoniczności po kompaktowaniu) jeszcze nie zrobiona.

### Testy

- `src/lib/sync/relayRollback.test.ts` — wiersze 1, 2 (migawka bez ostrzeżenia), 3 (trzy resety w dobie dają, dwa i rozłożone ponad dobę nie), 4 (przy pobraniu i przy wysyłce), 6; wygaśnięcie, „Rozumiem”, przeżycie restartu; porównanie awareness: czyszczenie, zgodne, krótki rozjazd, trwały rozjazd, inne epoki, inny serwer, stare pobranie.
- `src/lib/sync/relayServer.integration.test.ts` — „S2.3 wiersz 4”: katalog pokoju na prawdziwym serwerze podmieniony na starszy przy tej samej epoce → ostrzeżenie, pełny stan z powrotem, nowe urządzenie dostaje całość.

### Commit

Z-15.6 (część niezależna od F2), 2026-11-18 — commit po tym wpisie.

## Dane — podział magazynu `yjsStore.ts` (F3 planu Fable, 2026-11-23)

### Co robi

Nic nowego dla użytkownika. `src/lib/yjsStore.ts` (1374 linie) podzielony na moduły w `src/lib/yjs/`, żeby dało się czytać i zmieniać jedną część magazynu bez reszty. Publiczny kształt `YjsStore` i wszystkie ścieżki importu zostały bez zmian.

### Gdzie jest

| Plik | Co | Linie |
|---|---|---|
| `src/lib/yjsStore.ts` | Dokument i jego mapy, trwałość (`IndexeddbPersistence`, `ready`, `compactPersistence`), projekcja notatek (`projectNotes`, `noteCache`, `dirtyNotes`), operacje na notatkach (`applyPatch`, `patchNote(s)`, `upsertNote`, `importBatch`, `insertNoteCopies`, `removeNote(s)`, `setNoteOrder`), stan synchronizacji, złożenie API | 358 |
| `src/lib/yjs/context.ts` | Typ `StoreCtx` — wspólny stan przekazywany fabrykom | 22 |
| `src/lib/yjs/codec.ts` | Konwersje Y ↔ zwykłe obiekty (notatka, folder, lista zadań, właściwości, załączniki), listy pól (`NOTE_SCALAR_FIELDS`, `PRIVATE_FIELDS`, `PRIVATE_META`), `keepForeignKeys`, `FUTURE_CONTENT_KEY` | 394 |
| `src/lib/yjs/textEdit.ts` | `createTextEditApi(ctx)` — sesje edycji treści (`beginTextEdit` … `onRemoteTextChange`) i wewnętrzne `textBases` | 77 |
| `src/lib/yjs/vault.ts` | `createVaultApi(ctx, textBases)` — blokada, szyfrogramy, metadane skarbca, `rekeyVault`, ujście zapisów (`setLockedWriteSink`, wewnętrzne `writeLocked`) | 158 |
| `src/lib/yjs/taxonomy.ts` | `createTaxonomyApi(ctx)` — foldery, etykiety, definicje właściwości | 127 |
| `src/lib/yjs/migrations.ts` | `createMigrations(ctx, migratedKey)` — obrazy ze starych kluczy idb, notatki sprzed Yjs | 112 |
| `src/lib/yjs/fileRefs.ts` | `createFileRefsApi(ctx)` — odwołania do bajtów dla GC i synchronizacji plików | 80 |
| `src/lib/yjs/bulkReplace.ts` | `createBulkReplaceApi(ctx)` — `replaceAll`, `replaceAllChunked`, licznik zapisów masowych | 107 |
| `src/lib/yjs/docFile.ts` | `readDocState`, `replacePersistedDoc` — dokument poza działającym magazynem (reeksport z `yjsStore.ts`) | 106 |

### Jak działa

- `createYjsStore` tworzy dokument i mapy, składa z nich `ctx: StoreCtx` i woła fabryki modułów. Wynik destrukturyzuje do lokalnych nazw, więc kod, który został w `yjsStore.ts`, woła je jak dawniej.
- Funkcje przeniesiono dosłownie, z tym samym wcięciem. Zmieniło się tylko wywołanie ujścia skarbca w `applyPatch`: `lockedWriteSink?.(…) ?? false` → `writeLocked(…)` z tym samym wynikiem.
- Kolejność obserwatorów Yjs bez zmian: fabryki niczego nie obserwują przy tworzeniu (`observe` tylko na żądanie w `onRemoteTextChange` i `observeVaultMeta`), a obserwator brudnych notatek (`notesMap.observeDeep`) zostaje w `yjsStore.ts`.
- `src/lib/yjs/*.ts` są na liście modułów, którym ESLint pozwala importować `yjs` (`eslint.config.js`).

### Ograniczenia i pułapki

- Kolejność kroków różni się od planu: edycja tekstu przed skarbcem, bo `lockNote` kasuje bazę edycji (`textBases` idzie do `createVaultApi`).
- Ponad plan wydzielono `docFile.ts`, `fileRefs.ts` i `bulkReplace.ts` — bez nich `yjsStore.ts` miałby 606 linii.
- `codec.ts` ma 394 linie: to jeden spójny zbiór konwersji, dzielenie go dalej rozerwałoby pary zapis/odczyt.

### Testy

- `src/lib/yjsStore.shape.test.ts` — migawka posortowanych kluczy i typów API (krok 0); każdy krok ją zostawił bez zmian.
- Pełny Vitest po każdym kroku: 4248 zaliczonych. E2e magazynu (`daily-snapshot`, `file-sync`, `import-external`, `private-notes`, `restore-*`, `sync-*`): 25 zaliczonych, 1 niezaliczony — `private-notes` „przeżywa blokadę” pada tak samo na `50e3d232` sprzed F3 (5 z 5), więc to stara porażka.

### Commit

`c6503671` (krok 0), `a6d17413` (1), `99416d01` (2–3), `1831c38d` (4), `0a43d279` (5), `54ff28a6` (6), dalej `docFile`, `fileRefs`, `bulkReplace` — 2026-11-23.

## Dane — wymaganie wersji w dokumencie i spis map (D1.2–D1.4 planu migracji, 2026-11-18)

### Co robi

- Gdy dane zapisała nowsza wersja aplikacji, która oznaczyła w dokumencie cechę wymagającą nowszego formatu, starsza wersja pokazuje baner „Te dane zapisała nowsza wersja aplikacji. Zaktualizuj…”. W Ustawieniach → Kopia i dane → Diagnostyka jest wtedy wiersz z listą cech i przyciskiem „Ignoruj i pisz” (obejście, gdy wymaganie wpisał ktoś obcy).

### Gdzie jest

- `src/lib/docFormat.ts` — mapa `docFormat` (`DOC_FORMAT_MAP`), `requireFeature`, `readDocFormat`, `docWritable`, `docFormatStatus`, `ignoreDocFormat`, `useDocFormatStatus`, `KNOWN_FEATURES`.
- `src/components/DocFormatBanner.tsx` (w `src/pages/Index.tsx` obok banera przerwanego przywracania); `DocFormatOverride` w `src/components/settings/BackupSettings.tsx`.
- `src/lib/diagnostics.ts` — rodzaj `doc-format-claim`.
- `src/lib/docMapsInventory.test.ts` — spis map Yjs (D1.2).

### Jak działa i dlaczego

- Klucz = cecha danych, wartość = najniższa wersja formatu (`SCHEMA_VERSION`), która ją rozumie. Zapis tylko w górę, więc równoległe dopisanie tej samej cechy na dwóch urządzeniach daje ten sam wynik. Wymaganie liczy się na cechę: `docWritable(cecha)` blokuje tylko mapy tej cechy. Wspólnego punktu zapisu nie ma (ponad 40 modułów z własnym `transact`), więc pierwsze wydanie tylko zapisuje, czyta i pokazuje baner — blokadę dostanie każdy magazyn razem z pierwszą cechą, która jej wymaga (planowo `vault-files`). Dziś `KNOWN_FEATURES` jest puste i żadna cecha nie jest zapisywana.
- Wartości z dokumentu są niezaufane: nazwy `^[a-z][a-z0-9-]{0,31}$`, wartości przez `cleanSchemaClaim`, najwyżej 50 cech. Wymaganie ponad `SCHEMA_VERSION + 1` daje jeden wpis bezpieczeństwa na cechę i wartość — znający kod synchronizacji mógłby inaczej zablokować zapis wszystkim. Po rejestrze urządzeń (D4.1) próg będzie najwyższą wersją z rejestru.
- D1.2: każda mapa wymieniona w kodzie (`getMap("…")`, stałe z nazwą, nazwy bazowe Grafiku) ma kategorię — zachowuje nieznane pola (z testem przy module), zwolniona (mapy pól, wartości proste, wpisy bez edycji, bufory, znaczniki — z uzasadnieniem w teście) albo „do zrobienia”. Nowa mapa bez kategorii wywala test, a lista „do zrobienia” może tylko maleć.
- D1.1 w Ćwiczeniach (2026-11-18): plan dnia, własne ćwiczenie, waga, posiłek i cele diety zachowują pola nowszej wersji przy „Cofnij”, kopii i nadpisaniu wpisu z formularza (ważenie tego samego dnia, cele). Pomocnik `mergeStored` w `src/lib/extraFields.ts` bierze nieznane pola z bieżącej wartości w dokumencie; limity jak w `pickExtra`. Kopia zapisuje je na wierzchu wpisu, bez klucza `extra`. Klienci są mapą pól (`f␁id␁pole`), więc niczego nie wymagali. W Pracy to samo dla zestawów, punktów, cennika (robocizna, szablony), auta, kart powtórek, statystyk rund, własnych pytań oraz danych szefa i grupy (`yKits`, `yPoints`, `yPricing`, `yVan`, `yStudy`).
- D1.4 — granica: wersje wydane przed 2026-11-18 nie znają mapy `docFormat`; zmiany niszczące dla starszych klientów dopiero po D4.

### Ograniczenia i pułapki

- D1.1 (zachowanie nieznanych pól): wszystkie mapy dokumentu są w spisie (`src/lib/docMapsInventory.test.ts`, lista „do zrobienia” pusta, zapadka `TODO_MAX = 0`). Ostatnie, 2026-11-23: `plans` (`src/lib/plans/yPlans.ts` — `PROJECT_KEYS`, `CAL_KEYS`, `ENTITY_KEYS`; kolory to tablica wymieniana w całości) i `studySiteItems` (`src/lib/study/yStudy.ts` — `SITE_ITEM_KEYS` per rodzaj listy) zapisują przez `mergeStored` z jawną listą znanych pól, więc pole opcjonalne skasowane przez użytkownika nie wraca, a pole nowszej wersji zostaje; test `src/lib/extraD11plans.test.ts`. `vault` jest wyjątkiem: to nagłówek kryptograficzny zapisywany tylko przy założeniu i zmianie hasła — scalanie nieznanych pól mogłoby zostawić niespójny nagłówek; przed przepisaniem nowszego formatu chroni wymaganie wersji (D1.3). Kopia JSON Pracy (`cleanDump`) nadal gubi nieznane pola — to zakres D5.
- Mapy o nazwach składanych w locie poza Grafikiem test spisu zobaczy dopiero po dopisaniu ich listy (jak `SHIFTS_MAP_BASE_NAMES`).
- Baner nie mówi, które dane są zagrożone, gdy cecha jest nieznana z nazwy — to zamierzone: nie wiadomo, które mapy obejmuje.

### Testy

- `src/lib/docFormat.test.ts` — wymaganie tylko w górę i zbieżność dwóch dokumentów, czyszczenie niezaufanych wartości, blokada tylko wybranej cechy, jeden wpis bezpieczeństwa, „Ignoruj i pisz”.
- `src/lib/docMapsInventory.test.ts` — spis map i zapadka listy „do zrobienia”.
- `src/lib/exerciseExtra.test.ts` — Ćwiczenia: plan po „Cofnij” i w kopii, ponowne ważenie, posiłek, cele z formularza, `mergeStored`.
- `src/lib/study/extraD11.test.ts` — Praca: zestaw, pozycja auta, szablon wyceny, szef i własny punkt, pomieszczenie i punkt, statystyka rundy i karta powtórki.
- `src/lib/extraD11rest.test.ts` — Grafik (dzień, rodzaj zmiany, wzór, premia, rejestr grafików), przypomnienie i sprzęt treningu, foldery i właściwości (mapy pól: `keepForeignKeys` w `src/lib/yjs/codec.ts` z jawną listą kluczy), zapisane widoki.

### Commit

D1.2–D1.4, 2026-11-18 — commit po tym wpisie.

## Dane — rejestr urządzeń w dokumencie i bramka formatu (D4.1–D4.4 planu migracji, 2026-11-19)

### Co robi

- Każde urządzenie w grupie synchronizacji zapisuje w dokumencie swoją nazwę, wersję aplikacji i numer formatu. Dzięki temu urządzenia wiedzą o sobie, nawet gdy nigdy nie były online w tym samym czasie (wpis dochodzi przez WebRTC, przekaźnik i plik).
- Nowego formatu danych nie wolno zapisać, dopóki nie znają go wszystkie urządzenia obecne teraz **oraz** widziane w ostatnich 30 dniach.
- Ustawienia → Synchronizacja → „Zapisane w grupie”: pozostałe urządzenia z wersją i czasem ostatniego wpisu, ostrzeżenie „Może stracić dane” przy urządzeniu niewidzianym ponad 30 dni ze starszym formatem i przycisk „Zapomnij” (urządzenie wpisze się ponownie przy następnym starcie).

### Gdzie jest

- `src/lib/deviceRegistry.ts` — mapa `devices` (`DEVICES_MAP`), klucz lokalny `kaczy.device.id.v1` (`getLocalDeviceId`), `recordLocalDevice`, `readDevices`, `cleanDeviceEntry`, `activeOtherDevices`, `dormantOlderDevices`, `forgetDevice`, `useRegistryDevices`.
- `src/components/sync/DeviceRegistryList.tsx` — lista w `SyncSettings` pod „Ostatnio widziane”.
- `src/lib/formatSchema.ts` — `setRegistrySource`; `writeFormatAllowed` łączy awareness z rejestrem.
- `src/lib/yjsSync.ts` — `recordDevice()` po pierwszym pobraniu z przekaźnika w `connect` i po zmianie nazwy; źródło rejestru podpięte tylko przy kodzie grupy.

### Jak działa

- Wpis `{ name, schema, version, at }` pod losowym, stałym identyfikatorem (nie nazwą — dwa urządzenia o tej samej nazwie się nie zlewają, zmiana nazwy nie zostawia widma).
- Zapis tylko gdy zmieniła się nazwa, format albo wersja, albo wpis ma ponad dobę — każde nadpisanie zostaje w historii dokumentu. Transakcja z `origin` `"device-registry"`.
- Odczyt czyści wartości jak deklaracje z awareness (`cleanSchemaClaim`, `cleanVersionClaim`, `cleanDeviceName`); `at` z przyszłości (ponad dobę) liczy się jak „teraz”; czytane jest najwyżej 50 najnowszych wpisów. Wpisy starsze niż 180 dni i niepoprawne usuwa urządzenie przy swoim zapisie.
- Bez grupy bramka odpowiada „tak” (jedno urządzenie) — także gdy przywrócona migawka OPFS wniosła stare wpisy.
- Mapa nie wchodzi do kopii JSON (kopia ma jawne sekcje), a identyfikator — do kopii ustawień (`SETTINGS_KEYS`).

### Ograniczenia i pułapki

- Urządzenia sprzed D4.1 nie wpisują się do rejestru; widać je tylko w awareness. Przez 30 dni od wdrożenia nie podnosić `SCHEMA_VERSION` jako bramki zapisu.
- Urządzenie niewidziane ponad 30 dni nie blokuje; dostaje ostrzeżenie na liście w Ustawieniach. Gdy wróci ze starą wersją, zatrzymuje je tylko `docFormat` (D1.3).
- Migawka OPFS (kopie dzienne) zawiera mapę `devices` — to zgodne z zamiarem, bo bramka bez grupy jej nie czyta.

### Testy

- `src/lib/deviceRegistry.test.ts` — stały identyfikator, zapis najwyżej raz na dobę bez zmian, przejście wpisu do drugiego dokumentu i bramka, czyszczenie, limit 50, usuwanie po 180 dniach, `forgetDevice`.
- `src/lib/docMapsInventory.test.ts` — `devices` w spisie map z uzasadnieniem.
- `src/components/sync/DeviceRegistryList.test.tsx` — lista bez własnego urządzenia, ostrzeżenie, „Zapomnij”.
- `src/lib/sync/relayServer.integration.test.ts` (D4.4) — dwa urządzenia tylko przez prawdziwy serwer przekaźnika widzą swoje wersje, a bramka blokuje nowszy format.

### Commit

D4.1–D4.2: 069616d6, D4.3–D4.4: 851a4012, 2026-11-19.

## Dane — wzorce dokumentu dla każdej wersji formatu (D3.1 planu migracji, 2026-11-19)

### Co robi

- Dla użytkownika nic. Chroni przed zmianą, po której bieżąca aplikacja przestałaby czytać dokument zapisany starszą wersją.

### Gdzie jest

- `src/test/fixtures/docs/<wersja>.update` — zakodowane stany Yjs (1, 2, 3) z danymi syntetycznymi: 6 notatek (przypięta, w podfolderze z etykietami zagnieżdżonymi, lista z wcięciem, zarchiwizowana, w koszu, z `[[link]]` i `^id`), 2 foldery, 3 etykiety.
- `src/test/fixtures/docs/generate.test.ts` — generator (pomijany bez `GEN_DOC_FIXTURE=1`), tylko API `createYjsStore` dostępne od października.
- `scripts/doc-fixture.ps1 <wersja> <commit>` — uruchamia generator na starym kodzie (worktree + junction do `node_modules`, usuwany bez kasowania celu). Wersja 1: `98706d2f^`, wersja 2: `ec8be170^`.
- `src/test/fixtures/docs/fixtures.test.ts` — każdy wzorzec czytany bieżącym kodem.

### Jak działa

- Test sprawdza, że istnieje wzorzec dla każdej wersji od 1 do `SCHEMA_VERSION`, więc podniesienie `SCHEMA_VERSION` bez nowego wzorca czerwieni test. Nowy wzorzec: `GEN_DOC_FIXTURE=1 npx vitest run src/test/fixtures/docs/generate.test.ts`.
- Generator ustawia stały `clientID`, więc wynik jest powtarzalny.

### Ograniczenia i pułapki

- Wzorce 1–3 są bajtowo identyczne: zwykłe notatki, foldery i etykiety nie zmieniły kształtu. Wersja 2 zmieniła tylko notatki prywatne (metadane w szyfrogramie), a wersja 3 — mapy Długów, Pracy i Ćwiczeń; generator ich nie obejmuje, bo ich API zmieniało się między wersjami. Do rozszerzenia przy D3.2–D3.4.

### Testy

- `src/test/fixtures/docs/fixtures.test.ts`.

### Commit

D3.1: 963d900d, 2026-11-19.

## Dane — rejestr i wykonawca migracji dokumentu (D2.1–D2.4 planu migracji, 2026-11-19)

### Co robi

- Gdy nowa wersja aplikacji zmienia kształt danych, zmiana wykonuje się raz na dokument, w jednej karcie, po kopii obecnego stanu. Gdy się nie uda, dane zostają bez zmian, a próba powtarza się przy następnym starcie. Po trzech porażkach pojawia się baner z prośbą o kopię i zgłoszenie.
- Dziś rejestr jest pusty — nic się nie wykonuje (bez blokady i bez kopii).

### Gdzie jest

- `src/lib/migrations/registry.ts` — `DocMigration` (`id`, `scope`, `description`, `since`, `run`, `check`), `DOC_MIGRATIONS` (pusta), `LOCAL_MIGRATIONS` (opis istniejących migracji: dawny IndexedDB → Yjs, Praca i Grafik z localStorage), `DOC_MIGRATIONS_MAP`, `isMigrationOrigin`, `MIGRATION_ID_RE`.
- `src/lib/migrations/runner.ts` — `runDocMigrations`, `migrateOnCopy`, `pendingMigrations`, `MAX_FAILURES`.
- `src/lib/migrations/start.ts` — `startDocMigrations` (blokada `MIGRATION_LOCK`, migawka `saveBeforeReplace`, porażki w `kaczy.migrations.failures.v1`, rezygnacje w `kaczy.migrations.giveup.v1`), `useMigrationGiveUps`.
- `src/main.tsx` — start po `yjsStore.ready()`, import dynamiczny.
- `src/components/DocFormatBanner.tsx` — baner `migration-giveup-banner`.

### Jak działa

- Yjs nie cofa transakcji, więc migracja działa na kopii roboczej: nowy `Y.Doc` (własny, losowy `clientID`) + stan żywego dokumentu → jedna transakcja z danymi i znacznikiem `{ at, version }` w mapie `docMigrations` → `check` na kopii → różnica `encodeStateAsUpdate(kopia, wektorŻywego)` jednym `applyUpdate` z `origin` `migration:<id>`.
- Pod blokadą znaczniki są sprawdzane od nowa (inna karta albo inne urządzenie mogły już migrować). Po porażce kolejne migracje z listy czekają do następnego startu.
- `check` po scaleniu z żywym dokumentem jest tylko wpisem w dzienniku — zmiany, które przyszły w trakcie, scalają się jak każde inne.
- Istniejące migracje (D2.3) zostają w miejscu ze swoimi znacznikami na urządzenie; rejestr je tylko opisuje — przeniesienie znaczników byłoby kolejną migracją.

### Ograniczenia i pułapki

- D2.4 uproszczone: migawka trafia do katalogu „przed przywróceniem” (30 dni, istniejące przywracanie w Ustawieniach → Kopia i dane), nie do osobnego katalogu 14 dni / 3 sztuki. Ostrzeżenie o grupie synchronizacji daje istniejące okno przywracania (D-A1).
- Przed pierwszą migracją dokumentu trzeba spisać obserwatory, które biorą zmianę za edycję użytkownika (`updatedAt`, historia wersji, status zapisu), i dodać im `isMigrationOrigin`.
- Migracja dodana później niż zmiana od starszego klienta: znacznik już jest, więc czytnik musi rozumieć oba kształty (zasada 2, test D3.4 do zrobienia).
- Wzorce (D2.5) w `src/lib/migrations/patterns.ts`: `copyField` + `readRenamed` (zmiana nazwy), `deriveField` (zmiana jednostki), `objectsToFieldMaps` (obiekt → `Y.Map` pól, identyfikatory z danych), `splitInto`, `mergeInto` — wszystkie tylko dopisują. Reguła D2.6 („nie zmieniaj znaczenia pola”) jako zasada 9 w planie migracji. Testy zbieżności: `patterns.test.ts`.

### Testy

- `src/lib/migrations/runner.test.ts` — identyfikatory rejestru, jeden update z `origin` `migration:<id>`, znacznik i migawka, brak pracy przy drugim uruchomieniu, błąd i nieudane sprawdzenie bez zmian w dokumencie, rezygnacja po 3 porażkach, brak migracji bez migawki, zbieżność dwóch urządzeń (D3.3).
- `src/lib/docMapsInventory.test.ts` — `docMigrations` w spisie.

### Commit

D2.1–D2.4, 2026-11-19 — commit po tym wpisie.

## Synchronizacja — duże wiadomości WebRTC dzielone na ramki (D-U1, U-1, 2026-11-18)

### Co robi

- Pełna wymiana dużego dokumentu notatek i pierwsza wymiana obrazów przez połączenie bezpośrednie dochodzą także powyżej 256 KiB. Wcześniej Chrome odrzucał taką wiadomość, a `y-webrtc` połykał błąd — synchronizacja po cichu stała.

### Gdzie jest

- `src/lib/sync/peerChunks.ts` — `encodeChunks`, `createAssembler`, `attachChunking`, `chunkProvider`; stałe `CHUNK_SIZE` (64 KiB), `CHUNK_FROM` (192 KiB).
- `src/lib/yjsSync.ts` — `chunkProvider(p, { maxBytes: 64 MiB }, "yjs i")` na każdym dostawcy pokoju.
- `src/lib/imageSync.ts` — `chunkProvider(p, { maxBytes: 256 MiB }, "img")`.
- `package.json` — `y-webrtc` przypięty dokładnie na `10.3.0` (owijamy wnętrze biblioteki).

### Jak działa i dlaczego

- Wiadomość od `CHUNK_FROM` idzie jako ramki `[100, 1, id(4), index(4), total(4), dane]`; mniejsze bez zmian, więc ze starszą wersją aplikacji małe wiadomości działają jak dotąd (typ 100 starsza wersja pomija).
- `chunkProvider` słucha zdarzenia `peers` dostawcy — `y-webrtc` emituje je przy sygnalizacji, przed `connect`, więc owinięcie jest gotowe przed pierwszym krokiem synchronizacji. `attachChunking` podmienia `peer.send` i jedyny słuchacz `data`.
- Wysyłka ramek idzie kolejką z kontrolą `bufferedAmount` (czeka powyżej 1 MiB; Chrome zamyka kanał przy przepełnieniu bufora). Gdy kolejka nie jest pusta, małe wiadomości czekają za nią, żeby zachować kolejność.
- Odbiór: najwyżej 4 składane wiadomości naraz, 60 s na złożenie, limit rozmiaru. Każdy błąd ramki zamyka połączenie zamiast gubić część — wiadomości synchronizacji nie wolno pominąć.
- Połączenie o nieznanym kształcie (inna wersja `simple-peer`) jest zamykane i logowane w diagnostyce.

### Ograniczenia i pułapki

- Owijamy wnętrze `y-webrtc`/`simple-peer` (`room.webrtcConns`, `peer._channel`); aktualizację biblioteki pilnuje test-kanarek w `peerChunks.test.ts`.
- Wiadomość jest składana w pamięci w całości (do 64 MiB dla dokumentu, 256 MiB dla obrazów).

### Testy

- `src/lib/sync/peerChunks.test.ts` — podział i złożenie, ramki nie po kolei, duplikaty, sprzeczne nagłówki, limity, kolejność małych za dużymi, kształt `y-webrtc` (kanarek).
- Ręcznie w Chromium (Playwright, dwa `simple-peer` w jednej stronie): 100 B, 300 KiB, 1 MiB, 8 MiB i 50 B doszły w kolejności i bez zmian.

### Commit

`ee4e11ac`, 2026-11-18 (opis — commit po tym wpisie).

## Synchronizacja — strażnik wiadomości WebRTC (S2.5, Z-15.5, 2026-11-18)

### Co robi

- Urządzenie w grupie, które wysyła za duże, za częste albo nieznane wiadomości, jest rozłączane. Może wrócić — pojedyncza pomyłka nie odcina go na stałe.
- Po trzech takich rozłączeniach w 10 minut połączenie bezpośrednie (tekst i obrazy) jest wstrzymane na 15 minut; przekaźnik działa dalej. Toast i karta w Ustawieniach → Sync z „Wznów teraz”; przy drugim wstrzymaniu w dobie karta radzi zmianę kodu.
- Każde rozłączenie trafia do dziennika bezpieczeństwa jako `peer-limit`.

### Gdzie jest

- `src/lib/sync/peerGuard.ts` — `classify` (czysta), `GuardLimits`, `DOC_LIMITS`, `IMAGE_LIMITS`, `GuardState`, `PeerCloseCounter`, `MAX_AWARENESS_STATES`.
- `src/lib/sync/peerChunks.ts` — `PeerGuardHooks`; `attachChunking`/`chunkProvider` przyjmują strażnika i sprawdzają złożoną wiadomość przed oryginalnym słuchaczem `y-webrtc`.
- `src/lib/yjsSync.ts` — `peerGuardHooks`, `trimAwareness`, `pauseP2p`, `resumeP2p`, `checkPendingStructs`; pola `p2pPausedUntil`, `p2pPausesToday` w `SyncState`.
- `src/lib/imageSync.ts` — `overImageBudget`, ponowne założenie bufora obrazów.
- `src/components/sync/SyncCodeNotices.tsx` — `PeerPausedCard`; `src/components/SyncSettings.tsx` ją pokazuje.
- `src/lib/diagnostics.ts` — rodzaj `peer-limit`.

### Jak działa i dlaczego

- Strażnik czyta tylko długość i dwa pierwsze bajty. **Wiadomości synchronizacji nie są nigdy pomijane** (pominięta aktualizacja Yjs zatrzymuje wszystkie późniejsze od tego klienta) — przepuszczenie albo zamknięcie połączenia. Pomijane bywają tylko awareness i pytanie o awareness.
- Limity (dokument główny, na połączenie): krok 1 ≤ 64 KiB i ≤ 6/min; krok 2 ≤ 64 MiB i ≤ 6/min; aktualizacja ≤ 4 MiB i ≤ 600/min; bajty kroku 2 i aktualizacji ≤ 96 MiB/min; awareness ≤ 4 KiB i ≤ 30/10 s (inaczej pominięcie, trzecie pominięcie w minucie zamyka); pytanie o awareness ≤ 6/min; typ 4 i nieznane zamykają. Próg 4 MiB z pomiaru `applyUpdate` (kryterium 250 ms na telefonie, `docs/plan-wiadomosci-i-cofniecia.md` §1.4).
- Ramki D-U1 są składane przed strażnikiem, a limit składania równa się największej dopuszczalnej wiadomości — za duża jest zamykana już po nagłówku pierwszej ramki.
- Po przepuszczonym awareness: ponad 64 stany → nadmiar usunięty ze `states` (nigdy własny; `meta` zostaje, więc powtórka z tym samym zegarem nie wraca, a usunięcie nie jest rozsyłane dalej) i połączenie zamknięte.
- Wyjątek przy nakładaniu przepuszczonej wiadomości (poprawny nagłówek, zepsuta treść) też zamyka połączenie i liczy się do wstrzymania.
- Obrazy: rozmiaru wiadomości nie da się ograniczyć (pierwsza wymiana to cały zestaw), więc budżet pamięci liczy tylko obrazy, których nie wskazuje żadna notatka (≤ 64 MiB) — duża uczciwa grupa i nowe urządzenie się w nim mieszczą. Po przekroczeniu bufor jest zakładany od nowa (obrazy w `imageStore` zostają), naruszenie liczy się do wstrzymania (`reportPeerViolation`), a przy wstrzymaniu bufor nie wraca.
- Licznik zamknięć jest na całą grupę (identyfikator połączenia jest losowy). Stan wstrzymania tylko w pamięci karty — po przeładowaniu próba od nowa.
- Miernik: aktualizacje czekające na brakujące poprzedniki (`pendingStructs`) ponad 1 MiB dłużej niż 60 s → wpis diagnostyczny i jedno ponowne połączenie; miernik odnawia się, gdy zaległości znikną.
- Wstrzymanie i rozłączenie dzielą sprzątanie połączeń bezpośrednich (`stopPeers`); wstrzymanie zmienia token połączenia, więc `connect` w locie nie założy dostawców.

### Ograniczenia i pułapki

- Kanał między kartami (`BroadcastChannel`) jest bez strażnika — ten sam użytkownik.
- Zalew przez serwer sygnalizacyjny (`y-webrtc` dekoduje każdą wiadomość przed odrzuceniem) i kosztowna, ale mała aktualizacja nie są objęte (§1.6).
- Progi zmierzone na komputerze, nie na telefonie.
- Znane z przeglądu bezpieczeństwa: urządzenie z kodem może co 10 minut wywołać trzy zamknięcia i trzymać połączenie bezpośrednie wstrzymane (przekaźnik działa; karta radzi zmianę kodu). Dokument główny większy niż 64 MiB też trafi na wstrzymanie. Zaległości `pendingStructs` nie są zwalniane przy ponownym połączeniu, a aktualizacje dokumentu obrazów po pierwszej wymianie nie mają limitu bajtów na minutę. Nadmiar stanów awareness zamyka bieżące połączenie, nawet jeśli stany przyszły innym.

### Testy

- `src/lib/sync/peerGuard.test.ts` — tabela `classify` pod i nad każdym progiem, `PeerCloseCounter`, aktualizacja 10 MB odrzucona bez wołania oryginalnego słuchacza, awareness pominięte i nadmiar stanów, błąd dekodowania zamyka, `trimAwareness` (z zachowaniem `meta`).
- `src/lib/imageSync.test.ts` — przekroczenie budżetu zakłada bufor od nowa, obraz w `imageStore` zostaje.

### Commit

Z-15.5, 2026-11-18 — commit po tym wpisie.

## Kopia zapasowa — kopie dzienne w OPFS (Q1.4, Z-16.1 część A, 2026-11-17)

- **Co robi:** raz na dzień aplikacja zapisuje pełny stan danych (notatki, foldery, Grafik, Praca, Nauka, skarbiec) w prywatnym katalogu przeglądarki (OPFS), poza bazą IndexedDB. Zostaje 7 ostatnich dni ze zmianami. W Ustawieniach → Kopia i dane jest sekcja „Kopie dzienne na tym urządzeniu”: data, liczba notatek, rozmiar, „uszkodzona”, „zapisana przez nowszą wersję aplikacji”, „przypięta” z przyciskiem „Odepnij”. W karcie „Trwałość danych w tej przeglądarce” jest wiersz „Kopia dzienna: dziś, 148 notatek.”. Jeśli dziś zabrakło miejsca, w tym miejscu pojawia się ostrzeżenie „Kopia dzienna nie zapisana — brak miejsca.”. Przywracanie z kopii dziennej opisuje sekcja „Kopia zapasowa — przywracanie z kopii dziennej (Z-16.1B)”.
- **Gdzie jest:** `src/lib/dailySnapshot.ts` — `takeDailySnapshot(source, env)`, `listDailySnapshots`, `unpinDailySnapshot`, `parseSnapshot`, `encodeSnapshot`, `startDailySnapshots` (harmonogram), `browserEnv` (OPFS, `withLockIfFree`), stałe `SNAPSHOT_DIR` (`kopie-dzienne`), `SNAPSHOT_KEEP` (7), `PIN_MIN_NOTES` (20), `SNAPSHOT_MAX_BYTES` (256 MiB). `src/workers/snapshotWrite.worker.ts` — zapis przez `createSyncAccessHandle` dla przeglądarek bez `createWritable`. `yjsStore.encodeStateVector()`. Start w `src/main.tsx`: leniwy import po `yjsStore.ready()`, więc moduł nie wchodzi do paczki startowej. Interfejs: `DailySnapshots` i `DailySnapshotHealth` w `src/components/settings/BackupSettings.tsx`.
- **Format:** plik `RRRR-MM-DD.nkopia` (data lokalna). Kolejno: 4 bajty `NKD1`, 4 bajty długości nagłówka (big-endian), nagłówek JSON `{ v: 1, createdAt, app, schema, notes, bytes, sha256, sv }`, treść `Y.encodeStateAsUpdateV2`. `indeks.json` to pamięć podręczna listy i jedyne miejsce zapisu przypięcia. Źródłem prawdy są pliki: lista w Ustawieniach i zapis nowej kopii czytają każdy plik i sprawdzają długość oraz skrót.
- **Kiedy powstaje:** 30 s po starcie (w `requestIdleCallback`) i przy schowaniu karty, dopóki dzisiejszej kopii nie ma. Blokada `notatnik-kopia-dzienna` sprawia, że przy kilku kartach pisze jedna. Kopia bierze też `MIGRATION_LOCK` bez czekania i sprawdza `yjsStore.isBulkWriting()`. W trakcie przywracania kopii albo importu wynik to „busy” i kopia czeka do następnej okazji — inaczej stan pośredni zostałby kopią dnia. Kolejność kroków:
  1. Sprawdzenie samego dzisiejszego pliku. Jeśli jest poprawny, to koniec — tak kończy się prawie każde uruchomienie, bez czytania pozostałych plików. Uszkodzony dzisiejszy plik (przerwany zapis) jest usuwany i zapisywany od nowa.
  2. Pominięcie dnia bez zmian.
  3. Zapis.
  4. Odczyt i sprawdzenie skrótu. Błąd sprawdzenia usuwa plik.
  5. Przypięcie poprzedniej kopii, jeśli trzeba.
  6. Zapis `indeks.json`, a dopiero po nim rotacja (opis niżej). Bez zapisanego indeksu nic nie jest usuwane, bo przypięcie żyje tylko w indeksie.
  7. Zapis `kaczy.snapshot.last.v1` (`{ date, notes }`, dla części B) i `kaczy.snapshot.status.v1` (wynik próby, dla wiersza w Ustawieniach).

  Harmonogram: „quota” kończy dzień, więc nie ma ponownych prób przy każdym schowaniu karty. „error” — najwyżej 3 próby na sesję. Zapis przez Worker ma limit 30 s, żeby zawieszony Worker nie trzymał blokady do zamknięcia karty.
- **Decyzje:**
  - „Dzień bez zmian” rozpoznaje skrót **treści**, nie wektora stanu (`sv`). Samo usunięcie w Yjs nie przesuwa wektora stanu, więc dzień z samymi usunięciami zostałby pominięty. Pole `sv` zostaje w nagłówku, zgodnie ze specyfikacją.
  - Przypięcie: jeśli nowa kopia ma mniej niż połowę notatek poprzedniej, a poprzednia miała ich co najmniej 20, poprzednia zostaje przypięta. Przypięta może być tylko jedna — nowsza zastępuje starszą. Przypięta nie podlega rotacji, dopóki użytkownik jej nie odepnie.
  - Rotacja: zostaje 7 najnowszych poprawnych plików i przypięty. Pliki uszkodzone starsze od siódmego poprawnego też są usuwane. Pliki zapisane przez nowszą wersję aplikacji („newer”) nie są usuwane — po powrocie do starszej wersji nie giną kopie, których ta wersja nie umie przeczytać.
  - Brak miejsca: usunięcie najstarszej nieprzypiętej kopii i jedna ponowna próba. Nie jest usuwana kopia z nowszej wersji ani poprzednia kopia, która właśnie ma zostać przypięta (spadek notatek). Druga porażka oznacza „quota” i brak kopii z dziś, a reszta kopii zostaje.
  - Wiersz w „Trwałości danych” mówi wprost, co się stało: „Kopia dzienna: wczoraj, 148 notatek.”, w dzień bez zmian z dopiskiem „Od tamtej pory bez zmian, więc dziś nowej nie trzeba.”, a przy dzisiejszym „quota” albo „error” pokazuje ostrzeżenie. „Odepnij” czeka na blokadę i przy niepowodzeniu pokazuje błąd.
  - Bez OPFS (tryb prywatny, stara przeglądarka): sekcja i wiersz są ukryte, w diagnostyce jest jeden wpis.
  - Pomiar kodowania (plan §1.4): `encodeStateAsUpdateV2` dla 2000 notatek z historią edycji (1,4 MB) to mediana 15 ms na komputerze, czyli ok. 60 ms przy 4× spowolnieniu. Dzieje się to raz dziennie, w bezczynności. Kodowanie „z kopii w Workerze” nic nie daje, bo skopiowanie dokumentu do Workera wymaga tego samego kodowania w wątku strony. Jedyna inna droga to Worker czytający IndexedDB sam — do rozważenia, jeśli pomiar na telefonie pokaże ponad 100 ms.
- **Ograniczenia i pułapki:** w kopii nie ma obrazów, załączników ani historii wersji. „Wyczyść dane witryny” usuwa też kopie dzienne, więc nie zastępują kopii do pliku (tekst w Ustawieniach to mówi). Przypięcie żyje tylko w `indeks.json`: po utracie indeksu kopia przestaje być przypięta. Zapas dla Safari bez `createWritable` nie był sprawdzony na urządzeniu z iOS (QA telefonu).
- **Testy:** `src/lib/dailySnapshot.test.ts` (atrapa OPFS) sprawdza:
  - nagłówek i skrót;
  - odrzucenie pliku obciętego, z podmienionym bajtem, bez magii i z nowszego formatu;
  - listę z plikiem uszkodzonym;
  - jedną kopię na dzień i pominięcie dnia bez zmian;
  - zastąpienie uszkodzonego dzisiejszego pliku;
  - dwie karty naraz;
  - brak OPFS;
  - rotację 7;
  - przypięcie i jego przetrwanie rotacji, próg 20, zastąpienie przypiętej i odpięcie;
  - brak miejsca: za pierwszym razem i dwukrotnie; nieusuwanie kopii, która ma zostać przypięta;
  - brak kopii w trakcie wymiany porcjami („busy”);
  - pliki nowszej wersji przeżywają rotację;
  - nieudany zapis indeksu blokuje usuwanie.

  `e2e/daily-snapshot.spec.ts` (prawdziwy OPFS w Chromium) sprawdza zapis po schowaniu karty, brak drugiego pliku tego samego dnia, wiersz i listę w Ustawieniach oraz axe.
- **Commit:** w commicie z tym wpisem, 2026-11-17.

## Dane — zgodność w przód: nieznane pola wpisów (Z-17.3, 2026-11-18)

- **Co robi:** wpis zapisany przez nowszą wersję aplikacji z polem, którego ta wersja nie zna, nie traci tego pola przy edycji, „Cofnij”, kopii zapasowej ani scalaniu kopii. Wpis oznaczony wyższą minimalną wersją czytelnika jest dla tej wersji niewidoczny, zamiast pokazywać złe liczby.
- **Gdzie jest:** `src/lib/extraFields.ts` — `pickExtra`, `extraOf`, `toStored`, `tooNew`, `keepV`. Używają go:
  - Długi: `cleanDebt` (`DEBT_ENTRY_V`), `yDebts.ts` (`put`);
  - Odżywki: `cleanSupplement` (`SUPPLEMENT_ENTRY_V`), `ySupplements.ts`, `updateSupplement` (przenosi `extra` i `v` z poprzedniego wpisu);
  - Trening: `cleanSet`, `cleanEntry` (`TRAINING_ENTRY_V`), `storedEntry` w `training/model.ts`;
  - Praca: `cleanJobMeta` (`JOB_ENTRY_V`), `cleanQuoteItem`, `yJobs.ts` (`setMeta` przenosi `extra` i `v`), `cleanPayment` i `yBilling.ts`;
  - Faktury: `cleanRecord` w `ksef/yInvoices.ts`.
- **Jak działa:** `clean*` odkłada nieznane klucze w polu `extra` wpisu w pamięci. Jest to zwykłe pole, więc przeżywa `{ ...entry }`, `structuredClone` i JSON, a istniejące „Cofnij” niesie je bez zmian. Każdy zapis do mapy i każdy zrzut do kopii idzie przez `toStored`: nieznane pola wracają na wierzch, znane je nadpisują, a klucza `extra` nie ma. Limity `pickExtra` chronią przed rozdmuchaniem dokumentu przez peera: 8 kluczy `[a-z][A-Za-z0-9]{0,23}`, wartości proste (tekst do 200 znaków) albo płaskie tablice do 16, razem do 512 B. `v` (1–1000) większe niż stała modułu — `clean*` zwraca `null`, a wpis zostaje w mapie. `SCHEMA_VERSION` = 3 służy tylko ostrzeżeniu `olderDevices`.
- **Ograniczenia i pułapki:**
  - Wersje sprzed tej zmiany nadal gubią nieznane pola. Dlatego nowe dane wiążące wpisy (grupa, plan rat, dowód, stan wysyłki KSeF) idą do osobnych map (`docs/plan-zgodnosc-i-obieg.md` §1.4), a nie do pól wpisu.
  - Faktura jest niezmienna: numer KSeF i stan wysyłki (Etap 2) muszą być w mapie bocznej z kluczem = id faktury.
  - Wycena jako dokument (`q␁budowa␁pole`) ma klucz na pole, więc edycja nie rusza nieznanych pól. Zrzut do kopii ich jednak nie niesie.
  - Pozostałe `clean*` (klienci, posiłki, premie, zestawy, bus, budowy, dziennik) — bez zmian, przy okazji.
- **Testy:** `src/lib/debts/yDebts.extra.test.ts`, `src/lib/supplements/extra.test.ts`, `src/lib/training/extra.test.ts`, `src/lib/study/extra.test.ts` (zlecenia, pozycje, wpłaty, faktury).
- **Commit:** `ec8be170` i kolejne (2026-11-18).

## Kopia zapasowa — przywracanie z kopii dziennej (Z-16.1B, 2026-11-18)

- **Co robi:** przy każdej kopii dziennej w Ustawieniach → Kopia i dane jest „Przywróć…”. Okno pokazuje notatki z kopii w trzech grupach: usunięte od tamtej pory, zmienione i bez zmian. Wybrane notatki wracają jako **nowe** notatki w folderze „Przywrócone DD.MM”, a obecne zostają bez zmian (ścieżka domyślna). Niżej jest „Przywróć cały dokument…” (ścieżka awaryjna): cały dokument — notatki, foldery, Grafik, Praca, Nauka — wraca do stanu z kopii. W Ustawieniach synchronizacji jest „Zastąp dane na tym urządzeniu danymi grupy”: pusty dokument, a potem dołączenie kodem. Gdy baza zniknęła (np. „Wyczyść dane witryny” bez OPFS-u albo awaria), baner „dane zniknęły” prowadzi do kopii.
- **Gdzie jest:**
  - `src/lib/snapshotRestore.ts` — `compareSnapshot`, `restoreSnapshotCopies`, `restoredFolderName`, `vaultDiffers`; typy `SnapshotItem` (`privacy`, `sealed`) i `RestoreDeps`.
  - `src/lib/docReplace.ts` — `requestDocReplace` (część przed przeładowaniem). `src/lib/docReplaceCore.ts` — zamiar i wynik w `localStorage`, `performDocReplace`, `startupReplace` (hak `beforeOpen` w `createYjsStore`), pokolenie dokumentu (`docGeneration`, `watchDocGeneration`), sygnał `announceDocReplace`.
  - `src/lib/yjs/docFile.ts` — `readDocState`, `replacePersistedDoc` (wymiana bazy IndexedDB jedną transakcją; oba reeksportowane z `yjsStore.ts`); `src/lib/yjsStore.ts` — `insertNoteCopies`, opcja `beforeOpen`.
  - `src/lib/privateNotes.ts` — `reencryptCopy`, `sealCopy`, `copySession`, `adoptCopy`.
  - `src/lib/dailySnapshot.ts` — `readSnapshotFile`, `saveBeforeReplace` (katalog `kopie-przed-przywroceniem/`).
  - `src/lib/tabSync.ts` (pole `g` w wiadomościach), `src/lib/sync/relayRuntime.ts` (`clearRelayState`), `src/main.tsx`.
  - UI: `src/components/settings/DailySnapshotRestore.tsx` (`Row`, `ReplaceWholeDocument`), `src/components/DocReplaceBanners.tsx` (`DocReplaceNotice`, `DataLossBanner`), `src/components/SyncSettings.tsx`.
- **Jak działa — ścieżka domyślna:** kopia jest czytana i sprawdzana (nagłówek, skrót), a `readDocState` składa z niej notatki. Kopie powstają w jednej transakcji pod `MIGRATION_LOCK`. Każda dostaje nowy id i nie jest przypięta, w koszu ani w archiwum. Nie ma przypomnienia ani jego reguł (`reminderRule`, `reminderRepeat`, `reminderBase`, `snoozedUntil`), aliasów, gwiazdki „ulubiona”, rodzica ani daty notatki dziennej. Gdyby je zachować, oryginał i kopia dzwoniłyby dwa razy, a `[[linki]]` rozwiązywałyby się dwuznacznie. Drugie przywracanie z tego samego dnia trafia do tego samego folderu.
- **Notatki prywatne:** szyfrogram ma AAD = id, więc dla nowego id trzeba go zaszyfrować ponownie (`reencryptCopy`). Da się to zrobić tylko przy odblokowanym skarbcu z tym samym kluczem. „locked” oznacza, że wystarczy odblokować; „other-key” — że hasło zmieniono po dniu kopii, i wtedy pozycja jest wyszarzona. Notatka jawna w kopii, a prywatna teraz (`sealed`), ma ukryty tytuł i podgląd, dopóki skarbiec jest zablokowany. Wraca od razu zaszyfrowana bieżącym kluczem (`sealCopy`), nigdy jawnie. Notatka z obrazami albo załącznikami jest pomijana, tak jak w `lockNote`. `copySession` zapamiętuje klucz i epokę przed szyfrowaniem. Jeśli w trakcie przyjdzie blokada albo zmiana hasła, kopie prywatne trafiają do pominiętych, a jawne są wstawiane normalnie.
- **Jak działa — ścieżka awaryjna:** dokumentu w pamięci nie da się cofnąć, więc wymiana dzieje się przy następnym starcie, zanim powstanie `IndexeddbPersistence`.
  1. `requestDocReplace`: kopia obecnego stanu w `kopie-przed-przywroceniem/` (30 dni; stare pliki usuwane po dacie w nazwie). Bez tej kopii nic dalej się nie dzieje.
  2. Zamiar (`kaczy.restore.pending.v1`) i nowe pokolenie dokumentu (`kaczy.doc.generation.v1`).
  3. Wyjście z grupy i wyczyszczenie kolejek przekaźnika. Inaczej pierwsze połączenie scaliłoby stan grupy i cofnęło wymianę.
  4. Sygnał do innych kart i przeładowanie.

  Przy starcie `performDocReplace` pod `MIGRATION_LOCK` (czekanie najwyżej 10 s) czyta kopię, jeszcze raz czyści kolejki przekaźnika i wymienia bazę jedną transakcją IndexedDB (`replacePersistedDoc`). Potem zdejmuje zamiar i zapisuje wynik (`kaczy.restore.result.v1`), który pokazuje `DocReplaceNotice`. **Każda porażka** (uszkodzona kopia, zajęta blokada, błąd bazy, zamiar starszy niż 1 h) kończy się wynikiem „nie” i zdjętym zamiarem, bez cichego ponawiania. Zamiar zostaje tylko po awarii procesu w trakcie wymiany. Karty ze starym pokoleniem nie wymieniają stanu przez `tabSync` i przeładowują się po sygnale, zdarzeniu `storage` albo powrocie do widoczności.
- **Ograniczenia i pułapki:** w kopii dziennej nie ma obrazów ani załączników. Kopia notatki odwołuje się do obrazu, który jest tylko wtedy, gdy magazyn obrazów go ma. Ścieżka awaryjna przy synchronizacji wyprowadza urządzenie z grupy. Pozostałe urządzenia zachowują swoje dane, dopóki nie zastąpi się ich danymi z tego urządzenia. Gdy skarbiec w kopii jest inny niż obecny (`vaultDiffers`), potwierdzenie ostrzega, że po przywróceniu obowiązuje hasło z dnia kopii. Wynik porażki „Zastąp danymi grupy” nie zapisuje kodu grupy.
- **Testy:** `src/lib/snapshotRestore.test.ts` (grupy, kopie, pola usuwane z kopii, notatki prywatne: ten sam klucz, inny klucz, zablokowany skarbiec, `sealed`, blokada w trakcie, `vaultDiffers`), `src/lib/docReplace.test.ts` (wymiana bazy, zamiar przy starcie, porażka i wygaśnięcie, kolejność `requestDocReplace`, pokolenie między kartami), e2e `e2e/daily-snapshot.spec.ts` (przywrócenie usuniętej notatki; baza usunięta ręcznie → baner → przywrócenie całego dokumentu).
- **Commit:** `5d86280a`, `0b12224d`, `7067443a`, `72e64cae` (2026-11-17/18).

## Kopia zapasowa — kopia „przed przywróceniem” w OPFS i okno z zakresem (Z-18.3, P5/P6 audytu 2, 2026-11-18)

- **Co robi:** przed przywróceniem pliku kopii obecne dane zapisują się w aplikacji (OPFS, `kopie-przed-przywroceniem/`, 30 dni) i są sprawdzane po zapisie; dopiero potem rusza wymiana. Plik `notki-przed-przywroceniem-<data>.json` nadal się pobiera, jako dodatek. Bez OPFS (albo przy błędzie zapisu) okno „Czy plik się zapisał?” — „Nie, wstrzymaj” niczego nie zmienia. Okno przywracania mówi, co zostanie **zastąpione** (notatki, foldery, etykiety, Grafik, Nauka i Praca — wg zaznaczeń i zawartości pliku), a co **uzupełnione o brakujące** (sekcje `MERGE_SECTIONS` obecne w pliku). Przy sparowanych urządzeniach osobne potwierdzenie „Zmiana obejmie wszystkie sparowane urządzenia” (decyzja D-A1).
- **Gdzie jest:** `src/components/settings/BackupSettings.tsx` (`RestoreBackup`: stany `askSaved`, `syncAsk`, `syncOk`; `restore(skip, { fileConfirmed, syncConfirmed })`), `src/lib/docReplace.ts` (`saveCurrentLocally` → `saveBeforeReplace`, `inSyncGroup`), `src/lib/exportNotes.ts` (`restoreScope`). Kopia pojawia się na liście kopii w Ustawieniach jako „sprzed przywrócenia” i da się z niej odzyskać notatki tą samą ścieżką co z kopii dziennej (etykieta przycisku: „Przywróć notatki z kopii sprzed przywrócenia, <data>”).
- **Dlaczego tak:** pobranie pliku nie zwraca wyniku (iOS potrafi je zablokować po kilku `await` bez gestu), więc nie może być jedyną drogą powrotu. Grafik i Praca leżą w tym samym dokumencie Yjs, więc kopia OPFS obejmuje wszystko, co przywracanie zastępuje. Tekst okna liczony z tych samych list co `restoreFullBackup` — nowa sekcja nie zniknie z ostrzeżenia.
- **Ograniczenia:** kopia OPFS to stan dokumentu Yjs, nie ustawienia z `localStorage`. Potwierdzenie przy synchronizacji nie ma testu e2e (wymaga sparowania).
- **Testy:** `src/lib/restoreScope.test.ts`, `e2e/restore-before-copy.spec.ts` (zakres w oknie, plik w OPFS, ścieżka bez OPFS); `e2e/daily-snapshot.spec.ts`, `search-backup.spec.ts` bez zmian zielone.
- **Commit:** `4d5c9d59` — 2026-11-18.

## Kopia zapasowa — przywracanie: sprawdzenie przed zapisem, notatki porcjami, znacznik przerwania (Z-18.1, Z-16.2, 2026-11-17)

- **Co robi:** przywracanie najpierw czyta i sprawdza wszystkie części kopii, nic nie zapisując. Uszkodzona część (np. Dieta, Grafik, „Nauka i Praca”) zatrzymuje przywracanie **przed** wymianą notatek: okno „Część kopii jest uszkodzona — nie da się odczytać: … Nic jeszcze nie zostało zmienione” z „Przywróć bez nich” i „Anuluj”. Kopia „przed przywróceniem” pobiera się raz na wybrany plik, także przy ponowieniu. Gdy przywracanie zostało przerwane (zamknięta karta, wywrócona przeglądarka), przy następnym starcie baner: „Przywracanie kopii z DD.MM zostało przerwane. Część danych pochodzi z kopii, część sprzed niej. Wczytaj tę samą kopię jeszcze raz.” z „Kopia i dane” i „Zostaw, jak jest”.
- **Gdzie jest:** `src/lib/exportNotes.ts` — `restoreFullBackupLocked` w trzech fazach, `RestoreCheckError` (`sections`), `RestoreOptions.skip`, `MERGE_SECTIONS` z `load` (moduł działu wczytany w fazie sprawdzania, scalanie synchroniczne w fazie zapisu), `SHIFTS_SECTION`, `STUDY_SECTION`. `src/lib/restoreMarker.ts` — `RESTORE_MARKER_KEY` (`kaczy.restore.running.v1`, lokalnie, poza kopią), `readRestoreMarker`, `setRestoreMarker`, `clearRestoreMarker` (osobny moduł, żeby baner nie ładował kodu kopii). `src/components/RestoreInterruptedBanner.tsx` (w `Index.tsx`), `src/components/settings/BackupSettings.tsx` (`RestoreBackup`: okno uszkodzonych części, `savedCurrent`).
- **Jak działa i dlaczego:** dawniej między pierwszym a ostatnim zapisem było kilkanaście `await` (importy działów, zapis wersji), a błąd sekcji wychodził po zniszczeniu notatek. Teraz: 1) sprawdzanie — moduły, `JSON.parse` sekcji, `migrate` Grafiku, `cleanDump` Nauki, wersje; 2) obrazy (tylko dokładają do magazynu); 3) znacznik i zapis synchroniczny bez `await` między zapisami do Yjs — metadane skarbca **przed** notatkami w tym samym zadaniu (notatki prywatne z kopii nigdy nie zostają ze skarbcem urządzenia), sekcje działów (`training` po notatkach — P8), Grafik, Nauka; 4) wersje i `localStorage`, na końcu zdjęcie znacznika.
- **Notatki porcjami (Z-16.2):** `yjsStore.replaceAllChunked` wstawia notatki z kopii porcjami z oddaniem wątku (`src/lib/yieldToMain.ts`); stan pośredni to nadzbiór (stare plus część nowych), a usunięcie starych notatek, wymiana folderów, etykiet i pól oraz metadane skarbca (`final`) idą w jednej transakcji końcowej. Notatka dodana w trakcie zostaje. Okno pokazuje „Przywracanie notatek: N z M” i „Przerwij” — przerwanie zostawia nadzbiór i dymek „Przerwano. Notatki dodane z kopii zostają, nic nie zostało usunięte.” (znacznik przerwania jest wtedy zdejmowany). Między sekcjami działów też jest oddanie wątku.
- **Budżet porcji (Z-16.2):** `budgetMs` (domyślnie 20 ms) to czas **całej** porcji, razem z zamknięciem transakcji — kodowaniem aktualizacji Yjs dla IndexedDB i kart oraz obserwatorami. Profil pokazał, że to ok. dwa razy więcej niż samo wstawianie, więc porcja „30 ms” trwała ok. 100 ms. Czas wstawiania (`insertBudget`, start: jedna trzecia budżetu) jest dobierany po każdej porcji proporcjonalnie do zmierzonego czasu całości.
- **Odroczenie rzutów do Reacta (Z-16.2 p. 3):** w czasie wymiany `yjsStore.isBulkWriting()` zwraca `true`. `useNotes` wtedy nie przelicza rzutów (notatki, foldery, etykiety, pola), tylko zapamiętuje, które czekają, i liczy je raz w `yjsStore.onBulkWriteEnd` — także po przerwaniu, żeby lista pokazała zostawiony nadzbiór. Wewnętrzny obserwator brudnych notatek w `yjsStore` działa dalej, więc końcowy rzut widzi wszystkie zmiany, też te z synchronizacji. Powód: React renderował listę synchronicznie po każdej porcji (200–900 ms przy 4× spowolnieniu, głównie pomiary układu framer-motion `measureScroll`, `NoteCard`, `buildWikiIndex`).
- **Pomiar:** `e2e/restore-perf.spec.ts` (tylko z `PERF=1`; blokuje przeładowanie po komunikacie i liczy też zadania 3 s po nim), wyniki i profil w `docs/plan-dane-lokalne.md` §2.3. W fazie porcji nie ma już zadań ponad 50 ms. Zostają jednorazowe przerenderowania listy po przywróceniu (opis w planie).
- **Ograniczenia:** zapis synchroniczny nie jest atomowy względem awarii procesu (IndexedDB zapisuje aktualizacje osobno) — okno kurczy się do jednego zadania, a znacznik zamienia cichą mieszankę w komunikat; pełną atomowość da ścieżka awaryjna Q1.4. Błąd **scalania** sekcji (nie odczytu) nadal wychodzi po wymianie notatek i trafia do „Przywrócono kopię z błędami”, bo sprawdzenie kształtu każdego działu wymagałoby osobnych funkcji czyszczących. Nieznane sekcje z nowszej wersji, sekcje uszkodzone na poziomie schematu i limit odznak to Z-18.2; kopia „przed przywróceniem” w OPFS i tekst okna — Z-18.3.
- **Testy:** `src/lib/yjsStore.chunked.test.ts` (wynik jak `replaceAll`, przerwanie → nadzbiór i dokończenie ponownym importem, notatka dodana w trakcie zostaje, `final` w transakcji końcowej, flaga wymiany i jedno ogłoszenie końca — też po przerwaniu, porcje maleją przy kosztownym obserwatorze), `src/hooks/useNotes.test.ts` („wymiana porcjami”: rzut notatek liczony raz po końcu, nie w trakcie), `src/lib/fullBackup.test.ts` (uszkodzone sekcje → `RestoreCheckError`, dokument i znacznik nietknięte, „bez nich” przywraca resztę; przerwanie po zapisie notatek → znacznik zostaje, skarbiec z kopii, ponowne przywrócenie zdejmuje znacznik), `e2e/restore-interrupted.spec.ts` (baner, axe, „Kopia i dane”, „Zostaw, jak jest”), `e2e/search-backup.spec.ts`, `e2e/images.spec.ts`.

## Kopia zapasowa — pliki budów osobno od zdjęć dziennika (D3, 2026-10-19)

- **Co robi:** raport kopii rozdziela pominięte bajty na trzy kategorie: załączniki notatek, zdjęcia dziennika i pliki budów (plany, PDF). Toast po zapisie kopii podaje każdą kategorię osobno. Plan nie jest już nazywany zdjęciem dziennika.
- **Gdzie:** `src/lib/study/journalRefs.ts` (`siteDocRefsIn`), `src/lib/exportNotes.ts` (`collectAttachmentBlobs`, `describeSkippedAttachments`, pole `siteDocs` w `BackupAttachmentReport`, opcja `attachmentBudget` w `buildFullBackupWithReport`).
- **Jak działa:** `collectAttachmentBlobs` bierze budżet z opcji (domyślnie `BACKUP_ATTACHMENTS_BUDGET_BYTES`, 40 MB). Każdy pominięty bajt z dziennika albo z kart budów liczy się w swojej kategorii; klucze dokumentów budów wyznacza `siteDocRefsIn` z `studySiteItems`.
- **Okno przywracania:** liczby pominięte przy eksporcie zapisują się w pliku jako `skipped` (`BackupSkipped` w `src/lib/noteSchema.ts`, pole opcjonalne, bez treści; zawsze cztery liczby, zera, gdy nic nie pominięto — dzięki temu w `exportNotes.ts` nie ma gałęzi, a paczka startowa mieści się w budżecie 388 KB). Okno „Przywrócić ten backup?” pokazuje je jako zdanie `describeBackupSkipped` (`src/lib/backupSkipped.ts`, moduł tylko dla okna Ustawień, żeby nie wchodził do paczki startowej) nad listą sekcji (`data-testid=restore-skipped`), żeby było widać, czego w pliku nie ma. Starsze pliki bez pola: brak zdania.
- **Ograniczenie:** `skipped` to liczby z chwili eksportu. Przywrócenie nie odzyskuje pominiętych zdjęć — tylko je nazywa.
- **Testy:** `src/lib/fullBackup.test.ts` — przekroczenie budżetu (`attachmentBudget: 0`) rozdziela załącznik, zdjęcie dziennika i plan oraz składa komunikat; bez przekroczenia plan wchodzi do kopii i nie jest raportowany. Vitest 1469/1469, typecheck czysty.
- **Commit:** 6a97a92 (kod), testy budżetu — w commicie z tym wpisem, 2026-10-19; okno przywracania z `skipped` — 5fa3fbd, 2026-10-19.

## Zgodność danych ze starszą wersją (Faza 0.5, 2026-10-22; Plan-nowy 1.4, 2026-11-03)

- **Co robi:** edycja w jednej wersji aplikacji nie wycina pól, które dopisała inna wersja na drugim urządzeniu.
- **Gdzie:**
  - Notatki: `src/lib/yjsStore.ts` (`applyPatch` zapisuje pole po polu, `reminderSpec` z zapasowymi polami `reminder` i `reminderRepeat`).
  - Wpisy dziennika: `src/lib/study/journalEntry.ts` (`JOURNAL_ENTRY_KEYS`), `yStudy.ts` (`writeEntry`).
  - Karty budów: `src/lib/study/sites.ts` (`SITE_CARD_KEYS`), `yStudy.ts` (`writeCard`).
- **Jak działa:**
  - Notatka, wpis i karta to `Y.Map` pól. Zapis zmienia tylko pola, które się różnią.
  - Wpis i karta kasują tylko pola znane tej wersji, więc nieznane pole z nowszej wersji zostaje. Dla kart brakowało tego do 1.4: `writeCard` kasował każde pole spoza zapisu.
  - `SITE_CARD_KEYS` powstaje z obiektu z `satisfies Record<keyof SiteCard, 1>`. Nowe pole `SiteCard` bez wpisu w tym obiekcie nie przejdzie typecheck.
  - Przypomnienie: nowa reguła powtarzania (`reminderRule`) zapisuje też zapasowy `reminderRepeat` (`fallbackRepeat`). Wersja, która reguły nie zna, czyta więc poprawny rodzaj.
- **Świadome wyjątki:**
  - Zmiana terminu w wersji sprzed Terminy 3.2 (b1beade) zdejmuje wcześniejsze przypomnienie (`reminderLead`), bo ta wersja przepisuje cały `reminderSpec` bez niego. Reguła zostaje.
  - Zmiana terminu w wersji sprzed Terminy 3.1 (01c9ac8) zdejmuje regułę. Seria trwa w zapasowym rodzaju (np. „co tydzień” zamiast „pon., śr.”).
  - Pozycje list karty (`studySiteItems`: etapy, braki, zamówienia…), własne pytania (`studyCustom`) i powtórki (`studyReview`) są zapisywane jako cała wartość na klucz. Wersje sprzed D1.1 (dla `studySiteItems` — sprzed 2026-11-23) przy zmianie pozycji gubią pola, które dodała nowsza.
  - Wersja sprzed 9020901 kasowała każde nieznane pole wpisu. Tego nie da się naprawić bez aktualizacji tamtego telefonu.
- **Testy:** `src/lib/dataCompat.test.ts`: starsza wersja to drugi `Y.Doc` piszący surowymi operacjami Yjs tak jak dawny kod (tytuł i lista, odczyt terminu, oba wyjątki przypomnień, wpis z kluczami z 9020901, karta i wpis z polem z nowszej wersji). Do tego `src/lib/study/yStudy.test.ts` (pole nieznane we wpisie).
- **Commit:** d3acad4 (2026-11-03); wcześniej 9020901 (2026-10-22).

## Synchronizacja — przekaźnik E2E, serwer (Faza 2, 2026-10-23)

- **Co robi:** zmiany w notatkach docierają na drugie urządzenie także wtedy, gdy pierwsze jest wyłączone. Serwer przechowuje tylko zaszyfrowany log aktualizacji Yjs i nie zna treści ani kodu synchronizacji. Sam serwer nie ma jeszcze klienta w aplikacji (patrz „Ograniczenia”).
- **Gdzie jest:** `relay-server/` — `core.js` (czysta logika: tokeny, liczniki, snapshot, limity, sprzątanie), `storage.js` (dziennik na dysku, F2), `config.js` (zmienne środowiska, S4.3/S4.4), `server.js` (HTTP i WebSocket), `Dockerfile`, `README.md` (model zagrożeń, protokół, limity, układ danych).
- **Jak działa:**
  - Pokój ma identyfikator 64 znaki hex (klient wylicza go z kodu). Pierwszy zapis zakłada pokój i ustawia jego token; serwer przechowuje tylko `SHA-256(token)` (`hashToken`, porównanie `timingSafeEqual` w `tokenMatches`).
  - Wpisy mają rosnące numery `seq` (`appendEntry`). `GET updates?since=n` zwraca wpisy > n, najwyżej 500 na stronę (`entriesSince`, `hasMore`).
  - Snapshot (`applySnapshot`) zastępuje wpisy ≤ `upto` jednym wpisem o numerze `upto`; numeracja się nie cofa, więc klient na `upto` nie pobiera nic nowego.
  - Token idzie w nagłówku `Authorization: Bearer` albo w pierwszej wiadomości WS (`subscribe`), nigdy w adresie.
  - WS (`/ws`) tylko powiadamia `{type:"updated", last}` po zapisie; treść zawsze idzie przez GET.
  - **Dane na dysku (F2, Z-15.8, 2026-11-17):** katalog na pokój, `openStorage` w `storage.js`:
    - `rooms/<id>/room.json` — tożsamość: skrót tokenu, epoka, data założenia. Zapisywana raz, atomowo, przed pierwszą linią dziennika.
    - `meta.json` — liczniki `last`, `count`, `bytes`, `touched`, `snapshot`, `logSize`, zapisywane z opóźnieniem 1 s w kolejce pokoju.
    - `log.ndjson` — jeden wpis na linię, tylko dopisywany.
    - `blobs/<id>/<bid>` — bez zmian.

    Kolejne operacje:
    - **Dopisanie** to `appendFile` jednej linii, dopiero potem odpowiedź i `notify`. Potwierdzony wpis jest na dysku — dawniej było do 500 ms okna utraty. Błąd zapisu przycina dziennik do poprzedniej długości, żeby pół linii nie zepsuło następnej.
    - **Migawka** to nowy dziennik w pliku tymczasowym, zmiana nazwy i od razu liczniki.
    - **Kolejka na pokój** (łańcuch obietnic) obejmuje zapisy, odczyty i liczniki; różne pokoje nie czekają na siebie.
    - `core.js` sprawdza wpis (`prepareAppend`) bez zmiany pokoju i zatwierdza go (`commitAppend`) dopiero po zapisie. Liczniki są przyrostowe — `roomBytes()` nie jest już liczone przy każdym dopisaniu.
  - **Po awarii:** dziennik jest źródłem prawdy. Brak `meta.json` albo `logSize` niezgodny z rozmiarem pliku powoduje odtworzenie liczników z dziennika. Urwana linia — także pełny JSON bez znaku nowej linii — albo linia uszkodzona jest odrzucana, a dziennik zapisywany od nowa z poprawnych wpisów. Pliki `*.tmp` są usuwane przy starcie. Bloby są zawsze liczone z katalogu.
  - **Pamięć:** przy starcie tylko `room.json` i `meta.json`. Wpisy trafiają do pamięci podręcznej LRU (`CACHE_BYTES`, 256 MB). Pokój większy niż ćwierć limitu jest czytany strumieniem (`readline`).
  - **Limity łączne:** `MAX_TOTAL_BYTES` (20 GB dzienników i blobów) i `MIN_FREE_BYTES` (512 MB wolnego miejsca, `statfs` najwyżej co 5 s, w międzyczasie zapas odliczany lokalnie). Przekroczenie daje `507`.
  - **Młody pokój** (bez migawki, z jednym wpisem) wygasa po dobie bez zapisu (`expiredRooms`, `YOUNG_TTL_MS`). Pokój zniknięty za wcześnie nie gubi danych: klient dostaje `404`, zakłada pokój z nową epoką i wysyła pełny stan.
  - **Migracja:** przy pierwszym starcie stary `relay.json` jest rozbijany na katalogi (dziennik, tożsamość, liczniki — w tej kolejności) i zostaje jako `relay.json.bak`.
  - **Konfiguracja (S4.3, S4.4, `config.js`):** serwer nie startuje, gdy:
    - `NODE_ENV=production`, a `ALLOWED_ORIGINS` jest puste albo zawiera `*`;
    - `TRUST_PROXY=1` nie ma `TRUSTED_PROXY`;
    - zmienna liczbowa nie jest dodatnią liczbą całkowitą.

    `X-Forwarded-For` jest brany tylko z połączeń od adresu `TRUSTED_PROXY`, i to ostatni wpis (`clientIpOf`). Przy `TRUST_PROXY=0` i nagłówku serwer raz ostrzega w logu. `MAX_ROOMS` i `MAX_ROOM_BLOB_BYTES` nadpisują `LIMITS`.
  - **Epoka pokoju (Z-5.5, 2026-11-17):** pokój dostaje przy założeniu losową `epoch` (32 znaki hex, `newEpoch` w `core.js`), zapisaną w magazynie. Serwer zwraca ją w `GET updates`, `POST updates`, `PUT snapshot` i w wiadomościach WS `ready` / `updated`. Pokój usunięty i założony od nowa ma inną epokę i numery od 1. Zapis z polem `epoch` innym niż epoka pokoju (albo do pokoju, którego nie ma) dostaje `412` (`epochConflict`) — różnica ze starego pokoju nie zakłada nowego. Zapis bez `epoch` przechodzi jak dawniej (stary klient, klient po resecie). `PUT snapshot` nie zakłada już pokoju (`404`). Pokoje sprzed epok dostają ją w `cleanStore` przy wczytaniu, a serwer od razu zapisuje magazyn, żeby restart nie nadał innej. Dla nieznanego pokoju `412` idzie tylko przy poprawnym kształcie identyfikatora i tokenu.
- **Decyzje:**
  - Zamiast SQLite (zależność natywna albo niestabilne `node:sqlite`) dziennik plikowy. Dane to nieprzezroczyste ciągi w kolejności, a bloby już leżą jako pliki.
  - Tożsamość pokoju jest w osobnym `room.json`, nie w `meta.json`, jak przewidywał plan. Brak `meta.json` nie gubi wtedy pokoju, bo bez skrótu tokenu nie dałoby się go otworzyć. Epoka też jest w `room.json` — jest niezmienna do usunięcia pokoju.
  - Bez `fsync` przy dopisaniu: wpis przeżywa zabicie procesu, a awarię systemu operacyjnego klienci nadrabiają ponowieniem albo pełnym stanem.
  - Limity w `LIMITS` (`core.js`): wpis i migawka 22 400 000 znaków (≈ 16 MB; treść żądania tych dwóch tras ma własny limit `MAX_ENTRY_BODY` w `server.js`), pokój 50 MB i 5000 wpisów, 5000 pokoi, TTL pokoju 180 dni bez zapisu.
- **Przegląd `security-reviewer` (2026-11-17) — poprawione:**
  - **H1:** przerwany odczyt strumieniem zostawiał otwarty deskryptor pliku (`rl.close()` nie zamyka strumienia) — `input.destroy()`.
  - **H2:** migawka z `upto` poniżej pierwszego zachowanego wpisu niczego nie zastępowała, tylko dokładała do 22 MB — pokój rósł bez limitu aż do braku pamięci. Teraz w `applySnapshot` jest `409` i limit `MAX_ROOM_CHARS` na wynik migawki. Strona odczytu ma budżet `PAGE_CHARS` (32 mln znaków, co najmniej jeden wpis; `pageCollector` w `core.js`), a dziennik jest zapisywany strumieniem (`writeLogAtomic`), bez sklejania w jeden ciąg.
  - **H3:** treść do 22 MB była czytana przed sprawdzeniem pokoju i tokenu. Teraz kolejność jest taka:
    - najpierw identyfikator, token i limit nowych pokoi;
    - potem `Content-Length`;
    - potem budżet treści w locie (256 MB łącznie → `503`) i najwyżej 4 równoległe wysyłki z jednego adresu (`429`).

    Rozliczenie wysyłki następuje dokładnie raz, także przy zerwanym połączeniu.
  - **H4:** obraz Dockera nie kopiował `config.js`, więc nie startował — test `dockerfile.test.js` sprawdza, że `COPY` obejmuje wszystkie lokalne importy serwera.
  - **M1:** spóźniona operacja na usuniętym (albo założonym od nowa) pokoju mogła wskrzesić pokój albo nadpisać tożsamość nowego. Każda operacja z kolejki sprawdza teraz `store.rooms[id] === room` (inaczej `404`), a wysyłka bloba ustala pokój ponownie po odczycie treści.
  - **M2:** limit blobów pokoju jest sprawdzany w kolejce (`blobFits` w `putBlob`).
  - **M3:** usuwanie pokoju to zmiana nazwy na `trash/…`, a dopiero potem `rm`. Przy starcie znikają: kosz, katalogi pokoi bez tożsamości i bloby bez pokoju. Nowy pokój nie dokleja się do resztek starego dziennika.
  - **M4:** limity na adres liczą IPv6 jako prefiks /64 (`limitKey`). Mapy liczników mają górną granicę 100 tys. adresów i są sprzątane co minutę.
  - **M5:** obraz ma `NODE_ENV=production`, więc wymaga `ALLOWED_ORIGINS`.
  - **L1–L5:**
    - wygasanie sprawdzane ponownie w kolejce;
    - uszkodzony `relay.json` → `relay.json.corrupt-<czas>`, a istniejący `.bak` nie jest nadpisywany i już przeniesione pokoje nie są nadpisywane;
    - limit łączny rezerwowany przed `await`;
    - logi bez pełnych ścieżek (kod błędu i 8 znaków id);
    - obsługa błędu strumienia bloba.
  - **Zostaje (informacyjnie):** WebSocket nie sprawdza `Origin` (subskrypcja i tak wymaga tokenu); `TRUSTED_PROXY` bez CIDR, jeden pośrednik.
- **Ograniczenia i pułapki:**
  - Pokój z `openRoomForWrite` ma tablicę `entries`. `storage.js` usuwa ją przy pierwszym zapisie, bo inaczej `commitAppend` trzymałby cały dziennik w pamięci (test obciążenia to złapał: 119 MB zamiast 9 MB).
  - S4.2 (`deploy/`, Caddy, obrazy przypięte do skrótu) czeka na decyzję SE-1 o hostingu. S4.9 (serwer sygnałów: root, brak pliku blokady) czeka na SE-4.
  - Nowy moduł serwera trzeba dopisać do `COPY` w `Dockerfile` — pilnuje tego `relay-server/dockerfile.test.js`.
- **Testy:**
  - `relay-server/core.test.js` — logika.
  - `storage.test.js`:
    - awarie: urwana linia, pełny JSON bez znaku nowej linii, brak `meta.json`, nieaktualne liczniki, plik tymczasowy po migawce;
    - migracja, migawka, stronicowanie, odczyt strumieniem, limit LRU, limit łączny, mało miejsca na dysku, równoległe dopisania, usuwanie, wygasanie młodych pokoi;
    - obciążenie 200 × 2000: dopisanie 0,43 ms na początku i na końcu, sterta 9 MB po GC (`LOAD=1 node --expose-gc --test storage.test.js`).
  - `config.test.js`.
  - `server.test.js` — prawdziwy proces: odporność, limity, odmowa startu przy złej konfiguracji.
  - Bez zmian protokołu przechodzą `src/lib/sync/relayServer.integration.test.ts`, `relayBlobs.integration.test.ts`, `relayProvider.test.ts` i `e2e/relay-sync.spec.ts`.
- **Commit:** `adfb099` (2026-10-23); F2 i S4.3/S4.4 — w commicie z tym wpisem, 2026-11-17.

## Synchronizacja — przekaźnik E2E, klient (Faza 2, 2026-10-23)

- **Co robi:** z włączonym przekaźnikiem zmiany w notatkach (cały `yjsStore.doc`: notatki, teksty, metadane) idą na serwer zaszyfrowane i wracają na inne urządzenia, nawet gdy nadawca jest już wyłączony. Działa równolegle z P2P. Bez adresu przekaźnika nic się nie zmienia. Obrazy i załączniki nadal idą tylko P2P.
- **Gdzie jest:**
  - `src/lib/sync/relayKeys.ts`: `deriveRelayKeys(code)` (PBKDF2 → `roomId`, `token`, klucz danych), `sealBytes` / `openBytes`, `relayAad(roomId)`.
  - `src/lib/sync/relayProvider.ts`: `RelayProvider` (kolejka wysyłania, pobieranie stronicowane, kursor, snapshot, WebSocket, ponawianie). Interfejs `RelayStore` (trwałość) i `RelayStatus`.
  - `src/lib/sync/relayRuntime.ts`: `startRelay(code)` / `stopRelay()` (wołane z `yjsSync.ts` w `connect()` i `disconnectProvider()`), `validRelayUrl`, `getRelayUrl` / `setRelayUrl` (klucz `localStorage` `kaczy.relay.v1`), `useRelayView()` (status dla UI), magazyn w IndexedDB (`kaczy-relay`).
  - `src/components/SyncSettings.tsx`: sekcja „Przekaźnik” (`RelayServer`, `relayStatusText`).
- **Jak działa:**
  - Klucze: `kod → PBKDF2-SHA-256 (sól stała, 200 000 iteracji) → master`. Z `master`: `roomId` = SHA-256(`notki-relay-room:` ‖ master) w hex, `token` = HKDF(`notki-relay-auth-v1`), klucz danych AES-GCM = HKDF(`notki-relay-data-v1`), niewyodrębnialny. PBKDF2 jest po to, że kod ma ok. 59 bitów i sam HKDF nie utrudniłby zgadywania operatorowi serwera.
  - Wysyłanie: `doc.on("update")` zbiera zmiany (poza własnym źródłem `origin`), co 1 s scala je (`Y.mergeUpdates`), szyfruje i `POST`. Zmiany są w `RelayStore` do chwili potwierdzenia, więc przeżywają zamknięcie karty. Przy schowaniu karty wysyłane od razu (`flushNow`), przy powrocie `sync()`.
  - Pobieranie: `GET since=kursor`, po 500 wpisach stronami, każdy wpis odszyfrowywany i stosowany `Y.applyUpdate` z własnym `origin`. Kursor zapisywany po każdej stronie.
  - Numer swojego wpisu: jeśli serwer przydzielił `kursor + 1`, dokument już go ma, więc kursor rośnie bez pobierania.
  - Snapshot: po 500 wpisach od poprzedniego snapshotu wysyłany jest `Y.encodeStateAsUpdate(doc)` z `upto = kursor`. Obejmuje też lokalne, jeszcze niewysłane zmiany; ich późniejsze wysłanie jest bez skutku.
  - WebSocket (`/ws`): po `subscribe` serwer wysyła `ready` (wtedy `sync()`) i `updated` (wtedy pobranie, gdy `last > kursor`). Po zamknięciu ponawianie 2 s, 4 s … do 60 s.
  - Wszystkie operacje sieciowe idą jedną kolejką (`run`), więc nie przeplatają się.
  - **Epoka pokoju (Z-5.5, 2026-11-17, `e7c64af0`):** `RelayState.epoch` mówi, którego pokoju dotyczą `cursor`, `compactedAt` i `sv`. Gdy pokój zniknął z serwera (usunięcie z innego urządzenia, 180 dni bez zapisu, utrata danych serwera) i powstał od nowa, klient robi reset (`resetRoom`): kursor na zero, `sv` znika, do wysłania idzie pełny stan dokumentu, potem pobranie od zera. Wcześniej wysyłał samą różnicę, której nowe urządzenie nie mogło zastosować, a sam nie widział wpisów o numerach niższych niż stary kursor — przy stanie „online”. Reset wyzwalają: inna epoka w odpowiedzi `GET` (`roomReplaced`), `412` z `POST` albo migawki, `404` z migawki, `404` z `GET`, gdy klient pamięta jakiś pokój (`knowsRoom`), oraz — dla stanu albo serwera sprzed epok — `last` mniejsze od kursora i numer własnego wpisu nie większy od kursora. Stan sprzed epok przy `last ≥ kursor` przyjmuje epokę bez resetu. `404` z `GET` bez zapamiętanego pokoju to pusty pokój i stan „online”, nie „offline” (R-17). Wiadomość WS `updated` z inną epoką też uruchamia pobranie. Zbędny reset kosztuje tylko transfer, bo ponowne wysłanie pełnego stanu jest w Yjs bez skutku.
  - Pułapki epoki: stan sprzed epok nie rozpozna pokoju, który po odtworzeniu przegonił stary kursor (dotyczy tylko pierwszego połączenia po aktualizacji). Urządzenie czekające w pustym pokoju nie ponawia już pobierania co kilka sekund — budzi je gniazdo (ponawiane do 60 s), powrót do karty albo zdarzenie `online`. „Odłącz i usuń z przekaźnika” nie powstrzyma innego, nadal połączonego urządzenia przed założeniem pokoju od nowa pełnym stanem. Reset nie sprawdza jeszcze limitu wpisu (Z-5.6).
  - **Po resecie najpierw pobranie, potem wysyłka (2026-11-17):** `resetRoom` wstawia do kolejki `sync()` (pobranie + wysyłka), nie samą wysyłkę. Wcześniej po `412` przy wysyłce pełny stan szedł do pokoju, zanim urządzenie zobaczyło, co w nim jest — odtwarzało to dane w pokoju, który ktoś celowo wycofał. Koszt: jedno dodatkowe `GET` na reset.
  - **Bramka wysyłki `canSend` (2026-11-17):** opcja `RelayOptions.canSend?: () => boolean`, pytana w `flushTask` (przed zebraniem kolejki i drugi raz tuż przed żądaniem) oraz w `compactTask` (migawka też niesie dane). `false` wstrzymuje wysyłkę bez gubienia kolejki; pobieranie działa. Dziś nikt jej nie ustawia — to przygotowanie pod wymianę kodu (`docs/plan-wymiana-kodu.md` §3.5, I-3 i I-7): znacznik „kod zmieniony” przychodzi jako zwykły wpis i musi zatrzymać urządzenie, zanim cokolwiek wyśle. Pułapka: po zdjęciu blokady nic samo nie budzi wysyłki — wołający musi wywołać `sync()`.
  - **`settle()` (2026-11-17):** wysyła zaległości i czeka, aż kolejka zadań się opróżni; `true` = serwer potwierdził wszystko. Tylko dla operacji jednorazowych (zasilenie nowego pokoju przy wymianie kodu) i testów.
- **Wymiana kodu z wyrzuceniem urządzenia — logika bez podpięcia (S2.1, 2026-11-17):**
  - **Co robi:** na razie nic widocznego — to gotowa maszyna kroków i operacje na przekaźniku; ekran (Z-15.3) i podpięcie w `yjsSync.ts` czekają na kod długi (Z-15.1, Z-15.2). Projekt: `docs/plan-wymiana-kodu.md` §3.
  - **Gdzie:** `src/lib/sync/rekey.ts` — znacznik (`buildMarkerUpdate`, `readMarkers`, `stoppingMarker`, `pruneMarkers`, `rekeyTag`), zapis wymiany (`RekeyRecord`, `parseRekeyRecord`, `canCancelRekey`, `canSkipMarker`, `withDevicePaired`, `rekeyFinished`), sterownik (`prepareRekey`, `runRekey`, `cancelRekey`, porty `RekeyPorts`). `src/lib/sync/rekeyRelay.ts` — `seedRekeyRoom`, `postRekeyMarker`, `retireRekeyRoom`, `dropRekeyRoom`.
  - **Jak działa:** znacznik to wpis `rekey:<id>` → `{v:1, tag, at}` w mapie Yjs `syncControl`; `tag` = 16 bajtów SHA-256 z nazwy pokoju v3 starego kodu, więc dotyczy tylko urządzeń z tym kodem. Aktualizacja znacznika powstaje w osobnym, pustym `Y.Doc` — nie ma poprzedników i wchodzi na dowolnie stary stan odbiorcy. Kroki: `prepared` → `seeded` (pełny stan w nowym pokoju, sprawdzony pobraniem od zera do dokumentu pomocniczego) → `marked` (znacznik w dokumencie i wprost w starym pokoju) → `switched` (ustawienia na nowy kod) → `done` (stary pokój usunięty i założony od nowa z samym znacznikiem — „nagrobek”, po 7 dniach albo na żądanie). Krok zapisuje się po udanym działaniu, każde działanie jest powtarzalne, więc `runRekey` można wołać dowolnie często (start, powrót sieci, przycisk).
  - **Pułapki:** anulować wolno tylko przed znacznikiem — ślad `markStarted` jest zapisywany przed nałożeniem znacznika, bo ten rozchodzi się natychmiast. Znacznik jest niezaufany: zły kształt jest pomijany, oglądanych jest najwyżej 200 wpisów mapy. `seedRekeyRoom` używa zwykłego `RelayProvider` na głównym dokumencie z magazynem nowego pokoju — dzięki temu późniejsze połączenie nowym kodem nie wysyła całości drugi raz. Wpis znacznika idzie bez `epoch`, żeby wszedł także do pokoju założonego od nowa. Nagrobek może przegrać wyścig z urządzeniem, które akurat wysyła — trzy próby, potem błąd i ponowienie przy następnym uruchomieniu; po 30 dniach koniec z zapisanym błędem. Nowe pliki importują `yjs` bezpośrednio (wyjątek w `eslint.config.js`).
  - **Testy:** `src/lib/sync/rekey.test.ts` (znacznik na starym stanie, czyszczenie, kolejność kroków, anulowanie, ponowienie, pominięcie, bez przekaźnika, nieudany zapis, druga karta); `relayServer.integration.test.ts`, blok „wymiana kodu” (zasilenie i powtórzenie, znacznik zatrzymuje wysyłkę, nagrobek i spóźnione urządzenie). Pełna lista przypadków: Z-15.4.
  - **Commit:** `5aadafc5`, 2026-11-17.
- **Decyzje i ograniczenia:**
  - Błędy: sieć/5xx/429 → status `offline`, ponawianie. 401/403 → `error` („Serwer nie przyjął kodu”), bez ponawiania. Wpis, którego nie da się odszyfrować → `error`, kursor nie idzie dalej. Nie nadpisujemy danych ani nie pomijamy wpisu po cichu.
  - Wpis albo snapshot większy niż limit serwera (16 MB) daje stan „błąd” z komunikatem (HTTP 413, bez ponawiania). Brak dzielenia wpisów. Test: `relayServer.integration.test.ts` (dokument 2 MB od zera).
  - Powiadomienie „Zmiana z innego urządzenia” (toast w `yjsSync.ts`) działa tylko dla P2P, bo sprawdza `origin` providera P2P.
  - Pierwsze połączenie wyprowadza klucze (PBKDF2, ok. 200 000 iteracji) — chwila na telefonie przy każdym starcie synchronizacji.
  - Adres przekaźnika tylko `https://` (albo `http://localhost` do testów); w `localStorage` ze względu na prostotę, nie jest sekretem.
- **Testy:**
  - `relayProvider.test.ts` (10 testów): dwa `Y.Doc` z atrapą serwera o tym samym protokole. Wymiana, nowe urządzenie z historią, zapis offline, kolejka po restarcie, zły klucz danych, zły token, kompaktowanie po 500 wpisach, `stop()`.
  - `relayServer.integration.test.ts`: klient ↔ prawdziwy `relay-server/server.js` jako proces. Wymiana, izolacja pokoi, odrzucenie złego tokenu, dokument 2 MB; epoka: pokój usunięty między zapisami (trzecie urządzenie dostaje całość, wszystkie przechodzą na nową epokę), pokój odtworzony z `last` powyżej starego kursora, pusty pokój bez stanu „offline”. Reset i bramka: pokój wycofany i założony od nowa z jednym wpisem zatrzymującym — urządzenie z zaległą zmianą po `412` pobiera ten wpis i nie wysyła nic (w pokoju zostaje jeden wpis), a kolejka czeka.
  - Klucze (`deriveRelayKeys`) — dwa testy w `relayProvider.test.ts`; `validRelayUrl` — `relayRuntime.test.ts`.
- **Testy przycisku i powiadomienia (dopisane później):** przycisk „Testuj” (`checkRelay` w `relayRuntime.ts`: `GET /health`, bez kodu i tokenu; zwraca liczbę pokoi albo powód błędu, nie wysyła zapytania pod niepoprawny adres) i powiadomienie „Zmiana z innego urządzenia” (`onRemoteChange` w `RelayProvider`: tylko gdy Yjs realnie zmienił dokument po pobraniu, nie przy echu własnego wpisu; w `relayRuntime.ts` co 30 s, tylko na widocznej karcie). Testy: `relayRuntime.test.ts` (`checkRelay`), `relayProvider.test.ts` (powiadomienie), `e2e/relay-settings.spec.ts` (3 testy: walidacja i zapis, wyczyszczenie, „Testuj” pod nieosiągalnym adresem).
- **Commit:** `1207987` (2026-10-23); dodatki w osobnym commicie.
- **Wdrożenie:** decyzja 2026-10-23 — przekaźnik zostaje lokalny (bez hostingu). Adres wpisuje się w Ustawieniach → Sync → Przekaźnik; kod nie zawiera adresu serwera.

## Synchronizacja — obrazy i załączniki przez przekaźnik (Faza 2, 2026-10-23)

- **Co robi:** obrazy i załączniki notatek docierają na inne urządzenie także wtedy, gdy nadawca jest wyłączony (przy włączonym przekaźniku). Działa obok P2P i nie zmienia tego, co już jest.
- **Gdzie jest:**
  - `src/lib/sync/relayBlobs.ts`: `RelayBlobs` (przebieg: wysyłanie brakujących blobów przez HEAD → PUT, pobieranie referencji bez lokalnego obrazu przez GET), `packBlob` / `unpackBlob` (nagłówek MIME + bajty).
  - `src/lib/sync/relayKeys.ts`: `blobIdOf` (HMAC z klucza `notki-relay-blobid-v1` nad SHA-256 treści), `sealRaw` / `openRaw`, `blobAad`.
  - `src/lib/sync/relayRuntime.ts`: `scheduleBlobs` / `runBlobs` — przebieg przy starcie, 3 s po zmianie notatek (`notesMap.observeDeep`) i po zmianie z przekaźnika; jeden przebieg naraz.
  - `relay-server/core.js` (`validBlobId`, `blobFits`, limity), `relay-server/server.js` (`handleBlob`, pliki w `DATA_DIR/blobs`).
- **Jak działa:**
  - Referencje: `yjsStore.syncableRefs()` (te same co w P2P). Lokalny obraz, którego serwer nie ma → PUT. Referencja bez lokalnego obrazu → GET, odszyfrowanie, `putBytes(bytes, type, hash)`: obraz o złym SHA-256 jest odrzucany przez `imageStore`.
  - Serwer widzi tylko identyfikator (HMAC — nie da się sprawdzić, czy ma znany obraz, bez kodu), rozmiar i zaszyfrowane bajty. Typ MIME jest w zaszyfrowanej treści.
  - Odczyt i zapis wymagają tokenu pokoju; GET obcego kodu daje 404 (inny pokój).
- **Ograniczenia:**
  - Bloby większe niż 24 MB (zaszyfrowane) są odrzucane; obraz lokalny nadal działa, tylko nie wyjdzie na serwer.
  - Pierwszy przebieg po starcie sprawdza każdą referencję HEAD-em; przy wielu obrazach to dużo małych zapytań. Cache `known` obowiązuje tylko w sesji.
  - Nieudane przebiegi są liczone i zapisywane jako ostrzeżenie w diagnostyce, bez ponawiania poza następnym wywołaniem.
- **Testy:**
  - `relayBlobs.integration.test.ts` (5 testów): pakowanie, niebezpieczny MIME, wysyłka A → B bajt w bajt bez ponownego wysłania, obcy kod nie czyta, brak bloba = brak błędu.
  - `relay-server/core.test.js` (+3 testy: identyfikator, limity pojedynczy i pokoju, czyszczenie magazynu).
  - Smoke na uruchomionym serwerze: PUT, ponowny PUT, HEAD, GET bajt w bajt, zły token 403, brak 404, zły identyfikator 400, brak tokenu 401.
- **Keepalive (dopisane po commicie blobów):** `RelayProvider.setHidden(hidden)` — karta schowana: `flushNow` i ping `{"type":"ping"}` co `KEEPALIVE_MS` (20 s) na otwartym gnieździe; karta wróciła: ping zatrzymany i `sync()`. Serwer ignoruje wiadomości po subskrypcji, więc ping nie wymaga zmian po stronie serwera. Test: `relayProvider.test.ts` (fałszywe timery tylko dla interwałów).
- **Zmiany przed startem i kolejny start (dopisane):** `RelayProvider.start()` dokłada do kolejki różnicę `Y.encodeStateAsUpdate(doc, sv)`, gdzie `sv` to wektor stanu z ostatniego udanego wysłania (`RelayState.sv`, w IndexedDB). Zmiany zrobione przed startem nie przechodzą przez nasłuch `update`, więc bez tego zostałyby lokalnie. Po każdym udanym `POST` zapisujemy `sv` z chwili przed zakodowaniem wysyłki. Testy: `relayProvider.test.ts` (sprzed startu; kolejny start wysyła tylko różnicę).
- **Błąd znaleziony w e2e:** `this.fetchFn = opts.fetch ?? fetch` — natywny `fetch` wołany jako metoda obiektu rzucał „Illegal invocation”, a błąd był łapany jako „offline” i ponawiany, więc nic nie było widać. Teraz `fetch.bind(globalThis)` w `relayProvider.ts` i `relayBlobs.ts`. Testy jednostkowe nie wykryły tego, bo wstrzykują własny `fetch`.
- **E2E z prawdziwym serwerem:** `playwright.config.ts` ma drugi `webServer` (`node server.js` w `relay-server/`, port 4466, `DATA_DIR` w katalogu tymczasowym; wymaga `npm install` w `relay-server/`). `e2e/relay-sync.spec.ts` (2 testy): A zapisuje notatkę i zamyka się, B z tym samym kodem ją dostaje; obcy kod nie dostaje. Czeka na POST wywołany po zapisie — pierwszy POST po starcie niesie stan początkowy.
- **Ograniczenie:** zamknięcie karty w ciągu sekundy od zmiany może przerwać wysyłkę. Zmiana zostaje w kolejce IndexedDB i wyśle się przy następnym uruchomieniu; drugie urządzenie jej nie zobaczy, dopóki pierwsze nie wróci online.
- **Commit:** `12dd69b` (bloby), `0f04d0a` (keepalive); poprawki z e2e w commicie poniżej.

## Sync — status przekaźnika z kropką (poprawka wizualna, 2026-10-23)

- **Co robi:** przy statusie przekaźnika w Ustawieniach → Sync jest kropka w kolorze stanu: zielona (połączono), szara pulsująca (łączenie, tylko przy dozwolonym ruchu), żółta (brak połączenia, ponowi samo), czerwona (błąd), szara (wyłączony). Tekst zostaje i mówi to samo, więc kolor nie jest jedyną informacją.
- **Gdzie jest:** `src/components/SyncSettings.tsx` — `relayDotClass` (obok `relayStatusText`), w komponencie `RelayServer`. Kolory z tokenów `success`, `warning`, `destructive` i `muted-foreground`.
- **Testy:** `e2e/relay-settings.spec.ts` (3 testy, bez zmian). Zrzut sprawdzony na komputerze i telefonie.
- **Naprawa testów e2e (nie kodu aplikacji):** `composer.spec.ts` — przycisk „Usuń przypomnienie” jest dwa razy, asercja na pierwszym widocznym; `resilience.spec.ts` — komunikat „Nie zapisano” jest dwa razy (widoczny i dla czytnika), asercja na pierwszym.

## Synchronizacja: baner starszej wersji w całej aplikacji (P3.2)

- **Co robi.** Gdy w grupie synchronizacji jest urządzenie ze starszą wersją aplikacji, na górze każdego widoku pojawia się ostrzeżenie „<urządzenie> ma starszą wersję aplikacji — część danych może być tam niewidoczna. Zaktualizuj go.” (dotąd tylko w Ustawieniach → Sync). „Szczegóły” otwiera Sync, „×” chowa baner dla tego zestawu urządzeń — nowe starsze urządzenie pokaże go znowu.
- **Gdzie.** `src/components/sync/OlderDeviceBanner.tsx` (klucz ukrycia `kaczy.olderDeviceBanner.v1` = id i numer formatu starszych urządzeń), montowany na początku treści w `src/pages/Index.tsx`. Wykrywanie: `olderDevices` z `src/lib/formatSchema.ts`, stan z `useSyncState` (już ładowany w nagłówku, więc bez wpływu na główną paczkę).
- **Testy.** Vitest: `src/components/sync/OlderDeviceBanner.test.tsx` (brak banera przy aktualnych, pokazanie, „Szczegóły”, ukrycie na stałe dla zestawu, ponowne pokazanie przy nowym urządzeniu). E2E: brak — wymagałoby drugiego urządzenia ze starszą wersją.

## Pewność danych — blokada kart, błąd zapisu, zapełnienie magazynu (Q1.1, Q1.5, Q1.2 planu QoL, 2026-11-15)

- **Co robi:** migracje przy starcie i import kopii wykonuje jedna karta naraz (druga czeka). Błąd zapisu pokazuje stały komunikat „Nie zapisano — zrób kopię, zmiany są tylko w tej karcie”. W Ustawieniach → Kopia i dane pojawia się ostrzeżenie, gdy zajęte jest ponad 80% miejsca.
- **Gdzie jest:** `src/lib/tabLock.ts` (`withExclusiveLock`, `MIGRATION_LOCK`), użyte w `yjsStore.ts` (`ready()`) i `exportNotes.ts` (`restoreFullBackup` → `restoreFullBackupLocked`); `src/components/OfflineStatus.tsx` (etykieta błędu); `src/lib/storagePersistence.ts` (`storageFill`, `storageWarning`) i `settings/BackupSettings.tsx`.
- **Jak działa:** `navigator.locks.request("notatnik-migracja", exclusive)`; bez Web Locks kolejka obietnic w obrębie jednej karty. Druga karta zastaje flagi migracji w `localStorage`, więc nic nie dubluje. Stan błędu zapisu (`saveStatus.ts`, faza `error`) istniał wcześniej i blokuje zamknięcie karty.
- **Ograniczenia:** nie ma komunikatu „trwa w innej karcie” — druga karta po prostu czeka. Ostrzeżenia „magazyn nietrwały po 7 dniach” nie dodano (jest tylko status trwałości).
- **Testy:** `src/lib/tabLock.test.ts`, `src/lib/storagePersistence.test.ts`, istniejące `saveStatus.test.ts`.
- **Commit:** zob. `git log` (2026-11-15).

## Pewność danych — kilka kart naraz: karta prowadząca przekaźnik, odśmiecanie obrazów (Z-7, Z-6, 2026-11-16)

- **Co robi:** przy kilku otwartych kartach przekaźnik prowadzi jedna z nich, a pozostałe pokazują w Ustawieniach → Sync „Synchronizuje inna karta tej przeglądarki”. Po zamknięciu prowadzącej rolę przejmuje następna. Obrazy odśmieca jedna karta naraz. Zdjęcie dodane ponownie po dłuższym czasie nie znika, a obraz pobrany w jednej karcie jest od razu widoczny w pozostałych.
- **Gdzie jest:**
  - `src/lib/tabLock.ts`: `holdTabRole(nazwa, onAcquire, onWait)` (rola trzymana do zwolnienia albo zamknięcia karty), `withLockIfFree(nazwa, fn)` (uruchom tylko, gdy wolne), stałe `RELAY_ROLE`, `GC_LOCK`.
  - `src/lib/sync/relayRuntime.ts`: `startRelay` prosi o rolę, właściwy start jest w `lead`; `RelayView.elsewhere`; `stopRelay` oddaje rolę.
  - `src/lib/imageStore.ts`: `putBytes` (odnowienie daty), `collectGarbage` z `deleteIfStale`, kanał `kaczy-images:<baza>`.
  - **Trwałe usunięcie a odśmiecanie (Z-6.5, 2026-11-18):** `deleteNote` i „Opróżnij kosz” (`src/hooks/useNotes.ts`) przed usunięciem odnawiają datę plików notatki (`yjsStore.noteFileRefs` → `images.touch` w `src/lib/imageStore.ts`, jedna transakcja, brak pliku pomijany). Karencja 7 dni liczy się od usunięcia, więc „Cofnij” oddaje notatkę z obrazami nawet przy starym pliku. Automatyczne sprzątanie kosza po 30 dniach tego nie robi (nie ma „Cofnij”). Test: „Z-6.5: touch…” w `imageStore.test.ts`.
  - **Test-strażnik (Z-6.1, Z-6.2, 2026-11-18):** `src/lib/imageWriters.test.ts`. Część statyczna porównuje pliki z `putBlob`/`putBytes`/`putDataUrl` z zatwierdzoną mapą `WRITERS` (plik → gdzie leży odwołanie); nowy plik zapisujący obrazy wywala test, dopóki nie dopisze się czytelnika. Część dynamiczna tworzy obiekt przez publiczne API (notatka z obrazem i załącznikiem, wpis dziennika, usterka „po naprawie”, dokument i podpis budowy, analiza planu), przesuwa zegar za karencję i sprawdza, że `collectGarbage(referencedImages())` nic nie usuwa; przypadek kontrolny potwierdza, że obraz bez czytelnika znika. Zablokowany skarbiec nie wymaga osobnego przypadku: `lockNote` odmawia notatce z plikami (`has-files`). Punkt Z-6.3 (jedno źródło listy) świadomie nie zrobiony: `journalImageRefs` dokłada stan lokalny urządzenia (szkic, otwarta edycja, stary zapis z localStorage), który wymaga modułów spoza paczki startowej; `yjsStore` ich nie importuje, więc `useNotes` dalej łączy obie listy.
- **Skarbiec i kopia (Z-7.1, Z-7.3, 2026-11-18):** `changePassword` i `resetPasswordWithRecovery` w `src/lib/privateNotes.ts` idą pod `withExclusiveLock(VAULT_LOCK)` (`notatnik-skarbiec`) i czytają nagłówek skarbca dopiero w blokadzie — dwie karty nie wygenerują dwóch kluczy danych. Automatyczna kopia do pliku (`src/hooks/useBackupReminders.ts`) pod `withLockIfFree(AUTO_BACKUP_LOCK)`; zajęte = pomija przebieg, a po wejściu sprawdza od nowa, czy kopia nadal jest potrzebna. Bez testu dwóch kart (jsdom nie ma `navigator.locks`; zostaje Z-7.T/Z-7.4).
  - `src/hooks/useNotes.ts`: odśmiecanie pod `GC_LOCK`. `src/components/SyncSettings.tsx`: `relayStatusText`.
- **Jak działa:**
  - **Dokument między kartami** wymienia `tabSync.ts` (`BroadcastChannel`, start w `main.tsx`), więc edycja tej samej notatki w dwóch kartach scala się jak między urządzeniami. Na tym opiera się rola: zmiany karty czekającej dochodzą do prowadzącej z pochodzeniem `TAB_SYNC_ORIGIN`, które `RelayProvider` traktuje jak lokalne i wysyła. Zmiany z serwera wracają do pozostałych kart tą samą drogą.
  - **Rola** to blokada Web Locks `notatnik-przekaznik` trzymana obietnicą bez końca. Najpierw idzie próba `ifAvailable` — tylko tak widać, że rolę ma ktoś inny — potem zwykłe czekanie w kolejce. Powód roli: kursor, wektor stanu i kolejka wysyłki leżą w jednej bazie `kaczy-relay`, więc dwie karty nadpisywały je sobie nawzajem i pobierały każdy blob podwójnie. Nowa prowadząca startuje od zapisanego wektora stanu i dosyła różnicę, więc nic nie ginie przy przejęciu.
  - **Odśmiecanie:** data i usunięcie pliku są w jednej transakcji IndexedDB (`deleteIfStale`), plik po pliku — dawniej wszystkie kandydaty były czytane naraz z bajtami. `putBytes` dla znanego klucza czyta rekord: gdy go nie ma (skasowała go inna karta), zapisuje od nowa; gdy jest starszy niż dobę, odnawia `addedAt`. Karencja 7 dni liczy się więc od ostatniego dodania, nie od pierwszego.
  - **Bezpiecznik:** gdy kandydatów jest ponad 20 i ponad połowa magazynu, przebieg nic nie kasuje i zapisuje ostrzeżenie w diagnostyce. Taki stan oznacza raczej niepełną listę używanych niż porządki użytkownika.
  - **Kanał obrazów:** każda karta ma własny zbiór `known`. Zapis rozsyła `add` (druga karta dopisuje klucz, budzi `onAdded` i chroni plik w trwającym odśmiecaniu), usunięcie rozsyła `del`.
- **Ograniczenia i pułapki:**
  - Bez `navigator.locks` każda karta prowadzi przekaźnik sama, jak dawniej.
  - Rola wymaga `BroadcastChannel`; obie funkcje są w tych samych wersjach przeglądarek, osobnego sprawdzenia nie ma.
  - Prowadząca karta w tle ma dławione liczniki czasu, więc wysyłka zmian z karty widocznej może się opóźnić (zwykle sekundy, w skrajnym razie do minuty).
  - P2P (WebRTC) nadal działa w każdej karcie osobno. Powiadomienia i automatyczna kopia do pliku nie mają jeszcze roli (zlecenia Z-7.2, Z-7.3).
  - Po zadziałaniu bezpiecznika śmieci zostają do czasu, aż kandydatów ubędzie; nie ma ręcznego „sprzątnij mimo to”.
  - Notatka prywatna nie może mieć plików (`privateNotes.lockNote` odmawia z powodem `has-files`), więc zablokowany skarbiec nie ukrywa żadnych odwołań przed odśmiecaniem.
- **Testy:** istniejące `src/lib/imageStore.test.ts`, `tabLock.test.ts`, `tabSync.test.ts`, `src/lib/sync/*.test.ts` przechodzą. Nowych testów nie ma — przypadki są w zleceniach Z-6.T i Z-7.T (`docs/zlecenia-fable-2026-11-15.md`).
- **Commit:** zob. `git log` (2026-11-16).

## Kopia zapasowa — dzienny zapis do wybranego pliku (Q1.3, decyzja QL-2, 2026-11-23)

- **Co robi:** gdy w Ustawieniach → Kopia i dane wybrano jeden plik do nadpisywania (File System Access — Chrome i Edge na komputerze), pełna kopia zapisuje się do niego sama, bez pytania, raz dziennie: przy otwarciu aplikacji i przy jej schowaniu (koniec sesji). Pod wyborem pliku widać „Ostatni zapis: data · rozmiar”. Bez wybranego pliku zostaje dotychczasowe zachowanie: po interwale z suwaka „Auto-backup” dymek z „Pobierz” (przeglądarka nie pozwala pobierać bez kliknięcia). Suwak na „wyłączony” wyłącza też zapis do pliku.
- **Gdzie jest:** `src/hooks/useBackupReminders.ts` (harmonogram), `src/lib/backupReminder.ts` (`FILE_BACKUP_DAYS = 1`), `src/lib/backupFileHandle.ts` (`hasBackupFile`, `readLastFileWrite`, zapis `kaczy.backupFileLast.v1` po udanym nadpisaniu), `src/components/settings/BackupSettings.tsx` (`LastFileWrite`, poprawione opisy).
- **Jak działa:** termin = interwał z suwaka albo — przy wybranym pliku — dzień od ostatniej kopii (`kaczy.lastAutoExport`, wspólny dla ręcznych i automatycznych). Przy otwarciu: po 2,5 s i po wczytaniu notatek (`whenNotesReady`), raz na sesję karty, pod blokadą jednej karty (`AUTO_BACKUP_LOCK`). Przy `visibilitychange` → ukryta: cichy zapis do pliku, gdy minął dzień. Codzienny zapis jest cichy (dymek tylko przy pominiętych załącznikach albo za dużej kopii). Gdy przeglądarka cofnęła zgodę na zapis do pliku (wymaga kliknięcia), działa prośba „Pobierz” jak bez pliku, po interwale.
- **Decyzje i odstępstwa:** zamiast folderu z plikami z datą — jeden nadpisywany plik (tak działało dotąd); historię 7 dni dają kopie dzienne w OPFS (Q1.4). Naprawione przy okazji: znacznik „zrobione w tej sesji” stawiany był przed odroczonym zapisem, więc zmiana listy notatek w ciągu 2,5 s od startu anulowała kopię na całą sesję.
- **Pułapki:** w e2e uchwyt pliku z OPFS zapisany w IndexedDB zamyka stronę testową przy odczycie (Chromium w trybie testowym) — logika sprawdzana testem jednostkowym.
- **Testy:** `src/hooks/useBackupReminders.test.ts` (4: zapis przy otwarciu z plikiem mimo niezaległego interwału, brak zapisu tego samego dnia i bez pliku, zapis przy schowaniu po dniu, wyłączony suwak). E2e kopii i Ustawień — 66 zaliczonych.

## Kopia zapasowa — „Usuń nieużywane pliki” (Z-6.6, 2026-11-23)

- **Co robi:** Ustawienia → Kopia i dane → „Nieużywane pliki”: „Sprawdź nieużywane pliki” liczy zdjęcia i załączniki, których nie używa żadna notatka ani wpis w Pracy, starsze niż 7 dni, i pokazuje „Usuń nieużywane pliki (N, rozmiar)”. Usunięcie wymaga potwierdzenia w oknie i nie da się go cofnąć.
- **Gdzie jest:** `src/components/settings/UnusedFilesCleanup.tsx` (w `BackupSettings.tsx` pod „Cofnij ostatni import”), `src/lib/fileCleanup.ts` (`scanUnusedFiles`, `removeUnusedFiles` — ładowane leniwie), `src/lib/imageStore.ts` (`unusedFiles`, `collectGarbage(…, { force })`).
- **Jak działa:** lista używanych plików jest ta sama co w automatycznym odśmiecaniu (`referencedImages` — notatki, dziennik, plany, dowody długów — plus `journalImageRefs`). Automatyczne odśmiecanie po starcie ma bezpiecznik: gdy ponad połowa magazynu (i ponad 20 plików) wygląda na nieużywaną, nie usuwa nic, bo to zwykle niepełna lista — wtedy śmieci zostawały na stałe. Ręczne sprzątanie pomija bezpiecznik (`force`), bo użytkownik widzi liczbę przed usunięciem; karencja 7 dni zostaje (szkice, „Cofnij”, pliki w drodze z innego urządzenia). Jedna karta naraz (`GC_LOCK`, czekanie zamiast pominięcia).
- **Ograniczenia:** sprawdzenie czyta rekordy po jednym (rozmiar) — dlatego dopiero na przycisk, nie przy otwarciu Ustawień. Dotyczy tylko tego urządzenia.
- **Testy:** `src/lib/imageStore.test.ts` („ręczne sprzątanie…”: liczba i rozmiar tylko starych plików bez odwołania; bezpiecznik zostawia 25 z 30, `force` je usuwa, używane zostają), `e2e/unused-files.spec.ts`.

## Dane — wersje kopii i plików wymiany, wzorce (D3.2, D3.5, D5.1, D5.3, D5.4, 2026-11-23)

- **Co robi:** pełna kopia zapisuje obok wersji koperty (`version`, 1–3) wersję formatu dokumentu (`schema` = `SCHEMA_VERSION`). Kopia z nowszego formatu albo nowszej koperty jest odrzucana przed czymkolwiek („Ta kopia pochodzi z nowszej wersji aplikacji…”). Kopie bez `schema` (wszystkie sprzed 2026-11-23) czytają się jak dotąd. Paczka budowy (`sitePackage.ts`) ma tę samą regułę co plik synchronizacji: nowsza wersja — odmowa z prośbą o aktualizację, starsza — przyjęta, brak albo zła wersja — „To nie jest plik budowy.” (wcześniej odrzucała każdą wersję różną od 1). Komunikaty o obcym pliku mówią o aplikacji `APP_NAME` zamiast dawnego „G”.
- **Gdzie jest:** `src/lib/exportNotes.ts` (`buildFullBackupWithReport` — pole `schema`; `parseFullBackup`), `src/lib/noteSchema.ts` (`FullBackup.schema`, `fullBackupSchema`), `src/lib/study/sitePackage.ts` (`parseSitePackage`), `src/lib/yjsFileSync.ts` (bez zmian reguły).
- **Wzorce:** `src/test/fixtures/backups/v1.json`–`v3.json` (syntetyczne; generator w `backups.test.ts`: `GEN_BACKUP_FIXTURE=1 npx vitest run src/test/fixtures/backups`; v2 i v1 to kopia v3 bez sekcji, których wersja nie miała). `src/test/fixtures/docs/registry.test.ts` — każdy wzorzec dokumentu 1–3 przechodzi przez cały rejestr migracji (`DOC_MIGRATIONS`): `check` czysty, drugi przebieg pusty, dane całe. Rejestr jest dziś pusty — test to siatka dla pierwszej migracji.
- **Ograniczenia:** D5.2 (import starej kopii przez tymczasowy dokument i rejestr) czeka na podział `exportNotes.ts` (A3.1). D3.4 (spóźniony stary klient) i D3.6 (rozmiar migracji 5000 notatek) mają sens przy pierwszej migracji dokumentu — wtedy dopisać.
- **Testy:** `src/test/fixtures/backups/backups.test.ts` (wzorzec dla każdej wersji koperty, wczytanie v1–v3 bez utraty, Grafik od v2, `schema` w nowej kopii, odmowa nowszej), `src/test/fixtures/docs/registry.test.ts`, `src/lib/study/sitePackage.test.ts`.

## Dane — spisy baz IndexedDB, kluczy `localStorage` i migracji (D0.2–D0.4, 2026-11-23)

**Co robi.** Dokument dla programisty, bez zmian w działaniu aplikacji: co aplikacja trzyma poza dokumentem Yjs i jakie migracje działają przy starcie.

**Gdzie jest.** `docs/dane-spisy.md`, odnośnik w `docs/dane-wersje.md` („Gdzie jest kod”).

**Jak działa.** Trzy tabele: bazy IndexedDB i pamięci podręczne Service Workera (nazwa, moduł, zawartość, skutek braku); 146 kluczy `localStorage` wygenerowanych z literałów w `src/` z informacją, czy wchodzą do pełnej kopii (`SETTINGS_KEYS` + `APPEARANCE_KEYS`); 11 istniejących migracji z wyzwalaczem, znacznikiem, idempotentnością, datą i oceną, czy można je usunąć po 12 miesiącach (MG-1, D7.3).

**Ograniczenia i pułapki.** Spis kluczy pomija klucze składane w całości w czasie działania (bez literału z prefiksem `kaczy`). Kolumny „kształt” i „walidacja przy odczycie” zostają do rejestru kluczy (D6.1). Spis nie jest pilnowany testem — przy nowym kluczu lub bazie trzeba go poprawić ręcznie (lista kontrolna w `docs/dane-wersje.md`).

**Testy.** Brak (dokument).

**Commit.** Patrz historia `docs/dane-spisy.md`, 2026-11-23.

## Dane — spis map Yjs i przejście kluczy `localStorage` (D0.1, D6.3, D6.4, 2026-11-23)

**Co robi.** Narzędzia dla programisty, bez zmian w działaniu aplikacji: dokument z listą map Yjs, pomocnik do zmiany nazwy klucza `localStorage` przy zmianie kształtu i zasada dla baz IndexedDB.

**Gdzie jest.**
- `docs/dane-mapa.md` (53 mapy), generowany przez `scripts/dane-mapa.mjs`.
- `src/lib/storage/migrateKey.ts`: `migrateKey` (pod blokadą `MIGRATION_LOCK` z `src/lib/tabLock.ts`), `migrateKeySync`, `dropOldKey`.
- Zasady 10 i 11 oraz punkt 6 listy kontrolnej w `docs/dane-wersje.md`.

**Jak działa.**
- Skrypt czyta wywołania `getMap(…)` w `src/` i kategorie `PRESERVES`/`EXEMPT` z `src/lib/docMapsInventory.test.ts`. Źródłem prawdy jest test, a dokument tylko go pokazuje.
- `migrateKey(stary, nowy, przekształć)` zapisuje nowy klucz tylko wtedy, gdy go jeszcze nie ma. Dzięki temu drugi przebieg albo druga karta nic nie nadpisze.
- Gdy przekształcenie zwróci `null` albo rzuci wyjątek, nowy klucz nie powstaje, stary zostaje, a w diagnostyce pojawia się wpis.
- Stary klucz usuwa `dropOldKey` wydanie później, i tylko gdy nowy istnieje. Powrót do starszej wersji aplikacji nie zastaje wtedy pustego klucza.
- Zasada 11: baza IndexedDB w nowym kształcie dostaje nową nazwę i migrację kopiującą. Nie używa się `onupgradeneeded` w bazach otwieranych przez `idb-keyval` i `y-indexeddb`.

**Ograniczenia i pułapki.**
- `migrateKey` nie ma jeszcze żadnego wywołującego. Przyda się przy pierwszym kluczu `.v2`.
- `docs/dane-mapa.md` trzeba wygenerować od nowa po zmianie kategorii albo po dodaniu mapy — test tego nie sprawdza.

**Testy.** `src/lib/storage/migrateKey.test.ts`.

**Commit.** Patrz historia `src/lib/storage/migrateKey.ts`, 2026-11-23.

## Dane — rejestr kluczy `localStorage` i lista kopii z rejestru (D6.1, D6.5, 2026-11-23)

**Co robi.** Jedno miejsce, które opisuje klucze `localStorage`: jak je czytać, jaka jest wartość domyślna, czy wchodzą do pełnej kopii i czy są wrażliwe. Użytkownik nie widzi zmiany — kopia ma te same ustawienia co wcześniej.

**Gdzie jest.**
- `src/lib/storage/keys.ts`:
  - typ `KeyDef`, funkcje `defineKey`, `jsonKey` (JSON z funkcją sprawdzającą), `rawKey` (surowy tekst);
  - odczyt i zapis: `readKey`, `writeKey`, `removeKey`;
  - zapytania o rejestr: `backupKeyNames`, `isSensitiveKey`, `registeredKeys`.
- Nazwy kluczy Wyglądu: obiekt `APPEARANCE` (np. `APPEARANCE.skin`) i `appearanceSlotKey(n)`; `APPEARANCE_KEYS` to jego wartości, `src/lib/appearanceCode.ts` eksportuje je dalej. Moduły Wyglądu (`skins.ts`, `accent.ts`, `frames.ts`, `useTheme.ts`, `appearancePresets.ts` i reszta) biorą nazwę stąd.
- Nazwy kluczy Pracy: obiekt `PRACA` (np. `PRACA.seller`, `PRACA.ksefSeries`, `PRACA.store` = `kaczy.study.v1`). Czytają je `src/lib/study/*` (firma, cennik, raporty, zakładka, użycie), `src/lib/ksef/sellerPrefs.ts` i komponenty `src/components/study/` (tablica, poziomica, przyjazd na budowę). Dotychczasowe stałe (`SELLER_KEY`, `COMPANY_NAME_KEY` …) zostały jako aliasy.
- Strażnik D6.2: `src/lib/storage/keyLiterals.test.ts` z listą wyjątków `keyLiterals.exempt.ts`.
- `SETTINGS_KEYS` w `src/lib/exportNotes.ts` to `backupKeyNames()`.

**Jak działa.**
- `readKey` przy braku dostępu do pamięci, braku wpisu albo złym kształcie zwraca wartość domyślną; zły kształt zostawia wpis w diagnostyce. `writeKey` zwraca `false` zamiast rzucać.
- Klucz nie może być zarejestrowany dwa razy, a klucz wrażliwy nie może mieć flagi `backup` — oba przypadki rzucają przy rejestracji, więc błąd wychodzi w teście, nie u użytkownika.
- Strażnik przegląda `src/**/*.ts(x)` bez testów i bez komentarzy. Literał `"kaczy.`, `"kaczy:` albo `"kaczy-` poza `keys.ts` jest dozwolony tylko w pliku z listy wyjątków. Lista może tylko maleć: plik bez literału, a nadal na liście, też wywraca test.
- Klucze kopii są zarejestrowane jako `rawKey` z `backup: true`. Ich kształt nadal sprawdzają moduły, które je czytają, aż do przejścia modułami (D6.2).
- Jako wrażliwe są oznaczone: kod parowania `kaczy.sync.v1`, token push, PIN i próby skarbca, adres przekaźnika, numer konta i odciski dokumentów.

**Ograniczenia i pułapki.**
- D6.2 w toku: przeniesione Wygląd i Praca; 96 plików jest jeszcze na liście wyjątków. Moduły nadal czytają przez `createPersistedStore`, nie `readKey`/`writeKey`.
- Nowy klucz kopii trzeba dodać w `keys.ts`, nie w `exportNotes.ts`.
- `isSensitiveKey` nie ma jeszcze wywołującego. Raport diagnostyczny będzie z niego korzystał po D6.2.

**Testy.** `src/lib/storage/keyLiterals.test.ts` (strażnik literałów), `src/lib/storage/keys.test.ts` (odczyt, wartość domyślna, zły kształt, lista kopii równa flagom, wygląd w kopii, wrażliwe poza kopią), `src/lib/fullBackup.test.ts`, `src/lib/push/token.test.ts`.

**Commit.** Patrz historia `src/lib/storage/keys.ts`, 2026-11-23.

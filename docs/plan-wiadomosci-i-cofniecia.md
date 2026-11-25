# Wiadomości od urządzeń (S2.5) i cofnięcie stanu na przekaźniku (S2.3)

Specyfikacja do punktów S2.5 i S2.3 z `plan-security-2026-11-15.md` (sesja B z `plan-uzycia-fable-2026-11-17.md`). Data: 2026-11-17. Część 1 to analiza `y-webrtc` 10.3.0 z `node_modules` i kodu aplikacji — samo czytanie, nic nie uruchamiano. Wszystko, co wymaga pomiaru, jest oznaczone **(do pomiaru)**.

## Część 1. S2.5 — limity wiadomości przez WebRTC

### 1.1 Co jest dziś

- **Limitów nie ma żadnych** — ani w `yjsSync.ts`, ani w `imageSync.ts`, ani w `y-webrtc`. Jedyna kontrola to czyszczenie pola `device` z awareness (`cleanDeviceName`, `cleanSchemaClaim`) i sprawdzenie skrótu obrazu przed zapisem (`reconcileMissingImages`).
- Droga wiadomości od urządzenia w `y-webrtc` (`src/y-webrtc.js`):
  `peer.on('data')` (wiersz 232) → `readPeerMessage` → `readMessage` (63) → dla typu 0 `syncProtocol.readSyncMessage(decoder, encoder, doc, room)` — czyli **`Y.applyUpdate` na głównym dokumencie, synchronicznie, w wątku interfejsu**; dla typu 1 `applyAwarenessUpdate`; dla typu 3 odpowiedź wszystkimi stanami awareness.
- **Dane między urządzeniami nie są szyfrowane kluczem pokoju.** Klucz z kodu szyfruje tylko wiadomości sygnalizacyjne (`decryptJson`, wiersz 550); kanał danych chroni samo DTLS WebRTC. Punkt „przed odszyfrowaniem” z planu dotyczy więc wyłącznie sygnalizacji. Uwierzytelnieniem urządzenia jest to, że umiało odszyfrować sygnalizację, czyli zna kod — atakującym jest tu T5 (osoba znająca kod) albo zepsute urządzenie grupy.
- `y-webrtc` nie daje żadnego punktu wpięcia: `readMessage` i `WebrtcConn` nie są eksportowane, opcje (`peerOpts`, `maxConns`, `filterBcConns`) nie obejmują odbioru.
- **Wysyłka połyka błędy:** `sendWebrtcConn` i `broadcastWebrtcConn` mają `try { peer.send(...) } catch (e) {}`. Jeśli przeglądarka odrzuci za dużą wiadomość, aktualizacja znika bez śladu.
- Obrazy: `imageSync.ts` trzyma **wszystkie** synchronizowane obrazy i załączniki (każdy do 2 MB) w jednym pomocniczym `Y.Doc`. Pierwsza wymiana z nowym urządzeniem to jedna wiadomość „krok 2” z całym zestawem — przy stu obrazach rzędu setek megabajtów w jednej wiadomości.

### 1.2 Dlaczego nie wolno po prostu odrzucić wiadomości

Aktualizacja Yjs od klienta z zegarem `n` wymaga jego operacji `0…n−1`. Pominięta aktualizacja sprawia, że wszystkie późniejsze od tego klienta czekają w `doc.store.pendingStructs` — dokument wygląda na zsynchronizowany, a rozjeżdża się po cichu, aż do następnej pełnej wymiany (ponowne połączenie), która przyniesie tę samą za dużą treść. Stąd reguła:

> **Wiadomości synchronizacji nie pomija się. Albo jest nakładana w całości, albo połączenie z tym urządzeniem jest zamykane.** Pomijać wolno tylko awareness (stan ulotny, odnawiany co 15 s).

### 1.3 Miejsce wpięcia

Zalecenie: **strażnik na `peer.on('data')` zakładany przy tworzeniu połączenia**, bez zmiany biblioteki.

- `y-webrtc` emituje `peers` z `added: [id]` synchronicznie zaraz po `new WebrtcConn(...)` (wiersze 506–545), a dane mogą przyjść dopiero po zestawieniu kanału. W obsłudze `peers` aplikacja bierze `provider.room.webrtcConns.get(id).peer`, zdejmuje słuchaczy `data` (`peer.listeners('data')`, `removeAllListeners('data')`) i zakłada własnego: `data → guard(data) ? oryginalni słuchacze : reakcja`. Samo dopisanie słuchacza przed istniejącym nie wystarcza — nie zatrzyma oryginalnego.
- To sięganie do wnętrza biblioteki (`room`, `webrtcConns`, `peer`), więc: wersja `y-webrtc` przypięta dokładnie (`10.3.0`, bez `^`), **test-kanarek** sprawdzający na prawdziwym `WebrtcProvider`, że połączenie ma `peer` z dokładnie jednym słuchaczem `data` i że `peers` przychodzi przed pierwszą wiadomością. Gdy strażnika nie da się założyć (inny kształt obiektów) — połączenie jest zamykane i idzie wpis diagnostyczny; synchronizacja bezpośrednia bez strażnika nie działa.
- Wspólny moduł `src/lib/sync/peerGuard.ts` dla `yjsSync.ts` i `imageSync.ts`: czysta funkcja `classify(bytes, state, limits, now) → "pass" | "drop" | "close"` + cienka część zakładająca słuchacza.
- Kanał między kartami (`BroadcastChannel`, `_bcSubscriber`) zostaje bez strażnika: to to samo źródło i ten sam użytkownik, a karty dzielą dokument także przez `tabSync.ts`.

Odrzucone: **kopia biblioteki w repozytorium** (697 wierszy, pełna kontrola, ale własne utrzymanie i przegląd przy każdej poprawce) — wracamy do niej tylko, jeśli kanarek zacznie się sypać albo trzeba będzie zamknąć lukę z §1.6 (sygnalizacja), której strażnik nie obejmuje.

### 1.4 Limity

Pierwszy bajt (zmienna długość) to typ: `0` synchronizacja (drugi: `0` krok 1, `1` krok 2, `2` aktualizacja), `1` awareness, `3` pytanie o awareness, `4` identyfikator karty (tylko `BroadcastChannel`). Strażnik czyta **tylko długość i dwa pierwsze bajty** — niczego nie dekoduje.

Dokument główny (`yjsSync.ts`), na połączenie:

| Wiadomość | Rozmiar | Częstość | Po przekroczeniu |
|---|---|---|---|
| krok 1 (wektor stanu) | ≤ 64 KiB | ≤ 6 na minutę | zamknięcie — każdy krok 1 każe nam policzyć i wysłać różnicę, przy pustym wektorze cały dokument |
| krok 2 i aktualizacja | ≤ 8 MiB **(do pomiaru)** | ≤ 600 wiadomości i ≤ 32 MiB na minutę | zamknięcie |
| awareness | ≤ 4 KiB | ≤ 30 na 10 s | pominięcie; 3 pominięcia w minucie → zamknięcie |
| pytanie o awareness | 1–2 bajty | ≤ 6 na minutę | pominięcie |
| typ 4 i nieznane | — | — | zamknięcie |

Dodatkowo po przepuszczeniu awareness: jeśli `awareness.getStates().size > 64`, nadmiarowe stany są usuwane (`removeAwarenessStates`), a połączenie, które je przyniosło, zamykane — jedna mała wiadomość może nieść stany dowolnie wielu „klientów”.

Dokument obrazów (`imageSync.ts`): te same limity dla kroku 1 i awareness. Dla kroku 2 i aktualizacji **limitu rozmiaru wiadomości nie da się dziś ustawić sensownie** — legalna pierwsza wymiana jest jedną wiadomością z całym zestawem (§1.1). Zamiast tego budżet pamięci: suma bajtów w mapie `blobs` ≤ 2 × (suma rozmiarów lokalnych obrazów oczekiwanych przez manifest, nie mniej niż 64 MiB) — po przekroczeniu dokument obrazów jest **niszczony i zakładany od nowa** (`stopImageSync` + `startImageSync`). To bezpieczne: jest tylko buforem w pamięci, nigdy nie trafia na dysk, a obrazy już zapisane w `imageStore` zostają. Wpis `logSecurity`.

Próg 8 MiB jest tymczasowy. Kryterium z pomiaru: `Y.applyUpdate` wiadomości o progowym rozmiarze na telefonie średniej klasy trwa najwyżej 250 ms. Wynik pomiaru wpisać tutaj.

**Wynik pomiaru 2026-11-18 (Node na komputerze, dokument z notatkami, 3 przebiegi):** 1 MiB 14 ms, 4 MiB 38 ms, 8 MiB 94 ms, 16 MiB 147 ms. Telefon średniej klasy szacunkowo ~4× wolniej → kryterium 250 ms spełnia **aktualizacja ≤ 4 MiB**. Krok 2 (pełna wymiana) nie dostaje tego limitu: to cały dokument, więc 4 MiB odcięłoby duże zbiory notatek od synchronizacji bezpośredniej — **krok 2 ≤ 64 MiB i ≤ 6 na minutę**, bajty kroku 2 i aktualizacji ≤ 96 MiB na minutę. Wdrożone w `src/lib/sync/peerGuard.ts` (`DOC_LIMITS`, `IMAGE_LIMITS`). Pomiaru na telefonie nie było.

### 1.5 Reakcja

1. **Zamknięcie połączenia:** `conn.peer.destroy()`. `y-webrtc` sam sprząta (`close` → usunięcie z `webrtcConns`, `peers`, ponowne ogłoszenie), więc urządzenie może wrócić — pojedyncza pomyłka nie odcina go na stałe. Wpis `logSecurity("peer-limit", "<typ>: <rozmiar albo częstość>")` (nowy rodzaj zdarzenia).
2. **Trzy zamknięcia w 10 minut** (liczone na całą grupę — identyfikator połączenia jest losowy przy każdym połączeniu, więc licznik na urządzenie nic nie daje): synchronizacja bezpośrednia wstrzymana na 15 minut — niszczone są dostawcy WebRTC tekstu i obrazów, **przekaźnik działa dalej**. Stan `p2pPausedUntil` w pamięci karty (nie w ustawieniach — po przeładowaniu próba od nowa). Komunikat w ustawieniach synchronizacji i jednorazowy toast: „Urządzenie w grupie wysyła nieprawidłowe dane. Połączenie bezpośrednie wstrzymane na 15 minut.” Przycisk „Wznów teraz”.
3. Po drugim wstrzymaniu w ciągu doby komunikat dostaje zdanie: „Jeśli nie rozpoznajesz wszystkich urządzeń w grupie, zmień kod synchronizacji.” — odnośnik do wymiany kodu (`plan-wymiana-kodu.md` §3).

Miernik bez reakcji automatycznej: po nałożeniu zdalnej aktualizacji, jeśli `doc.store.pendingStructs` trzyma ponad 1 MiB dłużej niż 60 s — wpis diagnostyczny „aktualizacje oczekujące na brakujące poprzedniki” i jedno ponowne połączenie (pełna wymiana). To wykrywa rozjechanie, którego strażnik nie widzi (mała aktualizacja z dziurą w zegarze).

### 1.6 Czego to nie obejmuje

- **Zalew przez serwer sygnalizacyjny.** Każdy, kto zna nazwę pokoju (operator serwera, podsłuchujący temat), może słać dowolnie duże wiadomości; `y-webrtc` każdą dekoduje z base64 i próbuje odszyfrować (wiersz 550), zanim ją odrzuci. Strażnik tego nie widzi. Naprawa wymaga zmiany biblioteki (limit długości `m.data` przed `fromBase64`) — do zrobienia tylko z kopią biblioteki; ryzyko: zużycie procesora karty, bez dostępu do danych. Zapisać w modelu zagrożeń jako znane.
- **Kosztowna, ale mała aktualizacja** (np. ogromny zbiór usunięć) mieści się w limitach. Ogranicza ją tylko limit bajtów.
- **Zalew poprawnymi danymi** (tysiące notatek-śmieci od urządzenia z kodem) to nie jest sprawa limitów transportu — obroną jest wymiana kodu i kopia.

### 1.7 Ustalenia przy okazji (osobne od limitów)

- **U-1 (do pomiaru, możliwy poważny błąd).** Przeglądarki ograniczają rozmiar jednej wiadomości kanału danych (Chrome ogłasza w SDP `max-message-size` 262 144 bajty); `simple-peer` 9.11.1 nie dzieli wiadomości, a `y-webrtc` połyka błąd wysyłki. Jeśli limit działa tak, jak zapisano w SDP, to **pełna wymiana dokumentu większego niż około 256 KB i pierwsza wymiana obrazów w ogóle nie przechodzą drogą bezpośrednią** i nikt tego nie widzi. Sprawdzić przed ustawieniem progów: dwie przeglądarki, dokument 1 MB i 10 MB, obraz 2 MB; Chrome↔Chrome, Firefox↔Firefox, Chrome↔Safari na telefonie. Jeśli się potwierdzi — osobne zadanie (dzielenie wiadomości albo przekaźnik jako droga dla dużych wymian), ważniejsze niż same limity.
  **Wynik pomiaru 2026-11-18 (Chromium z Playwright, dwa `RTCPeerConnection` w jednej stronie):** `sctp.maxMessageSize` = 262 144, SDP `max-message-size:262144`; `send()` 256 KiB — dociera, 1 / 4 / 10 MiB — **`TypeError` przy wysyłce**, nic nie dociera. **U-1 potwierdzone** dla Chrome↔Chrome: pełna wymiana dokumentu > 256 KiB i pierwsza wymiana obrazów nie przechodzą drogą bezpośrednią, a `y-webrtc` połyka błąd. Firefox i Safari niezmierzone (brak przeglądarek w środowisku). Z-15.5 ✅ `ee4e11ac`, `ccc5191c` 2026-11-18 (po D-U1: dzielenie wiadomości). Pierwotnie wstrzymane do decyzji **D-U1**: dzielenie wiadomości (własna warstwa nad `peer.send`, wymaga kopii biblioteki albo owinięcia `peer.send`) czy przekaźnik jako droga dużych wymian.
- **U-2.** Transport obrazów „wszystko w jednym dokumencie” nie skaluje się i uniemożliwia limit rozmiaru. Docelowo: prośba o konkretny skrót i odpowiedź jednym obrazem. Osobna decyzja, zależna od U-1.

### 1.8 Zlecenie Z-15.5 (Opus, M)

0. **Pomiar** U-1 i czasu `applyUpdate` (1, 4, 8, 16 MiB) — wyniki do tego pliku; próg z §1.4 poprawić według kryterium 250 ms. Jeśli U-1 się potwierdzi: zatrzymać się i zgłosić, nie obchodzić.
1. `peerGuard.ts`: `classify` (czysta) + zakładanie słuchacza; liczniki w oknach przesuwnych na połączenie; licznik zamknięć na grupę.
2. Wpięcie w `yjsSync.ts` (`p.on("peers")`) i `imageSync.ts`; budżet pamięci obrazów; `p2pPausedUntil`, komunikat, „Wznów teraz”; nowy rodzaj `logSecurity`.
3. Przypięcie wersji `y-webrtc`; test-kanarek.
4. Testy (Vitest): tabela `classify` (każdy wiersz §1.4 tuż pod i tuż nad progiem); trzy zamknięcia → wstrzymanie, przekaźnik nietknięty; awareness ponad 64 stany; **wiadomość 10 MB jest odrzucana po sprawdzeniu samej długości** (test mierzy, że `applyUpdate` nie zostało wywołane, nie czas zegarowy); zniszczenie i odtworzenie dokumentu obrazów nie gubi obrazów z `imageStore`.
5. Poza zakresem: kopia biblioteki, limit sygnalizacji, zmiana transportu obrazów.

## Część 2. S2.3 — cofnięcie i powtórzenie na przekaźniku

### 2.1 Stan po Z-5.5

Klient pamięta w `RelayState`: `cursor` (numer ostatniego nałożonego wpisu), `sv` (wektor stanu z ostatniej udanej wysyłki), `epoch`. Serwer zwraca `epoch` i `last` w każdej odpowiedzi. Zmiana epoki albo `404` przy znanym pokoju to reset: kursor na zero i pełny stan do wysłania. Wpisy są szyfrowane AES-GCM z AAD wiążącym wpis z pokojem, **nie z numerem wpisu** — serwer może więc ten sam szyfrogram podać pod innym numerem.

Dane lokalne nie są zagrożone w żadnym scenariuszu poniżej: Yjs tylko scala, a przekaźnik nie ma kluczy. Stawką jest to, **czy urządzenia widzą nawzajem swoje zmiany** i czy użytkownik się dowie, że nie.

### 2.2 Co rozróżniamy

| # | Obserwacja klienta | Co to jest | Uczciwy serwer? | Reakcja |
|---|---|---|---|---|
| 1 | ta sama epoka, `last ≥ cursor`, wpisy po kursorze | zwykła praca | tak | bez zmian |
| 2 | ta sama epoka, mniej wpisów niż wcześniej, numery nadal rosną, pierwszy wpis oznaczony jako migawka | kompaktowanie (także F2) | tak | bez zmian; **liczba wpisów nigdy nie jest sygnałem** |
| 3 | inna epoka albo `404` przy znanym pokoju | pokój usunięty, wygasły, założony od nowa — albo serwer odtworzony z kopii z nowymi epokami | tak | reset jak dziś. Nowe: licznik resetów; **3 resety jednego pokoju w 24 h** → stan ostrzeżenia i `logSecurity("relay-reset-loop")`. Bez tego dwa urządzenia z różnym obrazem pokoju mogłyby zakładać go sobie nawzajem bez końca i nikt by nie zauważył |
| 4 | ta sama epoka, `last < cursor` | cofnięcie: serwer odtworzony z kopii **bez** zmiany epok albo celowe działanie operatora | nie | `logSecurity("relay-rollback", "last X < kursor Y")`, stan ostrzeżenia, potem **postępowanie jak przy resecie** (kursor na zero, pełny stan do wysłania — to naprawia serwer treścią z urządzenia). Zmiany lokalne nietknięte |
| 5 | ta sama epoka, `last ≥ cursor`, ale historia poniżej kursora jest inna niż ta, którą klient widział (serwer cofnięty do numeru 80, inni dopisali do 105, klient stoi na 100 i dostaje 101–105) | cofnięcie zamaskowane nowymi wpisami | nie | **niewykrywalne w etapie 1.** Skutek: klient nie dostaje wpisów 81–100 w nowej wersji. Wykrywa dopiero etap 2 (§2.4) albo kontakt drugą drogą (§2.3) |
| 6 | stary szyfrogram pod nowym numerem | powtórzenie | nie | nieszkodliwe — nałożenie tej samej aktualizacji Yjs nic nie zmienia. Nie wykrywamy; koszt to transfer. Zapisać w modelu zagrożeń |
| 7 | serwer nie podaje części wpisów (wstrzymuje) | cenzura wpisów | nie | niewykrywalne z jednego urządzenia. Wykrywa §2.3, gdy urządzenia spotkają się bezpośrednio |

Stan ostrzeżenia to nowe pole widoku przekaźnika (`RelayView.warning: "rollback" | "reset-loop" | "split" | null`), pokazywane w ustawieniach synchronizacji: „Serwer pośredniczący cofnął się do starszego stanu. Twoje dane są bezpieczne na tym urządzeniu i zostały wysłane ponownie. Jeśli to nie Twój serwer albo zdarza się to znowu — zmień serwer.” Ostrzeżenie gaśnie po 7 dniach bez nowego zdarzenia albo po „Rozumiem”.

### 2.3 Drugi kanał: porównanie przez awareness

Urządzenia, które widzą się bezpośrednio (WebRTC), dopisują do swojego stanu awareness `relay: { epoch, last }` — głowę pokoju, jaką ostatnio podał im przekaźnik (aktualizowane najwyżej raz na 15 s, razem z odświeżeniem awareness). Porównanie na odbiorcy, tylko gdy oba urządzenia mają ten sam adres przekaźnika skonfigurowany i od ostatniego własnego pobrania minęło mniej niż 60 s:

- ta sama epoka, a sąsiad podaje `last` większe od mojego o więcej niż jedną stronę przez ponad 60 s i moje kolejne pobranie tego nie zmienia → `warning: "split"`, `logSecurity("relay-split")`;
- różne epoki utrzymujące się ponad 60 s po moim pobraniu → to samo.

Deklaracja sąsiada jest niezaufana (każdy z kodem może ją wpisać), więc skutkiem jest wyłącznie ostrzeżenie; wartości czyszczone (`epoch` — 32 znaki szesnastkowe, `last` — bezpieczna liczba całkowita ≥ 0). Samo `{ epoch, last }` nie zdradza niczego, czego urządzenia grupy nie wiedzą. Grupy pracujące wyłącznie przez przekaźnik (nigdy online razem) tej kontroli nie mają — zapisać w modelu zagrożeń.

### 2.4 Etap 2 (osobna decyzja): łańcuch wpisów

Wykrycie przypadku 5 wymaga, żeby wpis mówił, co jego autor widział przed nim. Do treści jawnej wpisu (przed szyfrowaniem) dochodzi nagłówek `{ v: 2, prev: { seq, h } }`, gdzie `h` to pierwsze 16 bajtów SHA-256 szyfrogramu wpisu `seq`, który autor miał jako ostatni. Czytelnik trzyma skróty ostatnich 500 wpisów; wpis wskazujący `seq`, pod którym czytelnik widział inny skrót → rozwidlenie → reakcja jak w wierszu 4. Odwołania do numerów sprzed migawki są pomijane (nieznane, nie błędne).

Koszt: nowy format wpisu (okres dwóch formatów, bramka `canWriteSchema`), M. Zysk: wykrycie cofnięcia maskowanego dopisaniem — scenariusz wymagający złośliwego operatora albo nieudanego odtworzenia z kopii przy ruchu. **Zalecenie: nie robić teraz**; wrócić, jeśli przekaźnik będzie hostowany u kogoś obcego. Etap 1 i §2.3 pokrywają uczciwe awarie.

### 2.5 Wymagania wobec serwera (F2 i wdrożenie)

- **Numer wpisu nigdy nie maleje w obrębie epoki**, także po kompaktowaniu po stronie serwera i po restarcie. `last` i `epoch` trzymane razem z pokojem (`meta.json` w F2) i zapisywane przed potwierdzeniem zapisu klientowi.
- **Odtworzenie z kopii zapasowej = nowe epoki.** Procedura w `deploy/` i przełącznik serwera (np. `--new-epochs` przy starcie po odtworzeniu): każdy pokój dostaje nową epokę, klienci robią reset i dosyłają pełny stan — zamiast przypadku 4 albo 5 jest uczciwy przypadek 3. To najtańsza rzecz w całym punkcie i usuwa jedyny realistyczny scenariusz cofnięcia na własnym serwerze.
- Test awarii F2: przerwanie zapisu w połowie nie może dać `last` mniejszego niż potwierdzone klientowi.

### 2.6 Co klient pamięta — zmiany

`RelayState` dostaje: `resets?: number[]` (czasy ostatnich resetów, najwyżej 5) i `warnedAt?: number`. **Skrótu wektora stanu nie dodajemy**, choć plan go wymieniał: lokalny dokument nigdy się nie cofa, a „przekaźnik ma mniej niż ja” jest zwykłym stanem przed wysyłką — skrót nie rozróżniłby go od cofnięcia. Rozróżnia je `last` w obrębie epoki, który już jest.

### 2.7 Zlecenie Z-15.6 (Opus, M)

Część niezależna od F2 (można od razu):

1. `relayProvider.ts`: wiersz 4 tabeli (cofnięcie przy tej samej epoce) i licznik resetów z wiersza 3; `RelayView.warning`; nowe rodzaje `logSecurity`; komunikat i „Rozumiem” w ustawieniach.
2. Awareness `relay: { epoch, last }` i porównanie z §2.3 (`yjsSync.ts` + widok przekaźnika); czyszczenie wartości.
3. Testy: jednostkowe na każdym wierszu 1–4 i 6 tabeli (atrapa serwera zwracająca mniejsze `last`; migawka zmniejszająca liczbę wpisów **nie** daje ostrzeżenia; trzy resety w dobie dają, dwa nie); integracyjny z `relay-server`: podmiana pliku danych na starszy przy tej samej epoce → ostrzeżenie i pełny stan z powrotem na serwerze; porównanie awareness: zgodne, rozjechane krótko (bez ostrzeżenia), rozjechane trwale.

**Stan 2026-11-18: punkty 1–3 zrobione** (`relayProvider.ts`, `relayHeadCompare.ts`, `relayRuntime.ts`, `yjsSync.ts`, `SyncSettings.tsx`; testy `relayRollback.test.ts` i integracyjny „S2.3 wiersz 4”).

Część po F2 (Z-15.8): zrobiona 2026-11-25 — `NEW_EPOCHS=1` (`relay-server/config.js`, `storage.js`), testy w `relay-server/storage.test.js`.

Poza zakresem: etap 2 (§2.4).

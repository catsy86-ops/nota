# Plan: QoL i możliwości platformy (2026-11-15)

> **Status:** zapisany, realizacja nie zaczęta. Wykonawca: Sonnet, poza Q2 (Opus + `security-reviewer`). Wcześniejsze plany QoL (`nowyplan.md`, plan UI/UX z 25.10) są zrobione — tu są tylko rzeczy, których w kodzie nie ma albo są w jednym miejscu. Każdy punkt: najpierw `grep`, czy nie powstał w międzyczasie.

## 1. Stan (policzone w `src/`, manifeście i `index.html`)

**Jest:** `storage.persist`, odznaka aplikacji, `launchQueue`, `share_target`, `file_handlers`, skróty, `display_override`, `launch_handler`, obsługa „wstecz” dla nakładek (`overlayHistory.ts`: `registerOverlay`), `BroadcastChannel` (2 pliki), `ErrorBoundary` (6), samouczek (3 pliki), „Cofnij” w wielu miejscach, zapis kopii do wybranego pliku (`backupFileHandle.ts`), przypomnienie o kopii (`backupReminder.ts`).

**Nie ma (0 trafień):** `navigator.locks`, Background Sync i Periodic Background Sync, `CloseWatcher`, `scheduler.yield`/`postTask`, Trusted Types, `protocol_handlers`, automatyczny motyw według pory dnia.

**W jednym miejscu:** Wake Lock (1 plik), `visualViewport` (1), globalna obsługa błędów (1), `storage.estimate` (1).

## 2. Zasady

1. Każda funkcja platformy za sprawdzeniem dostępności, z zachowaniem zapasowym; nic nie może zepsuć Safari.
2. Dane nie opuszczają urządzenia; żadnej telemetrii na zewnątrz.
3. Budżety z `e2e/bundle.spec.ts` bez podnoszenia.

## Etap Q1: pewność danych (najważniejszy)

| Nr | Punkt | Rozmiar |
|---|---|---|
| Q1.1 | **Jedna karta pisze migracje.** `navigator.locks.request("notatnik-migracja")` wokół migracji i importu kopii; druga karta czeka albo pokazuje „trwa w innej karcie”. Dziś dwie karty mogą migrować naraz. | S |
| Q1.2 | **Zdrowie magazynu** w Ustawieniach → Kopia i dane: zajęte i wolne miejsce (`storage.estimate`), czy magazyn jest trwały (`persisted`), przycisk „Poproś o trwały”. Ostrzeżenie przy > 80% i przy magazynie nietrwałym po 7 dniach używania. | S |
| Q1.3 | **Automatyczna kopia do pliku bez pytania:** gdy wybrany jest plik (`tryWriteBackupToFile`), zapis po każdej sesji z > N zmianami, przy `visibilitychange`→ukryta; w Ustawieniach data i rozmiar ostatniego zapisu. Sprawdzić, co robi dziś `LAST_AUTO_EXPORT_KEY`, i nie dublować. | M |
| Q1.4 | **Rotacja kopii w OPFS:** 7 ostatnich dziennych migawek w Origin Private File System (poza IndexedDB, więc przeżywa uszkodzenie bazy); „Przywróć z dnia…” w Ustawieniach. Szyfrowane kluczem skarbca, gdy skarbiec istnieje — do decyzji z `security-reviewer`. | M |
| Q1.5 | **Błąd zapisu widoczny:** `QuotaExceededError` i odrzucone transakcje IndexedDB kończą się stałym banerem „Nie zapisano — zrób kopię”, nie toastem. Test z atrapą pełnego magazynu. | S |
| Q1.6 | **Dziennik błędów na urządzeniu:** `error` i `unhandledrejection` do pierścienia 50 wpisów w `localStorage` (bez treści notatek), widoczny w Ustawieniach → Diagnostyka z „Skopiuj”. Ułatwia zgłaszanie błędów z telefonu. | S |

## Etap Q2: twardnienie (Opus + `security-reviewer`)

| Nr | Punkt | Rozmiar |
|---|---|---|
| Q2.1 | **Trusted Types:** `require-trusted-types-for 'script'` najpierw w trybie raportu (zbieranie naruszeń w teście e2e), polityka domyślna tylko dla sanitizera Markdowna; potem egzekwowanie. | M |
| Q2.2 | **CSP z jednego źródła:** generator, który tworzy nagłówki dla `vercel.json` i `<meta>` dla powłoki APK (F1, pułapka 5); test zgodności obu. | S |
| Q2.3 | **Otwarte punkty audytu z 15.11** (COOP/HSTS, `Dockerfile` jako root) — sprawdzić w `memory/stan-2026-11-15-audyt.md` i zamknąć. | S |

## Etap Q3: codzienna wygoda

| Nr | Punkt | Rozmiar |
|---|---|---|
| Q3.1 | **Ekran nie gaśnie tam, gdzie się czyta z rękami zajętymi:** wspólny `useWakeLock` w sesji treningu, kalkulatorach Pracy, liście zakupów w trybie „w sklepie”, czytniku notatki (przełącznik). | S |
| Q3.2 | **Klawiatura ekranowa:** jeden hook na `visualViewport` — pasek akcji i przycisk zapisu zawsze nad klawiaturą we wszystkich arkuszach z polami (dziś 1 plik). Przegląd na 390 px: Długi, wpis Dziennika, posiłek, szybka notatka. | M |
| Q3.3 | **Motyw według pory:** opcja „jasny w dzień, ciemny po zmroku” z godzin (domyślnie 7–19) — obok „jak system”. Bez lokalizacji. | S |
| Q3.4 | **Wznowienie:** po powrocie do aplikacji po > 30 min — ten sam dział, ta sama notatka, pozycja przewijania (`captureAnchor`/`restoreAnchor` już są dla zmiany widoku). Po > 8 h start na „Dziś”. | S |
| Q3.5 | **„Ostatnie” w palecie poleceń:** 5 ostatnio otwartych notatek i 3 ostatnie polecenia na pustym zapytaniu (sprawdzić, co już daje historia wyszukiwarki z Ustawień). | S |
| Q3.6 | **Schowek z sensem:** wklejenie adresu na zaznaczony tekst robi link; wklejenie listy z punktorami do listy zadań robi pozycje; wklejenie obrazu wszędzie, gdzie jest załącznik. Testy na fragmentach HTML z Worda, Keep i WhatsAppa. | M |
| Q3.7 | **Głębokie linki:** `protocol_handlers` (`web+notatnik:`) i stałe adresy do notatki, budowy, osoby w Długach; „Skopiuj link” w menu. Przydaje się do tagów NFC i skrótów na ekranie głównym. | S |
| Q3.8 | **Praca głównego wątku:** `scheduler.yield()` (z zapasem `setTimeout`) w długich pętlach: import kopii, budowa indeksu poza Workerem, eksport ZIP. Miara: żadne zadanie > 50 ms przy imporcie 2000 notatek. | M |
| Q3.9 | **Skróty aplikacji według użycia:** `shortcuts` w manifeście są stałe — przejrzeć, czy cztery najczęstsze czynności właściciela (wg `usage.ts`) tam są. | S |

## Etap Q4: synchronizacja zrozumiała dla człowieka

| Nr | Punkt | Rozmiar |
|---|---|---|
| Q4.1 | **Jeden wskaźnik stanu** w nagłówku: zapisane lokalnie / wysyłam / zsynchronizowane z N urządzeniami / offline od 14:02. Stuknięcie otwiera szczegóły (ostatni kontakt z każdym urządzeniem, wersja formatu z `formatSchema.ts`). Sprawdzić istniejący status zapisu i rozbudować, nie dublować. | M |
| Q4.2 | **„Co się zmieniło, gdy mnie nie było”:** po synchronizacji po przerwie lista „3 notatki zmienione na innym urządzeniu” z przejściem do nich. Dane z porównania `updatedAt` przed i po. | M |
| Q4.3 | **Urządzenie ze starszą wersją:** gdy `canWriteSchema` blokuje nowy format, jasny komunikat „Zaktualizuj aplikację na telefonie X” zamiast cichego wstrzymania. | S |
| Q4.4 | **Wysyłka po odzyskaniu sieci** przez Background Sync (Chrome/Android) dla przekaźnika: kolejka w IndexedDB, zdarzenie `sync` w SW. Tylko jeśli przekaźnik zostanie wdrożony (F2); inaczej nie robić. | zależne |

## Etap Q5: dostępność i wejście

| Nr | Punkt | Rozmiar |
|---|---|---|
| Q5.1 | **Pełna obsługa klawiaturą** list i siatek: strzałki z jednym punktem `Tab` (roving tabindex — dziś 3 pliki) w liście notatek, Kalendarzu, Grafiku, tablicy. | M |
| Q5.2 | **Ściąga skrótów** pod `?` generowana z rejestru poleceń palety (jedno źródło), z wyszukiwaniem. | S |
| Q5.3 | **Menu pod prawym przyciskiem i długim przytrzymaniem** spójne w całej aplikacji (dziś 4 pliki): te same pozycje co menu „⋯”, z jednego opisu akcji. | M |
| Q5.4 | **Tryb „duże cele”** jako zestaw w Ustawieniach (obok „Czytanie”, „Oszczędny”): cele 56 px i większe odstępy tylko po włączeniu — zamiast zmiany `Button` dla wszystkich (cofniętej 15.11). | S |
| Q5.5 | **Czytnik ekranu na telefonie:** przejście TalkBackiem przez pięć głównych ścieżek; lista braków w `docs/`. Ręczne, właściciel albo sesja z Chrome. | S |

## Decyzje właściciela

- **QL-1:** kopie dzienne w OPFS (Q1.4) — szyfrować zawsze, tylko ze skarbcem, czy wcale.
- **QL-2:** automatyczny zapis do pliku bez pytania (Q1.3).
- **QL-3:** po ilu godzinach aplikacja wraca na „Dziś” (Q3.4).

## Kolejność

Q1.1, Q1.5, Q1.2 → Q1.3, Q1.6 → Q3.2, Q3.1 → Q4.1, Q4.3 → Q2 → reszta Q3 → Q5 → Q1.4, Q4.2.

## Weryfikacja

Vitest dla logiki; e2e na Chromium i WebKit dla każdej funkcji z zapasem; `e2e/a11y.spec.ts`; `security-reviewer` przy Q1.4, Q2, Q3.7; wpis w `opis.md` po każdym punkcie.

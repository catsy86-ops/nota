# Plan: bezpieczeństwo — model zagrożeń, twardnienie, wdrożenie przekaźnika i serwera powiadomień (2026-11-15)

> **Status:** zapisany, realizacja nie zaczęta. Wykonawca: Opus + agent `security-reviewer` przy każdym punkcie S1–S4; Sonnet przy S5 i dokumentach.
>
> **Powiązane, nie powtarzane tutaj:** kryptografia Skarbca — `plan-skarbiec-krypto-2026-11-15.md`; format danych i migracje — `plan-migracje-yjs-2026-11-15.md`; trwałość i limity pamięci przekaźnika — F2 w `plan-fable-2026-11-15.md` (warunek wstępny S4); Trusted Types i CSP z jednego źródła — Q2 w `plan-qol-platforma-2026-11-15.md` (tu tylko kolejność i uzupełnienia).
>
> **Zastrzeżenie:** stan w §1 pochodzi z czytania kodu 2026-11-15, nie z testów penetracyjnych. Punkty oznaczone „sprawdzić” są hipotezami — pierwszy krok to potwierdzenie w kodzie.

## 1. Stan

**Mocne strony (potwierdzone w kodzie):**

- CSP egzekwowane (`vercel.json`, kopia w `netlify.toml`, testy `securityHeaders.test.ts`, `e2e/csp.spec.ts`): `script-src 'self' 'wasm-unsafe-eval'`, bez skryptów wbudowanych.
- Skarbiec: PBKDF2-SHA-256 600 000, losowy klucz danych opakowany AES-GCM, AAD wiążące szyfrogram z notatką i epoką, lokalny pin metadanych, dławienie prób, walidacja `isValidMeta` z limitem iteracji.
- Przekaźnik: szyfrowanie po stronie klienta (`relayKeys.ts`), serwer zna tylko skrót tokenu, porównanie w stałym czasie, limity wpisu/pokoju/blobów, limit zapytań na IP, limit pokoi na IP na dobę, `Dockerfile` z `USER node`.
- Serwer powiadomień: bez `PUSH_TOKEN` słucha tylko na `127.0.0.1`, lista dozwolonych hostów Web Push (ochrona przed SSRF), limit treści 64 KB, `maxConnections`, testy `security.test.js`.
- CI: testy obu serwerów i `npm audit --omit=dev --audit-level=high` dla nich.
- Bramka formatu (`formatSchema.ts`), limity importu, dziennik `logSecurity`.

**Luki i słabsze miejsca:**

| # | Miejsce | Obserwacja | Waga |
|---|---|---|---|
| 1 | `vercel.json` | `connect-src 'self' https: wss:` — dowolny host. Po XSS dane można wysłać gdziekolwiek. Powód: adresy serwerów wpisuje użytkownik. | wysoka |
| 2 | `vercel.json` | `style-src 'unsafe-inline'`; brak Trusted Types; brak COOP/CORP; HSTS bez `includeSubDomains`; `Permissions-Policy` obejmuje tylko trzy funkcje. | średnia |
| 3 | `localStorage` | Kod synchronizacji (`kaczy.sync.v1`), token serwera powiadomień (`kaczy.push.token.v1`), adres przekaźnika (`kaczy.relay.v1`) — jawnie, dostępne dla każdego skryptu w domenie. Sprawdzić, czy kod trafia do kopii JSON i raportu diagnostycznego. | średnia |
| 4 | `push-server` | Serwer przechowuje tytuł i treść przypomnień jawnie (`cleanItems`: `title`, `body`). Operator serwera i każdy, kto przejmie plik danych, czyta przypomnienia. Jeden wspólny `PUSH_TOKEN` dla wszystkich urządzeń. | średnia (wysoka przy hostingu u obcych) |
| 5 | `relay-server` | `ALLOWED_ORIGINS` domyślnie `*`; `TRUST_PROXY` ustawiane ręcznie — błędne ustawienie wyłącza limit na IP albo pozwala go podrobić; serwer mówi czystym HTTP (TLS musi dać pośrednik). | średnia (konfiguracja) |
| 6 | `relayKeys.ts` | PBKDF2 200 000 ze stałą solą. Soli na pokój nie da się dodać — identyfikator pokoju wynika z kodu. Kod ma ok. 59 bitów; zgadywanie offline przez operatora to rząd 2^76 operacji — poza zasięgiem, ale margines jest mniejszy niż przy kluczu 128-bitowym, a tablica wyliczeń byłaby wspólna dla wszystkich użytkowników. | niska |
| 7 | `signaling-server` | `Dockerfile` na `node:20-alpine`, bez `USER` (proces jako root), bez pliku blokady zależności, poza macierzą CI. | średnia, jeśli wdrażany |
| 8 | CI | Brak `npm audit` dla aplikacji głównej; akcje przypięte do znacznika (`@v4`), nie do skrótu; brak automatu aktualizacji zależności; brak skanu sekretów. | średnia |
| 9 | `vaultPin.ts` | Pin nie obejmuje `iter`. Podmiana samej liczby iteracji w dokumencie daje fałszywe „złe hasło” i nabija dławienie (odmowa usługi, nie wyciek). | niska — w planie Skarbca K1 |
| 10 | Skarbiec a synchronizacja | Metadane skarbca (`wrapped`, `salt`) są w dokumencie — każdy, kto zna kod synchronizacji, może łamać hasło offline. Chroni tylko siła hasła (min. 12 znaków) i 600 000 iteracji. | do opisania w modelu; decyzja KR-1 w planie Skarbca |
| 11 | Treść renderowana | Mermaid, Markdown, podgląd importu, nazwy plików z udostępniania — miejsca z `innerHTML`/sanitizerem. Sprawdzić każde ujście. | sprawdzić |

## 2. Model zagrożeń (do zapisania jako `docs/model-zagrozen.md` w S0)

### 2.1 Co chronimy

| Aktywo | Gdzie jest | Poufność | Integralność | Dostępność |
|---|---|---|---|---|
| Notatki zwykłe, Praca, Długi, Grafik, klienci, faktury | IndexedDB (dokument Yjs), kopie, urządzenia w synchronizacji, przekaźnik (szyfrogram) | wysoka | wysoka | wysoka |
| Notatki prywatne | jak wyżej, dodatkowo szyfrowane kluczem skarbca | bardzo wysoka | wysoka | wysoka |
| Hasło skarbca, kod awaryjny | tylko w głowie i na papierze | bardzo wysoka | — | utrata = utrata notatek |
| Kod synchronizacji | `localStorage`, kod QR przy parowaniu | wysoka (daje cały dokument) | — | — |
| Token i klucze VAPID serwera powiadomień | zmienne środowiska serwera, `localStorage` klienta | średnia | wysoka | średnia |
| Dane klientów i NIP-y (KSeF) | dokument, eksporty XML | wysoka (dane osobowe — RODO) | wysoka | średnia |
| Obrazy i załączniki | `imageStore`, przekaźnik (bloby szyfrowane) | wysoka | średnia | średnia |

### 2.2 Granice zaufania

1. **Przeglądarka użytkownika** — zaufana. Rozszerzenia przeglądarki i inne aplikacje w tej samej domenie — nie.
2. **Hosting statyczny (Vercel)** — zaufany co do dostarczenia kodu. Kto zmieni wdrożenie, ma wszystko; nie da się tego wykluczyć w aplikacji webowej, da się zmniejszyć (przypięte wersje, przegląd wdrożeń, APK z F1 jako alternatywa).
3. **Serwer sygnalizacyjny WebRTC** — niezaufany: widzi nazwy pokoi i adresy IP, nie treść.
4. **Przekaźnik** — niezaufany co do poufności i integralności treści (widzi szyfrogram, rozmiary, czasy, IP); zaufany tylko co do dostępności.
5. **Serwer powiadomień** — dziś zaufany co do treści przypomnień (luka 4); docelowo niezaufany.
6. **Inne urządzenie w synchronizacji** — zaufane co do zwykłych notatek (zna kod), niezaufane co do skarbca (stąd pin i AAD).
7. **Plik importu, kopia, udostępnienie z innej aplikacji, schowek, plan DWG/PDF** — niezaufane wejście.

### 2.3 Przeciwnicy i scenariusze

| Kod | Przeciwnik | Co może | Główna obrona | Otwarte |
|---|---|---|---|---|
| T1 | Znalazca albo złodziej odblokowanego telefonu | Czyta wszystko poza skarbcem | Blokada skarbca po czasie i przy ukryciu, ukrywanie kwot | Blokada całej aplikacji (S1.8) |
| T2 | Złośliwa treść (wklejka, import, udostępnienie, plik planu) | XSS → odczyt dokumentu i sekretów z `localStorage`, wysyłka na dowolny host | CSP, sanitizer | Luki 1–3, 11 |
| T3 | Operator albo włamywacz na przekaźniku | Analiza ruchu, usuwanie i cofanie wpisów, zapełnienie pokoju | Szyfrowanie, AAD z identyfikatorem pokoju, limity | Powtórzenie i cofnięcie stanu (S2.3), luka 6 |
| T4 | Operator albo włamywacz na serwerze powiadomień | Czyta przypomnienia, wysyła fałszywe | Token, lista hostów | Luka 4 |
| T5 | Osoba znająca kod synchronizacji (były współużytkownik, podejrzany QR) | Pełny odczyt i zapis zwykłych danych, łamanie hasła skarbca offline, wstrzyknięcie metadanych skarbca | Pin, walidacja, AAD | Wymiana kodu z wyrzuceniem urządzenia (S2.1), luka 10 |
| T6 | Atak na łańcuch dostaw (zależność npm, akcja CI) | Kod w paczce produkcyjnej | Plik blokady | Luka 8 |
| T7 | Podsłuch w sieci | Nic (TLS, DTLS), o ile adresy są `https`/`wss` | `safeUrl.ts` | Wymuszenie schematu dla adresów serwerów (S1.2) |
| T8 | Utrata urządzenia albo danych | Brak dostępu | Kopie, kod awaryjny | Q1 planu QoL |
| T9 | Stara albo zmodyfikowana wersja klienta | Zapis w starym formacie, utrata nowych pól | Bramka formatu | Plan migracji |

**Poza zakresem (zapisać wprost w dokumencie):** złośliwe oprogramowanie na urządzeniu z dostępem do pamięci przeglądarki, przymus wobec użytkownika, błędy w przeglądarce i WebCrypto, ataki kanałem bocznym na sprzęt.

## Etap S0: dokument i baza (S)

| Nr | Punkt |
|---|---|
| S0.1 | `docs/model-zagrozen.md` z §2, uzupełniony o schemat przepływu danych (klient ↔ sygnalizacja ↔ urządzenie; klient ↔ przekaźnik; klient ↔ serwer powiadomień ↔ usługa push ↔ SW). |
| S0.2 | Potwierdzić albo odrzucić w kodzie obserwacje 3, 10 i 11 z §1; wynik dopisać do tabeli. Dla 11: lista wszystkich ujść HTML (`dangerouslySetInnerHTML`, `innerHTML`, `srcdoc`, `document.write`, `insertAdjacentHTML`) z nazwą sanitizera przy każdym. |
| S0.3 | `SECURITY.md` w katalogu głównym: jak zgłosić błąd, co jest w zakresie, obsługiwane wersje. |

## Etap S1: klient (Opus + `security-reviewer`)

| Nr | Punkt | Rozmiar |
|---|---|---|
| S1.1 | **Trusted Types** — Q2.1 planu QoL, ale wcześniej: po S0.2, w trybie raportu, potem egzekwowanie. To najtańsze trwałe zamknięcie T2. | M |
| S1.2 | **Zawężenie `connect-src`.** Wariant A (zalecany): `connect-src 'self'` plus stała lista usług zewnętrznych, a adresy własnych serwerów przechodzą przez jeden moduł `lib/net/endpoints.ts`, który wymusza `https:`/`wss:`, odrzuca adresy prywatne poza trybem deweloperskim i jest jedynym miejscem wywołującym `fetch`/`WebSocket` do hostów użytkownika (reguła ESLint). CSP zostaje szerokie tylko dla tych dwóch schematów, ale kod nie ma innej drogi na zewnątrz. Wariant B: po wdrożeniu własnych serwerów (S4) wpisać ich domeny do CSP i usunąć `https: wss:` — możliwe tylko przy stałych adresach (decyzja SE-2). | M |
| S1.3 | **Nagłówki:** `Cross-Origin-Opener-Policy: same-origin`; `Cross-Origin-Resource-Policy: same-origin`; pełna `Permissions-Policy` (wszystko nieużywane na `()`; używane — mikrofon, kamera, geolokalizacja, NFC, schowek — na `self`); HSTS z `includeSubDomains` tylko po sprawdzeniu, że żadna poddomena nie działa po HTTP; `X-Content-Type-Options`, `Referrer-Policy: no-referrer` — potwierdzić. Aktualizacja obu plików i testu. Sprawdzić, czy COOP nie psuje okna logowania passkey ani `window.open` do udostępniania. | S |
| S1.4 | **`style-src` bez `'unsafe-inline'`** — rozpoznanie: policzyć źródła stylów wbudowanych (Radix, framer-motion, recharts, `style={}`); `style-src-attr 'unsafe-inline'` + `style-src-elem 'self'` jako krok pośredni. Jeśli koszt duży — zapisać decyzję w ADR-2 i zostawić. | M |
| S1.5 | **Sekrety poza `localStorage`:** kod synchronizacji i token powiadomień do IndexedDB jako nieeksportowalny `CryptoKey` tam, gdzie to możliwe (klucze wyprowadzone z kodu), a sam kod pokazywany tylko przy parowaniu, po potwierdzeniu. Jeśli kod musi być odtwarzalny (pokazanie QR drugiemu urządzeniu) — zostaje, ale poza kopią JSON i poza raportem diagnostycznym (test). XSS nadal może użyć klucza, ale nie może go wynieść. | M |
| S1.6 | **Ujścia HTML z S0.2:** każde przez jeden sanitizer z listą dozwolonych znaczników; Mermaid w `securityLevel: "strict"` i renderowany do obrazu albo izolowanej ramki `sandbox` bez `allow-scripts` (sprawdzić obecny stan w `mermaidRender.ts`). Test z zestawem ładunków XSS dla każdego ujścia. | M |
| S1.7 | **Wejścia niezaufane — testy własności:** `fast-check` (tylko dev) dla parserów: kopia JSON, import Keep/ZIP, `shareTarget`, `shareLink`, wiadomości przekaźnika, metadane skarbca, pakiet budowy, KSeF XML. Własność: parser nie rzuca nieobsłużonego wyjątku, nie zwraca obiektu z `__proto__`/`constructor`, respektuje limity rozmiaru. | M |
| S1.8 | **Blokada aplikacji (opcjonalna, SE-3):** ekran blokady po czasie bezczynności odblokowywany passkey — zasłania treść, nie szyfruje jej. Opisać uczciwie w interfejsie, że to zasłona, nie szyfrowanie. | M |
| S1.9 | **Prywatność na ekranie:** zasłonięcie treści w przełączniku aplikacji przy `visibilitychange` dla skarbca i kwot; wyczyszczenie schowka po skopiowaniu kodu awaryjnego po 60 s (tam, gdzie przeglądarka pozwala). | S |
| S1.10 | **Service worker:** przejrzeć `sw-share.js`, `sw-notifications.js` — obsługa tylko żądań z własnego źródła (jest sprawdzanie `Sec-Fetch-Site` — potwierdzić zakres), adres z powiadomienia tylko ścieżką względną (serwer już to czyści; klient też powinien), brak `importScripts` spoza źródła. | S |

## Etap S2: synchronizacja i przekaźnik — protokół (Opus + `security-reviewer`)

| Nr | Punkt | Rozmiar |
|---|---|---|
| S2.1 | **Wymiana kodu z wyrzuceniem urządzenia:** „Nowy kod” tworzy nowy pokój, przenosi stan, usuwa stary pokój na przekaźniku (`DELETE`) i pokazuje listę urządzeń, które trzeba sparować ponownie. Dziś znający stary kod zachowuje dostęp do wszystkiego, co było i będzie w starym pokoju. Opisać w interfejsie, że to nie cofa tego, co już pobrano. | M |
| S2.2 | **Dłuższy kod przy nowym parowaniu:** 128 bitów w kodzie QR (QR i tak przenosi całość), krótka forma tylko do ręcznego wpisania z ostrzeżeniem. Stare kody działają dalej. Zamyka lukę 6 bez zmiany KDF. | S |
| S2.3 | **Cofnięcie i powtórzenie na przekaźniku:** klient pamięta najwyższy numer wpisu i skrót ostatniego stanu; przekaźnik zwracający mniej niż wcześniej → ostrzeżenie w stanie synchronizacji i wpis `logSecurity`, bez utraty danych lokalnych (Yjs i tak scala). Dokument opisuje, że operator może wstrzymywać wpisy — wykrywalne dopiero przy kontakcie z drugim urządzeniem inną drogą. | M |
| S2.4 | **Rozmiar jako kanał boczny:** bloby dopełniane do kubełków (np. potęgi 2 od 4 KB do 1 MB, dalej co 1 MB) — do decyzji (koszt miejsca do 2×). Wpisy dokumentu bez dopełniania; zapisać jako znane ograniczenie. | S |
| S2.5 | **Wiadomości od urządzeń:** limity rozmiaru i częstości dla awareness i aktualizacji przychodzących przez WebRTC (sprawdzić, co dało `mergeLimits`); pole `device` już czyszczone (`cleanSchemaClaim`). Test: urządzenie wysyłające 10 MB aktualizacji nie zawiesza karty. | M |
| S2.6 | **Wycofanie starych nazw pokoi** (v2, legacy): po okresie z `legacyRoomIdle.ts` klient przestaje do nich dołączać; starsze nazwy miały słabsze wyprowadzenie. Sprawdzić obecny stan i dopisać datę końca. | S |

## Etap S3: serwer powiadomień — treść niewidoczna dla serwera (Opus)

| Nr | Punkt | Rozmiar |
|---|---|---|
| S3.1 | **Szyfrowanie treści przypomnień po stronie klienta.** Klient tworzy klucz AES-GCM (nieeksportowalny, w IndexedDB dostępnej dla service workera), szyfruje `{title, body, url}` i wysyła serwerowi tylko `{key, at, enc}`. Serwer wysyła `enc` jako treść Web Push; `sw-notifications.js` odszyfrowuje w zdarzeniu `push` i pokazuje powiadomienie. Gdy odszyfrowanie się nie uda — ogólne „Masz przypomnienie”. AAD: identyfikator subskrypcji i `key`. Serwer przyjmuje oba formaty przez okres przejściowy. | M |
| S3.2 | **Token na urządzenie:** zamiast jednego `PUSH_TOKEN` — rejestracja zwraca token subskrypcji (losowy, serwer trzyma skrót), a `PUSH_TOKEN` służy tylko do rejestracji. Wyciek tokenu z jednego urządzenia nie pozwala zmieniać cudzych subskrypcji. | M |
| S3.3 | **Minimalizacja:** serwer nie zapisuje IP ani nagłówków; plik danych z prawami `600`; wpisy po wysyłce usuwane od razu (sprawdzić `tickStore`); `ALLOW_NO_AUTH` usunąć z obrazu produkcyjnego. | S |
| S3.4 | **Klucze VAPID:** tylko ze zmiennych środowiska w produkcji (dziś jest też ścieżka generowania do pliku — sprawdzić); procedura wymiany kluczy: nowe klucze → klienci subskrybują ponownie przy następnym uruchomieniu. | S |

## Etap S4: wdrożenie przekaźnika i serwera powiadomień (Opus; po F2)

Zmienia ADR-3 i ADR-4 („lokalnie, bez hostingu”) — zapisać jako **ADR-9**.

| Nr | Punkt | Rozmiar |
|---|---|---|
| S4.1 | **Wybór miejsca (SE-1).** (A) mały VPS w UE + Docker Compose + Caddy (automatyczny TLS) — pełna kontrola, ok. 4–6 € miesięcznie, aktualizacje po stronie właściciela. (B) platforma kontenerowa z wolumenem (Fly.io lub podobna) — mniej obsługi, zależność od dostawcy. (C) komputer domowy + tunel (Cloudflare Tunnel, Tailscale Funnel) — dane w domu, zależność od prądu i łącza. Zalecenie: A dla przekaźnika i powiadomień razem; C jako wariant, gdy właściciel nie chce płacić. | decyzja |
| S4.2 | **`deploy/`:** `compose.yml` (przekaźnik, powiadomienia, Caddy), `Caddyfile` (TLS, HSTS, limity rozmiaru i czasu, WebSocket), `.env.example`. Kontenery: użytkownik nie-root, `read_only: true`, `cap_drop: ALL`, `no-new-privileges`, wolumen tylko na dane, sieć wewnętrzna, porty serwerów niewystawione na zewnątrz, obrazy przypięte do skrótu. | M |
| S4.3 | **Konfiguracja bez pułapek:** serwer odmawia startu, gdy `NODE_ENV=production` i `ALLOWED_ORIGINS` zawiera `*` albo jest puste; `TRUST_PROXY=1` wymaga adresu zaufanego pośrednika; ostrzeżenie w logu, gdy nagłówek `X-Forwarded-For` przychodzi przy `TRUST_PROXY=0`. Testy. | S |
| S4.4 | **Limity do warunków serwera:** `MAX_ROOMS`, `MAX_ROOM_BLOB_BYTES` (300 MB × pokoje może przekroczyć dysk) ze zmiennych środowiska; kontrola wolnego miejsca przed zapisem; odpowiedź 507 zamiast awarii. Wspólne z F2. | S |
| S4.5 | **Dzienniki:** bez treści, bez tokenów, IP skrócone albo solony skrót zmieniany co dobę; retencja 7 dni; poziomy. Test, że żaden log nie zawiera nagłówka `Authorization`. | S |
| S4.6 | **Zdrowie i nadzór:** `GET /health` (bez danych), zewnętrzny monitor dostępności, alert o zajętości dysku > 80%. | S |
| S4.7 | **Kopie danych serwera:** przekaźnik — szyfrogram, kopia nie jest konieczna (urządzenia mają pełny stan), ale utrata danych przekaźnika nie może gubić zmian niewysłanych — potwierdzić testem ponownego wysłania stanu do pustego pokoju. Powiadomienia — klient odtwarza harmonogram przy starcie (sprawdzić). | S |
| S4.8 | **Aktualizacje:** obraz bazowy i zależności co miesiąc (automat z S5.2), procedura wdrożenia i wycofania w `deploy/README.md`. | S |
| S4.9 | **`signaling-server`:** albo doprowadzić do poziomu pozostałych (`node:22-alpine`, `USER node`, plik blokady, CI, limity połączeń i rozmiaru wiadomości), albo usunąć z repo i opisać publiczne serwery jako opcję. Decyzja SE-4. | S |
| S4.10 | **Po wdrożeniu:** adresy w CSP (S1.2 wariant B), domyślne adresy w aplikacji za flagą, e2e z prawdziwym serwerem w CI (kontener usługi), przegląd `security-reviewer` całego `deploy/`. | M |
| S4.11 | **RODO w skrócie:** serwer przetwarza adresy IP i szyfrogram; jeśli korzysta z niego ktokolwiek poza właścicielem — krótka informacja o przetwarzaniu i miejscu serwera. Jeśli tylko właściciel — notatka w dokumencie, bez dalszych kroków. | S |

## Etap S5: łańcuch dostaw i CI (Sonnet)

| Nr | Punkt | Rozmiar |
|---|---|---|
| S5.1 | `npm audit --omit=dev --audit-level=high` dla aplikacji głównej w CI (osobny krok, żeby błąd audytu nie zasłaniał testów). | S |
| S5.2 | Automat aktualizacji (Dependabot albo Renovate): npm w czterech katalogach, akcje GitHub, obrazy Docker; grupowanie tygodniowe; poprawki bezpieczeństwa od razu. | S |
| S5.3 | Akcje przypięte do pełnego skrótu; `permissions: contents: read` na poziomie przepływu; brak sekretów w zadaniach uruchamianych z PR z forka. | S |
| S5.4 | Skan sekretów (ochrona przed wypchnięciem w GitHub + `gitleaks` w CI); jednorazowy skan historii. | S |
| S5.5 | Zasoby wbudowane poza npm (Mermaid, OCR w `public/`): plik z wersją, źródłem i sumą SHA-256 każdego; test porównujący sumy. | S |
| S5.6 | `npm ci --ignore-scripts` w CI tam, gdzie się da; lista pakietów wymagających skryptów instalacyjnych. | S |
| S5.7 | Licencje zależności produkcyjnych — jednorazowy spis w `docs/`. | S |

## Etap S6: reagowanie i utrzymanie (Sonnet)

| Nr | Punkt |
|---|---|
| S6.1 | `docs/reagowanie.md` — procedury krok po kroku: zgubiony telefon; wyciek kodu synchronizacji (S2.1); wyciek hasła skarbca (opcja „hasło wyciekło” z planu Skarbca); przejęty serwer (wymiana tokenów i kluczy VAPID, nowy pokój); złośliwa zależność (wycofanie wdrożenia, wersja SW wymuszająca aktualizację). |
| S6.2 | **Wyłącznik awaryjny klienta:** sprawdzić, czy istnieje sposób wymuszenia aktualizacji service workera i wyczyszczenia pamięci podręcznej po wadliwym wdrożeniu; jeśli nie — dodać. |
| S6.3 | Ekran „Bezpieczeństwo” w Ustawieniach: dziennik `kaczy.security.log.v1` czytelnie, stan skarbca, lista urządzeń, data ostatniej kopii, wynik `storage.persisted`. Sprawdzić, co już jest. |
| S6.4 | Przegląd roczny: lista kontrolna w `docs/model-zagrozen.md` z datą ostatniego przeglądu. |

## Decyzje właściciela

- **SE-1:** gdzie stoją serwery (VPS / platforma / dom) i czy w ogóle wdrażać teraz.
- **SE-2:** stałe adresy serwerów (pozwala zawęzić CSP) czy dowolne wpisywane przez użytkownika.
- **SE-3:** blokada całej aplikacji passkey (S1.8).
- **SE-4:** własny serwer sygnalizacyjny czy publiczne.
- **SE-5:** dopełnianie rozmiaru blobów (S2.4).
- **SE-6:** czy z serwerów będzie korzystał ktoś poza właścicielem (zmienia S3.2, S4.4, S4.11).

## Kolejność

S0 → S5.1, S5.3, S5.4 (tanie, od razu) → S1.3, S1.1, S1.6 → S1.2, S1.5 → S3.1 → S2.1, S2.2 → F2 (plan Fable) → S4 → S2.3–S2.6 → S1.4, S1.7–S1.10 → S6.

Bez wdrożenia serwerów (SE-1 = nie teraz) sens mają: S0, S1, S2.1, S2.2, S2.5, S3.1 (także lokalnie), S5, S6.

## Weryfikacja

Każdy punkt S1–S4: test jednostkowy albo e2e pokazujący atak przed poprawką i jego niepowodzenie po; `securityHeaders.test.ts`, `e2e/csp.spec.ts`, testy serwerów; przegląd agentem `security-reviewer` na diffie; wpis w `opis.md` (dział „Bezpieczeństwo”) i aktualizacja `docs/model-zagrozen.md`.

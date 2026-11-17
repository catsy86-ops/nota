# Plan: bezpieczeństwo — model zagrożeń, twardnienie, wdrożenie przekaźnika i serwera powiadomień (2026-11-15)

> **Status:** zapisany, realizacja nie zaczęta. Wykonawca: Opus + agent `security-reviewer` przy każdym punkcie S1–S4; Sonnet przy S5 i dokumentach.
>
> **Powiązane, nie powtarzane tutaj:** kryptografia Skarbca — `plan-skarbiec-krypto-2026-11-15.md`; format danych i migracje — `plan-migracje-yjs-2026-11-15.md`; trwałość i limity pamięci przekaźnika — F2 w `plan-fable-2026-11-15.md` (warunek wstępny S4); Trusted Types i CSP z jednego źródła — Q2 w `plan-qol-platforma-2026-11-15.md` (tu tylko kolejność i uzupełnienia).
>
> **Zastrzeżenie:** stan w §1 pochodzi z czytania kodu 2026-11-15, nie z testów penetracyjnych. Hipotezy z pierwszej wersji są rozstrzygnięte w §1a (tabela luk niżej jest już według niej poprawiona); „sprawdzić” zostało tylko tam, gdzie §1a wymienia rzecz jako niesprawdzoną albo gdzie potrzebna jest przeglądarka lub działający serwer.

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
| 1 | `vercel.json` | `connect-src 'self' https: wss:` — dowolny host. Po XSS dane można wysłać gdziekolwiek. Powód: adresy serwerów wpisuje użytkownik. Samo zawężenie nie zamyka wycieku (WebRTC i nawigacja są poza `connect-src`, §1a). | średnia |
| 2 | `vercel.json` | `style-src 'unsafe-inline'`; brak Trusted Types; brak COOP/CORP; HSTS bez `includeSubDomains`; `Permissions-Policy` obejmuje tylko trzy funkcje. | średnia |
| 3 | `localStorage` | Kod synchronizacji (`kaczy.sync.v1`), token serwera powiadomień (`kaczy.push.token.v1`), adres przekaźnika (`kaczy.relay.v1`) — jawnie, dostępne dla każdego skryptu w domenie. Do kopii JSON i raportu diagnostycznego nie trafiają (§1a). | średnia |
| 4 | `push-server` | Serwer przechowuje tytuł i treść przypomnień jawnie (`cleanItems`: `title`, `body`). Operator serwera i każdy, kto przejmie plik danych, czyta przypomnienia. Jeden wspólny `PUSH_TOKEN` dla wszystkich urządzeń. | średnia (wysoka przy hostingu u obcych) |
| 5 | `relay-server` | `ALLOWED_ORIGINS` domyślnie `*`; `TRUST_PROXY` ustawiane ręcznie — błędne ustawienie wyłącza limit na IP albo pozwala go podrobić; serwer mówi czystym HTTP (TLS musi dać pośrednik). | średnia (konfiguracja) |
| 6 | `relayKeys.ts` | PBKDF2 200 000 ze stałą solą. Soli na pokój nie da się dodać — identyfikator pokoju wynika z kodu. Kod ma ok. 59 bitów; zgadywanie offline przez operatora to rząd 2^76 operacji — poza zasięgiem, ale margines jest mniejszy niż przy kluczu 128-bitowym, a tablica wyliczeń byłaby wspólna dla wszystkich użytkowników. | niska |
| 7 | `signaling-server` | `Dockerfile` na `node:20-alpine`, bez `USER` (proces jako root), bez pliku blokady zależności, poza macierzą CI. | średnia, jeśli wdrażany |
| 8 | CI | Brak `npm audit` dla aplikacji głównej; akcje przypięte do znacznika (`@v4`), nie do skrótu; brak automatu aktualizacji zależności; brak skanu sekretów. | średnia |
| 9 | `vaultPin.ts` | Pin nie obejmuje `iter`. Podmiana samej liczby iteracji w dokumencie daje fałszywe „złe hasło” i nabija dławienie (odmowa usługi, nie wyciek). | niska — w planie Skarbca K1 |
| 10 | Skarbiec a synchronizacja | Metadane skarbca (`wrapped`, `salt`) są w dokumencie — każdy, kto zna kod synchronizacji, może łamać hasło offline. Chroni tylko siła hasła (min. 12 znaków) i 600 000 iteracji. | do opisania w modelu; decyzja KR-1 w planie Skarbca |
| 11 | Treść renderowana | Jedno ujście HTML w całym `src/`: SVG Mermaida przez `dangerouslySetInnerHTML` (`MermaidBlock.tsx:51`, `securityLevel: "strict"`, bez własnego sanitizera). Markdown, podgląd importu i nazwy plików renderuje React (§1a). | średnia |

### 1a. Weryfikacja z kodem (2026-11-15, Fable)

Sprawdzone czytaniem kodu na `3cc066d6`; bez uruchamiania testów. Punkty etapów niżej są już poprawione według tej tabeli.

| Dotyczy | Wynik | Dowód |
|---|---|---|
| Luka 1 | **Potwierdzona, ale zawężenie `connect-src` nie zamyka wycieku po XSS.** Aplikacja używa WebRTC, a `connect-src` nie obejmuje kanałów danych `RTCPeerConnection` ani nawigacji (`location =`, `window.open`). S1.2 ogranicza przypadkowe połączenia, nie atakującego; realną obroną przed T2 jest S1.1 (Trusted Types) i brak ujść HTML. Waga S1.2: średnia, nie wysoka. | `vercel.json:102` |
| Luka 2 | Potwierdzona. `Permissions-Policy` ma tylko `camera`, `geolocation`, `payment`; mikrofon działa z domyślnego `self`. | `vercel.json:113–118`, `netlify.toml:78–82` |
| Luka 3 | Częściowo nieaktualna: kod synchronizacji **nie** trafia do kopii (`SETTINGS_KEYS` go pomija, tak samo token powiadomień i adres przekaźnika), a raport diagnostyczny wycina kod (`redact`). Zostaje sam fakt jawnego zapisu w `localStorage`. | `exportNotes.ts:278–302`, `diagnostics.ts:170–208` |
| Luka 4 | Potwierdzona: `cleanItems` zapisuje `title` i `body`; jeden `PUSH_TOKEN`. Katalog danych `0700` i pliki `0600` **już są**. | `push-server/core.js:84–98`, `server.js:22, 48, 63, 81` |
| Luka 5 | Potwierdzona: `ALLOWED_ORIGINS` domyślnie `*`; przy `TRUST_PROXY=1` brany jest ostatni wpis `X-Forwarded-For`. | `relay-server/server.js:28–29, 100` |
| Luka 6 | Potwierdzona (200 000, stała sól; kod 12 znaków z 31 = 59,4 bitu). **Poważniejszy wariant tej samej luki jest gdzie indziej:** nazwa pokoju v2 to szybki SHA-256 kodu i trafia do publicznych serwerów sygnalizacyjnych — w oknie zgodności v2 (30 dni, `v2Until`) operator serwera może zgadywać kod offline bez wolnego KDF. Pokój v3 (PBKDF2 200 000) już to naprawia. Stąd S2.6 wyżej w kolejności. | `relayKeys.ts:45–48`, `yjsSync.ts:24–27, 208–230, 274–286` |
| Luka 7 | Potwierdzona. Katalog zawiera tylko `Dockerfile`, `package.json` i README — to gotowy program `y-webrtc-signaling`, własnego kodu nie ma, więc limitów połączeń nie da się dodać bez pisania serwera. | `signaling-server/Dockerfile`, `package.json` |
| Luka 8 | Potwierdzona: audyt tylko w zadaniu `servers`; akcje `@v4`; brak bloku `permissions`. | `.github/workflows/ci.yml` |
| Luka 9 | Potwierdzona. | `vaultPin.ts:8–15, 61–67` |
| Luka 11 | **Jedno ujście HTML w całym `src/`:** `MermaidBlock.tsx:51` (`dangerouslySetInnerHTML` z SVG Mermaida, `securityLevel: "strict"`). Markdown renderuje React, import Keep czyta tylko `data` węzłów. Brak `innerHTML`, `srcdoc`, `insertAdjacentHTML`, `document.write`. S0.2 i S1.6 są więc małe, a Trusted Types (S1.1) potrzebuje polityki tylko dla Mermaida. | `MermaidBlock.tsx:50–51`, `mermaidRender.ts:90` |
| S1.2 | Przekaźnik i serwer powiadomień **już** wymuszają `https:` (z wyjątkiem `localhost`). Lista serwerów sygnalizacyjnych przyjmuje `ws://` do dowolnego hosta — w produkcji blokuje to dopiero CSP. | `relayRuntime.ts:19–26`, `push/prefs.ts:56–63`, `yjsSync.ts:236–249` |
| S1.5 | `y-webrtc` dostaje kod jako napis (`password: code`), więc przy synchronizacji WebRTC kodu nie da się trzymać jako nieeksportowalnego klucza. Do zrobienia zostaje tylko token powiadomień i klucze przekaźnika. | `yjsSync.ts:259–262` |
| S1.10 | `sw-share.js` sprawdza nagłówek `Origin`, nie `Sec-Fetch-Site` (komentarz w pliku: ten nagłówek nie dochodzi do service workera); znana luka — strona z nieprzezroczystym źródłem wysyła `null` i przechodzi. `sw-notifications.js` **już** przyjmuje tylko ścieżkę względną. | `public/sw-share.js:19–28`, `public/sw-notifications.js:72` |
| S2.1 | `DELETE` pokoju na przekaźniku istnieje. | `relay-server/server.js:275` |
| S2.5 | `mergeLimits` nie istnieje w kodzie — nazwa pada tylko w `docs/audyt-bledow-2026-11-11.md`. | wyszukiwanie w `src/`, `relay-server/`, `push-server/` |
| S3.4 | Potwierdzone: bez zmiennych środowiska klucze VAPID są generowane do `vapid.json`. | `push-server/server.js:52–64` |
| S4.4 | Limity są stałymi w `LIMITS`, nie zmiennymi środowiska: 5000 pokoi × (300 MB blobów + 50 MB dziennika). | `relay-server/core.js:6–15` |
| S4.6 | `GET /health` istnieje w obu serwerach, z `HEALTHCHECK` w obrazach. | `relay-server/server.js:266`, `push-server/server.js:183` |

Nie sprawdzone: zachowanie COOP z oknem passkey i `window.open` (wymaga przeglądarki), faktyczne limity wiadomości WebRTC w `y-webrtc`, `tickStore` w serwerze powiadomień.

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
| S0.2 | Obserwacje 3 i 11 są rozstrzygnięte w §1a — przenieść wynik do `docs/model-zagrozen.md`. Zostaje: (a) **test-strażnik ujść HTML** — wyszukiwanie `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `srcdoc`, `document.write`, `insertAdjacentHTML`, `createContextualFragment` w `src/` z listą dozwolonych (dziś jeden wpis: `MermaidBlock.tsx`); nowe ujście bez wpisu nie przechodzi; (b) obserwacja 10 — opis w modelu zagrożeń, decyzja KR-1 w planie Skarbca; (c) rzeczy z listy „Nie sprawdzone” pod §1a. |
| S0.3 | `SECURITY.md` w katalogu głównym: jak zgłosić błąd, co jest w zakresie, obsługiwane wersje. |

## Etap S1: klient (Opus + `security-reviewer`)

| Nr | Punkt | Rozmiar |
|---|---|---|
| S1.1 | **Trusted Types** — Q2.1 planu QoL, ale wcześniej: po S0.2, w trybie raportu, potem egzekwowanie. To najtańsze trwałe zamknięcie T2: polityka jest potrzebna tylko dla Mermaida (§1a). Przed startem sprawdzić obsługę w przeglądarkach docelowych (Chrome na Androidzie, Safari na iOS, Firefox); tam, gdzie jej nie ma, chroni wyłącznie strażnik z S0.2 i S1.6 — dlatego S1.6 nie jest opcjonalne. | M |
| S1.2 | **Zawężenie `connect-src`.** Wariant A (zalecany, dopóki adresy wpisuje użytkownik): CSP **zostaje** `connect-src 'self' https: wss:` — listy hostów nie da się wpisać z góry — a ograniczenie robi kod: adresy serwerów przechodzą przez jeden moduł `lib/net/endpoints.ts`, który wymusza `https:`/`wss:` i jest jedynym miejscem wywołującym `fetch`/`WebSocket` do hostów użytkownika (reguła ESLint zakazująca `fetch(`, `new WebSocket(` i `EventSource` poza nim i poza listą wyjątków). Adresów prywatnych i `localhost` moduł **nie odrzuca**: ADR-3 i ADR-4 zakładają serwery uruchamiane lokalnie, więc to dziś główny przypadek użycia; dostają tylko oznaczenie „serwer lokalny” w ustawieniach. To chroni przed pomyłką w kodzie i przed `ws://` do obcego hosta, nie przed atakującym. Walidacja `https:` dla przekaźnika i powiadomień już jest — moduł ją scala i dokłada serwery sygnalizacyjne (dziś przyjmują `ws://`). Zapisać w modelu zagrożeń, że to nie zamyka wycieku po XSS (WebRTC i nawigacja są poza `connect-src`, patrz §1a). Wariant B: po wdrożeniu własnych serwerów (S4) wpisać ich domeny do CSP i usunąć `https: wss:` — możliwe tylko przy stałych adresach (decyzja SE-2). | M |
| S1.3 | **Nagłówki:** `Cross-Origin-Opener-Policy: same-origin`; `Cross-Origin-Resource-Policy: same-origin`; pełna `Permissions-Policy` (wszystko nieużywane na `()`; używane — mikrofon, kamera, geolokalizacja, NFC, schowek — na `self`); HSTS z `includeSubDomains` tylko po sprawdzeniu, że żadna poddomena nie działa po HTTP; `X-Content-Type-Options`, `Referrer-Policy: no-referrer` — potwierdzić. Aktualizacja obu plików i testu. Sprawdzić, czy COOP nie psuje okna logowania passkey ani `window.open` do udostępniania. | S |
| S1.4 | **`style-src` bez `'unsafe-inline'`** — rozpoznanie: policzyć źródła stylów wbudowanych (Radix, framer-motion, recharts, `style={}`); `style-src-attr 'unsafe-inline'` + `style-src-elem 'self'` jako krok pośredni. Jeśli koszt duży — zapisać decyzję w ADR-2 i zostawić. | M |
| S1.5 | **Sekrety a `localStorage` — zakres po weryfikacji mały.** Kod synchronizacji musi zostać napisem, dopóki działa `y-webrtc` (dostaje go jako `password`) i dopóki pokazujemy QR, a klucze przekaźnika wyprowadza się z tego samego kodu — trzymanie ich jako nieeksportowalnego `CryptoKey` nic nie daje, skoro kod leży obok. Token powiadomień jest tokenem na okaziciela wysyłanym w nagłówku, więc też musi być czytelny dla skryptu; przeniesienie do IndexedDB nie chroni przed XSS (to samo źródło). Do zrobienia: (a) test pilnujący, że kod, token i adres przekaźnika nie trafiają do kopii JSON ani raportu diagnostycznego; (b) kod pokazywany w ustawieniach dopiero po potwierdzeniu; (c) opis w modelu zagrożeń, że XSS = utrata kodu, a obroną jest S1.1 i S2.1. Prawdziwe „klucza nie da się wynieść” wymaga zmiany protokołu: podpis żądań kluczem nieeksportowalnym zamiast tokenu (razem z S3.2) i tryb „tylko przekaźnik” bez `y-webrtc` — osobna decyzja, nie ten punkt. | S |
| S1.6 | **Ujście HTML Mermaida** (jedyne, §1a): dziś SVG z `securityLevel: "strict"` wstawiane przez `dangerouslySetInnerHTML` bez drugiej warstwy — bezpieczeństwo zależy od poprawności jednej biblioteki. Dodać drugą warstwę: SVG jako obraz (`<img>` z adresem `blob:` — skrypty w SVG wczytanym jako obraz się nie wykonują; sprawdzić, czy czcionki i etykiety `foreignObject` renderują się poprawnie) albo ramka `sandbox` bez `allow-scripts`. Sanitizer jako nowa zależność tylko, gdy oba warianty odpadną (budżet paczki). Test z zestawem ładunków XSS w źródle diagramu. | M |
| S1.7 | **Wejścia niezaufane — testy własności:** `fast-check` (już jest w `devDependencies`) dla parserów: kopia JSON, import Keep/ZIP, `shareTarget`, `shareLink`, wiadomości przekaźnika, metadane skarbca, pakiet budowy, KSeF XML. Własność: parser nie rzuca nieobsłużonego wyjątku, nie zwraca obiektu z `__proto__`/`constructor`, respektuje limity rozmiaru. | M |
| S1.8 | **Blokada aplikacji (opcjonalna, SE-3):** ekran blokady po czasie bezczynności odblokowywany passkey — zasłania treść, nie szyfruje jej. Opisać uczciwie w interfejsie, że to zasłona, nie szyfrowanie. | M |
| S1.9 | **Prywatność na ekranie:** zasłonięcie treści w przełączniku aplikacji przy `visibilitychange` dla skarbca i kwot; wyczyszczenie schowka po skopiowaniu kodu awaryjnego po 60 s (tam, gdzie przeglądarka pozwala). | S |
| S1.10 | **Service worker:** przejrzeć `sw-share.js`, `sw-notifications.js` — `sw-share.js` sprawdza `Origin` i przepuszcza `null` (udostępnienie z systemu, ale też strona w piaskownicy) — ocenić, co taka strona może wrzucić do skrzynki udostępnień, i ograniczyć rozmiar oraz typy tam, nie w nagłówku; adres z powiadomienia klient już czyści (dopisać test); brak `importScripts` spoza źródła. | S |

## Etap S2: synchronizacja i przekaźnik — protokół (Opus + `security-reviewer`)

| Nr | Punkt | Rozmiar |
|---|---|---|
| S2.1 | **Wymiana kodu z wyrzuceniem urządzenia:** „Nowy kod” tworzy nowy pokój, przenosi stan, usuwa stary pokój na przekaźniku (`DELETE`) i pokazuje listę urządzeń, które trzeba sparować ponownie (z rejestru urządzeń — D4.1 w planie migracji; bez niego lista jest tylko tym, co pamięta `syncSeen`). Przed opuszczeniem starego pokoju urządzenie zapisuje w dokumencie znacznik „kod zmieniony” (bez nowego kodu): pozostałe urządzenia po jego odebraniu pokazują „sparuj ponownie” i przestają wysyłać — inaczej pisałyby dalej do pokoju, którego nikt już nie czyta, a ich zmiany ginęłyby bez ostrzeżenia. Urządzenie offline w chwili wymiany znacznika nie zobaczy, jeśli pokój na przekaźniku został usunięty — opisać: jego niewysłane zmiany wchodzą dopiero po ponownym sparowaniu (scalenie Yjs). Znacznik jest niezaufany (każdy z kodem może go wpisać) — skutkiem jest tylko prośba o ponowne sparowanie. Dziś znający stary kod zachowuje dostęp do wszystkiego, co było i będzie w starym pokoju. Opisać w interfejsie, że to nie cofa tego, co już pobrano. | M |
| S2.2 | **Dłuższy kod przy nowym parowaniu:** 128 bitów w kodzie QR (QR i tak przenosi całość), krótka forma tylko do ręcznego wpisania z ostrzeżeniem. Stare kody działają dalej. Zamyka lukę 6 bez zmiany KDF. | S |
| S2.3 | **Cofnięcie i powtórzenie na przekaźniku:** klient pamięta najwyższy numer wpisu i skrót ostatniego stanu; przekaźnik zwracający mniej niż wcześniej → ostrzeżenie w stanie synchronizacji i wpis `logSecurity`, bez utraty danych lokalnych (Yjs i tak scala). Uzgodnić z F2: jeśli przekaźnik kompaktuje dziennik pokoju, numer wpisu musi pozostać monotoniczny, inaczej zwykłe sprzątanie będzie wyglądało jak cofnięcie. Dokument opisuje, że operator może wstrzymywać wpisy — wykrywalne dopiero przy kontakcie z drugim urządzeniem inną drogą. | M |
| S2.4 | **Rozmiar jako kanał boczny:** bloby dopełniane do kubełków (np. potęgi 2 od 4 KB do 1 MB, dalej co 1 MB) — do decyzji (koszt miejsca do 2×). Wpisy dokumentu bez dopełniania; zapisać jako znane ograniczenie. | S |
| S2.5 | **Wiadomości od urządzeń:** limity rozmiaru i częstości dla awareness i aktualizacji przychodzących przez WebRTC (`mergeLimits` z audytu 2026-11-11 nie ma w kodzie — zacząć od ustalenia, czy jakikolwiek limit istnieje w `yjsSync.ts` i `imageSync`); pole `device` już czyszczone (`cleanSchemaClaim`). Test: urządzenie wysyłające 10 MB aktualizacji nie zawiesza karty. | M |
| S2.6 | **Wycofanie starych nazw pokoi** (v2, legacy): po okresie z `legacyRoomIdle.ts` klient przestaje do nich dołączać; starsze nazwy miały słabsze wyprowadzenie. Stan: v3 (PBKDF2) jest domyślny, v2 (szybki SHA-256 kodu, widoczny dla serwera sygnalizacyjnego) żyje 30 dni po przejściu, pokój najstarszy — do wygaśnięcia bezczynności. Do zrobienia: po oknie v2 zaproponować nowy kod, bo stary mógł zostać odgadnięty z nazwy pokoju v2; dopisać datę końca pokoju najstarszego. | S |

## Etap S3: serwer powiadomień — treść niewidoczna dla serwera (Opus)

| Nr | Punkt | Rozmiar |
|---|---|---|
| S3.1 | **Szyfrowanie treści przypomnień po stronie klienta.** Klient tworzy klucz AES-GCM (nieeksportowalny, w IndexedDB dostępnej dla service workera), szyfruje `{title, body, url}` i wysyła serwerowi tylko `{key, at, enc}`. Serwer wysyła `enc` jako treść Web Push; `sw-notifications.js` odszyfrowuje w zdarzeniu `push` i pokazuje powiadomienie. Gdy odszyfrowanie się nie uda — ogólne „Masz przypomnienie” (powiadomienie trzeba pokazać zawsze: przeglądarki wymagają widocznego powiadomienia na każde zdarzenie `push`). AAD: wersja formatu i `key` pozycji — nie identyfikator subskrypcji, bo ten zmienia się przy odnowieniu subskrypcji i unieważniłby zapisane pozycje. Klucz jest na urządzenie; serwer trzyma pozycje na subskrypcję (`store.subs[id].items`, `push-server/core.js`), więc każde urządzenie szyfruje swoje. Ograniczenia do wpisania w testy: treść Web Push ma ok. 4 KB, więc `enc` ≤ 3 KB (przyciąć `body` przed szyfrowaniem); klucz utracony po wyczyszczeniu danych strony → klient tworzy nowy i wysyła harmonogram od nowa; `url` po odszyfrowaniu przechodzi tę samą kontrolę ścieżki względnej co dziś. Serwer przyjmuje oba formaty przez okres przejściowy; data jego końca do dziennika zmian. | M |
| S3.2 | **Token na urządzenie:** zamiast jednego `PUSH_TOKEN` — rejestracja zwraca token subskrypcji (losowy, serwer trzyma skrót), a `PUSH_TOKEN` służy tylko do rejestracji. Wyciek tokenu z jednego urządzenia nie pozwala zmieniać cudzych subskrypcji. | M |
| S3.3 | **Minimalizacja:** serwer nie zapisuje IP ani nagłówków (potwierdzić testem); prawa `600`/`700` już są; wpisy po wysyłce usuwane od razu (sprawdzić `tickStore`); `ALLOW_NO_AUTH` to zmienna środowiska, nie część obrazu — serwer ma odmawiać startu, gdy `NODE_ENV=production` i `ALLOW_NO_AUTH=1`. | S |
| S3.4 | **Klucze VAPID:** tylko ze zmiennych środowiska w produkcji (dziś bez nich serwer generuje klucze do `vapid.json` — potwierdzone, §1a; w produkcji ma odmówić startu); procedura wymiany kluczy: nowe klucze unieważniają wszystkie subskrypcje, więc klient porównuje klucz publiczny serwera z kluczem swojej subskrypcji przy starcie i przy różnicy subskrybuje ponownie — sprawdzić, czy to porównanie już istnieje, i dopisać test. | S |

## Etap S4: wdrożenie przekaźnika i serwera powiadomień (Opus; po F2)

Zmienia ADR-3 i ADR-4 („lokalnie, bez hostingu”) — zapisać jako **ADR-9**.

| Nr | Punkt | Rozmiar |
|---|---|---|
| S4.1 | **Wybór miejsca (SE-1).** (A) mały VPS w UE + Docker Compose + Caddy (automatyczny TLS) — pełna kontrola, ok. 4–6 € miesięcznie, aktualizacje po stronie właściciela. (B) platforma kontenerowa z wolumenem (Fly.io lub podobna) — mniej obsługi, zależność od dostawcy. (C) komputer domowy + tunel (Cloudflare Tunnel, Tailscale Funnel) — dane w domu, zależność od prądu i łącza. Zalecenie: A dla przekaźnika i powiadomień razem; C jako wariant, gdy właściciel nie chce płacić. | decyzja |
| S4.2 | **`deploy/`:** `compose.yml` (przekaźnik, powiadomienia, Caddy), `Caddyfile` (TLS, HSTS, limity rozmiaru i czasu, WebSocket), `.env.example`. Kontenery: użytkownik nie-root, `read_only: true`, `cap_drop: ALL`, `no-new-privileges`, wolumen tylko na dane, sieć wewnętrzna, porty serwerów niewystawione na zewnątrz, obrazy przypięte do skrótu. | M |
| S4.3 ✅ 2026-11-17 (`relay-server/config.js`; serwer powiadomień — osobno) | **Konfiguracja bez pułapek:** serwer odmawia startu, gdy `NODE_ENV=production` i `ALLOWED_ORIGINS` zawiera `*` albo jest puste; `TRUST_PROXY=1` wymaga adresu zaufanego pośrednika; ostrzeżenie w logu, gdy nagłówek `X-Forwarded-For` przychodzi przy `TRUST_PROXY=0`. Testy. | S |
| S4.4 ✅ 2026-11-17 (`config.js`, `storage.js`: `MAX_TOTAL_BYTES`, `MIN_FREE_BYTES`) | **Limity do warunków serwera:** `MAX_ROOMS`, `MAX_ROOM_BLOB_BYTES` (300 MB × pokoje może przekroczyć dysk) ze zmiennych środowiska; kontrola wolnego miejsca przed zapisem; odpowiedź 507 zamiast awarii. Wspólne z F2. | S |
| S4.5 | **Dzienniki:** bez treści, bez tokenów, IP skrócone albo solony skrót zmieniany co dobę; retencja 7 dni; poziomy. Test, że żaden log nie zawiera nagłówka `Authorization`. | S |
| S4.6 | **Zdrowie i nadzór:** `GET /health` już jest w obu serwerach — potwierdzić, że nie zwraca danych; zewnętrzny monitor dostępności, alert o zajętości dysku > 80%. | S |
| S4.7 | **Kopie danych serwera:** przekaźnik — szyfrogram, kopia nie jest konieczna (urządzenia mają pełny stan), ale utrata danych przekaźnika nie może gubić zmian niewysłanych — potwierdzić testem ponownego wysłania stanu do pustego pokoju. Powiadomienia — klient odtwarza harmonogram przy starcie (sprawdzić). | S |
| S4.8 | **Aktualizacje:** obraz bazowy i zależności co miesiąc (automat z S5.2), procedura wdrożenia i wycofania w `deploy/README.md`. | S |
| S4.9 | **`signaling-server`:** albo doprowadzić do poziomu pozostałych (`node:22-alpine`, `USER node`, plik blokady, CI; limity połączeń i rozmiaru wiadomości wymagają własnego kodu, bo dziś to gotowy program z `y-webrtc`), albo usunąć z repo i opisać publiczne serwery jako opcję. Decyzja SE-4. | S |
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

S0 → S5.1, S5.3, S5.4 (tanie, od razu) → S1.3, S1.1, S1.6 → S2.6, S2.2, S2.1 (kod i nazwy pokoi — dotyczą publicznych serwerów sygnalizacyjnych używanych już dziś; S2.1 najlepiej po D4.1 z planu migracji) → S2.5 (limity wiadomości WebRTC — nie zależy od serwerów) → S1.2, S1.5 → S3.1 → F2 (plan Fable) → S4 → S2.3, S2.4 → S1.4, S1.7–S1.10 → S6.

Bez wdrożenia serwerów (SE-1 = nie teraz) sens mają: S0, S1, S2.1, S2.2, S2.5, S2.6, S3.1 (także lokalnie), S5, S6.

## Weryfikacja

Każdy punkt S1–S4: test jednostkowy albo e2e pokazujący atak przed poprawką i jego niepowodzenie po; `securityHeaders.test.ts`, `e2e/csp.spec.ts`, testy serwerów; przegląd agentem `security-reviewer` na diffie; wpis w `opis.md` (dział „Bezpieczeństwo”) i aktualizacja `docs/model-zagrozen.md`.

# Model zagrożeń

Stan: 2026-11-23. Źródło: `docs/plan-security-2026-11-15.md` (§1a — weryfikacja z kodem). Zgłaszanie błędów: [`SECURITY.md`](../SECURITY.md).

## 1. Co chronimy

| Aktywo | Gdzie jest | Poufność | Integralność | Dostępność |
|---|---|---|---|---|
| Notatki zwykłe, Praca, Długi, Grafik, klienci, faktury | IndexedDB (dokument Yjs), kopie, urządzenia w synchronizacji, przekaźnik (szyfrogram) | wysoka | wysoka | wysoka |
| Notatki prywatne | jak wyżej, dodatkowo szyfrowane kluczem skarbca | bardzo wysoka | wysoka | wysoka |
| Hasło skarbca, kod awaryjny | tylko w głowie i na papierze | bardzo wysoka | — | utrata = utrata notatek |
| Kod synchronizacji | `localStorage`, kod QR przy parowaniu | wysoka (daje cały dokument) | — | — |
| Token i klucze VAPID serwera powiadomień | zmienne środowiska serwera, `localStorage` klienta | średnia | wysoka | średnia |
| Dane klientów i NIP-y (KSeF) | dokument, eksporty XML | wysoka (dane osobowe — RODO) | wysoka | średnia |
| Obrazy i załączniki | `imageStore`, przekaźnik (bloby szyfrowane) | wysoka | średnia | średnia |

## 2. Granice zaufania

1. **Przeglądarka użytkownika** — zaufana. Rozszerzenia przeglądarki i inne aplikacje w tej samej domenie — nie.
2. **Hosting statyczny (Vercel)** — zaufany co do dostarczenia kodu. Kto zmieni wdrożenie, ma wszystko; nie da się tego wykluczyć w aplikacji webowej, da się zmniejszyć (przypięte wersje, przegląd wdrożeń, APK jako alternatywa).
3. **Serwer sygnalizacyjny WebRTC** — niezaufany: widzi nazwy pokoi i adresy IP, nie treść.
4. **Przekaźnik** — niezaufany co do poufności i integralności treści (widzi szyfrogram, rozmiary, czasy, IP); zaufany tylko co do dostępności.
5. **Serwer powiadomień** — treść przypomnień szyfrowana po stronie klienta (S3.1); serwer widzi czas wysyłki, klucz pozycji i adres subskrypcji.
6. **Inne urządzenie w synchronizacji** — zaufane co do zwykłych notatek (zna kod), niezaufane co do skarbca (stąd pin i AAD).
7. **Plik importu, kopia, udostępnienie z innej aplikacji, schowek, plan DWG/PDF** — niezaufane wejście.

## 3. Przepływ danych

```
Urządzenie A ──WebRTC (DTLS, hasło = kod)──► Urządzenie B
      │  ▲                                        ▲
      │  └── nazwa pokoju (skrót kodu) ──► serwer sygnalizacyjny (widzi pokój i IP, nie treść)
      │
      ├──HTTPS, szyfrogram AES-GCM──► przekaźnik (widzi rozmiary, czasy, IP)
      │
      └──HTTPS, {key, at, enc}──► serwer powiadomień ──► usługa Web Push ──► service worker
                                                         (enc odszyfrowuje SW kluczem z IndexedDB)
```

## 4. Przeciwnicy i scenariusze

| Kod | Przeciwnik | Co może | Główna obrona | Otwarte |
|---|---|---|---|---|
| T1 | Znalazca albo złodziej odblokowanego telefonu | Czyta wszystko poza skarbcem | Blokada skarbca po czasie i przy ukryciu, ukrywanie kwot | Blokada całej aplikacji (S1.8) |
| T2 | Złośliwa treść (wklejka, import, udostępnienie, plik planu) | XSS → odczyt dokumentu i sekretów z `localStorage`, wysyłka na dowolny host | CSP z egzekwowanymi Trusted Types (S1.1, poza Firefoksem i starszym Safari), brak ujść HTML (strażnik), Mermaid w trybie `strict` i jako obraz `blob:` | `connect-src` |
| T3 | Operator albo włamywacz na przekaźniku | Analiza ruchu, usuwanie i cofanie wpisów, zapełnienie pokoju | Szyfrowanie, AAD z identyfikatorem pokoju, limity | Powtórzenie i cofnięcie stanu (S2.3) |
| T4 | Operator albo włamywacz na serwerze powiadomień | Wysyła fałszywe powiadomienia; treść niewidoczna (szyfrowana) | Token, lista hostów, szyfrowanie treści | Token na urządzenie (S3.2) |
| T5 | Osoba znająca kod synchronizacji (były współużytkownik, podejrzany QR) | Pełny odczyt i zapis zwykłych danych, łamanie hasła skarbca offline, wstrzyknięcie metadanych skarbca | Pin, walidacja, AAD, wymiana kodu z wyrzuceniem urządzenia (S2.1) | Metadane skarbca w dokumencie (patrz §6) |
| T6 | Atak na łańcuch dostaw (zależność npm, akcja CI) | Kod w paczce produkcyjnej | Plik blokady | S5 |
| T7 | Podsłuch w sieci | Nic (TLS, DTLS), o ile adresy są `https`/`wss` | `safeUrl.ts` | Wymuszenie schematu dla adresów serwerów (S1.2) |
| T8 | Utrata urządzenia albo danych | Brak dostępu | Kopie, kod awaryjny | — |
| T9 | Stara albo zmodyfikowana wersja klienta | Zapis w starym formacie, utrata nowych pól | Bramka formatu | Plan migracji |

**Poza zakresem:** złośliwe oprogramowanie na urządzeniu z dostępem do pamięci przeglądarki, przymus wobec użytkownika, błędy w przeglądarce i WebCrypto, ataki kanałem bocznym na sprzęt.

## 5. Ujścia HTML (S0.2, S1.6)

W `src/` nie ma żadnego ujścia HTML. Do S1.6 było jedno: SVG Mermaida wstawiane przez `dangerouslySetInnerHTML`. Teraz `MermaidBlock` zamienia SVG na `Blob` i pokazuje go jako `<img src="blob:…">` — skrypty i obsługa zdarzeń w SVG wczytanym jako obraz się nie wykonują, więc błąd w czyszczeniu Mermaida (`securityLevel: "strict"`, DOMPurify) nie kończy się XSS. Markdown, podgląd importu i nazwy plików renderuje React.

Koszt: diagramu nie da się zaznaczyć, a czcionki strony nie sięgają obrazu (stąd jawna czcionka systemowa i `htmlLabels: false` — WebKit nie rysuje `foreignObject` w obrazach SVG).

Pilnuje tego `src/lib/htmlSinkGuard.test.ts`: lista dozwolonych jest pusta, więc każde nowe `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `srcdoc`, `document.write`, `insertAdjacentHTML` lub `createContextualFragment` wymaga wpisu z uzasadnieniem i przeglądu tutaj.

## 6. Znane ograniczenia

- **Sekrety w `localStorage`.** Kod synchronizacji (`kaczy.sync.v1`), token powiadomień (`kaczy.push.token.v1`) i adres przekaźnika (`kaczy.relay.v1`) leżą jawnie, bo `y-webrtc` dostaje kod jako napis, a klucze przekaźnika wyprowadza się z tego samego kodu. XSS = utrata kodu. Do kopii JSON nie trafiają (`SETTINGS_KEYS` je pomija), raport diagnostyczny je wycina (`redact`).
- **`connect-src 'self' https: wss:`.** Adresy serwerów wpisuje użytkownik, więc listy hostów nie da się wpisać z góry. Zawężenie nie zamyka wycieku po XSS: kanały danych WebRTC i nawigacja (`location =`, `window.open`) są poza `connect-src`. Od S1.2 (2026-11-24) kod łączy się z serwerami użytkownika tylko przez `src/lib/net/endpoints.ts` (`https:`/`wss:`, nieszyfrowane tylko do pętli zwrotnej; reguła ESLint pilnuje reszty) — to chroni przed pomyłką w kodzie i `ws://` do obcego hosta, nie przed atakującym po XSS, który ma własny `fetch`.
- **Metadane skarbca w dokumencie.** `wrapped` i `salt` synchronizują się z dokumentem, więc każdy znający kod może łamać hasło skarbca offline. Chroni siła hasła (min. 12 znaków) i PBKDF2 600 000. Decyzja KR-1 w planie Skarbca.
- **Kod synchronizacji ma ok. 59 bitów** (12 znaków z 31); nowe parowanie dostaje dłuższy kod (S2.2). Stałej soli w `relayKeys.ts` nie da się zmienić, bo identyfikator pokoju wynika z kodu.
- **Operator przekaźnika może wstrzymywać wpisy** — wykrywalne dopiero przy kontakcie z drugim urządzeniem inną drogą.

## 7. Przegląd roczny (S6.4)

**Ostatni przegląd: 2026-11-25** (plan bezpieczeństwa z 15.11, punkty S0–S6). Następny: listopad 2027 albo wcześniej, po większej zmianie (nowy serwer, nowe ujście danych, zmiana szyfrowania).

- [ ] Sekcje 1–6 tego pliku zgadzają się z kodem (granice zaufania, przepływ danych, znane ograniczenia).
- [ ] Strażnik ujść HTML (`src/lib/htmlSinkGuard.test.ts`) ma tylko uzasadnione wyjątki. Polityka Trusted Types (`src/lib/trustedTypes.ts`) i CSP w `vercel.json`/`netlify.toml` nie mają nowych luzów.
- [ ] `npm audit` dla aplikacji i obu serwerów jest przejrzany, a Dependabot nie ma zaległych PR-ów.
- [ ] Wyjątki gitleaks (`.gitleaks.toml`) to nadal fałszywe alarmy.
- [ ] Procedury w `docs/reagowanie.md` są przećwiczone na sucho, a nazwy przycisków aktualne.
- [ ] Serwery: klucze VAPID i `PUSH_TOKEN` tylko ze zmiennych, dzienniki 7 dni, monitor `/health` działa (`deploy/README.md`).
- [ ] Parametry kryptografii (PBKDF2, długość kodu, klucze) są zgodne z bieżącymi zaleceniami OWASP.
- [ ] Data przeglądu wyżej jest zaktualizowana.

## 8. Niesprawdzone

Zachowanie COOP z oknem passkey i `window.open` (wymaga przeglądarki), faktyczne limity wiadomości WebRTC w `y-webrtc`. `tickStore` w serwerze powiadomień jest sprawdzony 2026-11-25 (wpisy znikają po wysyłce).

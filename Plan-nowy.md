# Plan rozwoju i dopracowania NOTKI (2026-11-03)

> **Status (2026-11-03, wersja 2):** ustalenia czterech agentów (dwa inwentarze, bezpieczeństwo, wydajność) są wpisane w §10, a Cykl 1 ma nowe punkty 1.8–1.11. Cykl 1 zrobiony: 1.1–1.11 (bramka ok. 3 min). Agentów architektury, testów i UX nie uruchamiano ponownie: ich zakres pokrywają inwentarze i punkty 1.2, 3.1 i 3.3.
>
> Wersja 1: To jedno źródło prawdy o tym, co zostało. Plany działów w `docs/plan-*.md` zostają jako szczegóły punktów, a ich linia „Status” ma się zgadzać z tym planem. Raporty siedmiu agentów (dwa inwentarze planów, architektura, wydajność, bezpieczeństwo, testy, UX i dostępność) były w toku przy zapisie tej wersji. Ich ustalenia trzeba dopisać w sekcji „Ustalenia agentów” i według nich poprawić kolejność.

## 1. Zasady pracy

1. **Jedno źródło prawdy.** Otwarte punkty są tutaj, a szczegóły w planie działu. `opis.md` opisuje stan aplikacji, nie historię zmian.
2. **Cykle ze stałym czasem i zmiennym zakresem** (Shape Up). Cykl trwa 1–2 tygodnie i ma „apetyt” zamiast estymaty. Po cyklu jest krótki czas na porządki i QA. Czego nie zdążymy, wraca do puli, a cykl się nie wydłuża.
3. **Priorytet według W/N** (wartość 1–3, nakład S/M/L), tak jak w planach działów. Ryzyko utraty danych idzie przed wszystkim innym.
4. **Definicja „zrobione”.** Kolejność: test → kod → `opis.md` → commit. Do tego:
   - typecheck i lint bez nowych ostrzeżeń;
   - Vitest dla logiki w `src/lib`, e2e dla ścieżki użytkownika;
   - axe dla nowego UI;
   - zielone budżety w `e2e/bundle.spec.ts`;
   - `/code-review` przed commitem i push po każdym etapie.
5. **Local-first.** Aplikacja działa offline, dane zostają u właściciela, a sync niczego nie gubi. Starsza wersja na drugim urządzeniu musi czytać nowy dokument:
   - nowe pola idą w jednej wartości LWW (wzorzec `reminderSpec`);
   - dane od peera są zawsze niezaufane (`safeProjection`).
6. **Dostępność według WCAG 2.2 AA.** Cel dotyku 44 px na telefonie (2.5.8), fokus nie chowa się pod paskiem (2.4.11), redukcja ruchu jest respektowana, kontrast sprawdzamy we wszystkich 10 stylach × 2 schematach.
7. **Bezpieczeństwo według OWASP ASVS L1** jako lista kontrolna. Treść notatki prywatnej nigdy nie wychodzi jawnie (push, `.ics`, kopia, dymki). Zmiany w Yjs, sync, udostępnianiu, CSP i przekaźniku przechodzą przez `security-reviewer`.
8. **Budżety wydajności:**
   - wejściowy JS ≤ 500 KB gzip; dziś 482 688 B, zapas około 29 KB;
   - precache ≤ 4,0 MiB;
   - DOM przy 300 notatkach.

   Nowa zależność to świadoma decyzja z pomiarem.
9. **Małe commity, krótkie gałęzie.** Gałąź robocza `wip/*` idzie na `master` po zielonych testach etapu.
10. **Decyzje właściciela są spisane** w tabeli w punkcie 6. Punkt czekający na decyzję nie blokuje reszty cyklu.

## 2. Stan wyjściowy (2026-11-03)

- **Zrobione dziś:**
  - Terminy 3.2: wcześniejsze przypomnienie 15 min / 1 h / dzień przed, w dymku, push i `.ics`;
  - Skrzynka 2.1: frazy `#etykieta`, `@folder`, `!` i data w polu;
  - Skrzynka 2.4: wklejony sam adres;
  - Skrzynka 2.5: wklejony obraz albo upuszczony plik;
  - Ustawienia → Wygląd bez podglądu na żywo i bez sekcji „Zestawy” (decyzja właściciela).
- **Testy z tej sesji:**
  - e2e terminów i kompozytora 51/51;
  - Skrzynka 8/8, plus test 2.5;
  - Wygląd 9/9 i szybkie zestawy 4/4;
  - Vitest dotkniętych obszarów zielony.
- **Znane chwiejne testy** (przechodzą osobno, padają pod obciążeniem):
  - `site-faults`, `study-delivery`;
  - zrzut „praca — odblask”;
  - zrzuty „komputer › praca — *”: pasek boczny bywa zwinięty na 1440 px, możliwy wyścig przy starcie.
- **Plany:** około 25 plików w `docs/`. Bez linii Status są Notatki (około 38 punktów), Ustawienia (22) i Powłoka (część). Plan Kalendarza, Grafiku i Pracy ma status z 27.10.
- **Ręczne QA na telefonie** jest zebrane w punkcie 5 (Cykl 4).

## 3. Cykl 1 — porządek i bezpieczne zmiany (apetyt: 1 tydzień)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | ✅ **Inwentarz z dowodami:** (linie „Status (2026-11-03)” wklejone w 15 planach) linia Status w planach Notatek, Ustawień i Powłoki (każdy punkt sprawdzony w kodzie); aktualny status planu Kalendarza, Grafiku i Pracy z 27.10. Źródło: raporty inwentarza. | `docs/plan-*.md` | 3 | S |
| 1.2 | ✅ **Chwiejne testy:** `site-faults` i `study-delivery` przeładowywały stronę przed końcem zapisu do IndexedDB, więc teraz czekają na „Zapisano”. Pasek boczny w zrzutach na 1440 px zwijał się, bo `fullPage` w Chromium na chwilę zmienia okno na 1×1 i `useIsMobile` widział telefon. W `visual.spec.ts` `matchMedia` jest teraz zamrożone, a 3 złe zrzuty bazowe (praca: miedz, plan, kafle) są poprawione. Wynik: zrzuty 154/154 na 3 workerach, `@smoke` 41/41 trzy razy. | `e2e/`, powłoka | 3 | M |
| 1.3 | ✅ **Bramka jakości lokalnie:** `npm run check` (typecheck, lint, Vitest, e2e `@smoke`). Lint ma 0 błędów (poprawione 4 wyrażenia z przecinkiem w e2e), a próg czasu w `plans/security.test.ts` podniesiony z 1,5 do 5 s, bo padał pod obciążeniem. **Czas: ok. 3 min** (smoke na 3 workerach: 1,1 min zamiast 2,6 min, po naprawie chwiejnych testów w 1.2). | `package.json` | 3 | S |
| 1.4 | ✅ **Test zgodności danych:** `src/lib/dataCompat.test.ts` (9 testów). Drugi `Y.Doc` pisze jak starsza wersja: notatki, `reminderSpec` sprzed 3.1 i 3.2, wpis z kluczami z 9020901, karta budowy. Test znalazł błąd: `writeCard` kasował pola karty z nowszej wersji. Naprawione przez `SITE_CARD_KEYS`. Świadome wyjątki są opisane w `opis.md` („Zgodność danych ze starszą wersją”). | `src/lib/*.test.ts` | 3 | M |
| 1.5 | ✅ **Zapas paczki:** zrobione 2026-11-03: −33 KB (484 234 → 451 235 B gzip), precache 4066,8 KiB; łańcuch Pracy niepotrzebny (cel osiągnięty), zostaje w §10.4 jako rezerwa. Pierwotnie: co najmniej 20 KB z powrotem według §10.4, w kolejności: `exportNotes` dynamicznie, zawężenie `vendor-radix`, łańcuch Grafiku, łańcuch Pracy (ten z testem GC obrazów). **Uwaga:** zapas precache to tylko około 18 KiB. | `vite.config.ts`, importy | 2 | M |
| 1.6 | ✅ **Gałęzie:** lokalny `master` = `origin/master` (083bb5f). Usunięte scalone `ui/*` i 5 × `worktree-agent-*`. Zostają `feat/checklist-wklejanie-konwersja` i `wip/d2-react-compiler` (po 1 niescalonym commicie) oraz `wip/matryca-hydraulika` (lokalnie inna niż zdalna). W `.claude/worktrees/` leżą 4 katalogi bez `.git` (resztki, jeden blokowany przez OneDrive) do ręcznego usunięcia. | git | 2 | S |
| 1.7 | ✅ **CLAUDE.md:** próg „394 KB” jest nieaktualny, obowiązuje `e2e/bundle.spec.ts` (500 KB). | `CLAUDE.md` | 1 | S |
| 1.8 | ✅ **Bezpieczeństwo: `/share` z obcej strony (§10.3 p. 2).** Wykonanie odbiega od raportu, bo `Sec-Fetch-Site` nie dochodzi do SW (sprawdzone w e2e). SW odrzuca POST z obcym `Origin`, a przepuszcza `null` i brak nagłówka. GET pyta „Zapisać w NOTKACH?”. **Zostaje:** luka dla nieprzezroczystego originu (`null`) i sprawdzenie na telefonie, jaki `Origin` wysyła systemowe „Udostępnij” (Cykl 4). | `public/sw-share.js`, `useLaunchIntents.ts` | 3 | S |
| 1.9 | ✅ **Odporność Grafiku na złe dane od peera (§10.3 p. 4):** filtrować przez `isShiftType` / `isPattern` przed sortowaniem. Test Vitest z `null` w mapie. | `src/lib/shifts/yShifts.ts:81,115` | 3 | S |
| 1.10 | ✅ **Limity plików:** `sw-share.js` przycina do 30 plików i 10 MB na plik, przy starcie czyści stare wpisy inboxu. `file.size` sprawdzany przed `text()` w trzech importach (§10.3 p. 5 i 7). | SW, importy | 2 | S |
| 1.11 | ✅ **CSP egzekwowane:** `Content-Security-Policy` w `netlify.toml` i `vercel.json`. `vite preview` wysyła te same nagłówki, więc całe e2e biegnie pod CSP. Poprawione przy okazji: `fetch(dataUrl)` (rysunek na zdjęciu, zaznaczony plan) i `Permissions-Policy`, które blokowało kamerę (QR) i lokalizację. Testy: `e2e/csp.spec.ts`, `src/lib/securityHeaders.test.ts`. | konfiguracja | 2 | S |

## 4. Cykl 2 — dokończyć działy bez decyzji (apetyt: 1–2 tygodnie)

| # | Co | W | N |
|---|----|---|---|
| 2.1 | ✅ **Skrzynka 2.3:** skrót `Alt+K` i polecenie „Do skrzynki…” w palecie (małe okno bez zmiany widoku), skrót PWA `?skrzynka=1`. | 3 | M |
| 2.2 | ✅ **Skrzynka 3.1, 3.4:** filtr chipów folderu i etykiety w porządkowaniu (9 najczęstszych, „Nowy…”); „Przypomnij…” z porządkowania. | 3 | M |
| 2.3 | ✅ **Skrzynka 4.1–4.4, 4.6:** pole jak zwinięty kompozytor, pasek z licznikiem i „Porządkuj”, wiek notatki i sortowanie „najstarsze najpierw”, pieczątka „Posortowane”, karta porządkowania z postępem. | 2 | M |
| 2.4 | ⏳ **Dziś (w toku: zrobione 2.1, 2.2, 2.5, 3.1, 3.3, 3.6; zostają 2.4 podpięcie osi, 3.2, 3.5, 4.2, zrzuty `dzis-*`):** 2.1 (reszta), 2.2, 2.4, 2.5, 4.2 i Etap 3 bez 3.4 (czeka na D-3). | 2 | M |
| 2.5 | ⏳ **Terminy:** ✅ 4.5 (odhaczenie z ruchem, bez ruchu przy redukcji — nowyplan 4.2, `ReminderQuickActions` + `collapseRowThen`); zostaje 3.4 (termin z treści jako podpowiedź w edytorze). | 2 | M |
| 2.6 | **Kalendarz, Grafik, Praca (plan 27.10):** K3.6 (po QA, K-4), K4.1, K4.5, reszta G2–G4 i P2–P5, P6.2, P6.3 — tylko punkty, które inwentarz potwierdzi jako otwarte. | 2 | L |
| 2.7 | **Skarbiec:** 2.2, 3.3, Etap 4 (1.2 część 2 czeka na decyzję). | 2 | M |
| 2.8 | ✅ **Powłoka i QoL:** test e2e celów dotyku 44 px na ekranie telefonu (`e2e/touch-targets-phone.spec.ts`, 7 ekranów, Pixel 7 i iPhone 14; poprawione 4 za małe cele); paleta zależna od kontekstu otwartej notatki — „Ta notatka” ma też Ulubione, Duplikuj, Archiwizuj i Do kosza (QoL 3.9 / Notatki 2.5). Przy okazji naprawione: Ctrl+K nie otwierał palety przy otwartym podglądzie. | 3 | M |
| 2.9 | **Notatki, Ustawienia, Ćwiczenia:** punkty potwierdzone przez inwentarz, w kolejności W/N. | 2 | L |

## 5. Cykl 3 — architektura i wydajność (apetyt: 1–2 tygodnie)

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **`src/pages/Index.tsx` na mniejsze części:** hooki widoków (Skrzynka, Terminy, Dziś), hosty okien i akcje zapisu w osobnych modułach. Bez zmiany zachowania; siatką bezpieczeństwa są e2e. | 3 | L |
| 3.2 | **Wyszukiwanie w Workerze** i zrzut indeksu do IndexedDB (odłożone z planu rozbudowy 3.x). Najpierw przejście wywołań na asynchroniczne. | 2 | L |
| 3.3 | **Pomiar reakcji:** INP i LCP na `pixel-7` w Playwright (web-vitals w trybie debug) jako stały test z progiem. | 2 | M |
| 3.4 | ✅ **ADR** (`docs/adr.md`, ADR-1…5): krótko spisane decyzje — `reminderSpec` jako jedna wartość LWW, CSP `connect-src` szerokie, Web Push lokalnie, brak hostingu, model stylów i motywów. | 2 | S |
| 3.6 | ✅ **Drobne z pomiaru renderu (§10.4)** (także paleta dostaje zapamiętaną listę zamiast nowej tablicy): `ShiftsView` dostaje memoizowane `reminderNotes` zamiast `[...notes, ...archivedNotes]` (`Index.tsx:974`); jedno liczenie `inboxBadge`/`inboxCount` (`Index.tsx:589,657`). | 2 | S |
| 3.5 | **`<Activity>` dla ostatniego działu** (powrót bez przeładowania), tylko po pomiarze pamięci na telefonie. | 1 | M |

## 6. Cykl 4 — telefon i wdrożenie (gdy właściciel ma czas)

- **Jedna sesja QA na telefonie, wszystko naraz:**
  - plan hydraulika: H4.2, H6.1 i H6.2 (dyktowanie);
  - Długi: Etap 5; Wygląd: Faza 8; motywy: pomiar klatek;
  - udostępnianie 5.3;
  - prawdziwy rysunek DWG w Analizatorze;
  - Terminy 3.2: sygnał na ekranie blokady;
  - Skrzynka 2.5: wklejenie zdjęcia z galerii;
  - 1.8: „Udostępnij” zdjęcia i PDF-u z systemu nadal działa (nagłówek `Origin` w SW).
- **Wdrożenie serwera push i przekaźnika:** po decyzji o hostingu, z `security-reviewer` przed uruchomieniem.

## 7. Decyzje właściciela

| Kod | Pytanie | Rekomendacja / stan |
|---|---|---|
| H-1 | Materiał w aucie (H1.3) — zakres. | Z planu hydraulika. |
| H-6 | H5.3: godziny z autorem. | Odłożone. |
| D-3 | Dziś 3.4. | Z planu Dziś. |
| Skarbiec 1.2 cz. 2 | Nowy projekt kryptografii. | Osobna decyzja i przegląd bezpieczeństwa. |
| C-1 | Ćwiczenia 2.7. | Z planu Ćwiczeń. |
| K-4 | Tydzień z osią godzin (K3.6). | Po QA. |
| — | „Gotowe” kończy serię? | Otwarte od 19.10. |
| — | Hosting serwera push i przekaźnika. | Odłożony. |
| S-1 | Nazwa pokoju WebRTC z PBKDF2 (§10.3 p. 3). Zmiana nazwy rozłącza parę ze starszą wersją aplikacji. | Rekomendacja: nowa nazwa przez PBKDF2 i okres przejściowy, w którym obie nazwy są słuchane. |
| S-2 | push-server: limit zapytań, jawna lista originów, „ogólne tytuły” (§10.3 p. 6). | Przy wdrożeniu serwera. |
| — | Zapis nowego „Mój N” po usunięciu „Zestawów” z Ustawień. | Dodać „Zapisz bieżący” do okienka „Zestaw wyglądu” albo zostawić bez zapisu. |

## 8. Miary (sprawdzane po każdym cyklu)

- Paczka wejściowa (B gzip) i precache (MiB) z `e2e/bundle.spec.ts`.
- e2e: odsetek zielonych, liczba chwiejnych testów, czas pełnego przebiegu.
- axe: 0 naruszeń na ekranach z `e2e/a11y.spec.ts`.
- Liczba otwartych punktów w planach i liczba decyzji czekających.

## 9. Czego nie robimy

- Bez nowego frameworka i bez przepisywania działów od zera.
- Bez nowych zależności bez pomiaru paczki.
- Bez funkcji, które wymagają własnego serwera, dopóki nie ma decyzji o hostingu.
- Bez wirtualizacji list ani Workerów „na zapas”: najpierw pomiar.

## 10. Ustalenia agentów (2026-11-03)

Cztery raporty, każdy sprawdzony w `src/` i `git log` przy HEAD 083bb5f. Gotowe linie „Status (2026-11-03)” dla planów działów są w 10.1 i 10.2. Trzeba je jeszcze wkleić do `docs/plan-*.md` (punkt 1.1).

### 10.1 Inwentarz A: Notatki, Ustawienia, Powłoka, UI/QoL, mobile, dane Yjs

- **Notatki** (najwięcej otwartych punktów):
  - częściowo: 1.2, 1.3, 2.5, 2.6, 3.3, 3.4, 4.2, 4.3;
  - otwarte: 1.4–1.6, 2.1–2.3, 2.7, 2.8, 3.1, 3.2, 3.5, 4.4, 4.8 oraz Etapy 5–8;
  - czeka: N-2, N-4.
  - Najtańsze z W2: dokończyć 1.2 („Cofnij” w dymku, `aria-expanded`), 1.3 (Esc i tło w rysowaniu), 2.3 (klawisze M i L, `gridKeyboardNav.ts:225`), 2.7 i 4.3 (70ch). Najcenniejsze: 2.1 (przeciąganie zadań, W3/M) i 6.2 (zapisane widoki, W3/L).
- **Ustawienia:**
  - częściowo: 1.1 (surowe „Błąd połączenia: {lastError}”, `SyncSettings.tsx:139`), 2.5, 3.2–3.4;
  - otwarte: 1.2, 1.3, 2.2, 2.4, 4.1 (stopka „NOTKI v1.0” na sztywno, `AppSidebar.tsx:375`), 5.1–5.3.
- **Powłoka:**
  - częściowo: 1.2 (resztki „G” w `ClipperSettings.tsx:17–29`, brak `APP_NAME`), 2.5 (polecenia palety);
  - otwarte: 2.6, 4.1 (88 × `uppercase tracking-wider`), 4.2.
- **UI/QoL:** otwarte D-3 (38 plików nadal na framer-motion), 2.7 (pełny zestaw mikrointerakcji), 4.2 (`size-adjust` dla fontów).
- **Mobile:** zostaje QA. Linia „Do sprawdzenia” w planie jest nieaktualna, bo D2, D3, D5, B5, E4 i A4 są w kodzie. Drobne: C5 i E2.
- **Dane Yjs:** zamknięte. Opcjonalnie test migracji na prawdziwych starych kopiach.
- **Uwaga:** marka zmieniła się z „hydra” na „NOTKI” (e21fb99), więc U-1 i PW 1.2 trzeba czytać pod nową nazwę.

### 10.2 Inwentarz B: Praca, Kalendarz, Grafik, Dziś, Skrzynka, Terminy, Ćwiczenia, Skarbiec, Długi, TODO, dług techniczny

- **Plan 27.10 zaniża stan.** Kalendarz K1–K4 i Grafik G2–G4.7 są zrobione, a z Pracy większość P2–P5 ma commity.
  - Otwarte: P2.1 (część), P2.2 (zdjęcia przed zakryciem, W3/M), P4.6, akcja „Skończyłem” przy G4.1, miniatury w protokole.
  - Czeka: G4.8, P4.1 (P-6), P4.4, P2.11 i P3.3 (telefon). P0.2 rozstrzygnięte: zostaje arkusz udostępniania.
  - Punkt 2.6 tego planu zmniejsza się więc do tych pozycji.
- **Dziś:** otwarte 2.1 (część), 2.2, 2.4, 2.5 (`canCompose` bez `today`, `Index.tsx:268`), 3.1–3.3, 3.5, 3.6, 4.2.
- **Skrzynka:** otwarte 1.2 (błysk liczony tylko z `[data-add-note-bar]`, `Index.tsx:536`), 2.3, 3.1, 3.4, 4.1, 4.2, 4.4, 4.6; częściowo 2.4 (ikona linku na kaflu) i 4.3.
- **Terminy:** otwarte tylko 3.4 i 4.5.
- **Ćwiczenia:** w kodzie otwarte 1.2–1.4, 2.1–2.6, 3.4 i 4.1–4.5, a w planie są oznaczone „do sprawdzenia”. Najtańsze z W3: 2.4 („Powtórz wczoraj”) i 2.1 (plan dnia prowadzi przez trening).
- **Skarbiec:** otwarte 2.2 (brak „Prywatna” w `AddNoteBar`), 3.3, 4.2, 4.4; częściowo 4.1 i 4.3.
- **Długi:** zamknięte poza QA (Etap 5).
- **TECH-DEBT:** otwarte domknięcia w `createYStudy`, cykl `sites.ts` → `yStudy`, `touch-audit` także poza projektem `chromium` (`playwright.config.ts:45`), testy `data.ts`. Do tego chwiejny test 50 ms (`searchNotes.test.ts:215`, z TODO).

### 10.3 Bezpieczeństwo (OWASP ASVS L1)

Dobrze:
- `npm audit` czysty w aplikacji i w obu serwerach;
- Skarbiec: PBKDF2 600 tys. iteracji, AES-GCM z AAD, klucze niewyodrębnialne, `vaultPin.ts`;
- markdown bez `dangerouslySetInnerHTML`;
- przekaźnik: walidacja, porównanie tokenu w stałym czasie, limit zapytań;
- notatki prywatne nie wychodzą jawnie;
- ZIP ma limit rozpakowanych bajtów.

Ustalenia:

1. **Ważne:** CSP działa tylko jako `Report-Only` (`netlify.toml:77`, `vercel.json:101`). → punkt 1.11.
2. **Ważne:** obca strona może dopisać notatkę przez `/share`:
   - POST bez sprawdzenia `Sec-Fetch-Site` (`public/sw-share.js:12–16`);
   - GET zapisuje bez pytania (`useLaunchIntents.ts:96`).
   → punkt 1.8.
3. **Ważne:** nazwę pokoju WebRTC da się złamać offline:
   - to jeden SHA-256 z kodu o około 59 bitach (`yjsSync.ts:196–199`, `:23–26`);
   - przekaźnik używa już PBKDF2.
   → decyzja S-1, bo zmiana rozłącza parę ze starszą wersją.
4. **Drobne:** wpis `null` od peera wywraca Grafik, bo `byOrder` działa przed `migrate()` (`yShifts.ts:44,81,115`). → punkt 1.9.
5. **Drobne:** SW zapisuje udostępnione pliki bez limitu, a od 30. pliku zostają w cache na zawsze (`sw-share.js:27–36`, `shareInbox.ts:50`). → punkt 1.10.
6. **Drobne:** push-server ma `ALLOWED_ORIGINS="*"`, brak limitu zapytań, a tytuły leżą jawnie w `store.json`. → decyzja S-2 przy wdrożeniu.
7. **Drobne:** `file.text()` bez sprawdzenia rozmiaru (`ShiftsIcsImport.tsx:25`, `icsImport.ts:149`, `CustomQuestionsDialog.tsx:20`). → punkt 1.10.
8. **Informacyjnie:** serwer deweloperski Vite ma `host: "::"` (`vite.config.ts:37`). Zostawić, bo jest potrzebny do testów na telefonie w sieci domowej.

### 10.4 Wydajność (build z sourcemapami)

- **Stan startu:**
  - wejście to `index` (182 KB gzip) plus około 85 chunków z modulepreload: vendor-react 81, radix 41, yjs 26, dnd 15, yjsStore 13 KB;
  - **precache: 4077,5 KiB z 4096**, więc zapas to tylko około 18 KiB.
- **Kandydaci do 1.5** (szacunek gzip; razem 25–32 KB, bo łańcuchy częściowo się nakładają):
  1. **Łańcuch Grafiku (10–13 KB).** Trzeba zmienić wszystkie cztery importery: `useShiftEveningNudge.ts:6` (leniwy komponent bez UI), `Index.tsx:91`, `ReminderPicker.tsx:18–19` i `exportNotes.ts:19–20`.
  2. **Łańcuch Pracy (14–17 KB).** Importery: `useNotes.ts:11` → `study/images.ts:4–5`, `study/data.ts:12` (efekt uboczny `createYStudy`), `useLaunchIntents.ts:10` i `exportNotes.ts:15–18`. **Ryzyko:** sprzątanie obrazów w `useNotes.ts:219` musi czekać (`await`) na referencje dziennika, więc najpierw test Vitest.
  3. **`exportNotes` dynamicznie (4,7 KB).** Dziś import w `Index.tsx:600` nic nie daje (INEFFECTIVE_DYNAMIC_IMPORT) przez statyczne importy w `useImportExport.ts:4`, `useBackupReminders.ts:4` i `ImportExportMenu.tsx:5`. Ryzyko niskie.
  4. **Zawężenie `vendor-radix` (5 KB).** Slider, switch, tabs i progress nie są potrzebne przy starcie. Ryzyko niskie.
  5. Dalsze: leniwy `ReminderPicker` (3–4 KB), arkusz „Więcej” w `BottomNav` (2–3 KB), `NoteEditor` z `NoteCard` (2–4 KB). Nie ruszać `vendor-dnd`.
- **Render:** dwie drobne poprawki w `Index.tsx`, opisane w punkcie 3.6. Moduły przeniesione na leniwe ładowanie mają wchodzić do kolejki idle (`prefetchViewsWhenIdle`), a nie do efektów przy montowaniu.

### 10.5 Kolejność po ustaleniach

1. Cykl 1: najpierw 1.8, 1.9 i 1.10 (bezpieczeństwo i dane, każdy S). Potem 1.1 (wkleić linie statusu), 1.5 w kolejności z 10.4, a na końcu 1.2, 1.4 i 1.11.
2. Cykl 2: punkt 2.6 zmniejsza się do P2.1, P2.2 i miniatur w protokole. Do 2.9 wchodzą najtańsze punkty W2–W3 z 10.1 i 10.2: Ćwiczenia 2.4 i 2.1, Notatki 1.2, 1.3, 2.3 i 2.1, Ustawienia 1.1 i 4.1, Powłoka 1.2.
3. Decyzje: nowe S-1 i S-2, a P0.2 usunąć jako rozstrzygnięte.

# Plan reszty — stan 2026-11-26

> **Zastępuje** `plan-co-zostalo-2026-11-25.md` (lista numerów) — tu te same otwarte punkty ułożone w fale wykonania.
> **Źródła:** tabele planów w `docs/`, `git log`, sprawdzenie w kodzie 26.11 (zaznaczone ✔︎ niżej).
> **Rozmiar:** S ≈ do 1 h, M ≈ pół dnia, L ≈ dzień i więcej. Każda fala kończy się: Vitest + typecheck + lint, e2e dotkniętych działów, `docs/opis/`, commit.

## Stan po 2026-11-26 (wznowienie tutaj)

- **E0.1 zamknięte:** przyczyna — Avast Web Shield / Malwarebytes Web Protection opóźniały `localhost`. Po wyłączeniu: `@smoke` 43/43 (workers=3), pełne e2e 1238 zielonych / 7 porażek na starym buildzie; z nich 4 niestabilne pod obciążeniem, 2 naprawione (`6c38f552`), `pressure-timer:30` przechodzi przy powtórce. **Do zrobienia przez właściciela:** stały wyjątek w obu programach. E2E działów zmienionych w Fali 1 na nowym buildzie: 332 + 56 zielonych.
- **Fala 1 zrobiona:** U1.2 + U1.3 (`24275fca`), Z-8.1 + Z-8.2 (`9fcaf10b`), Z-18.6 (`042f7529`), Z-18.5 (`6a3e9efb`), Z-18.2 + **naprawa sekcji Waga w kopii** (`6878a696`), Z-1.T (`e337fc49`).
- **Okazało się już zrobione:** U5.2 (sekcje przez `SectionCard`), P4.1 (jedyne wersaliki to dozwolona linijka `ViewTitle`), D0.3 (`docs/dane-spisy.md`), Z-18.5 część „podsumowanie” (z Z-18.4), Q1.4 z Fali 5 (kopie dzienne w OPFS, 2026-11-17).
- **Przeniesione:** P4.4 → decyzje (ukryte działy w „Więcej” przeczą PW-3; brak tokenów odcieni działów); Q3.9 → telefon (dane `usage.ts` są tylko na telefonie).
- **Zostało z Fali 1:** C2.3 (RIR), C4.1 (ulubione posiłki, mapa `dietFavorites`) — UI, przed kodem skill `frontend-design` i `docs/dane-wersje.md`; L2.3 (numer konta/BLIK w Długach) — przed kodem `security-reviewer`.
- **Push:** gałąź `wip/mobile-fala1` niewypchnięta (origin = `1b80d090`); push i scalenie do `master` po decyzji właściciela.

## Sprostowania po sprawdzeniu w kodzie (26.11)

- **Z-14.1 zrobione** — `src/lib/study/receivables.test.ts` istnieje.
- **Z-18.9 zrobione** (w `git log`), **Z-4.T zrobione** — usunięte z listy.
- **Z-17.9 częściowo** — `src/lib/yjs/convergence.prop.test.ts` pokrywa notatki (A4.5); brak pomocnika `convergence.ts` i testów długów, zmian, Pracy (wg `plan-zestaw-zbieznosci.md`).
- **Z-8.2 otwarte** — `src/components/calendar/useCalendarMoves.ts` nadal woła `nextInSeries` bez `seriesMinutes`.
- **Ustawienia 1.3 otwarte** — `deviceWord` w `SyncSettings.tsx` i `OfflineQueuePanel.tsx`.
- **Powłoka 4.1 prawie zrobione** — zostało 1 miejsce `uppercase tracking-wider`.
- **Q3.8** był w obu kolumnach starej tabeli — jest zrobiony.

## Fala 0 — stabilne e2e (najpierw, bo bez tego nie da się zamykać fal)

| Punkt | Co | Rozmiar |
|---|---|---|
| E0.1 | **Diagnoza zrobiona 26.11 — przyczyna poza aplikacją.** Porażki `@smoke` przy `--workers=3` to żądania, które docierają do serwera z opóźnieniem 20–110 s (próbnik `robots.txt` co 200 ms). Wykluczone po kolei: OneDrive (pada na zsynchronizowanym `dist/`), pula wątków libuv (`UV_THREADPOOL_SIZE=32` — gorzej), kompresja i odczyty `vite preview` (serwer z `dist/` w pamięci też staje), WebKit (sam Chromium też), brak portów (293 TIME_WAIT na 16 384). Pomiar w serwerze: pętla zdarzeń wolna (2 zacięcia ≤ 10 s), a 139 żądań **przychodzi** spóźnionych do 29 s — ruch na `localhost` trzyma coś w systemie. Podejrzani: **Avast** (aktywny, Web Shield filtruje HTTP) i **Malwarebytes** (Web Protection). **Do zrobienia przez właściciela:** wyjątek dla `localhost`/`127.0.0.1` albo dla `node.exe` i przeglądarek Playwrighta (`%LOCALAPPDATA%\ms-playwright`) w obu programach, potem powtórka: `npx playwright test e2e/checklist.spec.ts:9 e2e/mobile.spec.ts:13 --repeat-each=4 --workers=3`. Do tego czasu e2e lokalnie tylko z `workers: 1` (domyślne). | M |
| E0.2 | Po E0.1: pełne `@smoke` przy `--workers=3` zielone 3× z rzędu; potem pełne e2e; potem push 34+ commitów na `wip`, scalenie do `master`. | S |
| E0.3 | Znane niestabilne: `debts-due:59` (workers=3), `yjsStore.chunked.test.ts` (pada też na starym HEAD). | S |

## Fala 1 — małe punkty bez blokad (S, jeden commit na dział)

| Punkt | Plan | Co |
|---|---|---|
| U1.2, U1.3, U5.2 | `plan-ustawienia-2026-10-25.md` | teksty Sync („kopia”, „styl, krój”), `deviceWord` → `pluralPl`, nagłówki jako `section-label` |
| P4.1 | `plan-powloka-2026-10-25.md` | ostatnie `uppercase tracking-wider` |
| P4.4 | `plan-powloka-2026-10-25.md` | arkusz „Więcej” jako siatka kafli działów z licznikami |
| Q3.9 | `plan-qol-platforma-2026-11-15.md` | `shortcuts` w manifeście wg `usage.ts` |
| C2.3, C4.1 | `plan-cwiczenia-2026-11-15.md` | opcjonalne RIR; ulubione posiłki (`dietFavorites` — najpierw `docs/dane-wersje.md`) |
| L2.3 | `plan-dlugi-2026-11-15.md` | numer konta / BLIK w wiadomości (nowe pole w kopii → `security-reviewer`) |
| Z-8.1, Z-8.2 | `zlecenia-fable-2026-11-15.md` | test odłożenia przypomnienia serii; `seriesMinutes` w `useCalendarMoves.ts` |
| Z-18.2, Z-18.5, Z-18.6 | `audyt-2-2026-11-17.md` | walidacja eksportu (klucze, `appVersion`); przycinanie tytułów; grosze w rachunku Pracy |
| Z-1.T | `zlecenia-fable-2026-11-15.md` | przypadki wzorcowe w testach Grafiku |
| D0.3 | `plan-migracje-yjs-2026-11-15.md` | spis ~110 kluczy `localStorage` (punkt wyjścia: `src/lib/storage/names.ts`) |

## Fala 2 — rejestr poleceń (łańcuch, jedna gałąź myśli)

A3.4 (`src/lib/commands/` — źródła poleceń palety) → Powłoka 2.5 (więcej poleceń: karty Ustawień, style, kroje, „Zrób kopię”) → Q5.2 (ściąga `?` z rejestru) → Q5.3 (menu pod prawym przyciskiem i przytrzymaniem z tego samego opisu akcji). Razem L; każdy krok osobny commit.

## Fala 3 — testy zbieżności i dział Ćwiczenia/Długi

| Punkt | Co | Rozmiar |
|---|---|---|
| Z-17.9 | dokończyć: pomocnik `convergence.ts`, testy długów, zmian, Pracy | M |
| L1.2, A4.5 (`merge.ts`), Z-11 | testy własności na tym pomocniku | M |
| C2.2 | zapis serii jednym stuknięciem (największa dźwignia w Ćwiczeniach) | M |
| C3.1 | kalendarz regularności 12 tygodni (SVG + opis dla czytnika) | M |
| C3.4 | obwody ciała (nowa mapa Yjs — `docs/dane-wersje.md`) | M |
| C1.1 | przegląd wizualny Ćwiczeń 390 px przez `playwright.visual.config.ts` | S |

## Fala 4 — Ustawienia i synchronizacja

| Punkt | Co | Rozmiar | Przegląd |
|---|---|---|---|
| U2.4 | kolejność karty Sync (dwa duże wybory bez grupy) | S | |
| U3.2 | podgląd kopii przed przywróceniem | M | |
| U3.3 | stan danych (zajęte miejsce, `persist()`) | M | |
| U3.4 | krok samouczka o danych | S | |
| U5.1, U5.3 | jeden `SettingsCard`; `Segmented` zamiast `<select>` ≤ 5 opcji | M | |
| Q4.1 | jeden wskaźnik stanu synchronizacji w nagłówku | M | |
| Q4.2 | „Co się zmieniło, gdy mnie nie było” | M | |
| U2.5 | przekaźnik: dzielenie aktualizacji > 512 KB | M | `security-reviewer` |
| S3.2 | token push na urządzenie | M | `security-reviewer` |

## Fala 5 — platforma i dostępność

| Punkt | Co | Rozmiar |
|---|---|---|
| Q3.2 | `keyboardInset.ts` podpięty we wszystkich arkuszach z polami | M |
| Q3.6 | schowek z sensem (link na zaznaczeniu, lista → zadania, obraz) | M |
| Q5.1 | roving tabindex: lista notatek, Kalendarz, Grafik, tablica | M |
| Q1.4 | rotacja 7 kopii w OPFS (szyfrowanie: decyzja przy SE) | M |
| D1.3 | mapa `docFormat` — wymaganie wersji czytnika per cecha | M |
| A4.7, A5.5 | Stryker i `knip` — **uruchamia właściciel** (`npx -y` blokowane), potem raport i usunięcia | S |

## Fala 6 — duże i ryzykowne (każda osobno, z przeglądem przed kodem)

- **Skarbiec krypto** (`plan-skarbiec-krypto-2026-11-15.md`): ADR-10 → K1, K3, K4, K6.1–K6.3, K7; potem Skarbiec 3.3 (szyfrowane obrazy i załączniki). `security-reviewer` przed i po. L.
- **KSeF Etap 2** (`plan-ksef-etap2.md`): serwer wysyłkowy — najpierw decyzje D-K3… i `security-reviewer`. L.
- **Macierz `@visual`** (W0.1 → W9.2): 12 ekranów × 3 style × 2 szerokości. M.
- **C4.5** OCR etykiety (`tesseract.js`, za flagą). M.

## Czeka na telefon (jedna sesja odblokowuje najwięcej)

`qa-praca-telefon.md` (R1.1), B0.2/B0.3 → Faza 5 i B6 Pracy na budowie; R4.2, R2.3; F1.0 (APK z alarmami) → R4.5, C2.6, C5.1, Z-14.6; W7.5, W9.3; Q5.5 (TalkBack); Plan-nowy 3.5 (`<Activity>` po pomiarze pamięci); ręczne QA z `docs-zrobione/`.

## Czeka na decyzję właściciela

| Decyzja | Odblokowuje |
|---|---|
| SE-1, SE-3 i pozostałe SE | S1.8, S2.4, S4.1, S4.2, S4.9–S4.11, Q4.4, Q1.4 (szyfrowanie), sesja F |
| SE-2 (hosting) | G4.1 alarm push, wdrożenie przekaźnika i serwera powiadomień |
| Q3.3 | motyw według pory (kod S, gotowy do zrobienia po „tak”) |
| AR-1, AR-2 | A5.1, A5.2 |
| QL-2 | Z-16.3 |
| DL-2, DL-3, D-3 | L3.x, L5.x, Dziś 3.4, Długi 3.5 |
| CW-2, CW-3 | C4.2, C5.3 |
| MG-1 | D7.3 (D3.4, D3.6, D5.2 czekają na warunki z planu) |
| WZ-2, WZ-4, WZ-5 | jasna Tablica, W8.3, W7.4 |
| G-7 | Grafik G4.8 |
| D-A4 | audyt 2 |

## Kolejność w skrócie

Fala 0 (e2e i push) → Fala 1 (≈ 1–2 dni) → Fala 2 → Fala 3 → Fala 4 → Fala 5 → Fala 6; sesja na telefonie i decyzje w dowolnym momencie — każda odblokowuje punkty z dwóch ostatnich sekcji.

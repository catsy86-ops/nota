# Plan: Praca na budowie — naprawy, dopracowanie, rozwój (2026-11-10)

> **Status (2026-11-10):** B0.1 i B0.4 zrobione (`ec639272`, szczegóły w `opis.md`); B1.2 nie wymagało kodu, B1.3 i B1.7 zrobione; B0.2 i B0.3 czekają na telefon i Twój tydzień obserwacji. Zastępuje otwarte resztki `plan-praca-hydraulik-2026-10-29.md` (H4.2, H6.1, H6.2 → punkt B0.2) i P2.2 z planu 27.10 (→ B3.9). Numeracja ma przedrostek **B** (budowa).

## 1. Diagnoza

Plan hydraulika z 29.10 jest zrobiony prawie w całości: rury w metrach, zestawy, auto, punkty w pomieszczeniach, rozliczenia, fuchy, podpis, paczka `.budowa`, zdjęcia z dnia, dyktowanie na urządzeniu. W kodzie Praca to dziś ok. 200 plików w `src/lib/study/`, 71 komponentów w `src/components/study/` i ponad 50 specyfikacji e2e. Plany (analizator) są osobną zakładką.

Problem nie polega więc na brakujących funkcjach. Problemy są cztery:

| # | Problem | Dowód w kodzie |
|---|---|---|
| D1 | **Nic nie sprawdzono w terenie.** Dyktowanie na urządzeniu, tekst na żywo i EXIF z galerii nie przeszły próby na telefonie. Nie wiadomo, których funkcji używasz, a których nie. | `Plan-nowy.md` Cykl 4, status planu z 29.10 |
| D2 | **Karta budowy jest przeładowana.** Jedno okno ma do 14 paneli jeden pod drugim: rozliczenie, etapy, punkty, braki, usterki, materiał, godziny, zamówienia, dokumenty, serwis, miejsce na dysku. Do zamówień trzeba przewinąć przez wszystko inne. | `SiteCardDialog.tsx:293-474` |
| D3 | **Nie ma przepływu dnia.** Elementy dnia działają osobno: „Jesteś przy budowie”, godziny, plan na dziś, przypomnienie o raporcie, zamówienie i kopia. Koniec dnia to 4–5 osobnych miejsc. Zakładka Praca otwiera się na zakładkach nauki (Quiz, Tablica, Lista), a Dziennik jest dopiero czwarty. | `StudyView.tsx:292-297`, `DailyReportNudge.tsx`, `SiteArrivalPrompt.tsx` |
| D4 | **Dług w miejscach codziennych.** Kształtki zajmują 4 stuknięcia (cel: 3). `JournalEntrySheet.tsx` ma 973 linie, a `SiteCardDialog.tsx` 563. Jest cykl typów `sites.ts` ↔ `yStudy.ts`. Migracja `data.ts` ma 59% pokrycia. Starsze wersje aplikacji nie widzą wpisów zapisanych jako mapa pól, a aplikacja o tym nie ostrzega. | `docs/TECH-DEBT.md:10-15`, `opis.md` („Zgodność”) |

Dlatego kolejność to: **zmierzyć → naprawić → uprościć → dopiero potem dodawać**. Nowe funkcje (Faza 3) są wybrane pod pracę w terenie i korzystają z API przeglądarki, których aplikacja jeszcze nie używa.

## 2. Zasady

Zostają zasady z 29.10: telefon w rękawicach, Yjs z kluczem na pozycję, nowe pola zamiast zmiany starych, pieniądze nie trafiają do pomocnika, nowy kod tylko w leniwych chunkach, kolejność test → kod → `opis.md` → `simplify` + `code-review` → commit. Dochodzą cztery:

7. **Najpierw pomiar.** Każdy punkt Faz 2–5 ma miarę przed i po (stuknięcia, czas, INP). Bez miary punkt nie wchodzi.
8. **Ulepszanie stopniowe.** Każde nowe API (czujniki, skaner, NFC, AI na urządzeniu) jest sprawdzane przez wykrycie funkcji i ma działający wariant bez niego. Bez wsparcia przycisk się nie pokazuje. Nigdy nie pokazuje błędu.
9. **Prywatność bez wyjątków.** Nic nie wychodzi z telefonu bez Twojego stuknięcia. AI i rozpoznawanie działają tylko na urządzeniu, bez chmury.
10. **Mniej na ekranie.** Każdy nowy element zastępuje stary albo chowa się, dopóki nie jest potrzebny. Puste sekcje nie zajmują miejsca.

Oznaczenia: **W** to wartość dla codziennej pracy (1–3), **N** to nakład (S, M, L).

## 3. Miary sukcesu

| Miara | Dziś | Cel | Jak mierzone |
|---|---|---|---|
| Zdjęcie do wpisu bieżącej budowy | 3 stuknięcia | **2** | `e2e/workday.spec.ts` (licznik stuknięć) |
| Kształtki do wpisu | ~~4~~ 3 (B1.1) | **3** | j.w. |
| Brak materiału | ≤ 3 | ≤ 3 | j.w. |
| Koniec dnia: godziny + raport do szefa + zamówienie | 4–5 miejsc, ok. 12 stuknięć | **1 arkusz, ≤ 6 stuknięć** | nowy krok w `workday.spec.ts` |
| Otwarcie karty budowy (Pixel 7, CPU ×4) | brak pomiaru | **< 300 ms** do pierwszej sekcji | B0.4 |
| INP przy „Zapisz wpis” | brak pomiaru | **p75 < 200 ms** | B0.4 (LoAF) |
| Utrata danych przy scalaniu | testy przykładowe | **0 w 10 000 losowych przebiegach** | B1.4 (fast-check) |
| Paczka startowa / precache | progi w `bundle.spec.ts` | **bez wzrostu** startowej; precache ≤ 4,2 MiB | `e2e/bundle.spec.ts` |

---

## Faza 0: pomiar i próba w terenie (bez nowych funkcji)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| B0.1 | **Lokalny licznik użycia Pracy.** Liczy, ile razy użyto każdej funkcji (panel karty, kalkulator, ściąga, eksport, skrót), i zapisuje ostatnie użycie. Dane zostają na telefonie. Ustawienia → Diagnostyka pokazują tabelę „używane / nieużywane od 30 dni”, a raport diagnostyki może ją zawierać. Bez treści wpisów. Na tej tabeli opiera się B2.2: co schować, co wysunąć. | `src/lib/diagnostics.ts`, nowy `src/lib/study/usage.ts` (klucz localStorage, licznik + `lastAt`) | 3 | S |
| B0.2 | **Sesja QA na telefonie** (zaległe H4.2, H6.1, H6.2 i Cykl 4). Scenariusz z `workday.spec.ts` na prawdziwym telefonie: w rękawicach, w słońcu, w trybie samolotowym, z 300 zdjęciami w pamięci. Lista kontrolna w `docs/qa-praca-telefon.md`, wynik w `opis.md`. | telefon | 3 | S |
| B0.3 | **Tydzień obserwacji** (H0.4 nadal otwarte): w Skrzynce zapisujesz wszystko, co przeszkadza, z etykietą `#praca-uwagi`. Na koniec tygodnia uwagi zmieniają kolejność Faz 1–2. | Skrzynka | 3 | S |
| B0.4 | **Pomiar wydajności Pracy.** `PerformanceObserver` dla `long-animation-frame` (LoAF) i `event` (INP) na otwarciu karty, zapisie wpisu, przełączeniu zakładki i otwarciu osi z 2 latami danych. Dane testowe: generator 3 000 wpisów i 40 budów (`scripts/seed-praca.mjs`). Wynik trafia do diagnostyki i do `docs/PERFORMANCE.md`. Bez nowej zależności. | `src/lib/diagnostics.ts`, `scripts/` | 2 | S |

## Faza 1: naprawy i dług

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| B1.1 | ✅ **Kształtki w 3 stuknięciach** (trzy najczęstsze jako „+ Kolano 16” w rzędzie przycisków arkusza; bez przytrzymania, −/+ są po dodaniu). Pigułki ostatnio używanych kształtek widać od razu w arkuszu, bez rozwijania sekcji. Stuknięcie dodaje 1 szt., przytrzymanie otwiera pole ilości. | `JournalEntrySheet.tsx`, `FittingsFields.tsx` | 3 | S |
| B1.2 | ✅ **Nie wymaga kodu (2026-11-10).** Ostrzeżenie o starej wersji już istnieje: urządzenia ogłaszają `SCHEMA_VERSION` w awareness (`formatSchema.ts`), a `OlderDeviceBanner` (w `Index.tsx`) i Ustawienia → Sync pokazują „*Marek* ma starszą wersję”. Diagnoza D4 w tym punkcie była błędna. | `src/lib/formatSchema.ts`, `src/components/sync/OlderDeviceBanner.tsx` | 3 | S |
| B1.3 | ✅ **Testy charakteryzujące `data.ts`** (59% → 96%, `data.test.ts`): migracje, pierwsze uruchomienie, uszkodzony dump. | `src/lib/study/data.test.ts` | 2 | S |
| B1.4 | ✅ (2026-11-10; bez punktu „idempotentny import paczki”, w zamian fuzz parsera) **Testy własności** (`fast-check`, tylko w devDependencies): (a) scalanie 2–3 `Y.Doc` w losowej kolejności daje ten sam stan i niczego nie gubi (wpisy, punkty, braki, auto, wpłaty); (b) `billing.ts`: „naliczone − otrzymane = zostało” dla każdego wejścia, nigdy `NaN`; (c) stan auta = inwentaryzacja + przyjęcia − zużycie, niezależnie od kolejności zdarzeń; (d) `sitePackage` wczytany dwa razy daje to samo co raz (idempotentność). | `src/lib/study/*.prop.test.ts` | 3 | M |
| B1.5 | ✅ **Cykl typów i importy przez fasadę** (dług P3): `JournalEntry` importowane z `journalEntry.ts`, nie z `yStudy.ts`. Reguła ESLint `no-restricted-imports` pilnuje, żeby akcje nie importowały `store.ts`. | `src/lib/study/`, `eslint.config.js` | 1 | S |
| B1.6 | ◐ **częściowo (2026-11-10): wydzielone `EntryKitsPanel`, `EntrySupplyToggle`, `EntryTopicPanel` w `src/components/study/entry/`; reduktor szkicu i sekcje etapu/zdjęć/lokalizacji zostają.** Podział `JournalEntrySheet.tsx`** na sekcje (`EntryText`, `EntryMaterial`, `EntryPhotos`, `EntryTest`, `EntryMeta`) z jednym reduktorem stanu szkicu (`useReducer` + czysta funkcja `entryDraftReducer` w `lib/` z testem). Najpierw testy charakteryzujące obecnego arkusza. Robione razem z B1.1, bo to ten sam plik. | `src/components/study/entry/` | 2 | M |
| B1.7 | ✅ (bez przycisku archiwum, jest już w karcie) **Bezpieczeństwo zdjęć widoczne.** Na karcie budowy linia: „Zdjęcia: 124 · tylko na tym telefonie” albo „· w kopii z 8.11”. Jedno stuknięcie tworzy archiwum budowy (`siteZip.ts`) i otwiera arkusz udostępniania (Dysk Google, WhatsApp). Bez trwałego magazynu (`storagePersistence.ts`) widać ostrzeżenie. | `SiteStorageLine.tsx` | 3 | S |

## Faza 2: przebudowa wejścia i karty budowy (największa dźwignia)

Przed kodem: skill `frontend-design`. Po kodzie: `refactoring-ui` i `ux-heuristics`. Każdy ekran dostaje zrzut `@visual` na 390 px i 1440 px.

| # | Co | W | N |
|---|----|---|---|
| B2.1 | ✅ (2026-11-10; decyzja B-1: tak; na komputerze bez zapisu nadal Quiz) **Praca otwiera się na „Budowie”.** Nowa pierwsza zakładka **Budowa** pokazuje jeden ekran: bieżącą budowę (z lokalizacji, Grafiku albo ostatniej), plan na dziś, punkty do zrobienia, otwarte braki i trzy duże przyciski: **Zdjęcie**, **Wpis głosowy**, **Brak**. Zakładki: Budowa · Dziennik · Plany · Nauka. Quiz, Tablica i Lista przechodzą do zakładki Nauka jako podzakładki. Stary klucz `kaczy.study.tab.v1` jest tłumaczony na nowe zakładki, więc zapamiętany wybór działa dalej. Decyzja **B-1**. | 3 | M |
| B2.2 | ✅ (2026-11-10; bez adresu `?sekcja=` — zamiast tego pamięć segmentu w sesji; „Pokaż wpisy” i „Raport” zostały nad segmentami) **Karta budowy w sekcjach.** Zamiast 14 paneli pod sobą: przyklejony pasek segmentów **Dziś · Materiał · Punkty · Pieniądze · Papiery** (`ToggleGroup` z Radix, przewijany poziomo). Dziś: plan, etapy, usterki, godziny. Materiał: braki, zużycie, zamówienia, auto. Punkty: pomieszczenia. Pieniądze: rozliczenie i należności, tylko u Ciebie. Papiery: dokumenty, protokół, serwis, gwarancja, paczka. Pusta sekcja zwija się do jednej linii „+ Dodaj…”. Sekcja jest w adresie (`?budowa=id&sekcja=material`) i karta ją pamięta. Pasek liczników (`SiteTallyBar`) prowadzi do sekcji. Decyzja **B-2**. | 3 | L |
| B2.3 | ◐ **W TOKU (2026-11-10):** pasek `site-thumb-bar` (Wpis tutaj, Zdjęcie, Brak, Godziny) jest w `SiteCardDialog.tsx` na telefonie (`sm:hidden`), górny rząd tylko od `sm`; padają `workday.spec.ts` (chromium i iphone-14) i `site-points.spec.ts:109` (iphone-14) — do zbadania (pasek zasłania elementy albo zmienione liczby stuknięć). **Pasek kciuka w karcie.** Na telefonie dół karty ma stałe akcje: Zdjęcie, Wpis, Brak, Start/Stop godzin. Każda to 1 stuknięcie. Pasek nie zasłania klawiatury (`keyboardInset.ts`). | 3 | S |
| B2.4 | **„Zacznij dzień” i „Zakończ dzień”.** Start: budowa z lokalizacji albo z Grafiku, godzina wejścia z pierwszego zdjęcia albo z przyjazdu (z możliwością poprawki), plan na dziś. Koniec to jeden arkusz w 4 krokach, każdy można pominąć: (1) godziny z podpowiedzią z pierwszego i ostatniego wpisu, (2) podsumowanie dnia i raport do szefa (`report.ts`), (3) braki na jutro i jedno zamówienie do hurtowni (`WholesaleOrderDialog`), (4) kopia, jeśli ostatnia jest starsza niż 3 dni. Zastępuje osobne przypomnienie `DailyReportNudge` (stuknięcie w powiadomienie otwiera ten arkusz). | 3 | M |
| B2.5 | **Wyszukiwanie w Pracy.** Indeks MiniSearch (biblioteka już jest w projekcie) obejmuje wpisy, podpisy zdjęć, punkty, braki, usterki i nazwy dokumentów, bez polskich znaków i z literówkami. Wynik pokazuje miniaturę i budowę. Typowe pytanie: „zawór Lipowa”. Indeks budowany leniwie, przy pierwszym wyszukiwaniu. Ta sama funkcja zasila paletę poleceń (dziś `CommandPalette.tsx:158` porównuje tylko podciąg tekstu). | 3 | M |
| B2.6 | **Nowe skróty PWA:** „Zdjęcie na budowę” (od razu aparat i bieżąca budowa), „Brak materiału”, „Zakończ dzień”. Dziś skróty to tylko „Wpis z budowy” i „Wpis głosowy”. Android pokazuje 4 pierwsze, więc kolejność skrótów trzeba ustalić na nowo. | 2 | S |
| B2.7 | **Przejścia w karcie przez View Transitions API** (tryb jednego dokumentu: wejście w kartę, zmiana sekcji). Taniej niż framer-motion przy długich listach. Bez wsparcia zmiana jest natychmiastowa. Przy `prefers-reduced-motion` przejść nie ma. | 1 | S |

## Faza 3: nowe funkcje na budowę

| # | Co | Technika | W | N |
|---|----|----------|---|---|
| B3.1 | ✅ **(2026-11-11, bez zdjęcia manometru; sprawdzone w Puppeteerze na 390 px i testem z zegarem Playwrighta)** **Minutnik próby szczelności.** „Start próby” zapisuje ciśnienie początkowe i robi zdjęcie manometru. Ekran nie gaśnie (`useWakeLock.ts` już jest). Odliczanie zostaje po zamknięciu aplikacji: lokalne powiadomienie na koniec przez service worker, a przy powrocie licznik liczy się od zapisanego `startedAt`. Odczyty w trakcie (ciśnienie i godzina) dają mały wykres spadku. Na koniec zdjęcie manometru i automatycznie wypełniony `PressureTest` z wynikiem. Protokół PDF dostaje odczyty. Nowe pole `readings` w `PressureTest` (zasada 3). | Wake Lock, Notifications, Playwright `page.clock` w teście | 3 | M |
| B3.2 | **Zdjęcia przed zakryciem** (P2.2 z 27.10). Etap „zakrycie” (tynk, płytki, wylewka) ostrzega przy odhaczaniu, gdy punkt nie ma zdjęcia: „3 punkty bez zdjęcia przed zakryciem” i od razu aparat do pierwszego z nich. Na Dziś przypomnienie, gdy etap zakrycia jest w planie. | istniejące `points.ts`, `stages.ts` | 3 | S |
| B3.3 | **Wymiary na zdjęciu (miarka).** Narzędzie „wymiar” w rysunku: linia ze strzałkami i liczba („35 cm od narożnika”). Zapis jako dane wektorowe przy zdjęciu, nie wypalone w obraz, więc oryginał zostaje (H0.1). Wymiary trafiają do protokołu. Odpowiada na pytanie „gdzie idzie rura pod płytką”. | wektory na płótnie, `DrawingCanvas.tsx` | 3 | M |
| B3.4 | **Poziomica i spadek z czujnika.** Przykładasz telefon do rury i widzisz spadek w % z kolorem: 2–3% zielony, poza zakresem żółty. Najpierw kalibracja na płaskiej powierzchni. Wynik można dopisać do wpisu. Zastrzeżenie na ekranie: to sprawdzenie, nie pomiar (dokładność czujnika to ok. 0,1–0,2%). | `DeviceOrientationEvent` (na iOS wymaga zgody), dane z `calc.ts` (`SLOPE_TYPICAL`) | 2 | S |
| B3.5 | **Skaner kodów.** Natywny `BarcodeDetector` (Chrome na Androidzie) czyta EAN z opakowania kształtki przy przyjęciu do auta i przy inwentaryzacji. Pierwszy skan pyta o nazwę z katalogu (`catalog.ts`), następne ją pamiętają, w Yjs. Bez zewnętrznej bazy produktów. Te same naklejki QR na budowie (link z `siteLink.ts`) otwierają kartę. Gdy przeglądarka nie ma natywnego skanera, leniwie ładuje się `barcode-detector` (zxing-wasm) albo, tylko dla QR, obecny `jsqr`. Decyzja **B-5**. | BarcodeDetector, zxing-wasm leniwie | 2 | M |
| B3.6 | **Raport dnia z AI na urządzeniu** (eksperyment). Gdy Chrome udostępnia wbudowany model (Summarizer API albo Prompt API z Gemini Nano), raport do szefa może powstać z dzisiejszych wpisów i dyktowań jako 3–5 zdań po polsku. Zawsze do edycji, a obok zostaje obecny raport z szablonu. Dane nie wychodzą z telefonu. Domyślnie wyłączone. Najpierw próba: czy model jest na Twoim telefonie i czy dobrze pisze po polsku. To samo API może później lepiej rozumieć dyktowanie („trzy kolanka szesnaście”) niż obecne reguły w `spokenEntry.ts`. Decyzja **B-3**. | Chrome built-in AI, wykrywanie funkcji | 2 | M |
| B3.7 | **Nowa budowa z poprzedniej.** „Jak Lipowa” kopiuje etapy, pomieszczenia z punktami (bez stanów), zestawy, sposób rozliczenia, odbiorców raportu i hurtownię. Nie kopiuje wpisów, zdjęć ani pieniędzy. | `NewSiteDialog.tsx`, `siteActions.ts` | 2 | S |
| B3.8 | **Kontakty z telefonu.** Przy inwestorze, kierowniku i hurtowni przycisk „Z kontaktów” zamiast przepisywania numeru. Tylko Android (Contact Picker API), gdzie indziej przycisku nie ma. | Contact Picker API | 1 | S |
| B3.9 | **Aparat w aplikacji z latarką** (najpierw próba). Zdjęcia w szachcie, pod wanną i w kotłowni: podgląd z przyciskiem latarki, seria zdjęć bez wychodzenia z aplikacji, wybór punktu przed zrobieniem zdjęcia. Jeśli telefon nie daje latarki przez `getUserMedia`, punkt odpada i zostaje systemowy aparat. | `getUserMedia`, ograniczenie `torch`, `ImageCapture` | 2 | M |
| B3.10 | **Przegląd po gwarancji i serwis cykliczny.** Przypomnienie 30 dni przed końcem gwarancji (`warranty` już jest w karcie) oraz cykliczne przeglądy (filtr, kocioł, zmiękczacz) z telefonem klienta i gotową wiadomością. Źródło przyszłych fuch. | `service.ts`, `reminders.ts` | 2 | S |
| B3.11 | **Naklejka NFC w aucie i na budowie** (eksperyment, decyzja **B-6**). Przyłożenie telefonu otwiera kartę i pyta „Start godzin?”. QR z B3.5 robi to samo bez NFC. | Web NFC (Chrome na Androidzie) | 1 | S |

## Faza 4: pieniądze i papiery (dopracowanie)

| # | Co | W | N |
|---|----|---|---|
| B4.1 | **Cennik robocizny do fuch.** Własne pozycje („WC podwieszane: 350 zł”, „wymiana baterii: 120 zł”) korzystają ze stawek na typ punktu (H-4). Wycena fuchy powstaje w 30 sekund z pigułek. | 2 | S |
| B4.2 | **Przypomnienie o należności.** Na Dziś: „Lipowa: 2 400 zł czeka 14 dni”. Gotowa, grzeczna wiadomość SMS lub WhatsApp z kwotą i numerem konta z `companyPrefs.ts`. | 2 | S |
| B4.3 | **Kilometrówka** (decyzja **B-4**). Trasa dnia z kolejności budów (`geo` z karty), odległość wpisywana ręcznie z licznika albo podpowiadana w linii prostej × 1,3. Stawka za km, miesięczne zestawienie i CSV dla księgowej. | 2 | M |
| B4.4 | **Odcisk dokumentu.** Protokół, wycena i potwierdzenie mają w stopce skrót SHA-256 (Web Crypto) i datę. Kopia w aplikacji pozwala sprawdzić, że PDF u klienta jest tym samym dokumentem. Nie jest to podpis kwalifikowany i PDF tak tego nie nazywa. | 1 | S |
| B4.5 | **Miesiąc w jednym miejscu.** Godziny, punkty, ryczałty i fuchy, wpłaty i niezapłacone, koszt materiału fuch. Osobno „Dla szefa” i „Moje” (H3.6). Rozwinięcie linii „Z budów” w Grafiku. | 2 | M |

## Faza 5: technologia pod spodem (tylko po pomiarze z B0.4)

| # | Co | Warunek wejścia | W | N |
|---|----|-----------------|---|---|
| B5.1 | **Wirtualizacja osi dziennika** (`@tanstack/react-virtual`, leniwie). | Oś z 3 000 wpisów przekracza 300 ms albo INP > 200 ms | 2 | M |
| B5.2 | **Kompresja `.budowa` i archiwum budowy** przez natywne `CompressionStream("gzip")`, bez zależności. Paczka z dużą liczbą wpisów jest wtedy kilka razy mniejsza w WhatsApp. Nowy nagłówek pliku, a stary format nadal się wczytuje. | Zawsze (mały koszt), ale z testem starego formatu | 2 | S |
| B5.3 | **`<Activity>` z React 19.2 dla zakładek Pracy.** Quiz i oś zachowują stan i przewinięcie bez `forceMount` i ukrywania przez CSS. | Pomiar pamięci na telefonie bez regresji | 1 | S |
| B5.4 | **React Compiler 1.0** na Pracy (próba na osobnej gałęzi). Wymaga `@vitejs/plugin-react` z Babel zamiast SWC. | Zysk INP ≥ 15%, paczka + ≤ 2 KB, build ≤ +20%. Decyzja **B-8** | 1 | M |
| B5.5 | **Zdjęcia w OPFS** (Origin Private File System w Workerze) zamiast blobów w IndexedDB, z migracją w tle i powrotem do IndexedDB. | Tylko gdy B0.2 lub B0.4 pokażą wolne miniatury albo problemy z miejscem przy > 1 000 zdjęć. Decyzja **B-7** | 2 | L |
| B5.6 | **Indeks wyszukiwania (B2.5) w Workerze** razem z Cyklem 3.2 z `Plan-nowy.md`. | Budowanie indeksu > 100 ms na telefonie | 1 | M |

## Faza 6: Nauka (bez zmian w zakresie)

Nauka zostaje w zakładce „Nauka” (B2.1). Otwarte punkty bez zmian: 4.6 (więcej pytań) czeka na źródła od Ciebie, a 4.3 (własne tematy) to osobny projekt. Jedno małe rozszerzenie: problem z odpowiedzią „Jak rozwiązane?” może jednym stuknięciem stać się Twoim pytaniem w „Moich pytaniach” (`studyCustom`). Wtedy uczysz się z własnych budów. **W 1, N S.**

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| B-1 | ✅ **Tak (2026-11-10).** Czy Praca ma się otwierać na nowej zakładce „Budowa”, a Quiz, Tablica i Lista przejść do „Nauki”? | **Tak.** Na budowie nauka to dodatek, a budowa to codzienność. Zapamiętana zakładka nadal działa. |
| B-2 | ✅ **Segmenty (2026-11-10).** Karta budowy: segmenty (B2.2) czy harmonijka z rozwijanymi panelami? | **Segmenty.** Harmonijka nadal każe przewijać, a segment to jedno stuknięcie i własny adres. |
| B-3 | Czy AI na urządzeniu (B3.6) ma wejść, jeśli działa na Twoim telefonie? | **Tak, jako opcja, domyślnie wyłączona.** Wyłącznie model wbudowany w Chrome, nigdy chmura. |
| B-4 | Czy potrzebujesz kilometrówki (B4.3)? | **Tylko jeśli jeździsz prywatnym autem i rozliczasz kilometry.** Inaczej punkt odpada. |
| B-5 | Skaner: tylko natywny czy z zapasową biblioteką? | **Natywny, a biblioteka zxing-wasm leniwie, tylko gdy przeglądarka nie ma skanera.** Biblioteka nie trafia do precache (`globIgnores`). |
| B-6 | NFC (B3.11)? | **Najpierw QR z B3.5.** NFC tylko wtedy, gdy QR okaże się za wolny. |
| B-7 | OPFS dla zdjęć (B5.5)? | **ODŁOŻONE (przegląd architekta 2026-11-11).** Najpierw tańsze: miniatura obok oryginału (`acquireUrl` ładuje dziś pełne bajty), zmniejszanie zdjęcia przy zapisie, `persist()` po pierwszym zdjęciu we wszystkich ścieżkach, ostrzeżenie o quocie. OPFS dopiero gdy pomiar (>300 ms lista zdjęć albo błędy quoty przy >1 000) i te kroki nie wystarczą; wtedy za interfejsem `ImageBackend` w `imageStore.ts`, flaga `kaczy.images.backend` (idb / opfs-dual / opfs), dual-write, migracja partiami pod `navigator.locks` z weryfikacją hash, stary magazyn kasowany tylko ręcznie po kopii ZIP. **Tylko po pomiarze.** Migracja magazynu zdjęć to największe ryzyko utraty danych w całym planie. |
| B-8 | React Compiler (B5.4)? | **Próba na gałęzi.** Do master trafia tylko przy spełnionych progach. |

## Kolejność wdrażania

1. **Faza 0:** B0.1 i B0.4 (kod, 1 dzień) → B0.2 i B0.3 (telefon, tydzień pracy, równolegle z Fazą 1).
2. **Faza 1:** B1.2 (zgodność) → B1.7 (zdjęcia) → B1.3 → B1.4 → B1.6 razem z B1.1 → B1.5.
3. **Przegląd wyników z Fazy 0**, który może zmienić zakres Faz 2–3.
4. **Faza 2:** B2.1 (po B-1) → B2.2 (po B-2, `architect` nie jest potrzebny, granice modułów się nie zmieniają) → B2.3 → B2.4 → B2.5 → B2.6 → B2.7.
5. **Faza 3, szybkie korzyści:** B3.2 → B3.1 → B3.7 → B3.3 → B3.10.
6. **Faza 3, nowe API:** B3.4 → B3.5 (po B-5) → B3.8 → próby B3.6, B3.9, B3.11 na telefonie.
7. **Faza 4:** B4.1 → B4.2 → B4.5 → B4.4 → B4.3 (po B-4).
8. **Faza 5:** tylko punkty, których warunek wejścia spełnił pomiar. B5.2 można zrobić w dowolnej chwili.

## Agenci i skille

- `frontend-design` przed B2.1, B2.2, B2.4, B3.1, B3.3 i B3.4. Potem `refactoring-ui` i `ux-heuristics`.
- `security-reviewer`: B1.2 (metadane urządzeń w Yjs), B3.5 (dane ze skanera i link QR), B3.6 (treść wpisów w modelu), B4.4, B5.2 (nowy format pliku z zewnątrz).
- `performance-engineer`: B0.4, B2.5, każdy punkt Fazy 5, B3.5 (rozmiar zxing-wasm).
- `testing-engineer`: B1.4, nowe kroki w `workday.spec.ts`, zrzuty `@visual` sekcji karty.
- `architect`: tylko B5.5, bo zmienia magazyn zdjęć.
- `design:accessibility-review` i `e2e/a11y.spec.ts` po Fazie 2 i po Fazie 3.
- `simplify` i `code-review` na diffie przed każdym commitem.

## Weryfikacja

- **Każdy punkt:** `npm run typecheck`, Vitest dla `src/lib/study/**`, celowany spec e2e, `e2e/bundle.spec.ts` przy nowym kodzie.
- **Nowe dane w Yjs:** test scalania (od B1.4: test własności), test kopii (`fullBackup.test.ts`), test starszej wersji (`dataCompat.test.ts`).
- **Nowe API przeglądarki:** test e2e z atrapą API (jest) i bez API (przycisk się nie pokazuje, nic się nie wysypuje).
- **Codzienna ścieżka:** `e2e/workday.spec.ts` z licznikami stuknięć z tabeli miar po każdej fazie.
- **Telefon:** na koniec każdej fazy jeden prawdziwy dzień pracy. Wynik trafia do `opis.md`.
- Pełne `test:e2e` tylko na końcu fazy i na prośbę.

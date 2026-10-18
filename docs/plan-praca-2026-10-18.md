# Plan: dopracowanie i rozbudowa działu Praca (2026-10-18)

Trzy audyty tylko do odczytu: UX i funkcje, kod i model danych, testy i wiarygodność. Ustalenia są z odczytu kodu; liczby i nakłady to szacunki.

Uwaga: wejściowy JS jest na progu (próg podniesiony do 385 KB). Nowy kod w głównej paczce wymaga leniwego ładowania.

## Priorytet 1 — bezpieczeństwo danych (najpierw)

| # | Problem | Gdzie | Naprawa | Nakład |
|---|---------|-------|---------|--------|
| D1 ✅ | Wpis z samymi odhaczeniami znika po usunięciu punktu listy (pustość liczona po filtrze materiału); `removeCustom` nie czyści wpisów | `store.ts:67,75`, `yStudy.ts:529-539` | Sprawdzać pustość przed filtrem; czyścić `checked` we wpisach przy usuwaniu punktu; test | S |
| D2 (częściowo: ślad w diagnostyce) | Przywracanie kopii najpierw kasuje wpisy, potem zapisuje oczyszczone; wpisy nieznanego rodzaju i zdjęcia z błędnym kluczem znikają bez śladu | `yStudy.ts:550-551,150,198`, `store.ts:69` | Walidować przed kasowaniem; liczyć i logować odrzucone (`logDiag`); pokazać liczbę w oknie przywracania | M |
| D3 | Kopia zapasowa: przekroczenie budżetu 40 MB gubi zdjęcia i pliki budów po cichu; plany (PDF) liczą się jako „zdjęcia dziennika"; brak testu gałęzi przekroczenia | `attachments.ts:36`, `exportNotes.ts:91`, `journalRefs.ts`, `fullBackup.test.ts:175` | Test przekroczenia; osobna etykieta dla dokumentów budów; raport o pominiętych plikach | M |
| D4 ✅ | Wpis z referencją do nieobecnego zdjęcia: nie sprawdzono, czy przeżywa import | `fullBackup.test.ts:186`, `cleanDump`/`sanitizeStudy` | Test importu z brakującym obrazem; raport wymienia zdjęcie | S |
| D5 | Edycja tego samego wpisu na dwóch telefonach gubi pola: cały wpis to jeden klucz `Y.Map` | `yStudy.ts:433,442-467` | Pola wpisu jako osobne klucze (jak listy budowy w `siteItems.ts`) — zmiana modelu, osobna decyzja | L |

## Priorytet 2 — jedna logika zamiast kilku kopii

| # | Problem | Gdzie | Naprawa | Nakład |
|---|---------|-------|---------|--------|
| L1 | Trzy kopie czyszczenia wpisu (`sanitizeStudy`, `cleanEntry`, `entryFields`) i częściowa (`draft.ts`); to samo dla `cleanSites`, `cleanReviews`, `isColumn` | `store.ts:36-110,218-240`, `yStudy.ts:138-228`, `draft.ts:33-48` | Jeden `cleanEntry(raw, {topics, items})` dla projekcji, zrzutu, szkicu i zapisu | S–M |
| L2 | Dwa źródła „Na dziś": karta czyta surową kopię, widok — projekcję bez materiału | `review/TodayStudyCard.tsx:38-40`, `StudyView.tsx:108`, `store.ts:108` | Jedna funkcja `dueToday` dla obu | S |
| L3 | Cykl importów `sites.ts` ↔ `siteHours.ts` (w czasie działania) | `sites.ts:5`, `siteHours.ts:1` | Wydzielić `entrySiteId` i `cleanSiteHours` do modułu bez zwrotnej zależności | S |
| L4 | Duplikaty pomocników: klucz dnia (ok. 15 miejsc), `shortDate` (7 wersji, 2 formaty), normalizatory ogonków (2) | `report.ts:114,146`, `dayDone.ts:18`, `yShifts.ts:30`, `fittings.ts:21`, `sites.ts:61` | Jeden moduł `lib/dates`, jeden `shortDate`, jeden normalizator | S |
| L5 | Rzutowania `as` na danych z zewnątrz (bez walidacji) | `siteItems.ts:88-106`, `store.ts:318,332,428`, `CustomQuestionsDialog.tsx:47,58` | Type guardy | S |
| L6 | Martwy kod i mylące komentarze: parametr `known` w `srs.ts:58`, JSDoc `saveBoss` nad `addCustomEntry`, zdublowany komentarz, odwołanie do nieistniejącego `HandoverPrint.tsx`, `resetStudyForTests` w paczce produkcyjnej | jw. | Usunąć, poprawić | S |

## Priorytet 3 — testy (wartość wysoka, nakład ok. 2 dni)

| # | Co brakuje | Nakład |
|---|-----------|--------|
| T1 | Round-trip wrapperów list budowy: `setSiteStages/Shortages/Docs/Service/Warranty`, `markSiteOrdered` z `base` z innego zapisu (drugi telefon) | M |
| T2 | Komponenty działu bez testów jednostkowych (SiteDocs, SiteService, SiteStages, SiteShortages, SiteOrder, JournalEntrySheet, DayHours, Calculators); `addSiteDocFiles` z limitami i deduplikacją | S dla funkcji, M dla komponentów |
| T3 (parseHours ✅) | Funkcje liczące: `workLine`/`workMinutesOf`, `composeSiteLists`, `stripLists`, `reviewCard` („błąd, potem dobra tego samego dnia"), `deleteCustom`, `downloadSiteZip`; `parseHours` przepuszcza „6:70" jako 7 h 10 min | S każde |
| T4 | Dawny zapis w localStorage z ważnymi zdjęciami (ścieżka, którą GC może skasować) | S |
| T5 | Flaki w e2e: `report-nudge.spec.ts:41,49` (`waitForTimeout` przed negatywną asercją), słabe asercje (`journal-geo.spec.ts:57` akceptuje dwa komunikaty; `today-study.spec.ts` zawsze pierwsza odpowiedź) | S |
| T6 | Testy zależne od zegara bez mocków: `TodayDueList.test.tsx`, `recordRound` i `addJournalEntry` bez jawnego `now` | S |
| T7 ✅ | Usunięcie wpisu ze zdjęciami i „Cofnij" — brak testu, że zdjęcia wracają | S |

## Priorytet 4 — UX (wartość dla użytkownika w terenie)

| # | Propozycja | Nakład | Ryzyko |
|---|-----------|--------|--------|
| U1 | **Przypomnienie „próba przed zakryciem":** gdy etap instalacji podposadzkowej/bruzd jest zrobiony, a próby szczelności nie ma — pokaż na „Dziś" i w karcie budowy (najdroższy błąd, nic dziś tego nie pilnuje) | S–M | fałszywe alarmy, gdy etapy nie są odhaczane |
| U2 | **Seria wpisów z jednej budowy:** po „Zapisz wpis" zostaje budowa i rodzaj, czyszczony tekst i zdjęcia | S | wpis w złej budowie — nazwa budowy widoczna w nagłówku |
| U3 ✅ (zakładka) | **Jedna nazwa na każdą rzecz:** „Wpis" / „Dokończ wpis" / „Wpis z budowy"; „Lista" → „Lista kontrolna"; w notatkach „Tablica" to układ kolumn, w Pracy tablica tematów | S | e2e szukające tekstów do poprawy (zmieniamy etykiety, nie klucze) |
| U4 | **Rękawice:** sprawdzić, czy zakładki Quiz/Tablica/Lista/Dziennik mają 44 px na dotyku | S | na telefonie niesprawdzone |
| U5 | **Szybki wpis głosowy ze skrótu** (`?wpis=1` z włączonym dyktowaniem) | S–M | dyktowanie przeglądarkowe wymaga sieci i słabo działa na iOS |
| U6 | **Puste stany i błędy z następnym krokiem:** „Brak wpisów" bez przycisku „+ Wpis"; „Brakuje miejsca w pamięci" bez wskazówki (usuń stare zdjęcia) | S | minimalne |
| U7 | **Zamówienie do hurtowni przez WhatsApp** (dziś tylko „Kopiuj") | S–M | numer hurtowni trafia do sync i kopii |
| U8 | Nagranie głosowe w wpisie jako plan B (`VoiceRecorder` z notatek) | M | sync wymaga, by oba urządzenia były online; bez transkrypcji nie trafia do raportu |

## Kolejność

1. **Bezpieczeństwo danych:** D1, D4, T7 (małe, pewne), potem D2 i D3 z testami.
2. **Jedna logika:** L1, L2, L3, L4 (razem z testami T1–T3).
3. **Testy i flaki:** T4–T6, T2 (komponenty).
4. **UX:** U2, U3, U6 (szybkie), potem U1 (najwyższa wartość w terenie), U4, U5, U7.
5. **Duże zmiany:** D5 (model wpisu jako osobne klucze) i podział `JournalEntrySheet` — dopiero po decyzji.

## Decyzje potrzebne od Ciebie

1. **U1 (próba przed zakryciem):** czy przypomnienie ma być widoczne na „Dziś" (głośno), czy tylko w karcie budowy (cicho)?
2. **D5 (edycja z dwóch telefonów):** czy zmiana modelu wpisu jest warta ryzyka (nakład L, ryzyko migracji), czy zostajemy przy obecnym modelu i pilnujemy konfliktów?
3. **U7 (WhatsApp do hurtowni):** czy numer hurtowni może być zapisywany w karcie budowy (trafia do sync i kopii)?
4. **D3 (kopia, budżet 40 MB):** czy podnieść budżet, czy ostrzegać przed utworzeniem kopii, która pominie pliki?

Nic z tego nie zostało jeszcze zmienione w kodzie.

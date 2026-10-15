# Opis techniczny Notatnika

Dokumentacja aktualnego stanu funkcji — co robią, gdzie są w kodzie i jak działają.
Plik opisuje stan bieżący, nie historię: przy zmianie funkcji poprawiaj jej opis.
Zasady prowadzenia: `CLAUDE.md`, sekcja „Dokumentacja techniczna”.

Działy opisane do tej pory: **Nauka** (nagłówek i tablica) i **Nauka → Dziennik budowy**. Pozostałe działy (Notatki, Grafik,
Kalendarz, reszta Nauki) dopisuj, gdy zadanie ich dotyczy.

---

## Nauka — nagłówek i tablica tematów

`/nauka` (`src/components/study/StudyView.tsx`): nagłówek „Instalacje wod-kan”, pasek opanowania
i zakładki Quiz / Tablica / Lista / Dziennik.

### Pasek opanowania

**Co robi.** Pokazuje, ile z 18 tematów jest w kolumnie „Umiem”, z podziałem na moduły
(Woda użytkowa, Kanalizacja, Wspólne). Dotknięcie lub kliknięcie komórki podpisuje temat
i jego stan pod paskiem — na telefonie nie ma najechania kursorem.

**Gdzie jest.** `MasteryStrip` w `src/components/study/StudyView.tsx`; dane z `useStudy`,
`columnOf` (`store.ts`), `MODULES` i `TOPICS` (`content.ts`).

**Jak działa.** Odcinek modułu ma szerokość proporcjonalną do liczby tematów (`flexGrow`),
ale najmniej 4,5 rem, żeby zmieścił się podpis z licznikiem `x/n`. Komórka: pełna =
„Umiem”, połowa = „W trakcie”, pusta = „Do nauki”. Każda komórka to przycisk
(`aria-label` „Temat: stan”, `aria-pressed`) z wysokim celem dotyku przy cienkim pasku
(`-my-2 py-2`). Podpis pod paskiem ma `aria-live="polite"`. Wybór żyje tylko w stanie komponentu.
Licznik jest w JetBrains Mono (`font-mono tabular-nums`), bo w kroju nagłówków „1” wyglądała jak „l”.

**Testy.** e2e `e2e/study.spec.ts` („tablica: temat przechodzi między kolumnami…”: licznik
modułu i podpis po kliknięciu komórki), `e2e/resilience.spec.ts` (`mastery-count`).

### Karty tematów na tablicy

**Co robi.** Temat wędruje „Do nauki” → „W trakcie” → „Umiem” strzałkami przy tytule.
Pod opisem są przyciski z podpisami: „Wpis” (arkusz wpisu z tym tematem), „Ćwicz”
(runda quizu z tematu), „Do notatki” (notatka z listą kontrolną tematu).

**Gdzie jest.** `TopicCard` i `StudyBoard` w `src/components/study/StudyBoard.tsx`;
`moveTopic`, `practiceByTopic` (`store.ts`), `topicToNote` (`toNote.ts`).

**Jak działa.** Etykiety dostępności mają postać „Temat: wpis z budowy”, „Temat: ćwicz pytania”,
„Temat: do notatki”, „Temat: przenieś do „…””. Podpis widoczny jest zawarty w nazwie
dostępnej (WCAG 2.5.3). Na dotyku przyciski mają 44 px (`coarse:`), na komputerze 28 px.
Przesunięcie animuje `framer-motion` (`layoutId`).

**Testy.** e2e `e2e/study.spec.ts` (tablica, „Ćwicz”, „Do notatki”, wpis z karty tematu).

**Commit.** N1 — zobacz `git log` (2026-10-15).

## Nauka → Dziennik budowy

Zakładka „Dziennik” na `/nauka` (`src/components/study/StudyJournal.tsx`). Dziennik instalatora
wod-kan: co zrobione, jakie problemy, zdjęcia, na której budowie — połączone z tematami
materiału do nauki.

### Model danych i synchronizacja

**Co robi.** Wpisy, karty budów i postęp Nauki synchronizują się między urządzeniami razem
z notatkami i trafiają do kopii zapasowej.

**Gdzie jest.**
- `src/lib/study/yStudy.ts` — `createYStudy(doc)`, typy `JournalEntry`, `StudyState`, `StudyDump`,
  czyszczenie wejścia `cleanEntry`, `cleanDump`, `dumpFromLegacy`, `stateFromDump`, `journalRefsIn`.
- `src/lib/study/data.ts` — jedyna instancja `yStudy` na `yjsStore.doc`, `studyDevice()`,
  migracja ze starego zapisu, `useStudyReady`.
- `src/lib/study/store.ts` — fasada dla widoków: `useStudy`, `getStudy`, `sanitizeStudy`
  (projekcja przefiltrowana przez materiał z `content.ts`) i akcje (`addJournalEntry`,
  `updateJournalEntry`, `removeJournalEntry`, `restoreJournalEntry`, `setProblemResolved`,
  `setSite`, `saveSiteCard`, `setSiteArchived`).
- `src/lib/study/keys.ts` — klucze localStorage.

**Jak działa.**
- Mapy Yjs w dokumencie notatek: `studyJournal` (id → wpis), `studySites` (id → karta budowy),
  `studyBoard`, `studyChecked`, `studyMissed`, `studyDays`, `studyRounds` (per urządzenie),
  `studyMeta` (m.in. `site` — bieżąca budowa arkusza), `studyMigrations`.
- Każdy wpis i każda karta to osobny klucz mapy, więc dwa telefony dopisujące wpisy offline
  scalają się bez strat.
- `yStudy.ts` nie importuje materiału (`content.ts`), bo jest w głównej paczce (odśmiecanie
  zdjęć, kopia). Przynależność do materiału sprawdza `store.ts`.
- Wpis (`JournalEntry`): `id`, `at` (ms), `kind` (`ok` | `problem` | `note`), `topic`, `text`,
  `site` (kopia nazwy budowy), `siteId?`, `checked` (punkty listy kontrolnej), `images`
  (klucze `imageStore`), `resolved?` (tylko problem).
- Migracja: dawny zapis `kaczy.study.v1` z localStorage przenoszony raz na urządzenie
  (`mergeIn` + znacznik urządzenia w `studyMigrations` w tej samej transakcji). Stary klucz
  zostaje jako kopia.
- Kopia zapasowa: sekcja `study` (`StudyDump`, z kartami budów) oraz Nauka w dawnym
  kształcie w `settings` dla starszych wersji aplikacji. Przy przywracaniu jest osobny
  przełącznik „Nauka i dziennik z budowy”; `replaceAll` zastępuje dane, nie scala.

**Ograniczenia.** Bez limitu liczby wpisów. Tekst do 2000 znaków (`JOURNAL_MAX_TEXT`),
4 zdjęcia na wpis (`JOURNAL_MAX_IMAGES`), nazwa budowy do 120 znaków.

**Testy.** `src/lib/study/yStudy.test.ts` (dwa dokumenty Yjs), `src/lib/study/study.test.ts`,
`src/lib/fullBackup.test.ts`, e2e `e2e/study.spec.ts` (migracja ze starego zapisu).

**Commity.** D1 `6045b5a` (2026-10-15).

### Arkusz wpisu (nowy wpis i edycja)

**Co robi.** Szybki wpis z telefonu: rodzaj (3 duże przyciski), budowa, kiedy, tekst
z dyktowaniem, zdjęcia z aparatu lub galerii, temat z listą kontrolną. Ten sam arkusz
poprawia zapisany wpis i go usuwa (z „Cofnij”).

**Gdzie jest.**
- `src/components/study/JournalEntrySheet.tsx` — arkusz (od dołu na telefonie, z boku na komputerze).
- `src/lib/study/entrySheet.ts` — stan otwarcia (`openJournalSheet`, `closeJournalSheet`,
  `useJournalSheet`) i formularz edycji (`openJournalEdit`, `patchJournalEditForm`,
  `getJournalEditForm`).
- `src/lib/study/draft.ts` — szkic nowego wpisu (`useJournalDraft`, `patchJournalDraft`,
  `clearJournalDraft`, `setJournalDraftTopic`).
- `src/lib/study/images.ts` — `journalImageRefs()` chroni zdjęcia przed odśmiecaniem.

**Jak działa.**
- Szkic nowego wpisu żyje w localStorage `kaczy.study.draft.v1`. Przeżywa zmianę zakładki,
  „Wpis z budowy” z karty tematu (zmienia tylko temat) i odświeżenie strony.
- Edycja ma osobny formularz tylko w pamięci, więc poprawka starego wpisu nie rusza
  szkicu. Zamknięcie arkusza bez zapisu porzuca edycję.
- Zdjęcia: `prepareImage` → `imageStore`, w trakcie obróbki kafelek z kółkiem i zablokowany
  zapis. Limit miejsc liczony z góry, więc dwa szybkie wybory nie przekroczą 4 zdjęć.
  Przy pierwszym zdjęciu aplikacja prosi o trwały zapis (`requestPersistentStorage`).
- Zdjęcia szkicu, edycji i starego zapisu (przed migracją) są w `journalImageRefs()` —
  bez tego odśmiecanie skasowałoby je po karencji.
- Pigułka „Kiedy” (`datetime-local`, „Teraz”) pozwala na wpis „za wczoraj”. Przyszłość jest
  przycinana do chwili zapisu.
- Pigułka budowy: przy pustej budowie pokazuje 3 ostatnie budowy, przy edycji pola do
  6 pasujących (`suggestSites` w `journalView.ts`, bez polskich znaków). Archiwalne budowy
  się nie podpowiadają. Kliknięcie pigułki nie zabiera fokusu z pola (`onPointerDown`
  z `preventDefault`).
- Dyktowanie (`useDictation`) dopisuje rozpoznane zdanie na końcu tekstu. Bez Web Speech
  albo bez internetu jest podpowiedź o mikrofonie klawiatury.
- Problem przy temacie z kolumny „Umiem” cofa temat do „W trakcie” (też przy edycji
  wpisu na problem lub zmianie tematu problemu).
- Wejścia: „+ Wpis” w nagłówku dziennika, „+” w dolnym pasku na `/nauka`, skrót PWA
  „Wpis z budowy” (`/nauka?wpis=1`), „Wpis z budowy” z karty tematu (temat rozwinięty).

**Ograniczenia i pułapki.** Pusty wpis (bez tekstu, punktów i zdjęć) się nie zapisuje.
W e2e otwarty arkusz ukrywa zakładki z drzewa dostępności — w testach `includeHidden: true`.

**Testy.** `src/lib/study/study.test.ts` (szkic, edycja, problemy), e2e `e2e/study.spec.ts`
(szkic ze zdjęciem po odświeżeniu, wpis „za wczoraj”, usuwanie z „Cofnij”, dyktowanie,
telefon: „+” i skrót).

**Commity.** D0 `df308d5`, D2 `92c1015`, D3 `1c40b26`, pigułki budów D4a `b41e3c9` (2026-10-15).

### Problemy otwarte i rozwiązane

**Co robi.** Problem zostaje otwarty, dopóki nie oznaczysz go jako rozwiązanego. Licznik
„Otwarte problemy: N” w nagłówku dziennika filtruje do nich.

**Gdzie jest.** Pole `resolved` w `JournalEntry`; `setProblemResolved`, `openProblems`
w `store.ts`; `yStudy.setResolved`; przyciski „Oznacz jako rozwiązany” / „Otwórz ponownie”
w `StudyJournal.tsx`.

**Jak działa.** `resolved` to moment rozwiązania (ms). Brak pola oznacza problem otwarty.
`cleanEntry` trzyma `resolved` tylko przy rodzaju `problem`. Filtr rodzaju `open` w `filterJournal`.

**Testy.** `study.test.ts`, `yStudy.test.ts` (rozwiązanie przechodzi na drugi telefon), e2e.

**Commit.** D3 `1c40b26`.

### Oś czasu i filtry

**Co robi.** Wpisy pogrupowane dzień → budowa, z przyklejonym nagłówkiem dnia. Szukanie
bez polskich znaków, filtry rodzaju, budowy i tematu. Bez filtra widać ostatnie 30 dni,
reszta jest za „Pokaż starsze”.

**Gdzie jest.** `src/lib/study/journalView.ts` — czyste funkcje: `filterJournal`,
`groupJournal`, `splitRecent`, `suggestSites`, `isFiltered`, `NO_FILTER`, etykiety
(`dayLabel`, `whenLabel`, `entriesPl`, `problemsPl`). Widok w `StudyJournal.tsx`.

**Jak działa.**
- `JournalFilter.site` to id budowy (`entrySiteId`), a `""` oznacza wpisy bez budowy.
- Szukanie: każde słowo musi wystąpić w tekście, budowie, nazwie tematu albo rodzaju
  (`fold` z `sites.ts` usuwa ogonki i wielkość liter).
- Każdy filtr szuka w całym dzienniku. Bez filtra działa okno `RECENT_DAYS` = 30 dni od północy.
- Budowy w filtrze to pigułki od ostatnio używanej. Archiwalne są schowane za pigułką
  „Archiwum (n)”, chyba że są wybrane.
- Nagłówek budowy w grupie (`[data-journal-site]`) jest przyciskiem do karty budowy.

**Testy.** `study.test.ts` („dziennik — oś czasu i filtry”), e2e „oś czasu dzień → budowa…”.

**Commity.** D5 `cb35c04`, pigułki budów D4a `b41e3c9`.

### Karty budów

**Co robi.** Każda budowa ma kartę: nazwę, adres, inwestora i archiwum. Karta pokazuje liczbę
wpisów, otwarte problemy i okres od–do. Z karty można przejść do „Pokaż wpisy”, „Raport”
i „Do archiwum” / „Przywróć z archiwum”.

**Gdzie jest.**
- `src/lib/study/sites.ts` — `SiteCard`, `SiteInfo`, `siteKey`, `entrySiteId`, `cleanSite`,
  `siteDirectory`, `findSiteByName`, `resolveSite`, `fold`, `foldName`.
- `src/components/study/SiteCardDialog.tsx` — okno karty.
- `store.ts` — `saveSiteCard`, `setSiteArchived`. Rozwiązywanie nazwy na budowę
  w `addJournalEntry` i `updateJournalEntry`.
- `yStudy.ts` — mapa `studySites`, `saveSite`, `addEntry`/`updateEntry` z opcjonalną nową kartą.

**Jak działa.**
- Wpis trzyma `siteId` i kopię nazwy w `site`. Starsza wersja aplikacji i tekst raportu widzą nazwę.
- Migracja bez przepisywania dokumentu: wpis sprzed kart (sama nazwa) dostaje budowę
  `siteKey(nazwa)` — deterministyczny skrót FNV-1a z nazwy bez ogonków, wielkości liter
  i podwójnych spacji (`n-xxxxxxxx`). Dzieje się to przy odczycie, więc każde urządzenie
  liczy to samo id i nie powstają dwie karty jednej budowy.
- `siteDirectory` łączy karty z dokumentu z budowami znanymi tylko z nazw we wpisach
  (`stored: false`) i sortuje od ostatnio używanej. Karta trafia do dokumentu dopiero przy
  zapisie: przy pierwszym wpisie z nową nazwą albo przy edycji karty.
- Projekcja `sanitizeStudy` ustawia każdemu wpisowi z budową `siteId` i aktualną nazwę
  z karty, więc po zmianie nazwy stare wpisy pokazują nową.
- `resolveSite`: nazwa z arkusza → istniejąca budowa (porównanie `foldName`, czynna przed
  archiwalną) albo nowa karta. Jeśli id `siteKey(nazwa)` zajmuje karta o zmienionej nazwie,
  nowa karta dostaje losowe id `s-…`.
- Zmiana nazwy przenosi bieżącą budowę arkusza (`studyMeta.site`), jeśli to była ta —
  inaczej następny wpis założyłby starą budowę od nowa.
- Nazwa jest wymagana i unikalna (bez ogonków i wielkości liter): „Jest już budowa „…””.
- Archiwum (`archived` = moment) chowa budowę z pigułek arkusza i filtra. Wpisy zostają na osi czasu.

**Ograniczenia.** Nazwa do 120 znaków (`SITE_NAME_MAX`), adres i inwestor do 200
(`SITE_FIELD_MAX`). Starsza wersja aplikacji przy edycji wpisu gubi `siteId`. Budowa wraca
wtedy z nazwy, chyba że w międzyczasie zmieniono nazwę karty.

**Testy.** `study.test.ts` („budowy — karty”), `yStudy.test.ts` („karty budów w Yjs”),
`report.test.ts`, e2e „karta budowy — nazwa, adres, inwestor, raport z karty i archiwum”.

**Commit.** D4b `e3096c4` (2026-10-15).

### Raport z budowy

**Co robi.** Raport dnia albo okresu dla jednej budowy lub wszystkich, z godzinami pracy
z Grafiku. Można go udostępnić (tekst i zdjęcia), skopiować, dodać jako notatkę
z etykietą `budowa` albo wydrukować / zapisać jako PDF.

**Gdzie jest.**
- `src/lib/study/report.ts` — `buildJournalReport`, `reportBody`, `reportText`, `reportSummary`,
  `workOn`, `periodLabel`, `dayKeyOf`, `shiftKey`.
- `src/lib/study/toNote.ts` — `reportToNote`.
- `src/components/study/JournalReport.tsx` — `JournalReportDialog`, podgląd `ReportPaper`, wydruk `ReportPrint`.

**Jak działa.**
- `ReportOptions.siteId`: `null` = wszystkie budowy, `""` = bez budowy. `siteCard` daje
  nazwę, adres i inwestora do nagłówka i początku tekstu („Adres: …”, „Inwestor: …”).
- Godziny: `workOn` bierze zmianę z Grafiku w dniu z wpisem (z odchyleniem). Nieobecność
  pojawia się jako „Grafik: Urlop” z 0 h. Dni bez wpisów się nie liczą.
- Przy otwarciu: budowa z filtra, z karty albo ostatnio używana, a okres to dzień jej
  ostatniego wpisu. Okresy: Dziś / Wczoraj / 7 dni / Ten miesiąc / Wybierz.
- Udostępnianie: zdjęcia (do 10) wczytane z góry do `navigator.share` — po kliknięciu
  przeglądarka daje mało czasu. Bez share albo przy błędzie raport idzie do schowka.
- „Do notatki”: te same klucze zdjęć, bez kopiowania bajtów.
- Wydruk: kontener `#report-print` i klasa `html.printing-report` (style w `index.css`).
  Podgląd w oknie ma ten sam układ co wydruk.

**Testy.** `src/lib/study/report.test.ts`, e2e „raport budowy z godzinami z Grafiku…” i „karta budowy…”.

**Commity.** D6 `d73d951`, adres i inwestor w raporcie D4b `e3096c4` (2026-10-15).

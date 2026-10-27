# Plan: ulepszenie, rozbudowa i upiększenie działów Praca, Kalendarz i Grafik (2026-10-27)

> **Status wykonania (2026-10-27):**
> - **Zrobione:** K0.1 (`5b4d8d6`), K0.2, K0.3, K0.4 — część: data końca się czyści (`5ecf8c2`), pole „Do kiedy” w dialogu kalendarza (zrobione 2026-10-27, bez commita — patrz `opis.md`), G0.1–G0.6 i A.1 (`827a1cd`). Testy: vitest 265/265 w dotkniętych obszarach, typecheck i lint czyste.
> - **Odłożone:** P0.1 (rysunek zastępuje zdjęcie — zmiana modelu Yjs, 8 plików, wymaga osobnej sesji z testami scalania); P0.2 (świadomie nie zrobione: `shareOrCopy` na telefonie otwiera arkusz udostępniania zamiast kopiować — decyzja produktowa, do potwierdzenia).
> - **Korekta:** K0.1 — projekcja zeruje `content` notatki prywatnej (`yjsStore.ts:355`), więc wyciek nie zachodzi dziś; zabezpieczenie w eksporterze jest dodatkiem w głębi.
> - **Fala B, częściowo (2026-10-27):** zrobione K5.1 (siatka, 35 → 2 renderów przy zmianie zaznaczenia), G3.1 (nadgodziny raz na dane) i domyślne zmiany Grafiku 8 h i 10 h (patrz `opis.md`). K5.2 (podział `ReminderCalendarView` na `CalendarHeader`, `useCalendarMoves` i `calendarExport`) zrobione bez zmiany zachowania. G3.2 (podział widoku, bez hooka `useShiftActions`), P6.1 (dyktowanie i zdjęcia wyciągnięte; pola próby i kształtek były już w komponentach), P6.4 (`content-visibility` na dniach; miniatury protokołu odłożone do sprawdzenia wydruku) zrobione częściowo. Nie robione: P6.2, P6.3 (poza zakresem tej części).
> - **Kalendarz K1 (2026-10-27):** zrobione K1.1, K1.2, K1.3, K1.4, K1.6. Nie robione: K1.5 (adres `?dzien=`, dotyka routingu i Dziś). Reszta planu do zrobienia: K2–K4, G2–G4, P2–P5.
- **Kalendarz K2 (2026-10-27):** zrobione K2.1 (z panelu dnia), K2.2, K2.3, K2.4, K2.5 (część: T, N, P, C w siatce), K2.6. Nie robione: K2.7 (oś godzin, M), K2.1 w dialogu, K1.5 (adres dnia, potrzebny do „Wstecz”).
- **Kalendarz K1 i K2 — domknięte (2026-10-27):** K1.5 (adres `?dzien=`, paleta „Terminy na dziś/jutro”; push nie ma dnia do linkowania, opisane w `opis.md`), K2.7 i K2.1 w dialogu zrobione.
- **Kalendarz K3 (2026-10-27), częściowo:** zrobione K3.1 (znaczniki Pracy i tytuły w pasku, „Praca” w kartach), K3.2 (agenda na komputerze; wspólna lista z wydrukiem nie), K3.3 (warstwy z licznikami) i K3.4 (ostrzeżenie „w czasie zmiany”). Nie robione: K3.5 (podgląd po najechaniu bez nowej zależności, szukanie w miesiącu), K3.6 (tydzień z osią, po QA wg K-4), cała K4.
- **Nie robione jeszcze:** Kalendarz K3.5–K3.6, K4, reszta Grafiku (G2–G4), cała Praca (P2–P5).

## Kontekst

Użytkownik poprosił o jeden plan dla trzech działów: Praca, Kalendarz i Grafik. Plan ma użyć najlepszych technologii, agentów i technik, a potem trafić do repozytorium. Plany z 25.10 (`docs/plan-kalendarz-2026-10-25.md`, `plan-grafik-…`, `plan-praca-…`) sprawdziłem w kodzie na HEAD `73a913f`. Wyniki:

| Dział | Stan planu z 25.10 | Co wyszło przy sprawdzeniu |
|---|---|---|
| **Kalendarz** | 2 z 26 punktów zrobione (1.5, 1.7), 7 częściowo, 17 otwartych | **Wyciek treści prywatnej notatki w `.ics`** (`icsExport.ts:110` wpisuje `DESCRIPTION` z `note.content` także przy `locked`). Dialog pokazuje inną godzinę, niż zapisuje. Brak `memo` w `DayCell`. |
| **Grafik** | Etapy 1–5 zrobione (commity 9c34c15…bff2fdb), Etap 6 (QA) otwarty | 6 drobnych błędów w zrobionych punktach (nakładka, obraz PNG, znaczniki, północ). `monthSummary` liczy ponad 100 miesięcy przy każdym ruchu pędzla. `ShiftsView.tsx` ma 749 linii. |
| **Praca** | 7 z 26 zrobione (P-1, P-3, P-4, P-5, 3.1, 5.5, historia egzaminu), 5 częściowo | Rysunek na zdjęciu zastępuje oryginał (`JournalEntrySheet.tsx:343-354`). Powtórki (SM-2) mają błąd: łatwość tylko spada. Pliki urosły: `JournalEntrySheet` 946, `yStudy` 832, `store` 624, `SiteCardDialog` 561. |

Do tego dokumentacja nie nadąża za kodem: `opis.md` (Kalendarz :1397, Grafik :594/:638/:676/:689/:694, Praca :1025/:1097/:1098/:2519/:2696), `roadmap.md:1153` i `TODO.md`.

**Wynik:** jeden plan `docs/plan-praca-kalendarz-grafik-2026-10-27.md`, który zastępuje otwarte części trzech planów z 25.10. Ma te same zasady co reszta serii: tabela „co otwarte + dowód”, punkty z W/N, decyzje, kolejność. Numeracja ma przedrostek działu (K, G, P), a decyzje ciągną dotychczasową numerację (K-4…, G-5…, P-6…).

**Ograniczenia (wspólne):**
- **Paczka startowa:** próg pilnuje `e2e/bundle.spec.ts`. Wszystko nowe idzie do leniwych chunków działów. `lib/shifts/index.ts` (barrel) jest w paczce startowej, więc nowe moduły importować bezpośrednio.
- **Dane Yjs:** nowe pola dopisywane przez `clean*`/`migrate`, z testem scalania dwóch dokumentów i testem kopii (`yShifts.test.ts`, `yStudy.test.ts`, `fullBackup.test.ts`). Zmiana formatu idzie za bramką `canWriteSchema` (Ustawienia 2.1 już działa: `yjsSync.ts:311`).
- **7 motywów, redukcja ruchu, WCAG 2.2 AA, tryb budowy.** Kolejność w punkcie: test → kod → `opis.md` → commit.
- **E2E:** celowane specy przy punkcie. Pełny przebieg tylko na końcu fali i na prośbę (z pamięci: „bez e2e dla teatru”).

---

## Technologie, agenci i techniki

**Nowe zależności:** w zasadzie żadne, bo większość potrzeb pokrywa to, co już jest:
- `ts-fsrs` (~10 KB, leniwy chunk Pracy), tylko po decyzji P-6.
- Gesty: Pointer Events, bez `@use-gesture`.
- Podpis klienta i znaczniki na planie: istniejący `DrawingCanvas`.
- PDF: istniejący `jspdf` (dziś tylko w notatkach, `exportPdf.ts`).
- Wykresy roku: istniejący `recharts`, leniwie, kolory z tokenów (plan UI 5.3).
- Wyszukiwanie w quizie: istniejący `minisearch`.
- Tydzień z osią godzin: istniejący `@dnd-kit`.
- Długie listy: `content-visibility: auto` zamiast wirtualizacji.

**Web API i CSS:**
- View Transitions: panel dnia z komórki, przejście miesięcy (kierunek już jest: `useMonthDirection`).
- Screen Wake Lock: tryb budowy z otwartą kartą.
- Web Share Level 2: PDF protokołu przez WhatsApp.
- Web Push: lokalny serwer jest (`push/schedule.ts`), więc alarm przed zmianą.
- `requestIdleCallback`/Worker: ciężki rachunek roku, tylko jeśli pomiar pokaże > 16 ms.
- CSS: zapytania kontenerowe (komórka kalendarza), `@starting-style`, animacje sterowane przewijaniem (nagłówki dni), `color-mix`/`oklch(from …)` dla stanów.

**Testy:**
- Vitest: tabele przypadków w `lib/` (rachunek, `.ics`, FSRS).
- Playwright: `page.clock` dla czasu (zaległy chip, linia „teraz”, północ), `toHaveScreenshot` z danymi (dziś zrzuty Grafiku pokazują pusty miesiąc), `AxeBuilder` dla dialogów, arkuszy i protokołu.
- React Profiler: pomiar przed i po w K5 i G3.

**Agenci i skille (według `CLAUDE.md`):**
- `frontend-design` przed każdym punktem wyglądu, potem `refactoring-ui` i `ux-heuristics` przy przeglądzie.
- `security-reviewer`: K0.1 (`.ics`), P podpis/PDF/udostępnianie, każda nowa mapa Yjs.
- `performance-engineer`: K5, G3, każda nowa zależność.
- `architect`: tylko przed podziałem `yStudy.ts`/`store.ts` (granice modułów, P6).
- `testing-engineer`: zrzuty i axe w falach QA.
- `design:accessibility-review` przed zamknięciem działu.
- `simplify` i `code-review` na diffie przed każdym commitem.
- `technical-documentation` przy `opis.md`.
- Agentów nie puszczać równolegle na tych samych plikach (lekcja z worktree, pamięć 2026-10-10). Jeden dział na raz.

---

## Fala A: błędy i porządek (S, najpierw)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| K0.1 | **`.ics` bez treści prywatnej:** brak `DESCRIPTION` przy `locked`, test eksportu notatki prywatnej. Przegląd `security-reviewer`. | `icsExport.ts:110` | 3 | S |
| K0.2 | **Dialog terminu pokazuje to, co zapisze:** pole godziny ustawiane z `parsed.clock`, dymek „Rozpoznano: jutro, 15:00”. | `ReminderQuickAddDialog.tsx:116,220,252` | 3 | S |
| K0.3 | Tekst przy odłożonym wystąpieniu: „przesuwa to wystąpienie”, nie „całą serię”. | `ReminderQuickAddDialog.tsx:287-292` | 1 | S |
| K0.4 | Zmiana na „bez powtarzania” czyści `reminderRepeatUntil`. W dialogu Kalendarza pole „Do kiedy” jak w `ReminderPicker`. | `Index.tsx:978`, `ReminderPicker.tsx:198-216` | 2 | S |
| G0.1 | Nakładka drugiego grafiku odświeża się po jego zmianie (zależność memo od danych nakładki). | `ShiftsView.tsx:143` | 2 | S |
| G0.2 | Obraz PNG: tekst chipa przez `shiftInk(color)`, nie stałe `#111827`. | `monthImageDraw.ts:32,35,88` | 2 | S |
| G0.3 | Znacznik ↑/↓ ukryty na `sm` nie zajmuje miejsca (☾ nie znika na komputerze). | `ShiftMonthGrid.tsx:148` | 1 | S |
| G0.4 | Północ: `useDayClock` w memo „do dziś” i saldzie urlopu w oknie roku. | `ShiftsView.tsx:209`, `YearSummaryDialog.tsx:44` | 1 | S |
| G0.5 | „Razem brutto” widoczne, gdy zarobek = 0, a szacunek urlopu/L4 > 0. | `ShiftSummary.tsx:84-91` | 1 | S |
| G0.6 | Okno dnia: „(+1 dzień)” i ostrzeżenie > 16 h przy własnych godzinach. Cykl z widoku tygodnia startuje według reguły 2.3. | `DayDialog.tsx:174-181`, `ShiftsView.tsx:717` | 1 | S |
| P0.1 | **Rysunek nie niszczy zdjęcia:** oryginał zostaje w `imageStore` (`drawnFrom[id]` w wpisie), „Cofnij rysunek” przywraca. Ten sam wzór co P-1 (podpis jako dane). Test w `yStudy.test.ts`. | `JournalEntrySheet.tsx:343-354` | 3 | M |
| P0.2 | Bezpośrednie `navigator.clipboard.writeText` zamienione na `shareOrCopy`. | `JournalReport.tsx:100`, `SiteOrderPanel.tsx:30`, `SiteShortagesPanel.tsx:97`, `StudyStats.tsx:230` | 1 | S |
| A.1 | **Dokumentacja zgodna z kodem:** nieaktualne zdania w `opis.md` (lista z Kontekstu), `roadmap.md:1153`, `TODO.md` (quiz, 30 pytań, źródło). Trzy plany z 25.10 dostają linię statusu „otwarte punkty przeniesione do planu 2026-10-27”. | `opis.md`, `roadmap.md`, `TODO.md`, `docs/plan-*-2026-10-25.md` | 2 | S |

## Fala B: porządek w kodzie i wydajność (przed nowymi funkcjami, bo dotyka tych samych plików)

| # | Co | W | N |
|---|----|---|---|
| K5.1 | **Siatka bez zbędnych renderów:** `memo(DayCell)`, stabilny `cellRef` (`MonthGrid.tsx:146`), mapa `studyOf` zamiast funkcji w locie (`RCV:423`), `Map` notatek po id zamiast `notes.find` (`RCV:132,464`), jedno `expandOccurrences` dla siatki i `UpcomingDays` (`UpcomingDays.tsx:28-32`). Pomiar Profilerem przed i po. | 2 | S |
| K5.2 | Podział `ReminderCalendarView.tsx` (493): `CalendarHeader`, hook `useCalendarMoves` (przesuwanie, pomijanie), eksport `.ics`/druk. | 1 | M |
| G3.1 | **Rachunek raz na dane:** `dailyOvertimeSpans(data)` liczone raz na wersję `data` (pamięć podręczna `WeakMap` po obiekcie danych, `summary.ts:336`). Miesiące okresu i rok (`leave.ts:97`, `absenceEstimate.ts:45`, `timeOff.ts:29`) korzystają z tej samej. Test: wynik identyczny, liczba wywołań spada. | 3 | S |
| G3.2 | Podział `ShiftsView.tsx` (749): `TransferChooser`, `ShiftExportBar`, `EmptyMonth`, hook `useShiftActions` (pędzel `onDay`, `:262-297`). `summary.ts` (520): okres rozliczeniowy osobno. | 1 | M |
| P6.1 | **`JournalEntrySheet.tsx` (946):** rysunek z podpisami, dyktowanie z parserem i pola protokołu/kształtek do osobnych plików. Granica lazy bez zmian, każdy krok osobnym commitem. | 1 | M |
| P6.2 | `SiteCardDialog.tsx` (561): hook `useSiteCardActions` (ZIP, archiwum, zmniejszanie, protokół, `:94-197`), `SiteTallyBar` do pliku. | 1 | S |
| P6.3 | `yStudy.ts` (832) i `store.ts` (624): podział na dziennik, karty i naukę z jednym punktem wejścia. Najpierw agent `architect`. Test granicy (`content.ts` nie w `yStudy`). | 1 | M |
| P6.4 | Oś dziennika: `content-visibility: auto` na sekcji dnia. Protokół na miniaturach zamiast 12 pełnych zdjęć (`HandoverPaper.tsx:74`). | 2 | S |

## Kalendarz

**K1: poprawki (S)**

| # | Co | W | N |
|---|----|---|---|
| K1.1 | **Zaległy ≠ załatwiony:** chip i kropka przez `termStatus` (`lib/dueTerms.ts:28`), ton `destructive-ink` i lewa krawędź. W `aria-label` słowo „zaległe”. Kształt odróżnia od święta, którego kropka też jest czerwona (`dayCellStyles.ts:31`). | 3 | S |
| K1.2 | `.ics` cały dzień: `VALUE=DATE` z alarmem `DATE-TIME` 9:00. Test w obie strony z `icsImport.ts`. | 2 | S |
| K1.3 | `.ics` seria: `DTSTART` z `reminderBase`, odłożone wystąpienie jako `VEVENT` z `RECURRENCE-ID`, seria zakończona pominięta w `exportableReminders`. | 2 | S |
| K1.4 | „Cały dzień” 44 px na dotyku w obu oknach. W `ReminderPicker` kalendarzyk nie wyłącza przeszłych dni (dokończenie K-1, `:168`). | 1 | S |
| K1.5 | **Adres dnia** `/kalendarz?dzien=YYYY-MM-DD` (zdejmowany po odczycie). Używają go Dziś („Jutro: …”), push i paleta. | 2 | S |
| K1.6 | a11y: nazwy zawierają widoczny tekst (WCAG 2.5.3: „Dziś”, „.ics”, `RCV:308,317`). `aria-live` tylko w jednym regionie, nie na h2 i h3 (`RCV:292`, `DayPanel.tsx:84`). | 2 | S |

**K2: codzienna praca**

| # | Co | W | N |
|---|----|---|---|
| K2.1 | **„Otwórz notatkę”** z panelu dnia i dialogu (`onOpenNote` z `Index.tsx`). „Wstecz” wraca na ten dzień (K1.5). | 3 | S |
| K2.2 | Zapamiętany widok Miesiąc/Tydzień/Lista (`localStorage`, wzór `dayView`, `RCV:68`). | 2 | S |
| K2.3 | Panel dnia przewijany na ekran po stuknięciu (`scrollIntoView`, z redukcją ruchu). | 2 | S |
| K2.4 | **Szybkie dodanie:** podwójne kliknięcie dnia lub przytrzymanie na dotyku otwiera dialog na ten dzień. | 2 | S |
| K2.5 | **Skróty jak w Google Calendar:** `t` dziś, `n`/`p`, `c` nowy, `m`/`w`/`a` widok, `g` skok do daty. Wpisane do tabeli `lib/shortcuts.ts`, więc same trafiają do okna skrótów i podpowiedzi. Klik w tytuł miesiąca otwiera wybór daty (`react-day-picker`). | 2 | S |
| K2.6 | Gest przesunięcia miesiąca palcem (Pointer Events, próg i kierunek; PageUp/PageDown już są). | 1 | S |
| K2.7 | Oś godzin bez dziur: nocka przez północ na obu dniach, przerwa jako znacznik. | 2 | M |

**K3: rozbudowa**

| # | Co | W | N |
|---|----|---|---|
| K3.1 | Znaczniki Pracy w `WeekStrip` i `UpcomingDays`. `WeekStrip` z tytułami terminów, nie samą liczbą (`:111`). | 2 | S |
| K3.2 | **Agenda dokończona:** także na komputerze, ze znacznikami Pracy i zmianą. Stuknięcie dnia otwiera panel, nie przełącza na Miesiąc (`RCV:413`). Lista wspólna z `CalendarPrintList`. | 2 | M |
| K3.3 | **Filtr warstw** „Terminy · Grafik · Praca · Święta” (zapamiętany) i liczniki miesiąca w nagłówku. Klik w licznik ustawia filtr. | 2 | M |
| K3.4 | **Konflikt z Grafikiem:** znacznik „w czasie zmiany” przy terminie, który wypada w godzinach pracy (`currentAndNextShift`). Ostrzeżenie w dialogu przy zapisie. | 2 | S |
| K3.5 | Podgląd notatki po najechaniu na chip (Radix Popover/HoverCard na komputerze) i szukanie terminów w miesiącu (`searchNotes`). | 1 | S |
| K3.6 | **Tydzień z osią godzin na `xl`:** 7 kolumn, paski zmian, linia „teraz”, przeciąganie w pionie (godzina) i poziomie (dzień) z „Cofnij”. Osobny chunk. **Decyzja K-4.** | 2 | L |

**K4: wygląd (`frontend-design` najpierw)**

| # | Co | W | N |
|---|----|---|---|
| K4.1 | Stany kształtem: zaległy z krawędzią, całodniowy jako pasek, kropki koło/kwadrat/romb. Zwijana legenda. | 2 | S |
| K4.2 | Tokeny `--chip-*` z testem 3:1 w `contrastTokens.test.ts` zamiast `bg-primary/12` i `border-primary/40` (`ReminderChip.tsx:47,50`). | 2 | S |
| K4.3 | Komórka na telefonie: numer w kółku, kolor zmiany jako dolny pasek 3 px, 44 px na 320 px. Zapytanie kontenerowe zamiast punktów przerwania. `rounded-card` zamiast `rounded-xl` (`dayCellStyles.ts:14`). | 2 | M |
| K4.4 | Linia „teraz” na osi dnia i tygodnia (JetBrains Mono, co minutę, przewinięcie przy otwarciu). | 1 | S |
| K4.5 | View Transition: panel dnia wychodzi z komórki (`view-transition-name`), przy redukcji ruchu przenikanie. | 1 | S |
| K4.6 | Nagłówek: rok przyciemniony w bieżącym roku, „Dziś” jako pigułka akcentu tylko poza bieżącym miesiącem (`RCV:305`). | 1 | S |

## Grafik

**G2: dokończenie planu z 25.10**

| # | Co | W | N |
|---|----|---|---|
| G2.1 | `useShiftNow` w `TodayShiftCard` i widżecie (dziś tylko `NowCard`). | 2 | S |
| G2.2 | Pusty miesiąc z „Przedłuż cykl”, pusty stan w widoku tygodnia (`ShiftsView.tsx:556-569`). | 2 | S |
| G2.3 | Tygodnie bez 35 h jako przyciski jak krótkie odpoczynki (`ShiftSummary.tsx:164-167`). | 1 | S |
| G2.4 | Tydzień ISO widoczny w tytule miesiąca i tygodnia (`ShiftsView.tsx:503`, `ShiftWeekView.tsx:105`). W tabeli roku przyklejona kolumna miesiąca, wiersz otwiera miesiąc (`YearSummaryDialog.tsx:69,96`). | 1 | S |
| G2.5 | 390 px: Cofnij/Ponów w wierszu nawigacji zamiast osobnego rzędu (`:515-524`). Wybór motywu obrazu `coarse:h-11` (`:620`). Pędzel z „Własnymi godzinami” i przyklejony pasek pędzla (`roadmap.md:898`). | 2 | S |
| G2.6 | Paleta kolorów: bursztyn marki i czerwień świąt poza wyborem dla nowych rodzajów (`model.ts:196`). Istniejące kolory bez zmian. | 1 | S |

**G4: rozbudowa**

| # | Co | W | N |
|---|----|---|---|
| G4.1 | **Alarm przed zmianą:** push N min przed początkiem (domyślnie 60, ustawienie per grafik), z akcją „Skończyłem” po końcu. Lokalny serwer push (`push/schedule.ts:138-170`). **Decyzja G-6.** | 3 | M |
| G4.2 | **Kreator nowego grafiku:** 3 kroki (stawka i system, rodzaje zmian, pierwszy cykl od dziś) zamiast pustej siatki po „Nowy grafik”. | 2 | M |
| G4.3 | **Rok w wykresach:** godziny i norma, nadgodziny, zarobek, godziny nocne miesiąc po miesiącu (`recharts`, leniwie, kolory z tokenów, `tabular-nums`). Mapa cieplna roku (własne SVG, dzień = komórka). Tabela zostaje jako wersja dla czytnika. | 2 | M |
| G4.4 | **Porównanie z paskiem wypłaty:** pole „wypłacono brutto” per miesiąc (nowa mapa Yjs z prefiksem `id:`), różnica od szacunku i podpowiedź, co ją zwykle tłumaczy (nocne, L4, premie). | 2 | S |
| G4.5 | **Import do Grafiku:** `.ics` (reużyty `icsImport.ts`) i CSV w formacie eksportu (`timesheet.ts`, odwrotność), z podglądem i „Cofnij”. | 1 | M |
| G4.6 | Szablon tygodnia (zapisany osobno od cykli) w palecie i w pustym miesiącu. | 1 | S |
| G4.7 | Obraz miesiąca: dwa miesiące, legenda rodzajów, znacznik „dziś” (dokończenie 4.3). | 1 | S |
| G4.8 | Kilka nakładek (zespół): wspólne wolne dni dla N grafików. **Decyzja G-7.** | 1 | M |
| G4.9 | Dodatek nocny do zarobku: **czeka na G-1** (kadry). Kod gotowy do przełączenia (`ShiftSummary.tsx:114-116`). | 1 | S |

## Praca

**P2: budowa (największa wartość)**

| # | Co | W | N |
|---|----|---|---|
| P2.1 | **„Zdjęcie” jednym stuknięciem:** pływający przycisk na osi i karcie budowy. `input capture="environment"` otwiera aparat, a zdjęcie tworzy nowy wpis z budową i bieżącym etapem. Przy 5 zdjęciach (`yStudy.ts:76`) „Ciąg dalszy w nowym wpisie”. | 3 | S |
| P2.2 | **Zdjęcia przed zakryciem:** przed odhaczeniem „Zakrycia” i w przypomnieniu licznik zdjęć z podpisem „Przed zakryciem” (`PhotoStrip.tsx:12`) i przycisk „Zrób zdjęcia”. W protokole sekcja z datami (`handover.ts:60-73`). | 3 | M |
| P2.3 | **Usterki ze statusem:** problem dostaje odpowiedzialnego, termin i zdjęcie przed/po. Lista usterek w karcie i sekcja w protokole. **Decyzja P-7.** | 3 | M |
| P2.4 | **Podpis klienta na protokole:** `DrawingCanvas` jako pole podpisu, PNG w mapie karty z datą i imieniem. Przegląd `security-reviewer` (dane osobowe w kopii i ZIP). | 2 | S |
| P2.5 | **Prawdziwy PDF** protokołu i raportu dnia (`jspdf`, leniwie): nagłówek firmy (pole w Ustawieniach Pracy), numery stron, siatka zdjęć 2×3 z datą i podpisem. „Udostępnij” wysyła plik (Web Share L2). Druk zostaje. **Decyzja P-8.** | 2 | M |
| P2.6 | **Zużycie materiału:** suma kształtek i dostarczonych braków na budowie, podział na miesiące, „Kopiuj” i CSV (`sumFittings`). Opcjonalna cena jednostkowa i suma. **Decyzja P-9.** | 2 | S |
| P2.7 | **Zaznaczanie na planie:** dokument karty → `DrawingCanvas` z `initialImage`, wynik jako nowy dokument (oryginał zostaje). Potem pinezki x/y na planie połączone z wpisami. **Decyzja P-10.** | 2 | M |
| P2.8 | **Czas na budowie:** licznik od „Wchodzę” w karcie, stawka godzinowa budowy, miesięczny CSV do rozliczenia (`DayHoursDialog.tsx:33-56`). | 2 | S |
| P2.9 | Szablony wpisu per etap: lista kontrolna i podpowiedzi zdjęć, np. „Próba ciśnienia: manometr, czas, wynik”. | 1 | S |
| P2.10 | „Jesteś przy budowie X — Wchodzę?” przy otwarciu (jednorazowe położenie, bez śledzenia w tle, włączane). **Decyzja P-11.** | 1 | S |
| P2.11 | Nagranie i dyktowanie naraz: najpierw próba na telefonie, bo Chrome na Androidzie może nie dać mikrofonu obu naraz. Jeśli się nie da, punkt odpada. | 1 | M |

**P3: dane i miejsce**

| # | Co | W | N |
|---|----|---|---|
| P3.1 | Miejsce per budowa: „Zdjęcia i nagrania: 340 MB (budowa X: 120 MB)” w karcie i Ustawieniach (rozmiary blobów z `imageStore`, leniwie). | 2 | S |
| P3.2 | Baner starszej wersji w całej aplikacji, nie tylko w Ustawieniach (`SyncSettings.tsx:150` → powłoka). | 2 | S |
| P3.3 | QA dwóch telefonów (zdjęcia, odhaczenia, kształtki, karta naraz). Wynik w `opis.md`. | 2 | S |

**P4: Nauka**

| # | Co | W | N |
|---|----|---|---|
| P4.1 | **Powtórki FSRS** (`ts-fsrs`): poprawa błędu łatwości SM-2 (`srs.ts:29-52`), dwa przyciski „Nie umiem / Umiem” zamienione na oceny FSRS. Migracja stanu (interwał → stabilność) z testem na danych z kopii. Bez decyzji: tylko poprawka SM-2 (łatwość rośnie przy dobrej odpowiedzi). **Decyzja P-6.** | 2 | M |
| P4.2 | Szukanie pytań quizu bez polskich znaków (`minisearch`). Wspólny `foldPolish` w `lib/text` wydzielony z `parseNaturalDate.ts:17`. | 1 | S |
| P4.3 | Egzamin: ostrzeżenie przy małej puli (30 pytań na 20 w egzaminie), dociąganie punktów listy kontrolnej. `role="timer"` z ogłoszeniem co 5 min (`QuizPanel.tsx`). | 1 | S |
| P4.4 | Więcej pytań wbudowanych (12 tematów ma 1 pytanie): **czeka na źródła** od właściciela. | 3 | L |
| P4.5 | Import `.md` z pytaniami („P: … / A: …”) → własne pytania. Najpierw parser z walidacją (`cleanCustom`). | 1 | M |
| P4.6 | Własne tematy: osobny projekt (P-2 bez zmian). | 2 | L |

**P5: wygląd (`frontend-design` najpierw)**

| # | Co | W | N |
|---|----|---|---|
| P5.1 | **Karta budowy jako bohater:** okładka z pierwszego zdjęcia lub planu, nazwa i adres na niej, etapy jako linia postępu z kropkami (`SiteCardDialog.tsx:232-266`). | 2 | M |
| P5.2 | **Tryb rękawic** w trybie budowy: cele 56 px, większe pigułki, Wake Lock przy otwartej karcie. | 2 | S |
| P5.3 | Oś: separator tygodnia z sumą godzin (`StudyJournal.tsx:171`), nagłówki dni wchodzą animacją przewijania. | 1 | S |
| P5.4 | Protokół: papier firmowy (nagłówek, stopka ze stroną), wspólny z P2.5. | 1 | S |

---

## QA (na koniec każdego działu)

- **Zrzuty `@visual` z danymi**, bo dziś Grafik ma tylko pusty miesiąc. Kalendarz: miesiąc, agenda, panel, oś. Grafik: miesiąc pełny, tydzień, rachunek, rok, kreator. Praca: karta, arkusz, protokół, egzamin. Wszystko × 7 motywów × telefon i komputer (agent `testing-engineer`).
- **axe** dla dialogów, arkuszy, rachunku, protokołu i egzaminu, nie tylko pustych stron (`e2e/a11y.spec.ts:16-17`).
- **Zegar:** `page.clock` dla zaległego chipa, linii „teraz”, nocki przez północ i alarmu przed zmianą.
- **Rachunek:** tabela przypadków w `summary.test.ts` (system podstawowy i równoważny, ½ etatu, okres 3 mies., noc, święto, odbiór, urlop w godzinach).
- **`.ics`:** ręczny import do Google Calendar i iOS (cały dzień, seria z odłożeniem, notatka prywatna).
- **Telefon ręcznie:** PDF przez WhatsApp, aparat jednym stuknięciem, podpis, tryb rękawic, alarm przed zmianą, dwa telefony (P3.3).
- **Audyt dotyku** (plan UI 3.11): `e2e/touch-audit.spec.ts` z `@mobile`, bez duplikatów i z nazwą dostępną, zgodnie z uwagami `code-review` z 27.10. Najpierw poprawić test, potem użyć go dla trzech działów.

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| K-4 | Tydzień z osią godzin na `xl` (K3.6)? | Tak, ale po agendzie (K3.2) i jako osobny chunk. L, więc na koniec rozbudowy. |
| G-1 | Dodatek nocny do zarobku (G4.9)? | Bez zmian: sprawdzić z kadrami. |
| G-6 | Alarm przed zmianą (G4.1): ile minut, czy per grafik? | 60 min, ustawienie per grafik, wyłączalne. |
| G-7 | Wiele nakładek (G4.8)? | Odłożyć, dopóki jedna nakładka wystarcza. |
| P-6 | FSRS (`ts-fsrs`) czy poprawione SM-2? | FSRS z dwoma przyciskami. Lepsze odstępy przy małej puli, ~10 KB w leniwym chunku. |
| P-7 | Usterki jako rozbudowany „problem” czy nowy rodzaj wpisu? | Rozbudowany problem: zachowuje oś, raport i szkic pytania. |
| P-8 | PDF z `jspdf` czy tylko druk do PDF? | `jspdf` dla protokołu i raportu dnia: plik do WhatsApp bez kroku drukowania. |
| P-9 | Ceny materiału (P2.6)? | Opcjonalna cena jednostkowa, bez faktur. |
| P-10 | Pinezki na planie (P2.7, druga część)? | Po zaznaczaniu na planie, jeśli będzie używane. |
| P-11 | Podpowiedź „Jesteś przy budowie” (P2.10)? | Tak, włączana w Ustawieniach Pracy, jednorazowe położenie przy otwarciu. |

**Poza planem:** pogoda w raporcie (zapytanie sieciowe, więc decyzja o prywatności), udostępnianie grafiku linkiem lub QR (czeka na obrazy przez przekaźnik), webcal (K-2 bez zmian).

## Kolejność wdrażania

1. **Zapis planu** (zrobione 2026-10-27): ten plik, odnośnik na końcu `roadmap.md`, linie statusu w trzech planach z 25.10.
2. **Fala A:** K0.1 → K0.2 → P0.1 → G0.1–G0.6 → K0.3–K0.4 → P0.2 → A.1.
3. **Fala B:** K5.1, G3.1 (pomiar), potem podziały K5.2, G3.2, P6.1, P6.2, P6.4. P6.3 po `architect`.
4. **Kalendarz:** K1 → K2 → K3.1–K3.5 → K4 → QA → K3.6 (po K-4).
5. **Grafik:** G2 → G4.1 (po G-6), G4.2, G4.3, G4.4 → G4.5–G4.7 → QA. G4.8 i G4.9 po decyzjach.
6. **Praca:** P2.1, P2.2, P2.3 (po P-7), P2.5 (po P-8), P2.4, P2.6, P2.8 → P3 → P4.1 (po P-6), P4.2, P4.3 → P5 → P2.7, P2.9–P2.11, P4.5 → QA.
7. Każdy punkt: test → kod → `opis.md` → `simplify` + `code-review` → commit z hashem w `opis.md`.

## Weryfikacja

- **Każdy punkt:** `npm run typecheck`, `npx vitest run <pliki lib/>`, celowany `npx playwright test <spec>`, `e2e/bundle.spec.ts` przy nowym kodzie w paczce.
- **Wygląd:** `e2e/a11y.spec.ts` i `skins.spec.ts` dla dotkniętego widoku. Zrzut przed i po przez MCP Playwright na 390 px i 1280 px w Zeszycie i Hydraulice.
- **Wydajność (Fala B):** React Profiler na siatce Kalendarza i pędzlu Grafiku, przed i po (liczba renderów i czas). `e2e/perf.spec.ts`.
- **Koniec działu:** QA z sekcji wyżej. Pełne `test:e2e` i `test:visual` tylko na prośbę użytkownika.

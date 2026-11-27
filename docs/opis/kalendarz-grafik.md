# Kalendarz i Grafik

Część opisu technicznego Notatnika (spis: [`opis.md`](../../opis.md)). Stan bieżący, nie historia — przy zmianie funkcji poprawiaj jej opis.

## Grafik — stan aktualny (zmiany, rachunek, eksporty, wiele grafików)

Dział opisany w jednym miejscu: rdzeń (dotąd nieopisany) i dodatki z 2026-10-09…20. Przegląd audytu z 2026-10-09 jest uwzględniony.

**Poprawki Fali A (plan 2026-10-27, punkty G0.1–G0.6):**
- **Nakładka odświeża się sama** (G0.1): `useScheduleData(id)` w `src/lib/shifts/store.ts` słucha dokumentu nakładki (wcześniej `scheduleDump` w `useMemo` nie reagował na zmiany w drugim grafiku). `ShiftsView.tsx` używa hooka.
- **Obraz PNG: tekst na kafelku** (G0.2): `src/lib/shifts/monthImageDraw.ts` bierze kolor tekstu z `shiftInk(c.color)` dla kafla z kolorem; `chipInk` z palety zostaje tylko dla kafla bez koloru.
- **Znacznik ↑/↓ widoczny wszędzie** (G0.3): usunięto `sm:hidden` w `ShiftMonthGrid.tsx`. Wcześniej ukryty znacznik zajmował jedno z dwóch miejsc (`MAX_MARKS`) i na komputerze wypychał ☾.
- **Północ w liczeniu „do dziś” i saldzie urlopu** (G0.4): `ShiftsView` (`toDate`) i `YearBody` w `YearSummaryDialog.tsx` mają `useDayClock()` w zależnościach memo.
- **„Razem brutto” przy zarobku 0** (G0.5): pokazuje się, gdy jest szacunek urlopu albo L4 (`ShiftSummary.tsx`).
- **Własne godziny w oknie dnia** (G0.6): `DayDialog.tsx` pokazuje „(+1 dzień)” przy końcu przed początkiem i ostrzeżenie > 16 h.
- **Testy:** brak nowych testów dla G0.1–G0.6 w tej partii. Do dopisania przy QA Grafiku.

**Telefon w poziomie (844×390):** `ShiftsView.tsx` — wariant `short:` ustawia siatkę na trzy kolumny: przełącznik grafików, przełącznik Miesiąc/Tydzień i nawigacja miesiąca w jednym rzędzie; paleta zmian w jednym przewijanym rzędzie; podpowiedzi (`#shift-brush-hint`) schowane. Elementy pełnej szerokości mają `short:col-span-full`, bo liczba kolumn się zmieniła. Test: `e2e/shifts-landscape.spec.ts` (chromium, iphone-14, pixel-7).

### Co robi

- **Siatka miesiąca** (`ShiftMonthGrid`): dni tygodnia od poniedziałku, w komórce numer dnia, skrót rodzaju zmiany w kolorze, strzałka nadgodzin (↑/↓) i ⚠ przy dniu, przed którym odpoczynek był krótszy niż 11 h (`shortRestDays` z `shortRests`, liczone w `ShiftsView`) na telefonie. Nawigacja miesiąca; widok tygodnia (`ShiftWeekView`). Siatka to `role="grid"` ze strzałkami; ←/→ i ↑/↓ przesuwają dzień (`dayKeyCommand`).
- **Rodzaje zmian** (`ShiftType`) — w oknie rodzaju koniec przed początkiem daje „(+1 dzień)”, a zmiana dłuższa niż 16 h dostaje ostrzeżenie (`LONG_SHIFT_MINUTES` w `ShiftTypeDialog.tsx`): nazwa, skrót 1–3 znaki, kolor, godziny start–koniec, przerwa (minuty, opcjonalnie „o której”), stawka (opcjonalna), alarm w eksporcie do kalendarza, rodzaj `work` lub `absence` (urlop, chorobowe, inna). Domyślne (od 2026-10-27): „Dniówka 8–16” (8 h) i „Budowa 7–17” (10 h), dodawane raz na grafik (`addPresetOnce`), plus urlopy i L4. Dawne 6–14, 14–22 i noc usunięto z `DEFAULT_SHIFT_TYPES`, a `DEFAULT_PATTERNS` jest pusty (oba patterny stały na tamtych zmianach). Zapisane u użytkowników rodzaje i dni zostają bez zmian. Testy logiki, które potrzebują dawnych zmian, używają `src/lib/shifts/testShiftTypes.ts` (`TEST_SHIFT_TYPES`, `TEST_EMPTY_SHIFT_DATA`), nie domyślnych.
- **Wpis dnia** (`DayEntry`): rodzaj, notatka, odchylenie od planu w minutach (`extraMin`: + zostałem dłużej, − wyszedłem wcześniej), praca w dzień wolny według grafiku (`offSchedule`) lub w zamian za niedzielę/święto (`inLieu`), własne godziny dnia (`customHours`).
- **Pędzel** (`BrushBar`, `BrushHours`): wybrany rodzaj nanosi się kliknięciem lub przeciągnięciem; osobny tryb godzin. Przeciąganie kafli przenosi wpis (`ShiftDnd`, `planTransfer`).
- **Cykle** (`ShiftPattern`): lista kroków (rodzaj albo dzień wolny), powtarzana od wybranej daty do końca miesiąca (`applyPattern`, `daysUntilMonthEnd`). `PatternDialog`. Domyślny początek: dziś, gdy oglądany miesiąc to bieżący; w innym — dzień po ostatnim wpisie tego miesiąca (`defaultPatternStart`). Przed zatwierdzeniem okno pokazuje, co nałożenie zastąpi lub pominie: urlopy, L4, inne nieobecności i notatki (`patternOverlapInStore`, `patternOverlap` w `pattern.ts`). Domyślnie włączone „Pomiń dni z nieobecnością i notatką” (`applyPatternToStore(..., skipProtected)`), więc cykl nie zjada ich po cichu; wyłączenie nadpisuje je jak dawniej.
- **Pusty miesiąc** (2.4): gdy oglądany miesiąc nie ma żadnego wpisu, nad siatką (`EmptyShifts.tsx`, sekcja „Pusty miesiąc”/„Pusty tydzień”) są dwie akcje: „Nałóż cykl” (otwiera okno cyklu) i „Skopiuj poprzedni miesiąc” (`copyMonth` w `store.ts` → `planMonthCopy` w `move.ts`). Kopia idzie po dniach tygodnia (pn → pn, ten sam rząd tygodnia), pomija dni bez pary w miesiącu docelowym i nie nadpisuje istniejących wpisów; „Cofnij” w dymku przywraca dni (`restoreDays`).
- **Zamiana zmian** (2.6): upuszczenie na dzień z zmianą pyta „Przenieść, skopiować czy zamienić?”; „Zamień” wymienia oba dni jednym zapisem (`planSwap` w `move.ts`, `swapDays` w `store.ts`) z jednym „Cofnij”. Na dzień pusty pytanie zostaje bez „Zamień”.
- **Paleta poleceń** (2.7): grupa „Grafik zmian” — „Dodaj zmianę dziś” (otwiera okno dnia na dziś), „Nałóż cykl zmian”, „Obraz miesiąca (PNG)”. Polecenia idą kolejką `shiftActions.ts` (`requestShiftAction`, odbiór w `ShiftsView`, jak `focusDay`). „Pokaż dzień” działa przez wyszukiwanie dni w palecie. „Skończyłem teraz” jeszcze nie jest w palecie (jego logika siedzi w `NowCard`).
- **Dodatki w rachunku** (3.7): rachunek ma osobne linie „Dodatek 100%” (noc, niedziela, święto, przekroczenie normy okresu) i „Dodatek 50%” (pozostałe nadgodziny dobowe), każda z godzinami. `monthSummary` zwraca je jako `overtimePremium100` i `overtimePremium50`; ich suma to `overtimePremium` (część `earnings`). Rozbicie liczy `MonthCore.premium100/premium50` w `summary.ts`.
- **Przepracowane do dziś i prognoza** (3.1): w rachunku bieżącego miesiąca linia „Do dziś: X h (nadgodziny Y h) · na koniec miesiąca według grafiku: Z h”. Do dziś to `monthSummaryToDate` (`summary.ts`): dni do dziś włącznie, bez premii (premie są miesięczne i wchodzą tylko do prognozy). W innych miesiącach linii nie ma.
- **Odpoczynek tygodniowy 35 h** (3.4, art. 133 KP): tydzień z co najmniej jedną zmianą, w którym najdłuższa ciągła przerwa jest krótsza niż 35 h, dostaje ostrzeżenie w rachunku („Brak 35 h odpoczynku w tygodniu”). Tydzień to siedem dni liczonych od pierwszego dnia okresu rozliczeniowego (art. 128 § 3 pkt 2 KP), nie od poniedziałku; przy okresie dłuższym niż miesiąc tygodnie przechodzą przez granicę miesięcy. Liczy `weeklyRestShort` w `summary.ts` na przedziałach `shiftSpansMs` (ten sam zbiór co odpoczynek dobowy); wolne sprzed początku tygodnia nie wchodzi do jego odpoczynku. Pole `weeklyRestShort` w `MonthSummary`. Testy: `weeklyRest.test.ts`.
- **Rodzaj „Wolne” (dzień wolny, 2026-11-27):** trzecia pozycja przełącznika w oknie rodzaju (Praca / Wolne / Nieobecność, `ShiftTypeDialog.tsx`). Wcześniej rodzaj „Wolne” dało się zapisać tylko jako pracę — liczył się do godzin i dawał fałszywe „Brak 35 h odpoczynku” i krótkie odpoczynki. Model: pole `dayOff: true` przy `kind: "work"` (`ShiftType`, `TYPE_KNOWN` w `yShifts.ts`); `isDayOff` i `isWorkType` w `model.ts`. `isWorkType` zastępuje sprawdzenie „nie nieobecność” wszędzie, gdzie chodzi o pracę z godzinami: odpoczynek dobowy i tygodniowy (`shiftSpansMs`), nadgodziny, dodatki, `occurrence`, alarmy push (`push/schedule.ts`), eksport .ics (dzień wolny pomijany), karta pracy CSV, raport dnia, oś dnia, konflikt przypomnień, etykiety zmian i widoki siatki. `monthCore` pomija dzień wolny w całości: bez godzin, bez dnia pracy, bez zmiany normy. Okno pokazuje podpowiedź, gdy rodzaj nazwany „Wolne”/„Dzień wolny” jest zapisany jako praca (`shift-looks-off`). **Dlaczego osobne pole, a nie `kind: "off"`:** starsza wersja zamienia nieznany `kind` na pracę przy zapisie i zgubiłaby informację; nieznane pole zachowuje (`mergeStored`). Starsza wersja liczy taki dzień jak dotąd — jako pracę. `cleanType` zdejmuje `dayOff` z nieobecności i `alarmMin` z dnia wolnego. Istniejący rodzaj trzeba raz przełączyć na „Wolne” w jego oknie. Testy: `weeklyRest.test.ts` („dzień wolny (dayOff)”, „dayOff w zapisie”). Commit: zob. `git log` (2026-11-27).
- **Urlop w godzinach** (3.3, art. 154² KP): przy systemie równoważnym licznik urlopu ma drugą linię „W godzinach” (wymiar = dni × 8 h, zajęcie = godziny zmiany, którą urlop zastąpił). Godziny zapisuje się w wpisie urlopu jako `plannedMin` przy przypisaniu urlopu pędzlem (`setDayShift` w `yShifts.ts`, `plannedMinutesFor`). Wpisy bez `plannedMin` (sprzed zmiany, kopiowane cyklem albo z okna dnia) liczą 8 h × etat. Liczy `leaveBalance` w `leave.ts`; wyświetla `LeaveMeter` w `YearSummaryDialog.tsx`. Testy: `leaveHours.test.ts`.
- **Szacunek urlopu i L4 w zarobku** (3.6, decyzja G-2): rachunek ma linie „Urlop (szacunek)” i „L4 80% (szacunek)”, gdy w miesiącu są takie dni. Urlop liczy się wg średniej godzinowej z trzech poprzednich miesięcy (`basePay` / godziny), L4 — 80% tej stawki (`SICK_RATE`); godziny dnia jak w 3.3 (`plannedMin`, a dla starych wpisów 8 h × etat). Liczy `absenceEstimate` w `absenceEstimate.ts`. Przełącznik „Wlicz szacunki urlopu i L4” (domyślnie włączony) dolicza je do „Razem brutto”; `earnings` w podsumowaniu zostaje bez szacunków. Testy: `absenceEstimate.test.ts`.
- **Dodatek nocny** (3.5, decyzja G-1 — domyślnie informacja): kafelek „W nocy” pokazuje dodatek 20% jako informację, nie wlicza go do zarobku, dopóki kadry nie potwierdzą (decyzja D-G1 w `docs/zlecenia-fable-2026-11-15.md`). Stawka: 20% × (minimalne wynagrodzenie miesięczne ÷ godziny wymiaru danego miesiąca), osobno dla każdego miesiąca — `nightRateFor(rok, miesiąc, własna)` i tabela `MIN_MONTHLY_WAGE` w `nightAllowance.ts` (2026: 4806 zł, 2027: 4950 zł; podstawa: § 4b rozporządzenia MPiPS z 29.05.1996 r.). Wymiar etatu nie wpływa na stawkę: przy niepełnym etacie proporcjonalnie maleje i minimalne wynagrodzenie, i liczba godzin, więc funkcja zawsze dzieli przez wymiar pełnego etatu. Rok spoza tabeli bierze najbliższy znany rok wstecz (`minimumMonthlyWage`), więc po nowym rozporządzeniu trzeba dopisać kwotę. **Norma przy nieobecności** (art. 130 § 3 KP): gdy nieobecność zastąpiła zmianę z grafiku, od normy odejmuje się godziny tej zmiany (`plannedMin`), nie 8 h (`monthCore` w `summary.ts`). Testy: `nightAllowance.test.ts`, `shifts.test.ts`.
- **Odbiór nadgodzin** (3.2, decyzja G-3 — domyślnie 1:1): w oknie dnia nieobecności jest „Odbiór nadgodzin” z przelicznikiem 1:1 (na wniosek pracownika) albo 1:1,5 (z inicjatywy pracodawcy). Zapisuje się w `DayEntry.timeOff` (1 lub 1,5). Saldo w okresie rozliczeniowym liczy `timeOffBalance` w `timeOff.ts`: nadgodziny wypracowane (`overtimeMinutes` miesięcy okresu) minus godziny odebrane ÷ przelicznik (godziny dnia: `plannedMin`, a bez tego 8 h × etat). Linia „Nadgodziny w okresie · odebrane · do odbioru” jest nad rachunkiem. Odebrane dni to nieobecności, więc nie wchodzą do dodatku za nadgodziny. Testy: `timeOff.test.ts`.
- **Kopiowanie zakresu** (4.2): przycisk „Kopiuj zakres dni” w pasku tygodnia otwiera `RangeCopyDialog.tsx` (od–do, początek kopii). `planRangeCopy` w `move.ts` przesuwa dni o różnicę początków, odstępy zostają; `copyRange` w `store.ts`; „Cofnij” w dymku. Testy: `move.test.ts`, `RangeCopyDialog.test.tsx`.
- **Nakładka drugiego grafiku** (4.1, tylko do odczytu): w `ScheduleSwitcher` wybór „Nakładka: …” (bez aktywnego grafiku). W siatce miesiąca pasek w kolorze zmiany z nakładki i nazwa w etykiecie dnia; pod przełącznikiem licznik wspólnych wolnych dni. Dane z `scheduleDump`. Testy: `ScheduleSwitcher.test.tsx`.
- **Przełącznik grafików** (4.4): test komponentu (dodawanie, przełączanie, zmiana nazwy, nakładka) w `ScheduleSwitcher.test.tsx`.
- **Motyw obrazu miesiąca** (4.3): jasny, ciemny albo aktywny styl (kolory z `body`). Wybór: lista obok „Obraz miesiąca” na komputerze, trzy pozycje w menu „Udostępnij” na telefonie. `imagePalette` i parametr `theme` w `monthImageDraw.ts`. Dwa miesiące na jednym obrazie: G4.7 (zrobione, patrz „Obraz miesiąca (PNG)”).
- **Wygląd Grafiku — Etap 5 planu** (wykonane częściowo): znaczniki w komórce (5.1) — najwyżej dwa widoczne (⚠ odpoczynek, ↑/↓ nadgodziny, ☾ noc, • poza grafikiem / w zamian, • notatka), reszta w etykiecie dla czytnika (`ShiftMonthGrid.tsx`, `MAX_MARKS`). Domyślny kolor „Dzień” to pomarańczowy `#fb923c` (5.3, `DEFAULT_SHIFT_TYPES` i `SHIFT_COLORS`; istniejące grafiki zachowują zapisane kolory). Rachunek (5.4): „Razem brutto” w nagłówku, szczegóły rachunku zwinięte w `<details>`. Numer tygodnia ISO w nagłówku widoku tygodnia (5.6). Haptyka „sukces” po „Skończyłem teraz” i nałożeniu cyklu (5.7, `lib/haptics`).
- **Wygląd Grafiku — pkt 5.2, 5.5, 5.6:** 5.2 — kolory zmian nie są zmieniane (palety nie da się ustawić na 3:1 na każdym stylu naraz); zamiast tego każdy wypełniony znacznik ma obwódkę `ring-foreground` (`ShiftMonthGrid.tsx`), a `shiftChipOutline.test.ts` sprawdza 3:1 tekstu karty względem tła na każdym stylu. 5.5 — na 390 px przełącznik grafików zwinięty do jednego wiersza „Grafik: … ▾” (rozwijany; od sm bez zmian), a przycisk „Nowy grafik” pokazuje samą ikonę poniżej 420 px. Przełącznik Miesiąc/Tydzień jest na telefonie w rzędzie nawigacji (ten sam JSX `viewToggle` w dwóch miejscach, jeden ukryty: `sm:hidden` i `hidden sm:block`). Otwarte: tytuł miesiąca na 390 px nadal się ucina („Październi…”), bo nie ma miejsca na nazwę z rokiem; skrócenie zmieniłoby tekst używany w testach. 5.6 — tabela roku przewija się poziomo (`YearSummaryDialog.tsx`); fala pieczątek po nałożeniu cyklu: `cycleWave.ts` ustawia opóźnienie `--stamp-delay` (40 ms na dzień, tylko dni z cyklu, bez przy ograniczonym ruchu), CSS w `index.css`.
- **Cofnij / Ponów:** dwa przyciski 44 px nad podpowiedzią pędzla (`ShiftsView.tsx`, stan z `useShiftUndoState`, aktywne wg stosu). Ctrl+Z cofa, Ctrl+Shift+Z ponawia (`useGlobalShortcuts.ts`, na widoku Grafiku). Stos to `Y.UndoManager` (`yShifts.ts`): nowa zmiana czyści stos ponawiania; każdy grafik ma własny stos.
- **Kopiowanie:** wpis i tydzień można przenieść lub skopiować na inny dzień (`transferDay`, `pasteDay`, `copyWeekToNext`). Cofnięcie przywraca poprzedni stan dni (`restoreDays`). Skopiowany wpis jest w schowku jako chip „Schowek: …” nad siatką (`ShiftsView.tsx`), widoczny także po „Rozumiem”; „Wyczyść” go zdejmuje. Wklejanie schowka nie kasuje (można wkleić wielokrotnie).
- **Wyszukiwanie dni** (`searchShiftDays`) i **fokus z palety poleceń** (`requestShiftDay` / `takeShiftDay`): „Pokaż dzień” otwiera właściwy miesiąc i dzień.
- **Karta „Teraz”** (`NowCard`): bieżąca lub następna zmiana (`currentAndNextShift`, horyzont 60 dni). Zegar i wyliczenie zmian to wspólny hook `useShiftNow` (`src/lib/shifts/useShiftNow.ts`, pkt 2.5), z którego ma korzystać też Dziś i widżet; `NowCard` zostaje przy samym wyglądzie i „Skończyłem teraz”.
- **Podpowiedź wieczorna** (`eveningNudge`): opcjonalne przypomnienie wieczorem (godziny 18–22 do wyboru); godzina w localStorage tego urządzenia.
- **Rachunek miesiąca** (`ShiftSummary`, `monthSummary`): zarobek = podstawa (`basePay`, suma zaokrąglonych pozycji rodzajów) + dodatek za nadgodziny (`overtimePremium`, dobowe i okresowe) + premie; rachunek bierze dodatek wprost z podsumowania, więc linie sumują się do „Razem brutto” co do grosza. Dni w pracy, przepracowane godziny, godziny nocne, norma po odjęciu nieobecności, nadgodziny (dobowe i ponad normę okresu), z tego z dodatkiem 100%, zarobek brutto, premie, krótkie odpoczynki poniżej 11 h — każdy jest przyciskiem, który otwiera jego dzień (`onOpenDay` → okno dnia). Okresy rozliczeniowe dłuższe niż miesiąc (`settlementPeriod`) pokazują podsumowanie okresu.
- **Urlop** (`leaveBalance`): wymiar roczny (`leaveDays`, domyślnie 20), wykorzystanie i saldo na dziś. Saldo przelicza się po północy (`useDayClock` w `ShiftSummary.tsx`).
- **Podsumowanie roku** (`YearSummaryDialog`, `yearSummary`): wiersze miesięcy i sumy.
- **Eksporty:** plik `.ics` do kalendarza (`buildShiftsIcs`; zmiany odwołane po stronie grafiku dostają status anulowania, wysłane dni pamiętane w `kaczy:shifts.icsExported`), karta czasu CSV (`buildTimesheetCsv`; kolumny `Od`, `Do` = faktyczny koniec z odchyleniem, `Do (plan)` = koniec z rodzaju, potem przerwa, godziny, noc, odchylenie, notatka), obraz miesiąca PNG (sekcja niżej).
- **Premie** i **wiele grafików** — opisane niżej.

### Ustawienia grafiku (`ShiftSettingsDialog`)

- **Stawka za godzinę** (zł, 0 = nie licz zarobku). Stawka rodzaju nadpisuje domyślną. Pole przyjmuje „1 000”, „1 000,50”, „1.000,50” (`parseMoney` w `money.ts`); nieczytelny tekst nie zapisuje się — pod polem komunikat „Wpisz kwotę, np. 32,50”, a stawka zostaje poprzednia. Ten sam parser dla kwoty premii.
- **System czasu pracy** (`workSystem`): `basic` — dobowy limit 8 h (art. 129 KP) albo `equivalent` — do 12 h wg grafiku (art. 135 KP).
- **Okres rozliczeniowy** (`settlementMonths` 1, 2, 3, 4, 6, 12) i miesiąc startu (`settlementStart`), np. kwartały od lutego. Nadgodziny ponad normę rozlicza się w ostatnim miesiącu okresu.
- **Etat** (`fte`, (0, 1]; norma proporcjonalna) i próg nadgodzin przy niepełnym etacie (`overtimeFrom`).
- **Niedziela i święto** (`sundayFrom`, domyślnie 6:00 następnego dnia) i **pora nocna** (`nightFrom`: 21, 22 albo 23; trwa 8 h).
- **Święta** (`polishHolidays`, wyliczenie Wielkanocy): dzień świąteczny wpływa na normę (`isNormDay`, `workNormMinutes`) i na dodatki.

### Premie w rachunku

- Premia jednorazowa w miesiącu (nazwa do 40 znaków, kwota brutto > 0 do 1 000 000 zł), do 500 na grafik.
- Dolicza się do zarobku miesiąca, osobna linia „Premia: …” w rachunku, panel „Premie w tym miesiącu” z dodawaniem i usuwaniem (z „Cofnij”). Dodatek za nadgodziny liczy się bez premii.
- Tylko kwota stała — brak premii procentowej, brak podatków i składek (kwota brutto, jak reszta zarobku).

### Obraz miesiąca (PNG)

- Przycisk „Obraz miesiąca (.png)”: pokazany miesiąc i następny, jeden pod drugim (G4.7). Każdy ma siatkę (od poniedziałku), skróty i kolory rodzajów, podsumowanie (dni w pracy, godziny, nieobecności, zarobek brutto, jeśli jest stawka). Na dole wspólna **legenda** rodzajów, tylko tych, które wystąpiły w obu miesiącach (bez powtórek). Dzisiejszy dzień ma grubszą ramkę i pogrubiony numer (tylko w miesiącu, w którym jest dziś).
- Układ: `monthImage.ts` (`monthImageLayout(data, y, m, today)` z polami `today` i `legend`, `mergeMonthLegend`). Rysowanie: `monthImageDraw.ts` (`renderMonthCanvas(layouts[], scale, theme)`, sekcje od góry, legenda zawijana w wiersze). Nazwa pliku `grafik-RRRR-MM_RRRR-MM.png`, szerokość 1800 px.
- Na telefonie otwiera systemowe okno udostępniania z plikiem; gdy go nie ma, pobiera plik. Anulowanie okna nie jest błędem.
- Obraz jest w kolorach wybranego motywu (jasny, ciemny, styl). Zawsze dwa miesiące: pokazany i następny.

### Wiele grafików

- Przełącznik na górze widoku (`ScheduleSwitcher`): wybór, „Nowy grafik”, zmiana nazwy, usunięcie z potwierdzeniem. Grafik główny istnieje zawsze i nie da się go usunąć; maksymalnie 10 grafików.
- Każdy grafik ma własne rodzaje, dni, cykle i premie. Widoki (dziś, tydzień, podsumowanie, eksporty) pokazują aktywny grafik.

### Gdzie jest

- **Model i czas:** `src/lib/shifts/model.ts` (`ShiftType`, `DayEntry`, `ShiftPattern`, `ShiftBonus`, `ShiftData`, `cleanBonus`, `migrate`, `DEFAULT_SHIFT_TYPES`, `DEFAULT_PATTERNS`), `time.ts` (minuty, noc, DST, `formatMoney`, `formatDuration`), `holidays.ts`, `color.ts` (`shiftInk` — kontrast tekstu na kolorze).
- **Nadgodziny dobowe raz na dane (G3.1).** `summary.ts`: `overtimeSpansOf(data)` trzyma wynik `dailyOvertimeSpans` w `WeakMap` po obiekcie danych. `monthSummary` wołane przez `leave`, `absenceEstimate` i `timeOff` dla każdego miesiąca roku nie liczy odcinków od nowa. Dane są traktowane jako niezmienne (zmiana = nowy obiekt). Testy: `overtimeCache.test.ts`.
- **Rachunek:** `summary.ts` (`monthSummary`, `dailyOvertimeSpans`, `premium100Minutes`, `shortRests`, `settlementPeriod`, `currentAndNextShift`), `leave.ts` (`leaveBalance`, `yearSummary`), `timesheet.ts`.
- **Dane (Yjs):** `yShifts.ts` — `createYShifts(doc, scheduleId)`, mapy `shiftTypes`, `shiftDays`, `shiftPatterns`, `shiftBonuses`, `shiftMeta`, `shiftMigrations`; origin `SHIFTS_ORIGIN`. `schedules.ts` — rejestr grafików (`createScheduleRegistry`, `isScheduleId`, `cleanScheduleName`, `SCHEDULES_MAX` = 10).
- **Store:** `store.ts` — `useShifts`, `useShiftsReady`, `setDayShift`, `setDayEntry`, `saveShiftType`, `deleteShiftType`, `savePattern`, `saveBonus`, `deleteBonus`, `setHourlyRate`, `setWorkSystem`, `setSettlementMonths`, `setFte`, `setLeaveDays`, `bindSchedule`, `createSchedule`, `renameSchedule`, `removeSchedule`, `mainShiftData`, `extraSchedulesDump`, `restoreExtraSchedule`, `restoreShifts`.
- **Ruch i wyszukiwanie:** `move.ts` (`transferredEntry`, `planTransfer`, `planPaste`, `planWeekCopy`, `dayKeyCommand`), `searchDays.ts`, `focusDay.ts`, `eveningNudge.ts`, `pattern.ts`.
- **Eksporty:** `ics.ts` (`buildShiftsIcs`, `exportableShiftDays`, `cancelledShiftDays`), `timesheet.ts`, `monthImage.ts` (układ, czysty), `monthImageDraw.ts` (canvas i udostępnianie, ładowane leniwie).
- **Testy (Etap 2, pkt 2.4):** `move.test.ts` (`planMonthCopy`: dni tygodnia, brak nadpisania). Pusty stan nie ma osobnego e2e.
- **Testy (Etap 1 planu Grafiku, Etap 2 pkt 2.1 i 2.3):** `undo.test.ts` (redo), `pattern.test.ts` (`defaultPatternStart`), `e2e/shifts.spec.ts` („Cofnij” w cyklu, w usunięciu rodzaju i w czyszczeniu dnia).
- **Testy (Etap 1 planu Grafiku):** `money.test.ts` (kwoty), `overtimePremium.test.ts` (podstawa + dodatek = zarobek), `pattern.test.ts` (ochrona urlopów i notatek przy cyklu), `timesheet.test.ts` (kolumny „Do” i „Do (plan)”).
- **Komponenty** (`src/components/shifts/`): `ShiftsView.tsx` (widok, `exportImage`, podpięcie przełącznika), `ShiftMonthGrid.tsx`, `ShiftWeekView.tsx`, `ShiftSummary.tsx` (`Receipt`, `BonusPanel`), `NowCard.tsx`, `DayDialog.tsx`, `ShiftTypeDialog.tsx`, `PatternDialog.tsx`, `ShiftSettingsDialog.tsx`, `YearSummaryDialog.tsx`, `BrushBar.tsx`, `BrushHours.tsx`, `ShiftDnd.tsx`, `TimeStepper.tsx`, `ScheduleSwitcher.tsx`, `labels.ts`, `dayLabel.ts`.
- **Kopia:** `src/lib/noteSchema.ts` (pola `shifts`, `shiftSchedules`), `src/lib/exportNotes.ts` (zapis w buildzie i przywracanie; grafik główny zastępuje, dodatkowe są dokładane).
- **Podpięcie:** `src/pages/Index.tsx` (leniwy widok), `src/hooks/useFilteredNotes.ts`, `src/lib/viewRoute.ts`, pasek boczny, `BottomNav.tsx`, paleta poleceń. Telefon w poziomie: wariant `short:` w `tailwind.config.ts`.

### Jak działa i dlaczego

- **Dane w Yjs.** Grafik jest w dokumencie notatek, więc synchronizuje się między urządzeniami i wchodzi do pełnej kopii. Każdy dzień, rodzaj, cykl i premia to osobny klucz mapy: dwa telefony wpisujące różne dni scalają się bez strat.
- **Zapis i odczyt przez `clean*` / `migrate`.** Złe rekordy od peera lub z kopii są odrzucane przy odczycie. `migrate` przyjmuje też dane sprzed `version: 2`. Projekcja w `yShifts.ts` (`get`, `nextOrder`) bierze z map rodzajów, cykli i premii tylko obiekty (`objectValues`), a `order`, który nie jest liczbą, traktuje jak 0 (`orderOf`). Dzięki temu `null` albo napis od peera nie wywraca Grafiku jeszcze przed `migrate` (przegląd bezpieczeństwa 2026-11-03, Plan-nowy 1.9; test „złe wpisy od peera” w `yShifts.test.ts`).
- **Migracja z localStorage.** Dawny zapis w `kaczy:shifts` jest przenoszony do dokumentu raz na urządzenie (znacznik `device` w dokumencie, nie w localStorage). Stary klucz zostaje jako kopia; uszkodzony zapis zostaje nietknięty i jest zgłaszany w logu.
- **Stabilne odczyty.** `useShifts` i pochodne zwracają cache; zmiany powiadamiają przez `emitStore`.
- **Wiele grafików.** Grafik główny używa dawnych nazw map (dane sprzed wprowadzenia grafików zostają na miejscu), pozostałe mają prefiks `id:`. Rejestr nazw jest w dokumencie; wybór aktywnego grafiku jest w localStorage tego urządzenia, bo to preferencja widoku. Jeśli zapamiętany grafik zniknął (usunięty na innym urządzeniu), wracamy do głównego (H1). Usunięcie czyści mapy w tej samej transakcji.
- **Funkcje zamiast aliasów.** Eksporty store są funkcjami delegującymi do aktywnego grafiku, nie zamrożonymi referencjami — inaczej przepinanie grafiku nie działałoby.
- **Zarobek.** Dodatki (nocne, niedziela, święto, ponad normę okresu) liczone w `summary.ts`; stawka okresowa dla dodatku to średnia z zarobku okresu i jego godzin (M6). Premie dolicza się na końcu, więc nie zmieniają dodatków.
- **Eksport `.ics`.** Pamięta wysłane dni, żeby zmiany odwołane po stronie grafiku dostały anulowanie, a nie zostały w kalendarzu.

### Ograniczenia i pułapki

- Eksport `.ics`, karta czasu i obraz dotyczą aktywnego grafiku, tak jak widok.
- Aktywny grafik nie jest synchronizowany między urządzeniami (każde ma swój wybór).
- Kopia: przywrócenie grafiku głównego zastępuje go w całości; dodatkowe grafiki są tylko dokładane. Premie z kopii bez pola `bonuses` nie kasują premii na telefonie (M8).
- Brak testu komponentu przełącznika grafików i brak testu przepinania przez store (pokryte przez e2e, do uruchomienia później).
- Obraz miesiąca: rysowanie na canvasie nie ma testu jednostkowego (jsdom nie ma canvasa); sprawdzić na telefonie. Udostępnianie: `canvasToPng` jest synchroniczne, więc `navigator.share` jest wołane w tym samym kliknięciu.
- Telefon w poziomie: zrzut `fullPage` w Playwright powiększa okno i wyłącza wariant `short:` — sprawdzaj zwykłym zrzutem 844×390.
- Czytelność: strzałka nadgodzin i podpis pieczątki mają 11 px / 10 px (`text-2xs` jest najmniejszym tokenem; poniżej 11 px nieczytelne w słońcu).

### Testy

- `src/lib/shifts/shifts.test.ts`, `yShifts.test.ts` (mapy, migracje), `timesheet.test.ts`, `leave.test.ts`, `move.test.ts`, `searchDays.test.ts`, `eveningNudge.test.ts`.
- `src/lib/shifts/bonus.test.ts` (6): czyszczenie, wpływ na zarobek co do grosza, migracja, Yjs (zapis, usunięcie, scalanie).
- `src/lib/shifts/monthImage.test.ts` (8): początek tygodnia, skróty i kolory, dzień bez wpisu, tytuł i podsumowanie, znacznik „dziś”, legenda i jej scalanie. E2e `e2e/shifts-image.spec.ts` (dwa miesiące, nazwa pliku, wymiary PNG).
- `src/lib/shifts/schedules.test.ts` (9): nazwy, nazewnictwo map, izolacja grafików, rejestr (sortowanie, główny nieusuwalny, usunięcie czyści dane, limit).
- `src/lib/shifts/reviewFixes.test.ts` (3): `isScheduleId`, zaokrąglenie premii 0,004 vs 0,005, niezależność stawki okresowej.
- `src/components/shifts/TimeStepper.test.tsx`.
- E2E: `e2e/shifts.spec.ts`, `e2e/shifts-week.spec.ts`, `e2e/shifts-landscape.spec.ts`, `e2e/touch-targets.spec.ts`, `e2e/mobile-layout.spec.ts`. Z ostatnich zmian e2e nie uruchomiono.

### Lint i budżet

- `eslint.config.js`: `yShifts.ts` i jego testy, `schedules.ts` i test rejestru są na liście dozwolonych importów `yjs`.
- Próg `eagerJsGzip` (393 KB). Ostatni pomiar po przeglądzie: 392,3 KB — niewiele zapasu, moduły grafiku są leniwe.

### Commity

- `6442da5` (2026-10-15) — czytelność drobnych znaczników.
- `c8b9817` (2026-10-16) — przegląd po audycie z 2026-10-09 (część).
- `370d656` (2026-10-20) — przegląd po audycie, dotyk pędzla 44 px.
- `fcf76c1` (2026-10-20) — obraz miesiąca.
- `520e47a` (2026-10-20) — premie w rachunku.
- `cccd483` (2026-10-20) — wiele grafików.
- `b779947` (2026-10-20) — poprawki z przeglądu (H1, M4–M6, M8, L12, L13, L14, L15).
- `1380f10` (2026-10-20) — udostępnianie obrazu bez `await` (L14).

## Kalendarz — stan aktualny (siatka, dzień, oś godzin, skróty, wydruk, eksport)

Dział opisany w jednym miejscu. Kalendarz pokazuje terminy przypomnień (`reminderSpec`), znaczniki dnia z Pracy i zmiany z Grafiku.

### Co robi

- **Siatka miesiąca** (`MonthGrid`, `DayCell`): dzień z terminami; dzień z wizytą serwisową albo dostawą ma ikonę kasku z liczbą (np. „2”), a dla czytnika „Praca: 2 wizyty, 1 dostawa”. Tylko odczyt. Przycisk „Dziś” wraca do bieżącego dnia (także gdy wybrany dzień to nie dziś, „Dziś” jest widoczne w miesiącu).
- **Panel dnia** (`DayPanel`): przełącznik „Lista | Oś godzin” (lista domyślna, wybór zapamiętany w `kaczy.calendar.dayView`). Panel pokazuje zmianę z Grafiku, linię Pracy (wizyty i dostawy), terminy i przycisk pominięcia wystąpienia serii.
- **Oś godzin** (`DayTimeline`): wiersze po godzinach od 07:00; pasek zmiany z Grafiku w lewej kolumnie (przerwa jaśniejsza), każdy termin w swojej godzinie z dokładnym czasem. Terminy „cały dzień” nad osią.
- **Dialog terminu** (`ReminderQuickAddDialog`): tytuł, dzień, godzina, powtarzanie, „Do kiedy” przy serii (pusty = bez końca, dzień włącznie, jak w pickerze), „Cały dzień” (termin na 9:00, godziny nie widać). W edycji pole „Dzień” przenosi termin (także serię). Etykieta podaje godzinę i powtarzanie.
- **Skróty:** Ctrl+Enter (⌘+Enter na Macu) z dowolnego pola okna tworzy notatkę z terminem, a w edycji zapisuje termin. Zwykły Enter w polu tekstu działa jak dotąd. Przycisk ma `aria-keyshortcuts`.
- **Prognoza serii:** pusty krąg; zapisany termin — pełna kropka. Klik w termin otwiera edycję; Shift+←/→ przesuwa o dzień.
- **Wydruk** („Drukuj” w nagłówku): lista terminów bieżącego miesiąca dzień po dniu, z oznaczeniem prognozy serii tekstem. Wydruk nie zawiera Pracy.
- **Telefon:** przełącznik „Miesiąc / Tydzień”; tydzień pokazuje pasek 7 dni (`WeekStrip`). Wybór nie jest zapamiętywany między wejściami.
- **Eksport `.ics`** z listy: `UNTIL` ma ten sam typ co `DTSTART` (lokalny, bez „Z”), zgodnie z RFC 5545.

### Gdzie jest

- `src/components/calendar/ReminderCalendarView.tsx` — widok: `handleSkip` (komunikat końca serii), `previousOf` (cofnięcie z odłożeniem i `allDay`), `moveToDay` (odmowa przy nieistniejącej godzinie), `focusDay`, `studyMarks`, przełącznik `phoneView`, przycisk „Drukuj”, `PrintRoot`.
- `src/components/calendar/MonthGrid.tsx` (prop `studyOf`), `src/components/calendar/DayCell.tsx` (ikona, `studySummary` w `aria-label`, `data-day-key`, kształt kropki).
- `src/components/calendar/DayPanel.tsx` — linia Pracy, przycisk pominięcia, `readDayView` / `writeDayView`, etykieta edycji.
- `src/components/calendar/DayTimeline.tsx` — oś, `TimelineItem`. `src/lib/dayTimeline.ts` — `shiftPieces`, `timelineHours`, `hourBackground`, `minutesOfDay` (czysta logika).
- `src/components/calendar/ReminderQuickAddDialog.tsx` — dialog, `allDay` w stanie, `handleShortcut` na `ResponsiveDialogContent`.
- `src/components/calendar/WeekStrip.tsx` — widok tygodnia na telefonie.
- `src/components/calendar/CalendarPrintList.tsx` — lista wydruku.
- `src/components/calendar/useStudyDayMarks.ts` — hook: czeka na `studyReady`, potem liczy znaczniki.
- `src/lib/study/calendarMarks.ts` — `studyDayMarks`, `StudyDayMarks`, `studySummary`. Wizyta to otwarte zgłoszenie z terminem `due`; dostawa to pozycja „zamówione” z `due`. Budowy w archiwum są pomijane.
- `src/lib/reminderOccurrences.ts`, `src/lib/reminderTime.ts`, `src/lib/icsExport.ts` (`eventLines`, `UNTIL` przez `formatLocal`), `src/lib/dueTerms.ts` (`endOfDay` nakładka na `reminderRepeat.ts`).
- `src/pages/Index.tsx` — kalendarz dostaje `reminderNotes` (stała tablica), `onCreateNote` i `onSetReminder` z `reminderAllDay`.

### Jak działa i dlaczego

- **Znaczniki Pracy są w osobnym module**, który ładuje się leniwie: `useStudyDayMarks` wciąga store Pracy do paczki kalendarza, a nie do startowej. Do gotowości dokumentu kalendarz pokazuje brak znaczników i przelicza się po wczytaniu.
- **Zakres osi** to co najmniej 7–21 i rozszerza się, gdy zmiana albo termin wychodzi poza przedział (w granicach doby). Pasek zmiany to gradient CSS w każdym wierszu, więc wiersz może rosnąć od wielu terminów bez przesunięć paska.
- **Oś ma sens tylko dla zmiany** (ma godziny). Przypomnienie zostaje punktem, a nie blokiem. Lista zostaje domyślna, bo tam są eksport `.ics` i opisy prognoz. Przerwa i pasek korzystają z `shiftSpan` / `breakOffset` z `lib/shifts/time.ts`, więc są spójne z eksportem i sumą godzin. Urlop nie ma paska.
- **Zmiana czasu:** godzina z przeskoku wiosennego (np. 02:30) jest odrzucana (`composeReminderTimestamp` zwraca `null`), pokazany jest komunikat; przeniesienie na taki dzień nie przesuwa po cichu.
- **Seria zapisana dawno temu** (>400 kroków wstecz) pokazuje się w bieżącym miesiącu: `expandOccurrences` przewija do `rangeStart`.
- **Skrót nie zapisuje**, gdy godzina jest niepoprawna, a przy dodawaniu wymaga tytułu.

### Ograniczenia i pułapki

- Znaczniki Pracy są tylko w siatce miesiąca; widok tygodnia (`WeekStrip`) i „najbliższe dni” (`UpcomingDays`) ich nie pokazują.
- Zmiana przez północ rysuje się na osi tylko do 24:00. Przerwa bez godziny (`breakAt`) nie ma miejsca na osi — zmiana rysuje się jako jeden odcinek.
- Oś nie pokazuje minut na skali; dokładny czas jest w tekście terminu.
- Podpowiedzi skrótów nie są widoczne w interfejsie (tylko `aria-keyshortcuts` i zachowanie).
- Szerokość komórki na 320 px to ok. 42 px, poniżej 44 px; pełne 44 px wymaga zmiany układu.
- Wydruk na papierze: prognozy oznaczone tekstem.
- Nie zrobione: całodniowe w dialogu przy tworzeniu z kompozytora, scalenie duplikatów, historia serii (decyzja właściciela).

### Testy

- `src/lib/study/calendarMarks.test.ts` — liczenie po dniach, otwarte/zamknięte, dostawa po dacie, archiwum.
- `src/lib/dayTimeline.test.ts` — odcinki zmiany, przerwa, urlop, zakres osi, gradient, minuty.
- `src/lib/reminderOccurrences.test.ts` — „cały dzień”, „seria zapisana dawno temu”, `isNext`.
- `src/lib/reminderTime.test.ts` — zmiana czasu (Europe/Warsaw).
- `src/lib/icsExport.test.ts` — `UNTIL` tego samego typu co `DTSTART`; notatka prywatna bez tytułu i treści w pliku (K0.1).
- **Dialog terminu — godzina z języka naturalnego (K0.2, K0.3, K0.4):** `ReminderQuickAddDialog.tsx`: pole „Godzina” pokazuje godzinę, którą zapisze (`effectiveTime`); „jutro 15:00” ustawia pole na 15:00 i dymek mówi „Rozpoznano datę: … o 15:00”. Ręczna zmiana pola (`timeTouched`) ma pierwszeństwo. Przy odłożonym wystąpieniu tekst mówi, że zmiana zostaje w jednym wystąpieniu (`edit.base`). `Index.tsx` (`onSetReminder`) przy „bez powtarzania” czyści `reminderRepeatUntil`, żeby stara data końca nie wróciła przy następnej serii. Pole „Do kiedy” w dialogu kalendarza (`ReminderQuickAddDialog`, `untilText` → `until` na koniec dnia, blokada zapisu, gdy koniec wcześniej niż termin): przechodzi przez `onCreateNote` / `onAttachReminder` / `onSetReminder` (`ReminderCalendarView`) do `Index.tsx`. `onSetReminder` dostaje `until` jawnie z każdego wywołania: ruch, pominięcie, usunięcie i cofnięcie podają koniec z `before.until`, więc go nie kasują (wcześniej cofnięcie gubiło koniec serii). Test: brak automatycznego (logika w komponencie), sprawdzone `typecheck` i `vitest`.
- **Eksport `.ics` a notatka prywatna (K0.1):** `eventLines` w `src/lib/icsExport.ts` nie wpisuje `DESCRIPTION` przy `locked`, a `titleOf` daje „Przypomnienie z notatki prywatnej”. Projekcja (`yjsStore.ts`) i tak zeruje `content` takiej notatki, więc to zabezpieczenie w głębi, a nie naprawa aktywnego wycieku.
- `src/components/calendar/CalendarPrintList.test.tsx` — wydruk: godzina, „cały dzień”, prognoza, pusty miesiąc.
- E2E: `reminders-calendar` (w tym Ctrl+Enter), `reminders-agenda`, `day-timeline` (360 px bez poziomego przewijania), `calendar-phase1` (pole „Dzień”), `calendar-phase2` (Cały dzień, przełącznik na 375 px). Od zmian z 2026-10-20 nieuruchamiane.

### Paczka

- Kalendarz jest leniwy. Próg paczki startowej w `e2e/bundle.spec.ts` to 393 KB (eager); ostatni pomiar 392,4 KB.

### Commity

- `42e1c83` (2026-10-19) — znaczniki Pracy w komórkach (K2).
- `0236f73` (2026-10-19) — poprawka typu `ToggleGroup` w `DayPanel`.
- `K1` — widok dnia z osią godzin (2026-10-19; hash w commicie z tym wpisem).
- `19f2ade` (2026-10-19) — skróty w oknie terminu (K3).
- `518871f` (2026-10-20) — fazy 1 i 2 planu.
- `11ef99f` (2026-10-20) — fazy 2d, 2f, 3a, 3b.

## Kalendarz — „Drukuj” i „.ics” w akcjach główki (nowy plan 1.1, 2026-11-05)

- **Co robi:** „Drukuj” (terminy miesiąca) i „.ics” (nadchodzące terminy) stoją w akcjach główki kartki: na komputerze obok tytułu „Kalendarz”, na telefonie w rzędzie pod nim. Zastąpiły menu „⋯” z telefonu (Fala 4). Pasek miesiąca ma strzałki, „Dziś” i skróty klawiszy.
- **Gdzie:** `src/components/calendar/CalendarHeader.tsx` (`<PageActions>` z dwoma przyciskami `Button variant="ghost"`; nazwy dla czytnika jak dotąd: „Drukuj terminy tego miesiąca”, „Eksportuj nadchodzące terminy do kalendarza (.ics)”).
- **Testy:** `e2e/reminders-calendar.spec.ts` — „telefon: .ics i Drukuj w rzędzie akcji pod tytułem” (@mobile) oraz test .ics na komputerze.

## Grafik — eksporty na telefonie w menu „Udostępnij” (Fala 4, 2026-10-22)

- **Co robi:** na telefonie pod siatką zamiast trzech wrapujących się przycisków jest jeden „Udostępnij” z menu: Karta czasu (.csv), Do kalendarza (.ics), Obraz miesiąca (.png). Na szerszych ekranach bez zmian.
- **Gdzie:** `src/components/shifts/ShiftsView.tsx` (wiersz `order-9`: dwa warianty `sm:hidden` / `hidden sm:flex`; `DropdownMenu`).
- **Nie zrobione z pozycji „Mniej nad siatką”:** przełącznik „Grafik ▾” przy tytule (`ScheduleSwitcher`) zostaje bez zmian.
- **Testy:** `e2e/shifts.spec.ts` — "telefon: eksporty Grafiku …" (@mobile); pełny plik na desktopie 26/26.

## Grafik — kotwica cyklu, „Przedłuż cykl”, dodatek nocny (Fala 5, pkt 3, 2026-10-22)

- **Kotwica cyklu:** pole „Kotwica: pierwszy dzień cyklu” w oknie Cykl (domyślnie dzień startu). Faza każdego dnia to krok `steps[(dzień − kotwica) mod długość]`, więc nakładanie od dowolnej daty trzyma rytm. Zapisany cykl pamięta kotwicę (`ShiftPattern.anchor`) i ostatni nałożony dzień (`appliedUntil`).
- **Przedłuż cykl:** przy wczytanym zapisanym cyklu przycisk „Przedłuż cykl od …” nakłada go od dnia po `appliedUntil`, z fazą od kotwicy, na wybrany zakres.
- **Dodatek nocny (art. 151⁸ KP):** 20% stawki godzinowej wynikającej z minimalnego wynagrodzenia miesięcznego: kwota roku (`MIN_MONTHLY_WAGE` w `src/lib/shifts/nightAllowance.ts`) ÷ godziny wymiaru danego miesiąca, więc stawka różni się między miesiącami (`nightRateFor`). Ustawienia → "Dodatek nocny" nadpisuje ją ręcznie (`ShiftData.nightRate`, 0 = z tabeli). Kwota pokazuje się jako podpowiedź przy kafelku „W nocy”.
- **Otwarte, do decyzji:** dodatku nocnego **nie dodaję do zarobku**, bo dodatek 100% za porę nocną już jest w rachunku (`summary.ts`). Trzeba sprawdzić z kadrami, czy 20% przysługuje dodatkowo do tego dodatku, czy wchodzi w jego miejsce. Kwoty w tabeli sprawdzone 2026-11-16 (2026: Dz.U. 2025 poz. 1242; 2027: rozporządzenie z 14.09.2026).
- **Gdzie:** `src/lib/shifts/pattern.ts` (`applyPattern` z `anchorKey`, `addDaysKey`, `dayDiff`), `model.ts` (pola `anchor`, `appliedUntil`, `nightRate`), `PatternDialog.tsx`, `ShiftSettingsDialog.tsx` (`RateField` z etykietą i zapisem), `ShiftSummary.tsx`, `ShiftsView.tsx`.
- **Testy:** `src/lib/shifts/pattern.test.ts`, `nightAllowance.test.ts`, `referenceMonths.test.ts` (Z-1.T, `e337fc49`, 2026-11-26: miesiące wzorcowe policzone ręcznie — 14 zmian 12 h w lutym 2026 w systemie równoważnym = 168 h przy wymiarze 160 h → 8 h nadgodzin 100%; ten sam grafik w podstawowym = dobowe; niepełny etat 0,5 i 0,75 → wymiar 80/120 h i godziny ponadwymiarowe; okres 4 miesiące styczeń–kwiecień 2026 = 664 h, nadgodziny dopiero w kwietniu; stawka nocna dzieli przez wymiar nominalny, nie przez godziny z grafiku); `e2e/shifts.spec.ts` — "cykl: „Przedłuż cykl” …" (27/27 z całym plikiem). Jednostkowe `lib/shifts` + `components/shifts` 151/151.

## Kalendarz — agenda miesiąca na telefonie (K-3, plan 3.4, 2026-10-26)

- **Co robi:** na telefonie przełącznik widoku w Kalendarzu ma trzy tryby: „Miesiąc”, „Tydzień” i „Lista”. „Lista” zamienia siatkę na agendę miesiąca: dni z terminami albo zmianą z Grafiku, jedno pod drugim, bez pustych dni. Każdy dzień to wiersz (stuknięcie otwiera go w panelu i przełącza na „Miesiąc”). Prognozy serii są oznaczone. Pusty miesiąc pokazuje komunikat.
- **Decyzja K-3:** najpierw agenda, oś tygodnia (plan 3.3) zostaje na później, bo to L i tylko na `xl`.
- **Gdzie:** `src/components/calendar/MonthAgenda.tsx` (widok; ta sama lista co wydruk, ale z przyciskami); `src/components/calendar/ReminderCalendarView.tsx` (tryb `agenda`, przełącznik, widoczność siatki i tygodnia).
- **Nie zrobione:** agenda na komputerze (na desktopie siatka zostaje, a tryb „Lista” nie jest widoczny); oś godzin tygodnia (3.3).
- **Testy:** `src/components/calendar/MonthAgenda.test.tsx`; e2e `e2e/calendar-agenda.spec.ts` (telefon: Lista ↔ Miesiąc).

## Kalendarz — plan mobile A6 (2026-10-28)

### Co robi
- **Legenda kształtów** (K4.1): zwijana sekcja „Legenda” pod siatką. Opisuje kształty stanów: kropka = termin, kwadrat = zaległy, pusty krąg z obwódką = prognoza serii, czerwona kropka = święto, pasek = zmiana z Grafiku, kółko z numerem = dziś, ikona kasku = wizyta lub dostawa z Pracy.
- **Komórka dnia reaguje na swój rozmiar** (K4.3): kropki, chipy z tekstem, pasek zmiany i nazwa święta przełączają się zapytaniem kontenerowym `@[7.5rem]` zamiast punktów przerwania `sm:`. Przy szerokości poniżej 7,5 rem są kropki, od 7,5 rem chipy. Na desktopie w wąskim panelu bocznym komórki przechodzą na kropki, zamiast łamać tekst.
- **Przejście przy wyborze dnia** (K4.5): klik w dzień uruchamia `startViewTransition`. Zaznaczona komórka ma nazwę `day-active`, więc podświetlenie przesuwa się z poprzedniego dnia na nowy. Panel dnia ma nazwę `day-panel` i przenika się. Przy redukcji ruchu i bez API — zwykła zmiana.

### Gdzie jest
- `src/components/calendar/CalendarLegend.tsx` — komponent legendy (`data-testid="calendar-legend"`).
- `src/components/calendar/DayCell.tsx` — `@container` na komórce, klasy `@[7.5rem]:*`, `style.viewTransitionName` dla zaznaczonego dnia.
- `src/components/calendar/dayCellStyles.ts` — `holidayNameClass(inMonth, container)` i `holidayDotClass(inMonth, container)`; domyślnie `sm:` (Grafik zostaje bez zmian).
- `src/components/calendar/ReminderCalendarView.tsx` — `pickDay` (przejście + `flushSync`), legenda przed panelem dnia (`order-6`), `viewTransitionName: "day-panel"`.

### Jak działa i dlaczego
- Zapytanie kontenerowe mierzy komórkę, a nie okno. Komórka w wąskim panelu bocznym dostaje kropki tak samo jak telefon, więc nie trzeba było sprawdzać `sm:` osobno.
- `flushSync` jest potrzebny, bo React aktualizuje DOM asynchronicznie, a przejście musi zobaczyć nowy stan w tym samym kroku.
- Grafik używa tych samych komórek (`dayCellClass`), ale ma własną siatkę bez `@container`. Dlatego domyślne klasy holiday zostały bez zmian, a zapytanie włącza się tylko z flagą `container`.

### Ograniczenia i pułapki
- **K4.5 nie jest wzrostem panelu z komórki.** Dodanie nazwy na komórce i panelu daje przesunięcie podświetlenia i przenikanie, ale panel nie rośnie z klikniętego kafla. Pełny efekt wymagałby wspólnej nazwy dla kafla i całego panelu, co zmieniłoby układ.
- K4.1 „całodniowy jako pasek” nie zrobione: w modelu kalendarza nie ma wydarzeń całodniowych.
- Szerokość 7,5 rem zmienia wygląd desktopowego kalendarza między 640 a ok. 900 px: tam, gdzie wcześniej były chipy, będą kropki. Świadoma decyzja, bo wąskie chipy były nieczytelne.
- Wysokość komórki na telefonie to nadal `min-h-14` (56 px), czyli więcej niż 44 px z K4.3.

### Testy
- Vitest: `CalendarLegend.test.tsx` (zwinięta, opisy kształtów). Grupa `src/components/calendar` i `src/components/shifts`: 10 plików, 23 testy, zielone.
- `tsc --noEmit` czysto, eslint czysto.
- Przeglądarka (Pixel 7, poza repo): kalendarz bez przewijania w bok, komórki 51 px, klik zaznacza jeden dzień, brak błędów na stronie, legenda otwiera się.
- E2e nie uruchamiane (zgodnie z zasadą „e2e tylko na prośbę”).

## Grafik: szablon tygodnia i przyklejony pasek pędzli (B4 z planu mobile, G2.5 i G4.6)

- **Co robi.** Na telefonie i tablecie pasek pędzli (Cykl, Szablon, rodzaje zmian, Wolne, Szczegóły) zostaje przyklejony pod nagłówkiem, gdy przewijasz siatkę; „Własne godziny” przewijają się pod nim. Przycisk **„Szablon”** na pasku otwiera listę szablonów tygodnia: zapisz tydzień jako szablon (z widoku tygodnia), nałóż go na tydzień albo na cały miesiąc, usuń (z cofnięciem). Pusty tydzień i pusty miesiąc mają przycisk „Szablon tygodnia”.
- **Gdzie jest.**
  - `src/components/shifts/ShiftsView.tsx`: blok pędzli (`order-4`, `max-xl:sticky`), `WeekTemplateDialog` z zakresem tydzień/miesiąc, `cyclePatterns` w `PatternDialog`.
  - `src/components/shifts/BrushBar.tsx`: przycisk „Szablon” (`onTemplate`).
  - `src/components/shifts/WeekTemplateDialog.tsx`: lista szablonów z podglądem pn–nd i podsumowaniem nakładania, zapis tygodnia (tylko w widoku tygodnia).
  - `src/lib/shifts/weekTemplate.ts`: `weekTemplateSteps`, `weekTemplates`, `cyclePatterns`, `weekTemplateAnchor`, `hasWorkSteps`.
  - `src/lib/shifts/model.ts`: pole `ShiftPattern.kind?: "week"`.
- **Jak działa.** Szablon to zwykły `ShiftPattern` z `kind: "week"` i 7 krokami (indeks 0 = poniedziałek), zapisywany w tej samej mapie Yjs `shiftPatterns` co cykle. Nakładanie używa istniejącego `applyPatternToStore` z kotwicą = poniedziałek tygodnia zawierającego start zakresu, więc krok zawsze trafia na właściwy dzień tygodnia, także w środku miesiąca. Nakładanie zawsze z `skipProtected = true`: urlopy, L4 i notatki zostają. Krok `null` czyści dzień. Cofnięcie idzie przez `applyPattern` w `ShiftsView` (toast „Cofnij”).
- **Ograniczenia i pułapki.** Szablon nie zapisuje nieobecności (urlop, L4) ani dni z rodzajem, którego już nie ma. Zapis tygodnia jest tylko w widoku tygodnia; w miesiącu `weekSteps` to `null` i sekcja zapisu się nie pokazuje. Toast po nałożeniu na miesiąc mówi „cykl” (wspólna ścieżka z cyklami). Wiersze „Cykl” nie pokazują szablonów, a szablony nie pokazują cykli.
- **Testy.** Jednostkowe: `src/lib/shifts/weekTemplate.test.ts` (5 testów, zielone). E2E: `e2e/shifts-template.spec.ts` (zapis z tygodnia i nałożenie na pusty tydzień; dialog w widoku miesiąca; 390 px — pasek przyklejony po przewinięciu). Wszystkie 3 zielone.
- **Commit.** Niezacommitowane (stan 2026-10-28, drzewo na `wip/mobile-fala1`, HEAD b94287d).

## Kalendarz: chipy terminów od 6 rem w komórce (naprawa przeciągania)

- **Problem.** Przeciąganie terminu w siatce miesiąca nie działało na desktopie. Chip (`DraggableChip`) jest w kontenerze `hidden @[7.5rem]:flex`, a komórka miesiąca ma na desktopie ok. 116 px zawartości (siatka jest ograniczona szerokością), więc poniżej progu 7,5 rem (120 px) pokazywały się same kropki bez chipa i bez uchwytu. Regresja z K4.3 (A6).
- **Zmiana.** Próg obniżony z `@[7.5rem]` na `@[6rem]` w `DayCell.tsx` (chip, pasek zmiany, nazwa i kropka święta) i `dayCellStyles.ts` (`holidayNameClass`, `holidayDotClass`). Próg zmieniono razem, żeby święto i chip przełączały się w tym samym miejscu.
- **Testy.** `e2e/reminders-calendar.spec.ts` („termin da się przeciągnąć…”) ustawia viewport 1920 px, przy którym komórka mieści chip. Zestaw kalendarza i terminów (calendar-*, reminders-*) zielony.

**Decyzja (2026-10-28): próg chipów 6 rem zostaje.** Potwierdzone przez użytkownika jako domyślne; przeciąganie terminów w widoku miesiąca działa na desktopie.

## Kalendarz i Grafik: kontrast nazw świąt i zaznaczonego weekendu (2026-11-01)

- **Co.** Nazwa święta w komórce dnia ma pełny `text-destructive-ink` (wcześniej `/80`, poniżej 4,5:1 na karcie). W pasku tygodnia zaznaczony dzień ma napis dnia tygodnia w `text-foreground` — kolor marki na tle podbarwionym marką nie miał kontrastu w stylu Hydraulika.
- **Gdzie.** `src/components/calendar/dayCellStyles.ts` (`holidayNameClass`), `src/components/calendar/WeekStrip.tsx`.
- **Pułapka.** Oba błędy zależały od daty: wychodzą tylko w miesiącu ze świętem w siatce i gdy dziś jest sobota albo niedziela. `e2e/a11y.spec.ts` łapie je dopiero w taki dzień.
- **Testy.** `e2e/a11y.spec.ts` (1440 i 390 px, wszystkie style) zielone 2026-11-01.

## Kalendarz — jedna kropka na notatkę w wąskiej komórce (2026-11-05)

- **Co robi:** na telefonie (komórka dnia węższa niż 6 rem) każda notatka z terminem tego dnia ma jedną kropkę. Wcześniej każde wystąpienie miało własną, więc seria powtarzana kilka razy dziennie dawała rząd pustych kręgów, który wyglądał jak „0000 +3”.
- **Gdzie:** `src/components/calendar/dayDots.ts` (`dayDots`), użyte w `DayCell.tsx`.
- **Jak działa:** wystąpienia są grupowane po `noteId`. Kropka ma najważniejszy rodzaj z tego dnia: zaległy (czerwony kwadrat) > zapisany (pełna kropka) > prognoza serii (pusty krąg). „+N” liczy kolejne notatki, nie wystąpienia. Najwyżej 4 kropki.
- **Bez zmian:** chipy na szerokiej komórce (z godziną każdego wystąpienia) i opis komórki dla czytnika ekranu (liczba wszystkich terminów).
- **Testy:** `src/components/calendar/dayDots.test.ts`.

## Kalendarz — czytelniejsze kropki i komórki (2026-11-12)

- **Co robi:** w wąskiej komórce dnia (telefon) terminy to do 3 kropek (7 px) i pigułka `+N` z liczbą pozostałych zamiast luźnego „+3” obok kropek; na szerokiej komórce „+N więcej” to ta sama pigułka. Komórki miesiąca reagują na najechanie (ramka marki, lekki cień), „dziś” ma delikatne tło marki oprócz kółka przy numerze, a nagłówki dni tygodnia są pogrubione.
- **Gdzie:** `src/components/calendar/DayCell.tsx` (`MAX_DOTS = 3`, `MorePill`), `dayCellStyles.ts` (`dayCellClass`, `weekdayHeadClass`; wspólne z Grafikiem, więc zmiana obejmuje też jego siatkę).
- **Ograniczenia:** wygląd pigułki sprawdzony tylko testami i przeglądem kodu, bez zrzutu z prawdziwymi terminami.
- **Testy:** `src/components/calendar/*.test.*`, `dayDots.test.ts`.

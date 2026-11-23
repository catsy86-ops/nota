# Dziś i Skrzynka

Część opisu technicznego Notatnika (spis: [`opis.md`](../../opis.md)). Stan bieżący, nie historia — przy zmianie funkcji poprawiaj jej opis.

## Skrzynka — stan aktualny (szybkie przechwycenie, prywatność)

Dział opisany w jednym miejscu. Skrzynka to widok „do posortowania”: notatki bez folderu i bez etykiet.

### Co robi

- **Widok „Skrzynka”** w pasku bocznym, w palecie poleceń i w menu „Więcej” na telefonie. Licznik = liczba notatek do posortowania (na telefonie też na kafelku w „Więcej”).
- **Szybkie przechwycenie.** Na górze widoku pole: Enter zapisuje tekst od razu. Pierwsza linia staje się tytułem (do 120 znaków), reszta treścią. Dymek „Zapisano w skrzynce” ma „Cofnij”. **Frazy (2.1, 2026-11-03):** `#etykieta`, `@folder`, `!`/`!!` i data na końcu („jutro 9:00”) działają jak w pasku nowej notatki. Pod polem pojawiają się chipy, a klik albo Backspace na chipie zostawia tekst bez zmian. Dymek mówi, dokąd trafiła notatka: „Zapisano w #budowa · jutro 9:00”, a z samą datą „Zapisano w skrzynce · jutro 9:00”. Notatka z etykietą albo folderem od razu wychodzi ze Skrzynki, to zamierzone. Nowa etykieta z `#` tworzy się przy zapisie. **Wklejony link (2.4, 2026-11-03):** sam adres http(s) w polu daje tytuł „domena/ścieżka” (bez `www.`, końcowego `/` i parametrów, ścieżka zdekodowana, np. „pl.wikipedia.org/wiki/Miedź”), a adres trafia do treści. Tytułu strony nie pobieramy: nie ma serwera, a CORS i tak by na to nie pozwolił. Inne schematy (`javascript:`) i tekst z linkiem w środku idą zwykłą drogą. Ikony linku na kaflu nie ma, kafel pokazuje adres w treści. **Wklejony obraz albo upuszczony plik (2.5, 2026-11-03):** wklejenie zdjęcia do pola albo upuszczenie pliku na pole zapisuje notatkę: obrazy jako zdjęcia, PDF jako załącznik, tą samą drogą co udostępnianie (`importNoteFiles`, `warnImportedFiles` w `src/lib/inboxFiles.ts`, wspólne z `useLaunchIntents`). Tekst z pola staje się tytułem. Dymek „Zapisano w skrzynce z plikiem” ma „Cofnij”. Inne typy plików dostają komunikat „Nie przyjęto: …”. Przy przeciąganiu pole ma obrys w kolorze akcentu. Moduł plików ładuje się leniwie. Testy: `InboxCapture.test.tsx`, `e2e/inbox-triage.spec.ts` („skrzynka 2.5”). Pusty tekst nic nie robi. Pole czyści się po zapisie.
- **Do skrzynki z każdego miejsca (2.3, 2026-11-03).** `Alt+K`, polecenie palety „Do skrzynki…” albo skrót z ekranu głównego „Do skrzynki” (`/?skrzynka=1`) otwiera małe okno z tym samym polem. Widok pod spodem się nie zmienia. Enter zapisuje i zamyka okno, dymek z „Cofnij” jest ten sam co w Skrzynce. Frazy, link i pliki działają jak w polu Skrzynki. `Alt+K` działa także z pola tekstowego, ale nie nad innym otwartym oknem (okna by się piętrzyły). Na macOS skrót łapie `e.code === "KeyK"`, bo Option+K daje inny znak. Parametr to `skrzynka`, nie `inbox`: `?inbox=` ma już udostępnianie z plikami. Commit 724190b.
- **Wygląd widoku (4.1–4.4, 2026-11-03).**
  - *Pole:* ten sam kształt co zwinięty pasek „Zapisz notatkę…”: `note-shadow`, `focus-ring-gradient`, `max-w-xl` i ikona skrzynki na kafelku `bg-primary/12`. Linii kratki w Zeszycie nie dodano, bo pole leży na kartce z kratką.
  - *Pasek nad listą* (`InboxBar`): „Do posortowania”, licznik jako `stamp-tag` i przycisk „Porządkuj” (nazwa dla czytnika: „Porządkuj skrzynkę (N)”). Na telefonie pasek przykleja się pod nagłówkiem (`--app-header-h`; przy schowanym nagłówku do góry), a „Porządkuj” jest w nim. Od `md` (`useIsMobile` = fałsz) „Porządkuj” stoi w akcjach główki (nowy plan 1.1). W DOM jest jedna kopia: ukryta klasą zostawiłaby niepuste miejsce na akcje i pusty rząd na telefonie.
  - *Wiek notatki:* kafel w Skrzynce pokazuje, od kiedy notatka czeka („dziś”, „od wczoraj”, „od 3 dni”, liczone z `createdAt` w dniach kalendarzowych). Pełna data zapisu jest w podpowiedzi. Po 14 dniach (`INBOX_STALE_DAYS`) przed napisem pojawia się klepsydra w kolorze akcentu, a czytnik słyszy „Czeka długo”. Sortowanie „najstarsze najpierw” było już wcześniej.
  - *Pieczątka „Posortowane”* (`SortedStamp`): odbija się, gdy licznik zejdzie do zera w otwartej Skrzynce i na końcu porządkowania, jeśli Skrzynka naprawdę jest pusta (po „Zostaw” pieczątki nie ma). Ruch to istniejące `stamp-in` i `stamp-ring`. Przy ograniczonym ruchu globalna reguła `html[data-motion="reduced"]` zostawia samo pojawienie się.
- **Co jest w skrzynce:** aktywne notatki bez folderu, bez etykiet i nie będące podnotatkami. Przeniesienie do folderu albo nadanie etykiety usuwa notatkę ze skrzynki.
- **Prywatność.** Notatka prywatna (zablokowana) nigdy nie trafia do skrzynki: ani na liście, ani w liczniku. Wcześniej prywatna notatka bez folderu i etykiet była liczona i pokazywana jako pusta karta.

### Gdzie jest

- `src/components/InboxBar.tsx` (pasek i pieczątka w widoku), `src/components/SortedStamp.tsx`. Wiek na kaflu: `inboxAgeDays`, `inboxAgeLabel`, `INBOX_STALE_DAYS` w `src/lib/inbox.ts`; flaga `inboxAge` idzie z `Index.tsx` przez `NoteGrid` i `NoteViewActionsContext` do `NoteCard` i `NoteCardBody` (jak `reminderActions`).
- `src/lib/inbox.ts` — `isInboxNote` (reguła; warunek `!n.locked`), `captureParts` (tekst → tytuł i treść), `linkCapture` (sam adres → tytuł i treść, 2.4; test `inbox.test.ts`), `INBOX_TITLE_MAX`.
- `src/components/InboxCapture.tsx` — pole na górze widoku (`InboxCaptureExtras`: etykiety, nowe etykiety, folder, priorytet, termin; props `labels`, `folders`). Frazy: `extractCapture`/`applyCapture` z `src/lib/quickCapture.ts` na wyniku `captureParts`, chipy we wspólnym `src/components/CaptureChips.tsx`. Zapis i dymek: `captureToInbox` w `src/pages/Index.tsx`. Testy: `InboxCapture.test.tsx` (frazy, „zignoruj”), `e2e/inbox-triage.spec.ts` („skrzynka 2.1”).
- `src/components/QuickInboxDialog.tsx` — okno „Do skrzynki” (2.3), leniwie przez `src/pages/indexViews.ts`; stan `quickInboxOpen` w `Index.tsx`. Skrót: `onQuickInbox` w `src/hooks/useGlobalShortcuts.ts`, lista w `src/lib/shortcuts.ts`. Paleta: prop `onQuickInbox` w `CommandPalette.tsx`. Skrót PWA: `public/manifest.webmanifest` i `openQuickInbox` w `src/hooks/useLaunchIntents.ts`. Testy: `e2e/inbox-quick.spec.ts`, `src/lib/manifest.test.ts`.
- `src/hooks/useFilteredNotes.ts` — typ `View` z `"inbox"`, filtr w `filterNotes`.
- `src/lib/viewRoute.ts` — adres `/skrzynka`.
- `src/components/EmptyState.tsx` — nagłówek i opis pustej skrzynki.
- `src/components/sidebar/sidebarItems.ts` — pozycja „Skrzynka” z licznikiem.
- `src/components/BottomNav.tsx` — prop `inboxCount`, kafelek „Skrzynka” w arkuszu „Więcej”, `inbox` w `isMoreActive`.
- `src/components/CommandPalette.tsx` — wpis w palecie poleceń.
- `src/pages/Index.tsx` — `inboxCount` (z notatek aktywnych), handler `captureToInbox`, render `InboxCapture`, przekazanie licznika do `BottomNav`.

### Jak działa i dlaczego

- **Bez nowego pola w danych.** Skrzynka to reguła nad istniejącymi notatkami. Nie trzeba migracji; synchronizacja i kopia działają bez zmian, a sortowanie od razu opróżnia skrzynkę.
- **Sortowanie „najstarsze najpierw” (S-3, 2026-10-26).** W Skrzynce domyślne sortowanie (`updated` / `desc` z `viewPrefs`) jest zamieniane na rosnące (`inboxPrefs` w `useFilteredNotes.ts`). Ograniczenie: jawny wybór „Zmieniono / desc” w Skrzynce też dostaje rosnące, bo nie ma osobnego zapisu dla widoku. Test: `useFilteredNotes.test.ts`.
- **Zapis przez ten sam kanał co kompozytor.** Idzie przez `handleAddNoteGlow`, więc widok `inbox` nie dokłada folderu ani etykiety (`activeLabel` jest pusty poza widokiem etykiety).
- **Prywatność przez regułę.** Zablokowana notatka odpada w `isInboxNote`, więc nie pojawia się ani na liście, ani w liczniku.

### Ograniczenia i pułapki

- Notatki w koszu i archiwum nie są w skrzynce (reguła działa na notatkach aktywnych).
- Starsze notatki bez folderu i etykiet też trafiają do skrzynki. To zamierzone: to „do posortowania”.
- Pasek „Zapisz notatkę…” nie pojawia się w skrzynce. Nowe notatki z szablonami robi się w widoku Notatek.
- Kafelek w arkuszu „Więcej” nie ma testu komponentu (brak testu `BottomNav`); sprawdza go e2e przy przeglądzie telefonu.

### Testy

- `src/lib/inbox.test.ts` (9) — reguła skrzynki, podział tekstu, prywatność (zablokowana notatka poza skrzynką).
- `src/components/InboxCapture.test.tsx` — Enter, pusty tekst.
- `e2e/inbox-today.spec.ts` — zapis, licznik w pasku, „Cofnij”, pusta skrzynka.

### Commity

- `c8b9817` (2026-10-16) — szybkie przechwycenie do posortowania.
- `ba47169` (2026-10-20) — prywatność i dostęp z telefonu (`bcbe1be` — hash w `opis.md`).

## Dziś — karta zmiany, zaległe i terminy, powtórki (punkt 3 planu)

**Co robi.** Na górze widoku „Dziś” są cztery elementy, w tej kolejności:
1. Karta z datą i dzisiejszą zmianą z Grafiku (nazwa, godziny) albo informacją, że dziś nie ma zmiany. Przyciski:
   „Grafik” otwiera Grafik, „Notatka dnia” otwiera dzisiejszą notatkę dnia.
2. Sekcja „Przypomnienia”: zaległe i dzisiejsze terminy (po cztery z każdej grupy, z licznikiem reszty).
   Kliknięcie otwiera notatkę, „Wszystkie” przechodzi do widoku Przypomnień.
3. „Powtórki na dziś: N pytań” z działu Praca — tylko gdy są pytania do powtórki. „Powtórz” otwiera quiz od razu
   w trybie „Na dziś” (`/praca?powtorka=1`).
4. Przegląd tygodnia (jak dotąd).
Wszystko znika przy aktywnym wyszukiwaniu.

**Gdzie jest.**
- `src/components/review/TodayShiftCard.tsx`: `TodayShiftCard({ onOpenShifts, onDailyNote })`. Czyta
  `useShifts()` i `useShiftsReady()` z `lib/shifts`, dzień liczy przez `localDayKey()`.
- `src/components/review/TodayDueList.tsx`: `TodayDueList({ notes, onOpen, onOpenReminders })`. Grupowanie przez
  `groupReminders` z `lib/reminderAgenda.ts` (ta sama logika co widok Przypomnień), tylko grupy „Zaległe” i „Dziś”.
  Subskrybuje `useDayClock()` (`lib/dayClock.ts`), więc po północy i po powrocie na kartę lista przelicza się sama.
  Czas przy notatce przez `formatReminderShort` z `lib/reminderTime.ts`.
- `src/components/review/TodayStudyCard.tsx`: `TodayStudyCard({ onPractice })` (dane) i `TodayStudyCardView`
  (sam widok). Liczy `dueToday(useStudy())` z `lib/study/store.ts` — ta sama projekcja i funkcja co „Na dziś: N” w Pracy,
  więc liczba nie zawyża kart pytań, których nie ma już w materiale (L2). Karta ładuje `store.ts` (materiał), ale jest
  lazy i nie wchodzi w paczkę startową;
  `STUDY_DUE_PARAM` (`powtorka`) — obsługa w `StudyView.tsx` (zakładka quiz, zakres „due”, parametr zdjęty z adresu).
- `src/pages/Index.tsx`: lazy importy `TodayShiftCard`, `TodayDueList` i `TodayStudyCard`, renderowanie w widoku `today` przed
  `WeeklyReviewCard`. `onOpenShifts` → `go("shifts")`, `onDailyNote` → `openDailyNote`, `onOpen` → `openNote`,
  `onOpenReminders` → `go("reminders")`. Każda karta ma własny `ViewErrorBoundary` (nazwy: Grafik, Przypomnienia,
  Praca, Powtórki, Przegląd tygodnia), więc błąd jednej nie kładzie reszty widoku. `reminderRowCount` dla widoku `today`
  to `countDueToday(reminderNotes)` z `lib/reminderAgenda.ts`; pusty stan („Brak notatek z dzisiaj”) nie pokazuje się,
  gdy są zaległe lub dzisiejsze przypomnienia.

**Jak działa i dlaczego.**
- Dane tylko do odczytu: zmianę dodaje się i zmienia w Grafiku, nie tutaj (jeden punkt prawdy).
- Karta jest leniwa (jak przegląd tygodnia), więc nie dokłada nic do pierwszego ekranu.
- Karta powtórek czyta stan z warstwy danych, nie z `study/store.ts`: ten importuje cały materiał do nauki, który
  nie jest potrzebny do policzenia pytań na dziś. Bez pytań na dziś karty nie ma (nie zajmuje miejsca).
- Gdy Grafik jeszcze się nie wczytał, karta pokazuje „Grafik się wczytuje…”, zamiast udawać brak zmiany.
- Rodzaj zmiany usunięty z Grafiku daje „Zaplanowana zmiana (rodzaj usunięty).” — zapis nie znika bez śladu.
- Jedna definicja zaległości: `termStatus` z `lib/dueTerms.ts` (lista Dziś, licznik w pasku, przegląd tygodnia).
  Jedna definicja „dotknięte w zakresie” (utworzone albo edytowane): `inRange` z `lib/dateRanges.ts`, używana przez
  filtr widoków Dziś i Tydzień oraz przez oba nudge'y (dzień, tydzień).
- Przegląd „po kolei” (`ReviewWalkthrough.tsx`): kosz (przycisk „Do kosza” i skrót D) i archiwizacja (A, „Archiwizuj”)
  idą przez `useConfirmAction` z `ConfirmActionDialog.tsx`. Domyślnie bez pytania (plan 3.1): od razu z „Cofnij” w toście.
  „Zostaw” (K) nic nie zmienia i nie pyta. Skróty są ignorowane, gdy otwarte jest okno potwierdzenia
  (`[role="alertdialog"]`). Testy: `src/components/review/ReviewWalkthrough.test.tsx` (6).

### Potwierdzenia kosza i archiwum (plan UI/UX 3.1, 2026-10-27)
- Domyślnie (`lib/confirmPrefs.ts`, `DEFAULTS`): `trash: false`, `archive: false` — usunięcie i archiwizacja (kafel, zbiorczo, przegląd po kolei) wykonują się od razu i pokazują dymek „Cofnij”. Kosz da się cofnąć 30 dni, archiwum bez limitu.
- Wyłączniki „Pytaj przed przeniesieniem do kosza” / „Pytaj przed archiwizacją” w Ustawieniach → Ogólne zapisują `kaczy.confirmPrefs.v1`; po włączeniu wraca okno z „Nie pytaj ponownie”.
- Dymki z powiadomienia systemowego: „Odłożono o 10 minut” i „Przypomnienie odhaczone” mają „Cofnij” (`useReminderNotifications.ts`, `applyActionRef`): przywracają poprzednie `reminder`, `reminderDay`, `reminderBase`.
- Załączniki: „Usunięto załącznik” ma „Cofnij” (od dawna). Pozostałe toasty z usunięciem w kodzie już miały „Cofnij” (`toastWithUndo`).
- Testy: `src/lib/settingsPrefs.test.ts` (domyślne i zapis), `ReviewWalkthrough.test.tsx` (6, w tym przepływ bez pytania), e2e `notes.spec.ts` („usunięcie do kosza bez pytania…”). Pięć testów e2e, które sprawdzają okno, włącza `askBeforeTrashAndArchive` (`e2e/helpers.ts`).
- Dotyk: przyciski przeglądu tygodnia, „Przejrzyj po kolei”, przyciski trybu „po kolei” i link „i jeszcze N”
  mają `coarse:` do 44 px. Nazwa sekcji przypomnień to „Przypomnienia”, jak nagłówek.

**Ograniczenia.** Sekcja terminów pokazuje tylko zaległe i dzisiejsze; przyszłe terminy są w Przypomnieniach.
Notatki w koszu są pomijane. Przypomnienia z archiwum są pokazywane — ich terminy nadal dzwonią (decyzja właściciela,
2026-10-20). Przegląd tygodnia wyklucza archiwum, więc ta jedna różnica jest świadoma.

**Testy.** `src/components/review/TodayDueList.test.tsx` (grupy, limit 4, archiwum i kosz pominięte, kliknięcie,
przejście z „dziś” do zaległych po zmianie doby — `focus` i przesunięty zegar),
`src/lib/reminderAgenda.test.ts` (`countDueToday`: zaległe i dzisiejsze, bez przyszłych i kosza, archiwum liczy się),
`src/lib/weeklyReview.test.ts` (przeterminowane przypomnienia — ta sama definicja co lista Dziś),
`src/components/review/TodayShiftCard.test.tsx` (brak zmiany, godziny, usunięty rodzaj, Grafik niegotowy, przyciski;
`useShifts` zmockowany), `src/components/review/TodayStudyCard.test.tsx` (bez powtórek — nic; liczba z odmianą,
„Powtórz”), `e2e/inbox-today.spec.ts` (karta zmiany i przypomnienia na pustym koncie, przycisk „Grafik”),
`e2e/today-study.spec.ts` (runda quizu, następnego dnia karta „10”, „Powtórz” → quiz „Na dziś”).

**Commit.** `32f51b7`, `25ed6cb`, `ddf6765` (powtórki) (2026-10-16). Poprawki Fazy 1 (odświeżanie po zmianie doby,
granice błędów, pusty stan), 2026-10-20: `f720739` (Faza 1), `687756d` (Fazy 2–3, dotyk i jedna definicja zaległości), `585d4a5` (potwierdzenie kosza w przeglądzie), `5168b98` (potwierdzenie archiwizacji).

## Dziś — karta zmiany jako bohater, „Skończyłem teraz”, podgląd jutra, kompozytor, pusty dzień (2.1, 2.2, 2.5, 3.1, 3.3, 3.6, 2026-11-03)

- **Co robi:**
  - *Karta zmiany (3.1):* data jest nagłówkiem karty („Wtorek, 3 listopada”), obok nazwy zmiany stoi duży znaczek ze skrótem w kolorze zmiany (`shiftInk`), a godziny są w kroju mono. Urlop, L4 i dzień bez zmiany mają spokojny, szary znaczek.
  - *„Skończyłem teraz” (2.1):* w trakcie zmiany i tuż po niej (okno `recentlyEndedShift`) zapisuje koniec zmiany tak samo jak karta „Teraz” w Grafiku. Po zmianie napis mówi „Zmiana skończyła się o 14:00”. Pasek postępu ma kolor zmiany.
  - *Podgląd jutra (2.2):* od godziny wieczornego przypomnienia o Grafiku (`readEveningNudgeTime`), a bez niego od 18:00, karta ma wiersz „Jutro: R 06:00–14:00 · 2 terminy”. Klik otwiera Kalendarz na jutrzejszym dniu (`/kalendarz?dzien=`). Bez Grafiku i bez terminów wiersza nie ma. Dostaw Pracy w wierszu jeszcze nie ma.
  - *Kompozytor (2.5):* pasek „Zapisz notatkę…” jest także w Dziś. Nowa notatka jest dzisiejsza, więc zostaje na ekranie, a „+” nie przenosi do Notatek.
  - *Nagłówki grup terminów (3.3):* „Zaległe”, „Przegapione” i „Dziś” jako `section-label` z kropką stanu i liczbą.
  - *Pusty dzień (3.6):* bez zmiany i bez terminów karta mówi „Wolne. Nic nie czeka.”, a „Notatka dnia” jest głównym przyciskiem. Karta Terminów znika, gdy nie ma ani dzisiejszych, ani przyszłych terminów. Rysunku w karcie nie ma, bo słońce jest już w pustym stanie notatek pod kartami.
- **Gdzie:** `src/components/review/TodayShiftCard.tsx` (props `reminderNotes`, `onOpenTomorrow`), `TodayCards.tsx`, `TodayDueList.tsx` (`GROUP_DOT`). Logika: `src/lib/todayTomorrow.ts` (`isTomorrowPreviewTime`, `countRemindersOn`, `tomorrowLine`), `src/lib/shifts/finishNow.ts` (`finishShiftNow`, wspólne z `NowCard.tsx`). Kompozytor: `canCompose` w `src/pages/Index.tsx`.
- **Oś dnia (2.4):** `src/components/review/TodayTimeline.tsx`, leniwie w `TodayCards` pod kartą zmiany, z własną granicą błędu „Oś dnia”.
  - Pokazuje tę samą `DayTimeline` co Kalendarz: pasek zmiany (z nocką z wczoraj), terminy w swoich godzinach i linię „teraz”. Klik w termin otwiera notatkę.
  - Jest zwijana. Stan zapisuje się w `kaczy.today.timeline.v1` (`"1"` lub `"0"`). Bez zapisu oś jest rozwinięta na komputerze i zwinięta na telefonie.
  - W pusty dzień (bez zmiany, bez nocki z wczoraj i bez terminów w godzinach) osi nie ma, bo „Wolne. Nic nie czeka.” mówi już to samo.
  - `DayTimeline` ma prop `scrollWithin`. Linia „teraz” centruje się wtedy tylko w pojemniku osi (`max-h-96`). Wcześniej `scrollIntoView` przewijał całą stronę Dziś do osi.
- **Testy:** `src/components/review/TodayTimeline.test.tsx` (pusty dzień, termin, zmiana, pamięć zwinięcia, kosz), `e2e/today-timeline.spec.ts` (komputer: rozwinięta, strona nie skacze; telefon: zwinięta), `src/lib/todayTomorrow.test.ts`, `src/components/review/TodayShiftCard.test.tsx` (znaczek, „skończyła się”, wiersz „Jutro”), `e2e/dzis-composer.spec.ts`, `e2e/inbox-today.spec.ts` (pusty dzień). Zrzuty `dzis-*` w `e2e/visual.spec.ts-snapshots` są zaktualizowane (2026-11-05, nowy plan 0.1).
- **Commity:** 52fe529, 16e748f (2026-11-03).

## Dziś — karta „Trening mózgu” (Neuroklik, 2026-10-22)

Co robi: na stronie Dziś karta z podpowiedzią względem dzisiejszej zmiany z Grafiku: „Rozgrzewka przed pracą” (do 3 h przed startem), „Trening mózgu po zmianie” (w trakcie zmiany), „Trening po pracy” (do 2 h po końcu) albo „Codzienny trening mózgu” (dzień bez zmiany). Przycisk „Otwórz trening” otwiera https://neuroklik.vercel.app/ w nowej karcie. „Przypomnij” tworzy notatkę z przypomnieniem: 30 min przed startem, albo 10 min po końcu zmiany w trakcie pracy.

Gdzie:
- `src/lib/brainTraining.ts` — `NEUROKLIK_URL`, `brainPlan(data, now)` (tryby przed/w pracy/po/wolne i godzina przypomnienia).
- `src/components/review/BrainTrainingCard.tsx` — karta (leniwa).
- `src/pages/Index.tsx` — montaż pod kartą powtórek na Dziś; `onRemind` tworzy notatkę przez `addNote`.

Ograniczenia: Notatnik nie ma dostępu do danych Neuroklik (wynik, serie); karta tylko otwiera stronę. Osadzenie w ramce odrzucone przy wyborze — strona jest otwierana w nowej karcie. Przypomnienie to zwykła notatka z terminem (działa jak inne przypomnienia, także offline).

Testy: `src/lib/brainTraining.test.ts` (4 przypadki). Budżet paczki startowej: +124 B w `Index.tsx` (już wcześniej przekroczony, patrz sekcja Fala 1).

## Dziś — ciaśniejsze odstępy na telefonie (Fala 4, 2026-10-22)

- **Co robi:** na telefonie karty Dziś mają odstęp 16 px (zamiast 32 px), mniej przewijania na 390 px. Na komputerze 40 px jak dotąd. Pozostałe widoki bez zmian.
- **Gdzie:** `src/pages/Index.tsx` — `<main>` (`gap-4 sm:gap-10` dla `view === "today"`).
- **Nie zrobione z pozycji „Mniej przewijania”:** „Praca+Powtórki w jednym rzędzie” — wymaga decyzji po zobaczeniu wypełnionego widoku.
- **Testy:** `e2e/dzis-phone.spec.ts` (telefon 16 px, komputer 40 px); `today-study.spec.ts` na desktopie OK.

## Skrzynka — tryb porządkowania (Fala 5, pkt 2, 2026-10-22; 3.1 i 3.4, 2026-11-03)

- **Co robi:** przycisk „Porządkuj skrzynkę (N)” pod polem przechwytywania otwiera okno, które pokazuje notatki ze Skrzynki po jednej. Chipy folderów i etykiet przenoszą notatkę z Skrzynki (folder albo etykieta zdejmuje ją z reguły skrzynki). Archiwizuj i Kosz działają od razu. „Zostaw w skrzynce” przechodzi dalej bez zmian. „Cofnij” cofa ostatnią akcję (stos w oknie). Skróty 1–9 wybierają pierwsze dziewięć widocznych chipów.
- **Filtr chipów (3.1, 2026-11-03):** pole „Folder lub etykieta…” nad chipami. Pisanie filtruje bez ogonków i wielkości liter, a `#`/`@` na początku jest pomijane. Najpierw idą nazwy zaczynające się od wpisanego tekstu. Enter wybiera pierwszy pasujący chip, a bez dopasowania tworzy etykietę. Bez filtra widać 9 najczęściej używanych (liczba notatek w folderze albo z etykietą), resztę pokazuje „Więcej (N)”. Kolejka i ranking są zamrożone przy otwarciu, więc skróty 1–9 nie skaczą po każdej akcji. Folder albo etykieta dodane w trakcie idą na koniec. Na końcu listy są „Nowy folder „…”” i „Nowa etykieta #…”, gdy takiej nazwy jeszcze nie ma. Tworzą folder albo etykietę i od razu przenoszą notatkę. „Cofnij” zdejmuje przypisanie, ale nowego folderu ani etykiety nie usuwa. Filtr czyści się przy każdej następnej notatce.
- **Karta (4.6, 2026-11-03):** notatka to karta z cieniem kafla, większym tytułem i okładką z pierwszego zdjęcia (`TriageCover`, `useImageUrl`; bez zdjęcia na tym urządzeniu nie ma okładki). Pod nagłówkiem jest pasek postępu (`role="progressbar"`) obok „3 z 12”. Każda następna karta wjeżdża z prawej (`tween.enter`), a przy ograniczonym ruchu `MotionConfig` ją wycisza.
- **„Przypomnij…” (3.4, 2026-11-03):** rozwija panel z „Dziś 18:00” (tylko przed 18:00), „Jutro 9:00” i polem `QuickReminderInput` („jutro 15:00”, „za 2h”). Termin zapisuje się, kolejka idzie dalej, a „Cofnij” przywraca poprzedni termin. Notatka z samym terminem zostaje w Skrzynce (reguła `isInboxNote` się nie zmienia), co panel mówi wprost. Przy pierwszym terminie aplikacja prosi o zgodę na powiadomienia (`requestNotificationPermissionOnIntent`).
- **Gdzie:** `src/components/InboxTriage.tsx` (okno, kolejka i ranking chipów zamrożone przy otwarciu w efekcie na `open`, `quickReminders`); `src/lib/triageChips.ts` (`rankTriageChips`, `filterTriageChips`, `hasExact`, `triageQuery`, `TRIAGE_TOP`); `src/pages/Index.tsx` (leniwy import, przycisk i montowanie przy pierwszym otwarciu, `triageOpen`/`triageMounted`). Reguła skrzynki: `src/lib/inbox.ts` (`isInboxNote`).
- **Gesty na dotyku (plan mobile A5, 2026-10-28):** na telefonie (`pointer: coarse`) kartę z treścią notatki można przesunąć. W lewo — archiwizuj (jak kafel w Notatkach), w prawo — zostaw w skrzynce (bez zmian danych). Próg 110 px, a 60 px przy szybkim ruchu, tak jak w `useCardGestures`. Pod kartą widać podpowiedź. Każda akcja idzie stosem „Cofnij”. Przyciski zostają bez zmian, a na myszy karta stoi w miejscu. Kod: `InboxTriage.tsx` (`m.div` z `drag="x"`, `onDragEnd`, stan `coarse`).
- **Testy:** `src/lib/triageChips.test.ts` (ranking, filtr, „Nowy…”). `e2e/inbox-triage.spec.ts` (archiwizacja, cofnięcie, kosz, zostawienie, stan „Gotowe”; „skrzynka 3.1” filtr i nowa etykieta; „skrzynka 3.4” termin; „skrzynka 4.2–4.4” pasek, wiek, postęp i pieczątka). `src/lib/inbox.test.ts` (wiek). `e2e/a11y.spec.ts` („Skrzynka z paskiem i oknem porządkowania”). Zrzuty `skrzynka-*` w `e2e/visual.spec.ts-snapshots` są zaktualizowane. Gest przesunięcia nie ma jeszcze testu e2e (e2e uruchamiane tylko na prośbę). Skrótów 1–9 jeszcze nie pokrywa test e2e (brak folderów w teście). Regresja: `inbox-today` 3/3, `InboxCapture` + `inbox` 13/13.

## Skrzynka — „Odłóż” (S-1, 2026-10-26)

- **Co robi:** w porządkowaniu Skrzynki (`InboxTriage`) przyciski „Jutro” i „Za tydzień” odkładają notatkę do północy wskazanego dnia. Znika wtedy ze Skrzynki i z jej licznika, a po terminie wraca sama. „Cofnij” zdejmuje odłożenie.
- **Dane:** nowe pole `snoozedUntil` (ms) w notatce. Brak albo `0` = nieodłożona. Zapis w Yjs jako zwykłe pole notatki (`src/lib/yjs/codec.ts`, `NOTE_SCALAR_FIELDS`), odczyt odrzuca wartości niedodatnie i nieskończone, schemat w `noteSchema.ts` (`catch(undefined)`), typ `Note` w `useNotes.ts`. Starsze dokumenty bez pola działają bez zmian.
- **Reguła:** `isSnoozed` i `isInboxNote` w `src/lib/inbox.ts`. Notatka odłożona jest też poza filtrem Skrzynki w `useFilteredNotes.ts`.
- **Ograniczenie:** pole nie jest scalane przez `mergeNotes.ts` (ta lista dotyczy przypomnień). Dwa urządzenia edytujące tę samą notatkę jednocześnie mogą wybrać inne odłożenie, zwykła zasada „ostatni zapis wygrywa”.
- **Testy:** `src/lib/inbox.test.ts` (odłożenie i powrót po terminie), e2e `e2e/inbox-triage.spec.ts` („Jutro” i „Cofnij”).

## Dziś — karty opcjonalne per urządzenie (D-2, 2026-10-26)

- **Co robi:** w Ustawieniach → Wygląd, sekcja „Karty na Dziś”, przełączniki „Trening mózgu” i „Przegląd tygodnia”. Wyłączona karta znika z widoku Dziś. Domyślnie obie są włączone.
- **Zakres na tym urządzeniu:** zapis tylko lokalnie (klucz `kaczy.todayCards.v1`), bez synchronizacji. Telefon na budowie i komputer mogą mieć inne karty. Decyzja D-2 z planu.
- **Gdzie:** `src/lib/todayCards.ts` (`todayCardsStore`, `setTodayCard`, `useTodayCards`); bramki przy kartach w `src/pages/Index.tsx` (widok „today”); przełączniki w `src/components/settings/AppearanceSettings.tsx`.
- **Odłożone z planu 4.1:** kolejność kart przeciąganiem (`@dnd-kit/sortable`) i „oś dnia”. Oś dnia jest w Kalendarzu (`DayTimeline`), nie na Dziś, więc nie ma tu czego ustawiać. Kolejność zostaje jak dziś.
- **Testy:** `src/lib/todayCards.test.ts`; e2e `e2e/today-cards-settings.spec.ts`.

## Dziś — notatka dnia na karcie: podgląd i „Dopisz” (2.6, 2026-11-02)

- **Co robi.** Gdy notatka dnia istnieje, karta zmiany na Dziś pokazuje przycisk „Dopisz” (zamiast „Notatka dnia”), pod nim pierwsze dwie niepuste linie treści i licznik odhaczeń („Odhaczone: 1 z 2”). Prywatna notatka dnia pokazuje tylko „Notatka dnia jest w skarbcu.”, bo jej treść nie jest jawna. Bez notatki dnia wszystko jak dawniej.
- **Gdzie.** `TodayCards.tsx` wylicza notatkę dnia (`findDailyNote(notes, dailyKey())`) i przekazuje ją jako prop `dailyNote`; `TodayShiftCard.tsx` (`dailyPreview`, blok `today-daily-preview`).
- **Testy.** `src/components/review/TodayShiftCard.test.tsx` (bez notatki, z notatką, prywatna).
- **Commit.** `97174a3` (2026-11-02).

## Najmniejsze punkty planów: przegląd tygodnia i nowy rekord (Skrzynka 5.2, Ćwiczenia 3.3, 2026-11-02)

- **Co robi.**
  - **Skrzynka 5.2:** w przeglądzie tygodnia nowa kategoria „Skrzynka starsza niż tydzień” — notatki bez folderu i etykiety, z treścią, nietknięte od 7 dni. Zwykła lista do przejrzenia jak pozostałe kategorie; kategoria „Do posegregowania” zostaje bez zmian (notatka może być w obu).
  - **Ćwiczenia 3.3:** po zapisie serii, w której najcięższy ciężar przebija dotychczasowy rekord tego ćwiczenia, pojawia się komunikat „Nowy rekord: <ćwiczenie> — <kg> kg” i wibracja. Pierwszy zapis ćwiczenia rekordem nie jest. Komunikat nie jest wyłączalny w efektach — to jeszcze do decyzji.
- **Gdzie.** `src/lib/weeklyReview.ts` (`inbox` w `ReviewCategoryKey`, `META`, `ORDER`, budowa listy), etykiety w `ReviewWalkthrough.tsx` i ikona/szczegół w `WeeklyReviewCard.tsx`; `TrainingSection.tsx` (`LogForm.save`, porównanie z `bestKg` wpisów tego ćwiczenia).
- **Testy.** `src/lib/weeklyReview.test.ts` (skrzynka: tylko nieposortowane, z treścią, od 7 dni), `src/components/cwiczenia/TrainingSection.test.tsx` (rekord vs. lżejsza seria i pierwsze ćwiczenie), `e2e/weekly-review.spec.ts` bez zmian.
- **Commit.** `16947b2` (2026-11-02).

## Dziś — prywatna notatka, czas powtórek, najbliższy termin, trening bez duplikatów, Skrzynka i Ćwiczenia (1.2–1.5, 2.3, 4.3, 4.4, 2026-11-02)

- **Co robi.**
  - **1.2:** termin z notatki prywatnej to „Notatka prywatna” z kłódką zamiast „Bez tytułu” — na Dziś i w Terminach jako lista (`noteListTitle`, `src/lib/noteListTitle.ts`).
  - **1.3:** zanim Grafik się wczyta, karta zmiany pokazuje szkielet (`CardSkeleton`, `aria-busy`) zamiast napisu „Grafik się wczytuje…”.
  - **1.4:** „Przypomnij” w treningu mózgu: gdy przypomnienie na tę porę z tym tytułem już jest, przycisk mówi „Przypomnienie ustawione” (wyłączony) — bez drugiej notatki.
  - **1.5:** karta powtórek podaje „ok. N min” (20 s na pytanie, najmniej 1 min) zamiast „kilka minut”.
  - **2.3:** gdy nic nie czeka, karta Terminów dopisuje „Najbliższy: <termin> — <tytuł>” (klik otwiera notatkę).
  - **4.3 i 4.4:** nowa karta „Skrzynka i Ćwiczenia”: „Skrzynka: N do posortowania” z „Porządkuj” (przechodzi do Skrzynki) i „Odżywki: 2 z 5 · Trening: 6 serii dziś” (klik → Ćwiczenia). Każdy wiersz tylko, gdy jest o czym mówić.
- **Gdzie.** `TodayShiftCard.tsx`, `TodayDueList.tsx`, `ReminderListGroups.tsx`, `BrainTrainingCard.tsx` (prop `hasReminder`), `TodayStudyCard.tsx`, nowy `TodayPersonalRows.tsx` (leniwy, w `TodayCards.tsx`; `inboxCount` z `Index.tsx`).
- **Jak działa.** Karta osobista ładuje się leniwie, więc magazyny Ćwiczeń nie trafiają do paczki startowej. Najbliższy termin: najwcześniejszy przyszły poza koszem (też z archiwum, bo jego przypomnienia dzwonią).
- **Stan planu Dziś.** Zrobione wcześniej 1.1 (D-1), część 2.1 (stan zmiany w karcie), 4.1 (ustawienia kart). Otwarte: 2.2, 2.4–2.6, Etap 3 (3.4 czeka na D-3), 4.2, 4.5.
- **Testy.** `src/lib/noteListTitle.test.ts`, `TodayDueList.test.tsx` (najbliższy termin, prywatna notatka), `TodayStudyCard.test.tsx` (szacunek), `TodayShiftCard.test.tsx` (szkielet), `e2e/inbox-today.spec.ts` (wiersz Skrzynki → „Porządkuj”), zrzuty `dzis-*` odświeżone.
- **Przy okazji:** `e2e/reminders-calendar.spec.ts` czekał na nagłówek z rokiem — wcześniej czasem odczytywał nagłówek pustych Notatek, zanim kalendarz się pokazał.
- **Commit.** `f4a63eb` (2026-11-02).

## Skrzynka — „Zapisz” i dyktowanie w polu, tytuł z treści, „Otwórz notatkę”, pusty stan z działaniem (1.1, 1.3, 2.2, 3.2, 4.5, 2026-11-02)

- **Co robi.**
  - **1.1:** w polu Skrzynki przy niepustym tekście pojawia się okrągły przycisk „Zapisz do skrzynki” (strzałka, 44 px na dotyku) — na telefonie Enter klawiatury bywa nową linią. Enter na komputerze zapisuje jak dotąd.
  - **2.2:** mikrofon w polu (gdy przeglądarka ma rozpoznawanie mowy): podyktowany tekst dopisuje się do pola, zapis dalej Enterem albo „Zapisz”. Ta sama zgoda i dyktowanie bez internetu co w innych miejscach (`useDictation`).
  - **1.3:** tryb porządkowania pokazuje przy notatce bez tytułu pierwszą niepustą linię treści, a resztę jako podgląd (dawniej „Bez tytułu”).
  - **3.2:** w trybie porządkowania „Otwórz notatkę” zamyka okno i otwiera notatkę w edytorze (w miejscu kafla).
  - **4.5:** pusta Skrzynka ma jeden przycisk „Zapisz pomysł” (kursor w polu nad listą) zamiast ogólnego „Nowa notatka”.
  - Podpowiedź w polu skrócona do „Zapisz pomysł — Enter” — z mikrofonem dawna dłuższa zawijała się i była ucięta (wyłapane zrzutem `@visual`).
- **Gdzie.** `src/components/InboxCapture.tsx`; `triageHeadline` w `src/lib/inbox.ts`, `InboxTriage.tsx` (prop `onOpenNote`, w `Index.tsx` `openNote(id, false, true)` — trzeci argument otwiera edytor, bez niego `openNote` tylko pokazuje kafel); `EmptyState.tsx` (przycisk dla `inbox`, `Index.tsx` nie podaje `onNew` w Skrzynce).
- **Pułapka.** Znak nowej linii w kodzie wstawiany przez polecenia powłoki zamienia się na dosłowny znak — `triageHeadline` dzieli po `String.fromCharCode(10)`, a CR znika przy `trim()`.
- **Testy.** `src/lib/inbox.test.ts` (`triageHeadline`), `src/components/InboxCapture.test.tsx` (przycisk „Zapisz”), `e2e/inbox-triage.spec.ts` (pusty stan i kursor w polu, „Otwórz notatkę” → edytor), zrzuty `skrzynka-telefon-*` odświeżone.
- **Commit.** `50daf70` (2026-11-02).

## Dziś — listy na dziś i ruch kart (Dziś 4.2 i 3.5, Plan-nowy 2.4, 2026-11-05)

- **Listy na dziś (4.2).** Karta „Listy na dziś” (`src/components/review/TodayListsCard.tsx`, w `TodayCards.tsx` pod Terminami, leniwie, z własną granicą błędu). Pokazuje nieodhaczone pozycje list z notatek zmienionych dziś albo z terminem dziś, najwyżej 8, a reszta jako „i jeszcze N w notatkach”. Bez notatek prywatnych, archiwum i kosza (`todayListRows` w `src/lib/todayLists.ts`). Odhaczenie działa jak „Gotowe” w Terminach: rysowany ptaszek, zwinięcie wiersza (`collapseRowThen`), zapis listy i toast z „Cofnij”. Nazwa notatki przy pozycji ją otwiera. Karta znika, gdy nie ma czego odhaczać. Nagroda „Dzień zamknięty” liczy listy jak dotąd.
- **Ruch kart (3.5).** Karty Dziś wchodzą kolejno, co 40 ms (`.today-stagger` w `src/styles/motion.css`). Licznik w nagłówku Terminów „pyka” przy zmianie (`useBump` w `TodayDueList.tsx`). Zwinięcie odhaczonego terminu było już w nowym planie 4.2. Przy ograniczonym ruchu bez animacji.
- **Testy:** `src/lib/todayLists.test.ts`, `e2e/today-lists.spec.ts` (odhaczenie, „Cofnij”, audyt axe karty — Dziś nie ma go w `a11y.spec.ts`).

## Skrzynka — błysk nowej notatki i ikona linku (1.2, 2.4, 2026-11-12)

- **Co robi:** błysk przy dodaniu notatki startuje teraz także z pola przechwytywania Skrzynki (wcześniej tylko z paska dodawania, którego w Skrzynce nie ma). Notatka z samym adresem http(s) w treści (np. wklejony link) ma na kaflu ikonę linku przed tytułem.
- **Gdzie:** `src/pages/Index.tsx` (`handleAddNoteGlow` szuka `[data-add-note-bar], [data-inbox-capture]`), `src/components/NoteCardBody.tsx` (`ExternalLink` + `parsePastedUrl` z `urlTitle.ts`).
- **Ograniczenia:** ikona pojawia się tylko, gdy cała treść to jeden adres; bez testu komponentu kafla (brak testów jednostkowych `NoteCard`), sprawdzone tylko typami.
- **Testy:** `src/lib/urlTitle` (rozpoznanie adresu).

## Dziś — „Należności” (R3.1, R3.4, decyzja PR-2, 2026-11-23)

- **Co robi:** karta „Należności” na Dziś pokazuje, kto ile jest winien: rozliczenia budów z saldem, zlecenia „Zrobione” bez zapłaty i faktury bez wpłaty. W nagłówku suma, w wierszu nazwa budowy, skąd kwota (rozliczenie / zlecenie / faktura z numerem), ile dni czeka albo ile po terminie, kwota i pasek „zapłacono N%”, gdy była wpłata lub zaliczka. Najdłużej czekające na górze, do 5 wierszy, resztę otwiera „i N kolejnych w Pracy”. Wiersz otwiera kartę budowy (tam wpłata i przypomnienie klientowi). Karta znika, gdy nic nie czeka.
- **Gdzie jest:** `src/lib/study/receivables.ts` (`receivables` — czysta funkcja, `REMIND_AFTER_DAYS = 14`), `src/lib/study/receivablesStore.ts` (`useReceivables`), `src/components/review/TodayReceivables.tsx`, podpięte w `TodayCards.tsx` za „Do wystawienia”.
- **Jak działa:** `useReceivables` liczy zestawienie każdej niearchiwalnej budowy z wybranym sposobem rozliczenia tak jak `SiteBillingDues` (godziny do dziś z dziennika i Grafiku — `siteMinutesInRange`, punkty, etapy, wpłaty), do tego zlecenia (`useJobs`) i faktury (`useInvoices`). Rozliczenia i punkty to osobne mapy dokumentu bez stabilnego zrzutu, więc hook przelicza się po sygnale `subscribeBilling` / `subscribePoints` (licznik wersji) i raz na dzień (`useDayClock`). Zlecenie i faktura tej samej budowy dają najwyżej jeden wiersz (opis w nagłówku `receivables.ts`). Wiersz ostrzegawczy (kolor `warning-ink`) po terminie faktury albo po 14 dniach czekania.
- **Ograniczenia i pułapki:** bez przycisku przypomnienia w wierszu — przypomnienie jest w karcie budowy (potrzebuje telefonu klienta i numeru konta). `unpaidTotal` w `JobsDialog` i `StudyJournal` dalej liczy same zlecenia — to inna liczba („do zapłaty ze zleceń”), więc nie podmieniono jej na sumę należności.
- **Testy:** `src/lib/study/receivables.test.ts` (6: budowa z wpłatą i bez, zlecenie z fakturą liczone raz, zaliczka i pasek, faktura bez zlecenia, kolejność), `e2e/today-receivables.spec.ts` (zlecenie „Zrobione” → karta z kwotą i axe → wiersz otwiera kartę budowy → „Zapłacone” zdejmuje; chromium, iPhone, Pixel).

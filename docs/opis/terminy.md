# Terminy, przypomnienia i powiadomienia

Część opisu technicznego Notatnika (spis: [`opis.md`](../../opis.md)). Stan bieżący, nie historia — przy zmianie funkcji poprawiaj jej opis.

## Przypomnienia — stan aktualny (terminy, serie, odłożenie, dymki, widok Terminy)

Dział opisany w jednym miejscu. Przypomnienie to termin na notatce; z jego zapisu liczą się wystąpienia, powiadomienia, push i widok Terminy.

### Co robi

- **Termin i powtarzanie** (`ReminderPicker`): godzina, dzień, powtarzanie (codziennie, tygodniowo, miesięcznie), koniec serii. Flaga „Cały dzień (o 9:00)” — zamiast godziny zapisuje się 9:00 wybranego dnia; na kaflu i w Terminach widać samą datę („dziś”, „jutro”, „25 paź”). Na telefonie (ekran do 639 px) picker otwiera się jako dolny arkusz zamiast Popovera (F2.1, `ReminderSurface` w `ReminderPicker.tsx`, `useMediaQuery`); treść ta sama. Pola godziny i „Do kiedy” mają `max-sm:h-11` (44 px). Test: `e2e/reminder-sheet.spec.ts`. F2.2: nad polami daty rząd chipów „Dziś / Jutro / Pojutrze” (ustawiają tylko dzień, `DAY_CHIPS`) i „Wybierz…” (tylko na telefonie). Na telefonie kalendarz pokazuje się dopiero po „Wybierz…” albo gdy wybrano dzień spoza chipów (`showCalendar`); na komputerze jest zawsze. Pod polem godziny chipy 08:00, 12:00, 15:00, 18:00, 20:00 (`HOUR_CHIPS`, tylko bez „Cały dzień”). F2.3: wpisany tekst (`QuickReminderInput`, `onPreview`) ustawia pola na żywo, bez zapisu; Enter albo przycisk nadal zapisują. Podgląd „Zapiszę: …” (`data-testid="reminder-preview"`, `aria-live`) stoi tuż nad przyciskiem „Zapisz” jako pasek wyniku (Faza 4). Nad grupami dnia i godziny są etykiety kroków „DZIEŃ” i „GODZINA” (`StepLabel`, zeszytowa przerywana linia, `aria-hidden`, bo grupy mają własne nazwy). Test axe arkusza terminu: `e2e/fab-sheets-a11y.spec.ts`. Pod chipami linia „Zapiszę” jest już tylko w pasku wyniku; wcześniej była w dwóch miejscach, a przy „Cały dzień” dopisek „· cały dzień” (F2.4: pole godziny się chowa). Ostrzeżenia o przeszłości i końcu serii mają `aria-live` (F2.5). Istniejące „Szybkie terminy” zostają bez zmian (testy kompozytora ich używają). Ten sam arkusz wyłącza „kliknięcie poza” w kompozytorze (`data-reminder-sheet` w `AddNoteBar.tsx`): bez tego dotknięcie w arkusz zwijało kompozytor razem z pickerem. Testy: `e2e/reminder-sheet.spec.ts`. Termin w przeszłości (K-1, 2026-10-26): ostrzeżenie „Ten termin jest w przeszłości — przypomnienie odezwie się przy najbliższym otwarciu aplikacji.” i zapis dozwolony, tak jak w dialogu Kalendarza (`ReminderQuickAddDialog`). Blokuje tylko brak godziny i nieprawidłowa seria. Test automatyczny tej reguły w pickerze: brak (sprawdzone tylko, że istniejące testy Kalendarza i Terminów przechodzą).
- **Seria zaległa** (np. aplikacja była zamknięta przez kilka cykli) odpala się RAZ. Dymek lub powiadomienie pokazuje „pominięto N”, a termin przesuwa się na najbliższy przyszły. Zabezpieczenie: najwyżej 1000 wystąpień wstecz.
- **Odłożenie** („Odłóż”, 10 minut, jutro o 9:00, +1 h) działa też dla serii i odkłada tylko jedno wystąpienie. Kolejne wystąpienia są od swojego terminu, nie od chwili odłożenia.
- **„Gotowe”:** przy każdym terminie w widoku Terminy; na serii kończy bieżące wystąpienie i przechodzi do następnego. Koniec serii albo zwykły termin zdejmuje przypomnienie. Cofnij przywraca termin, dzień serii i odłożenie.
- **„Jutro rano” i „+1 h”** nie przepisują dnia serii.
- **Widok Terminy:** grupy „Zaległe” / „Nadchodzące” z nagłówkami `<h2>`, osobna sekcja „W archiwum” na dole z wyszukiwaniem (nie wchodzi do grup ani licznika). Pusty widok ma przycisk „Nowa notatka”.
- **Zaległości:** licznik na pasku bocznym i w tytule karty liczy też terminy Pracy (ta sama lista co Terminy). Zaległy termin ma prefiks „Zaległe:” dla czytnika ekranu.
- **Fokus po akcji** (Gotowe, Jutro, +1 h, przesunięcie, usunięcie) przechodzi na sąsiedni kafel w grupie, a gdy go nie ma — na nagłówek grupy.

### Gdzie jest

- `src/lib/reminderSpec.ts` — `ReminderState` (w tym `reminderAllDay`, `reminderBase`), `REMINDER_FIELDS`, `specOf`, `readSpec`, `mergeSpec`, `projectReminder`. Całe przypomnienie to jedna wartość `reminderSpec` w Y.Map notatki.
- `src/lib/yjs/codec.ts` — `readReminderState`, zapis przy tworzeniu notatki (`yNoteFromPlain`), projekcja w `plainFromYNote`; `src/lib/yjsStore.ts` — zapis w `applyPatch`.
- `src/lib/reminderRepeat.ts` — `nextOccurrence(note, at)`, `snoozeTarget(note, at, now)`, `doneTarget`, `seriesDay`, `endOfDay(date)`.
- `src/lib/reminderOccurrences.ts` — `expandOccurrences` (przewija do `rangeStart`, limit `MAX_SKIP_STEPS`), `isNext` tylko dla zapisanego terminu, `Occurrence.allDay`.
- `src/lib/reminderDue.ts` — `planDueReminders` (czysta funkcja: co odpalić i ile pominięto), rejestr „już odpalone”, mapa `handled`.
- `src/components/useReminderNotifications.ts` — wykonuje efekty: dymki, powiadomienia, przesunięcie serii, `markDone`, `applyActionRef` (akcja z SW i z kolejki przy starcie).
- `src/components/ReminderDueToast.tsx` — dymek z „Odłóż” zawsze.
- `src/components/NoteCardBody.tsx` — przyciski terminu („Gotowe”, „Jutro”, „+1 h”), `focusAfterRemoval`.
- `src/components/ReminderPicker.tsx` — `ReminderBadge` (kolor, prefiks „Zaległe:”, `useReminderPassed`).
- `src/hooks/useReminderPassed.ts` — przełącza się przez `setTimeout` co najwyżej do terminu (dłuższe terminy w krokach, limit ok. 24,8 dnia).
- `src/lib/reminderAgenda.ts` — `snoozeTimes` (w tym `inHour`), `byReminderAsc` (jedno sortowanie dla Terminów i grup).
- `src/lib/reminderTime.ts` — `formatReminderShort(ts, now, allDay)`, `composeReminderTimestamp` (`null` dla godziny nieistniejącej w czasie letnim).
- `src/lib/push/schedule.ts` — harmonogram push; `push-server/core.js` (komentarz: „Odłóż” też dla serii).
- `src/lib/studyOverdueCount.ts` — mały store licznika zaległości Pracy; `src/components/review/StudyOverdueSync.tsx` — leniwy komponent bez wyglądu, który go zasila.
- `src/hooks/useOverdueBadge.ts` — drugi argument `extra` (zaległości spoza notatek).
- `src/pages/Index.tsx` — `reminderGroups`, `archivedRows`, `reminderRowCount`, sekcja „W archiwum”, `onNew`, przekazanie `reminderBase` do `updateNote`.
- `src/components/NoteGroupSection.tsx` — nagłówek grupy.

### Jak działa i dlaczego

- **Jeden zapis całego terminu** (`reminderSpec`, LWW): termin, powtarzanie, dzień serii, koniec, odłożenie i flaga dnia są jedną wartością, więc konflikt dwóch urządzeń nie zostawia mieszanki. Stare pola (`reminder`, `reminderRepeat`, `reminderDay`, `reminderRepeatUntil`) są dalej zapisywane tą samą wartością dla starszych odczytów. Odczyt: najpierw `reminderSpec`, gdy go nie ma — stare pola. Nic nie trzeba migrować.
- **Odłożenie** zapisuje `reminder` = odłożona chwila i `reminderBase` = termin serii, który zastępuje. Kolejne wystąpienia liczą się od bazy. Odłożona chwila zawsze wypada przed następnym terminem (`snoozeTarget` zastępuje ją zwykłym terminem, gdyby wypadała później). Zaległości: `snoozeTarget` przesuwa bazę na ostatnie minione wystąpienie.
- **Odpalenie** nie zależy od flagi dnia: przypomnienie idzie o zapisanej godzinie (9:00 dla „cały dzień”), w aplikacji i w push.
- **Cały dzień = 9:00, nie północ**, bo północ dzwoniłaby w nocy. Dzwonienie idzie o 9:00 jak dawniej. Zaległość dla terminu „cały dzień” (D-1, 2026-10-26) liczy się dopiero od następnego dnia: w dniu terminu jest na „Dziś” (`termStatus(at, now, allDay)` w `dueTerms.ts`, używane przez `groupReminders`, `countOverdue`, przegląd tygodnia). Testy: `dueTerms.test.ts`, `reminderAgenda.test.ts`.
- **Liczba z Pracy** w liczniku zawiera też serwis przypadający dziś — tak jak lista Terminów.
- **Zmiana terminu w kalendarzu** (przeciągnięcie, Shift+←/→, „Termin zapisany”) czyści odłożenie: to nowy termin serii. Wyjątek: przeciągnięcie odłożonego wystąpienia (`reminder` ≠ `reminderBase`) przesuwa tylko je, a baza serii zostaje, o ile nowy czas wypada przed następnym terminem serii (`ReminderCalendarView.tsx` `moveToDay`, `keepSeries`). Poza tym regułą seria przesuwa się cała.
- **Licznik i odznaka** przełączają się na „Zaległe” w chwili, gdy termin minie, nawet gdy lista notatek się nie zmienia.

### Ograniczenia i pułapki

- Kompozytor nowej notatki (`AddNoteBar`) nie ma pola „Cały dzień” — termin wymaga tam godziny. „Nowa notatka” z pustych Terminów otwiera zwykły kompozytor, nie kompozytor z terminem.
- Notatki zapisane przez starszą wersję nie mają `reminderSpec`, dopóki nie zostaną zmienione; konflikt całości obejmuje dopiero zmienione notatki.
- Liczba z Pracy jest liczona przy renderze; zmiana doby bez zmiany dziennika odświeża ją dopiero po zmianie danych.
- Każda odznaka z przyszłym terminem ma jeden `setTimeout`; odznaki bez terminu nie mają timera.
- Odznaka terminu ma 12 px i może zwiększyć wysokość kafla w wąskim kaflu — do sprawdzenia na telefonie.
- Wybór dnia, który już minął (np. 9:00 dziś po czasie), jest blokowany komunikatem jak przeszła godzina.
- Fokus po akcji wybiera pierwszy przycisk sąsiedniego kafla, a nie zawsze „Gotowe”.
- Brak e2e dla odłożenia serii i testu na telefonie.

### Testy

- `src/lib/reminderDue.test.ts` — na czas, zaległa seria, koniec serii, miesiąc z 31., rejestr, `handled`, brak terminu, odłożone wystąpienie odpala się raz.
- `src/lib/reminderRepeat.test.ts` — `nextOccurrence` i `snoozeTarget` (jednorazowa, seria, zaległe, seria zakończona).
- `src/lib/reminderSpec.test.ts` — zapis i odczyt, czyszczenie przy nowym terminie, flaga „cały dzień”.
- `src/lib/reminderTime.test.ts` — `formatReminderShort`, zmiana czasu (Europe/Warsaw).
- `src/lib/reminderAgenda.test.ts`, `src/lib/reminderOccurrences.test.ts`.
- `src/lib/yjsStore.reminder.test.ts` — dwa dokumenty: równoległa zmiana terminu i powtarzania daje jedną całość; baza wraca po synchronizacji; flaga przez dwa dokumenty.
- `src/hooks/useOverdueBadge.test.ts`, `src/hooks/useReminderPassed.test.ts`.
- `src/components/ReminderDueToast.tsx` — testy istniejące, bez zmian.
- E2E: `reminder-toast`, `reminders-calendar`, `reminders-agenda`, `reminders-phase2` (Gotowe, pusty widok Terminów). Pełny przebieg chromium ostatnio na 2026-10-20 (391/391 przed kolejnymi zmianami); od tego czasu nie uruchamiany.

### Commity

- `a235912` (2026-10-19) — przypomnienie na cały dzień (P6).
- `831ab76` (2026-10-19) — cały termin w jednym zapisie `reminderSpec` (C3).
- `0d6e497` (2026-10-19) — jedno odpalenie zaległej serii (krok 1).
- `3c07051` (2026-10-19) — odłożenie jednego wystąpienia serii (P3).
- `0ae3808` (2026-10-20) — faza 1 planu (grupy, dotyk, „+1 h”).
- `018d791` (2026-10-20) — dokończenie fazy 1 („Nowa notatka”, odświeżany termin, odznaka 12 px).
- `ebe2567` (2026-10-20) — fazy 2–3 wg decyzji D1–D4 („Gotowe” przy każdym terminie, archiwum, licznik Pracy).

## Terminy — jedna definicja zaległych, archiwum liczone (krok 2 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** licznik zaległych przy tytule karty i ikonie, widok Terminy oraz „Dziś” liczą terminy tą samą funkcją. Przypomnienia z archiwum są liczone jak reszta: pojawiają się w „Zaległe” i w „Dziś”, bo nadal dzwonią. Kosz nie jest liczony.
- **Gdzie jest:** `src/lib/dueTerms.ts` (`termStatus`, `endOfDay`: zaległy / dziś / najbliższe 7 dni / później), `src/lib/reminderAgenda.ts` (`groupReminders`, `countOverdue` korzystają z `termStatus`), `src/pages/Index.tsx` (licznik i „Dziś” dostają `reminderNotes`, Terminy dostają `others` plus archiwum), `src/components/review/TodayDueList.tsx` (pomija tylko kosz).
- **Decyzje:** archiwum liczone (potwierdzone przez właściciela); Terminy z Praca tylko do odczytu z linkiem do budowy (potwierdzone, jeszcze niezrobione — krok 3).
- **Czego nie ujednolicono:** harmonogram push (`src/lib/push/schedule.ts`) liczy tylko przyszłość, bo wysyła przypomnienia, a nie zaległości. Parytet z licznikiem byłby mylący, więc nie jest testowany.
- **Testy:** `src/lib/dueTerms.test.ts` (granice dnia i tygodnia), `TodayDueList.test.tsx` (archiwum widoczne, kosz nie). E2E `reminders-agenda`, `reminders-calendar`, `reminder-toast`, `today-study`: 18/18. Vitest 1441/1441. Typecheck czysty.
- **Commit:** 01b7589, 2026-10-19.

## Terminy z Praca — serwis, zamówienia, problemy na Dziś i w Terminach (krok 3 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** na Dziś i w widoku Terminy pojawia się sekcja „Praca” z trzema rodzajami terminów: serwis należny dziś lub zaległy, zamówienie bez dostawy ponad 3 dni, otwarte problemy ponad 3 dni. Wiersze są tylko do odczytu; przycisk „Otwórz Pracę” przenosi do działu. Protokół próby nie jest terminem i się tu nie pojawia.
- **Gdzie jest:** `src/lib/study/dueRows.ts` (`studyDueRows`: przypomnienia Pracy → wiersze), `src/components/review/StudyDueRows.tsx` (komponent; ładowany leniwie z `Index.tsx` w dwóch miejscach: Dziś i Terminy; czeka na gotowość danych Praca i nic nie pokazuje bez wierszy; subskrybuje `useDayClock()`, więc terminy „na dziś” przechodzą na listę po północy), `src/pages/Index.tsx` (lazy import, blok „Dziś” jako fragment).
- **Dlaczego leniwie:** dane Praca (dziennik, budowy, listy) nie mogą wejść do paczki startowej. Komponent korzysta z `useStudy`, więc jest w osobnym chunku.
- **Budżet:** po tej zmianie wejściowy JS to 395 319 B gzip przy progu 395 264 B (386 KB) — przekroczenie 55 B. Test `e2e/bundle.spec.ts` jest czerwony do decyzji właściciela: podniesienie progu do 387 KB albo znalezienie 55 B w kodzie. Próg nie został zmieniony.
- **Testy:** `src/lib/study/dueRows.test.ts` (4: mapowanie serwisu, zamówienia i problemów; brak protokołu; liczba problemów po polsku), `src/components/review/StudyDueRows.test.tsx` (3: brak wierszy, serwis z przyciskiem do Pracy, zamówienie). E2E `site-service`, `reminders-agenda`, `today-study`, `site-shortages`: 5/5. Vitest 1448/1448. Typecheck czysty.
- **Nieobjęte:** zaległy serwis nie dostaje push (T5 z planu, do zrobienia osobno); brak zapisu „załatwione” w Terminach (wyjaśnione: tylko odczyt).
- **Commit:** 8b6bd21, 2026-10-19.

## Push — zaległa wizyta serwisowa dostaje przypomnienie rano następnego dnia (krok T5 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** wizyta serwisowa nadal otwarta (bez „załatwione”) dostaje przypomnienie push rano dnia wizyty, jak dotąd, a jeśli nadal jest otwarta — także rano dnia następnego, z tytułem „Serwis zaległy: <budowa>”. Zamknięta wizyta nie dostaje nic. Przypomnienie z poranka dnia następnego, które już minęło, nie jest wysyłane.
- **Gdzie jest:** `src/lib/push/schedule.ts` (`studyItems`, gałąź serwisu).
- **Klucze:** zaległe przypomnienie ma klucz `v:<id>:<termin>+1`, żeby nie zostało uznane za duplikat porannego. Format klucza w `src/lib/push/shown.ts` bez zmian.
- **Jak działa:** harmonogram push jest wysyłany w całości przy każdej zmianie i co godzinę. Zamknięcie wizyty usuwa więc też jej jutrzejsze przypomnienie, bez osobnej logiki.
- **Budżet:** `schedule.ts` jest ładowany leniwie (PushScheduleSync, DailyReportNudge, client), więc nie zmienia paczki startowej. Próg wciąż czeka na decyzję (patrz krok 3).
- **Testy:** `src/lib/push/schedule.service.test.ts` (3: wizyta dziś z jutrzejszym zaległym, wizyta z wczoraj, wizyta z przedwczoraj nie wysyłana, zamknięta nie wysyłana). `src/lib/study/service.test.ts`: oczekiwania zaktualizowane do nowego zachowania. Vitest 1452/1452. E2E `push`: przechodzi; `site-service`: jeden test niestabilny pod obciążeniem (przy ponownym uruchomieniu przechodzi dwa razy).
- **Commit:** 3dd2544, 2026-10-19.

## Push — limit 200: obcinanie po czasie, strażnik, wysyłka przy chowaniu (P4 planu kalendarza, Z-18.4 audytu 2)

- **Co robi:** serwer przyjmuje do 200 pozycji harmonogramu. Przy nadmiarze odpadają **najdalsze terminy** z jednej listy posortowanej po czasie — nie cała grupa. Lista odświeża się przy otwarciu aplikacji i co godzinę, więc skutkiem jest krótszy horyzont, a nie zgubiony jutrzejszy budzik zmiany czy serwis. Koniec próby szczelności nigdy nie odpada. Tytuł każdej pozycji jest przycinany do 120 znaków z wielokropkiem (`PUSH_TITLE_MAX`, S4 audytu 2 — serwer i tak tnie po cichu, np. „Koniec zmiany: <długa nazwa>”). Zapowiedź („za 15 min”) jest planowana tylko dla 3 najbliższych wystąpień serii. W Ustawieniach → Powiadomienia: „Serwer przyjmuje do 200 przypomnień: wysłano N z M.”, a przy obcięciu: „Zaplanowane do DD.MM GG:MM; dalsze terminy (K: przypomnienia notatek (…), …) dojdą przy kolejnym otwarciu aplikacji.”
- **Alarmy systemowe (APK):** przy obciętej liście strażnik „Otwórz NOTKI…” stoi dobę przed ostatnim zachowanym terminem (nie wcześniej niż za godzinę), z treścią „Przypomnień jest więcej, niż mieści lista”.
- **Wysyłka przy chowaniu aplikacji (`keepalive`):** przeglądarki ograniczają takie żądania do 64 KB, więc wysyłany jest najdłuższy początek listy, którego treść mieści się w 60 KB. Skrót wysłanej listy nie jest wtedy zapisywany — następna zwykła wysyłka wyśle całość.
- **Gdzie jest:** `src/lib/push/schedule.ts` (`buildPushSchedulePlan` → `PushSchedulePlan`: `items`, `total`, `dropped`, `droppedBy`, `horizonEnd`; `LEADS_PER_SERIES`, `categoryOf`), `src/lib/push/client.ts` (`fitKeepalive`, `KEEPALIVE_MAX_BYTES`), `src/lib/reminders/sink.ts` (`ScheduleHorizon` w `replace`), `src/lib/reminders/nativePlan.ts` (`sentinelFor(…, horizon)`, `planNative(…, horizon)`), `src/lib/push/summary.ts` (pola `horizonEnd`, `droppedBy` w `kaczy.push.summary.v1`), `src/components/PushScheduleSync.tsx`, `src/components/settings/PushSettings.tsx` (`droppedText`).
- **Ograniczenia:** podsumowanie jest lokalne dla urządzenia i pojawia się po pierwszym wysłaniu. W PWA strażnika nie ma — seria kończy się po 14 dniach bez otwarcia aplikacji; komunikat z serwera push czeka na decyzję D-A2. Serwer (`push-server/core.js`) tnie na 200 w kolejności otrzymania, co przy liście po czasie daje ten sam wynik.
- **Testy:** `src/lib/push/schedule.test.ts` („długa nazwa zmiany: tytuł przycięty…”), `src/lib/push/schedule.limit.test.ts` (w limicie nic nie odpada; odpada najdalsza; serwis wygrywa z dalszą notatką; 10 serii dziennych z zapowiedzią i budzik zmiany; próba szczelności poza limitem; strażnik przy obcięciu i nie wcześniej niż za godzinę; 200 długich pozycji ≤ 60 KB), `src/lib/push/summary.test.ts`.
- **Commit:** a00bb21 (2026-10-19), Z-18.4 — 2026-11-17, przycinanie tytułów (Z-18.5) — `6a3e9efb` (2026-11-26).

## Terminy — „Przegapione” dla zaległych starszych niż godzina (P5 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** w widoku Terminy i na liście Dziś zaległe przypomnienia starsze niż godzina trafiają do osobnej grupy „Przegapione”. Zaległe z ostatniej godziny zostają w „Zaległe”. Powód: serwer push odrzuca spóźnienie powyżej godziny, więc takich przypomnień już nie dośle.
- **Co się nie zmieniło:** w aplikacji przypomnienie dalej odpala się, gdy jest otwarta; licznik w pasku bocznym i znaczku liczy obie grupy razem.
- **Gdzie jest:** `src/lib/reminderAgenda.ts` (`MISSED_AFTER_MS`, grupa `missed` w `groupReminders`), `src/components/review/TodayDueList.tsx` (grupa na liście Dziś, ton alarmowy), `src/pages/Index.tsx` (ton nagłówka grupy w Terminach).
- **Testy:** `src/lib/reminderAgenda.test.ts` (nowy: granica godziny; oczekiwania zmienione na „Przegapione”), `src/components/review/TodayDueList.test.tsx` (zaktualizowane), `e2e/reminder-toast.spec.ts` (akceptuje obie nazwy grupy). E2E `reminders-agenda`, `today-study`, `reminder-toast`: 9/9 po zmianach. Vitest 1458/1458. Budżet: w progu.
- **Commit:** 62eb749, 2026-10-19.

## Terminy — prognoza serii w „Najbliższe 7 dni” (T2 planu kalendarza/przypomnień, 2026-10-19)

- **Co robi:** w widoku Terminy, pod grupami, jest blok „Prognoza serii (najbliższe 7 dni)” — jeden wiersz na powtarzalne przypomnienie z liczbą jego kolejnych wystąpień w tym tygodniu, np. „+4 wystąpienia (prognoza)”. Wiersze są tylko do odczytu.
- **Gdzie jest:** `src/lib/reminderForecast.ts` (`weekSeriesForecasts`, typ `SeriesForecast`), `src/components/calendar/SeriesForecastSection.tsx` (sekcja, ładowana leniwie z `Index.tsx`), `src/components/calendar/SeriesForecastRows.tsx` (`SeriesForecastRows`), `src/pages/Index.tsx` (`SeriesForecastSection` po grupach w widoku `reminders`).
- **Jak działa:** zapisany jest tylko najbliższy termin, więc kolejne wystąpienia liczy `expandOccurrences` (`src/lib/reminderOccurrences.ts`) w oknie od końca dziś +1 ms do końca dnia +7 — ten sam przedział co grupa „Najbliższe 7 dni”. Liczone są wyłącznie wystąpienia z `isSeries && !isNext`, czyli te, których nie ma w danych. Kosz jest pomijany, archiwum nie. Kolejność wierszy: wg pierwszego wystąpienia w oknie.
- **Paczka:** pierwsza wersja trzymała `weekSeriesForecasts` w `reminderAgenda.ts`, co wciągało rozwijanie wystąpień do paczki startowej (przekroczenie budżetu o ok. 0,6 KB). Przeniesione do `reminderForecast.ts`, a sekcja jest leniwa.
- **Decyzja:** blok stoi pod grupami, a nie w grupie „Najbliższe 7 dni”. Seria zaległa (zapisany termin w „Zaległe”), która ma wystąpienia w tym tygodniu, nie trafia do żadnej grupy „Najbliższe 7 dni”, więc wiersz w grupie by zniknął, gdyby tej grupy nie było.
- **Ograniczenie:** `now` w memo to czas ostatniego przeliczenia (zależności: widok i lista notatek); otwarty widok przez północ może pokazać prognozę o dzień starą, do najbliższej zmiany listy. Prognoza nie ma akcji (edycja tylko dla zapisanego terminu).
- **Testy:** `src/lib/reminderAgenda.test.ts` (`weekSeriesForecasts`: zaległa seria 7 wystąpień, seria od jutra 6, jednorazowe pominięte, seria poza oknem i kosz). Vitest 1489/1489 po wszystkich krokach.
- **Commit:** 392f197, 2026-10-19.

## Przypomnienia — akcje na terminie w Dziś i Kalendarzu (Fala 5, pkt 1, 2026-10-22)

- **Co robi:** „Gotowe”, „Jutro rano” i „+1 h” przy terminie działają tak samo na kaflu notatki, na liście Dziś (zaległe i dziś) i w panelu wybranego dnia w Kalendarzu. Cofnięcie w toaście. W Kalendarzu akcje są tylko przy aktualnym terminie notatki, żeby nie odłożyć innego wystąpienia serii.
- **Gdzie:** `src/lib/reminderActions.ts` (czyste funkcje: `doneReminderUpdate`, `snoozeReminderUpdate`, `reminderFields`); `src/components/ReminderQuickActions.tsx` (przyciski, toast, fokus po usunięciu wiersza); użycie w `NoteCardBody.tsx`, `review/TodayDueList.tsx` (prop `onUpdate` z `Index.tsx`), `calendar/DayPanel.tsx` (`noteOf`, `onUpdateNote`; z `ReminderCalendarView.tsx`).
- **Testy:** `src/lib/reminderActions.test.ts`; `e2e/dzis-terminy.spec.ts` (Dziś: „Jutro rano” zdejmuje zaległy termin z listy; Kalendarz: „Za godzinę” w panelu). Regresja przypomnień: `reminders-phase2`, `weekly-review`, `reminders-calendar`, `reminder-toast` 25/25.
- **Uwaga:** `e2e/composer.spec.ts` „przypomnienie z paska” nie przechodzi także na czystym HEAD (zduplikowany przycisk „Usuń przypomnienie”) — problem sprzed tej zmiany.

## Terminy — powtarzanie 3.1, terminy względem grafiku, zgodność (T-1, T-2, 2026-10-26)

- **Co robi:** w pickerze terminu (`ReminderPicker.tsx`) i w szybkim dodawaniu w kalendarzu (`ReminderQuickAddDialog.tsx`) jest dziewięć rodzajów powtarzania: nigdy, codziennie, co tydzień, co miesiąc, dni robocze (pn–pt), co 2 tygodnie, co rok, wybrane dni tygodnia (przyciski Pn–Nd), co N dni (pole liczby, 1–366). Pickery pokazują to samo (`RepeatRuleFields.tsx`).
- **Terminy względem grafiku (T-2):** w pickerze, gdy są dane grafiku, dwie dodatkowe pozycje: „Po dzisiejszej zmianie” (koniec dzisiejszej zmiany) i „30 min przed jutrzejszą zmianą”. To zwykłe terminy zapisane w chwili wyboru; późniejsza zmiana grafiku ich nie przesuwa (decyzja T-2: bez powiązania). Liczenie w `src/lib/reminderShiftPresets.ts` (`shiftPresets`, na `currentAndNextShift`).
- **Zgodność starszych wersji (T-1):** nowa reguła zapisuje się w `reminderSpec` jako `reminderRule`, a zapasowo w `reminderRepeat` jako najbliższy znany rodzaj (`FALLBACK_REPEAT`: dni robocze → codziennie, co 2 tygodnie → co tydzień, co rok → co miesiąc, wybrane dni → co tydzień, co N dni → codziennie). Starsza wersja, która nie zna `reminderRule`, przypomina więc częściej, ale nie gubi terminu. Przed wdrożeniem nowych rodzajów zaktualizować wszystkie urządzenia.
- **Gdzie:** `src/lib/reminderRepeat.ts` (typy `RepeatKind`, `RepeatRule`, `getNextReminderTime` z gałęziami nowych rodzajów, `ruleOf`, `repeatUpdate`, helpery wyboru `changeRepeatKind`, `toggleWeekday`, `clampEvery`); `src/lib/reminderSpec.ts` (`readRule`, `mergeSpec` ustawia zapasowy rodzaj i zdejmuje regułę przy ręcznym wyborze starego rodzaju); `src/lib/yjsStore.ts` (zapis i odczyt `reminderRule`); `src/lib/icsExport.ts` (`rruleFor`: `BYDAY`, `INTERVAL`); listy: `ReminderListGroups.tsx`, `ReminderChip.tsx`, `DayPanel.tsx` (etykiety z reguły).
- **Ograniczenia:** w `.ics` „co rok” to zwykłe `FREQ=YEARLY`, więc 29 lutego w roku bez tego dnia wypada 1 marca, a aplikacja liczy 28 lutego. Pusty wybór dni tygodnia nie jest możliwy (ostatniego dnia nie da się odznaczyć). Notatka prywatna nie zmienia zasad powtarzania.
- **Testy:** `src/lib/reminderRules.test.ts` (nowe rodzaje, pierwszeństwo reguły, walidacja i scalanie, helpery pickera), `src/lib/reminderShiftPresets.test.ts` (T-2), `src/lib/icsExport.test.ts` (RRULE dla nowych rodzajów). Istniejące `reminderRepeat`, `reminderSpec`, `reminderOccurrences`, `push/schedule`, `reminderDue` przechodzą bez zmian.
- **Commit:** niezacommitowane (do commita po zielonym e2e).

## Terminy — plan 1.1, 1.3, 1.4 (2026-10-26)

- **1.1 Grupy przeliczają się z czasem.** `useNextBoundary(notes)` (`src/hooks/useNextBoundary.ts`) budzi się na najbliższej granicy: termin notatki, koniec dnia terminu całodziennego albo północ, i podbija licznik. Widok Terminów (`Index.tsx`, `reminderGroups`) i kafel Dziś (`TodayDueList.tsx`) przeliczają grupy na tę chwilę, bez zmiany notatek. Testy: `src/hooks/useNextBoundary.test.ts` (czyste `nextBoundary`, z przesuniętym czasem). Nie ma e2e na zegarze.
- **1.3 Parser dat** (`src/lib/parseNaturalDate.ts`). Obsługuje: `12.11`, `12/11`, `12.11.2026`, `12 listopada`, `2026-11-12`, dzień tygodnia z „w/we” (`w piątek`, `we środę`), „w przyszły poniedziałek” (poniedziałek następnego tygodnia kalendarzowego), pory dnia („rano” 9, „po południu” 15, „wieczorem” 18) samodzielnie i po dacie, „za godzinę”, „o 15”. Data wyjmowana z tekstu przed szukaniem godziny, więc „12” z „12.11” nie jest godziną; godzina tylko z dwukropkiem albo sama liczba. Nieistniejący dzień (31.02) i miesiąc spoza 1–12 dają `null`; „15.30” też (to nie data). Data bez roku to najbliższe wystąpienie w przyszłości. Tabela przypadków: `src/lib/parseNaturalDate.test.ts`.
- **1.4 `seriesDay` po odłożeniu.** Dzień serii to `reminderDay`, a bez niego dzień `reminderBase ?? reminder`. Odłożone wystąpienie nie przesuwa dnia serii. Test: `src/lib/reminderRepeat.test.ts`.
- **1.5 Akcja z powiadomienia na prywatnej notatce.** „Odłóż 10 min” i „Gotowe” nie są już blokowane przez `note.locked` w `useReminderNotifications.ts` (`applyActionRef`). Zmieniają tylko pola terminu, a te są w jawnej projekcji, więc skarbiec nie musi być odblokowany. Dymek „Odblokuj skarbiec” nie jest potrzebny. Automatycznego testu brak (obsługa przycisku SW), sprawdzone e2e skarbca i przypomnień.
- **1.6 „W archiwum” po terminie.** Sekcja archiwum w Terminach (`Index.tsx`, `archivedRows`) idzie przez `sortArchivedByReminder` (`reminderAgenda.ts`): z terminem rosnąco, bez terminu na końcu. Test: `reminderAgenda.test.ts`.
- **1.2 DST w serii:** zrobione, patrz sekcja „godzina serii przez zmianę czasu” niżej.

## Dymek przypomnienia — menu „Odłóż” (T-4, 2026-10-26)

- **Co robi:** w dymku, który wypadł przypomnienie (`ReminderDueToast.tsx`), menu „Odłóż” ma: „Za 10 minut”, „Za godzinę”, „Wieczorem (18:00)” (tylko do 17:30, potem pozycji nie ma), „Jutro rano (9:00)”. Gotowe i Otwórz bez zmian.
- **Gdzie:** `src/components/useReminderNotifications.ts` (`onSnoozeHour`, `onSnoozeEvening`, `eveningTime(now)`); `src/lib/reminderAgenda.ts` (`eveningTime`). Odłożenie zawsze idzie przez `snoozeTarget`, więc odkłada jedno wystąpienie serii.
- **Testy:** `src/lib/reminderAgenda.test.ts` (`eveningTime`), e2e `e2e/reminder-toast.spec.ts`.
- **Nie zrobione z planu 2.1:** wspólna lista `SNOOZE_OPTIONS` dla kafla, Dziś i Kalendarza (tam dalej są osobne przyciski), menu „Wybierz…” z datą (2.2), i powiadomienie systemowe z dwoma przyciskami zostaje bez zmian.

## Terminy — godzina serii przez zmianę czasu (1.2, 2026-10-26)

- **Problem:** seria dzienna o 2:30 w dniu przeskoku (29.03) przechodziła na 3:30 i zostawała na 3:30 na zawsze, bo każdy krok liczył się z poprzedniego wystąpienia.
- **Co robi:** notatka ma pole `reminderTime` (minuty od północy, 0–1439) — kotwicę godziny serii. Kroki serii (`getNextReminderTime`, `nextInSeries`, `nextOccurrence`, `snoozeTarget`, `doneTarget`) ustawiają godzinę z kotwicy, więc po przeskoku seria wraca na 2:30. Krok przesunięty przez zmianę czasu (3:30 tego dnia) nie zmienia kotwicy: `isDstShiftedOccurrence` składa kotwicę w dniu terminu i sprawdza, czy zegar dał właśnie tę chwilę. Ręczna zmiana o równą godzinę w dniu zmiany czasu (8:00 → 9:00) jest więc nową godziną serii (do 2026-11-16 była po cichu ignorowana).
- **Kiedy kotwica się zmienia:** decyduje `anchorAfterWrite` w `reminderRepeat.ts`, wołana z `updateNote` (`useNotes.ts`). Nowy termin bez `reminderBase` ustawia kotwicę na swoją godzinę. Odłożone wystąpienie (zapis z `reminderBase`) jej nie rusza — wcześniej „Odłóż 10 min” na serii o 8:00 przestawiało całą serię na 8:10. Krok serii (podaje `reminderDay`) na notatce bez kotwicy jej nie zakłada. `addNote` z terminem zapisuje kotwicę od razu.
- **Zapis:** `reminderTime` w Yjs (`yjsStore.ts`, osobny klucz obok `reminderSpec`), schemat (`noteSchema.ts`), typ `Note`, scalanie (`mergeNotes.ts`), typ w `push/schedule.ts` (`PushNote` ma też `reminderRule`). Starsze notatki bez pola liczą godzinę z terminu bazowego, jak dotąd.
- **Strefy czasowe:** `reminder` to chwila (ms). Termin jednorazowy składa się z daty i godziny w strefie urządzenia (`composeReminderTimestamp`), więc w jednej strefie „8:00 w grudniu” ustawione w lipcu wypada o 8:00. Na urządzeniu w innej strefie ten sam termin pokazuje się i dzwoni o innej godzinie ściennej; serie liczą kolejne wystąpienia w strefie urządzenia, które robi krok. Plan i decyzja D-P1: `docs/zlecenia-fable-2026-11-15.md`, Zadanie 8.
- **Ograniczenie:** notatka bez kotwicy, której seria przeszła przez zmianę czasu przed pierwszym ręcznym ustawieniem, ma już dryf 3:30 i zostaje na nim, dopóki nie ustawi się godziny ponownie. Serie przestawione dawnym odłożeniem (np. na 8:10) też trzeba poprawić ręcznie. Zmiana terminu z kalendarza (z `reminderDay`) na notatce bez kotwicy nie zapisuje kotwicy.
- **Kalendarz (Z-8.2):** przeniesienie odłożonego wystąpienia (`moveToInstant` w `src/components/calendar/useCalendarMoves.ts`) i zapasowa gałąź „Pomiń” liczą następny termin serii z godziną serii (`previousOf(…).minutes` = `seriesMinutes(note)`). Bez niej po dniu przeskoku następny termin wychodził 3:30 zamiast 2:30 i przeniesienie na 2:45 zostawiało stary `reminderBase`.
- **Testy:** `src/lib/reminderRepeat.dst.test.ts` (strefa Europe/Warsaw, 28–30.03.2026, kotwica przy dziennej, tygodniowej i miesięcznej serii; `seriesMinutes`; `anchorAfterWrite`: odłożenie, ręczna zmiana o godzinę w dniu przeskoku, krok bez kotwicy); `src/hooks/useNotes.test.ts` — „odłożenie terminu serii (Z-8.1)”: `updateNote` z odłożeniem zostawia `reminderTime` 480, krok serii wraca na jutro 8:00, cofnięcie odłożenia przywraca stan; `src/components/calendar/useCalendarMoves.dst.test.ts` (Z-8.2, 29–30.03.2026).
- **Commit:** Z-8.1, Z-8.2 — `9fcaf10b` (2026-11-26).

## Terminy — menu „Odłóż” na kaflu i w Dziś (2.1, 2026-10-26)

- **Co robi:** przy terminie na kaflu, w Dziś i w Kalendarzu są w rzędzie „Gotowe”, „Jutro rano” i „+1 h”, a obok przycisk „⋯” z pozycjami „Za 10 minut” i „Wieczorem (18:00)” (ta druga znika po 17:30). Odłożenie zawsze dotyczy jednego wystąpienia serii i ma cofnięcie w toaście.
- **Gdzie:** `src/lib/reminderActions.ts` (`SnoozeKind` z `in10` i `evening`, `SNOOZE_MENU`, `snoozeMenuAt`, komunikaty `SNOOZE_MESSAGE`); `src/components/ReminderQuickActions.tsx` (menu „⋯”). Dymek przypomnienia ma tę samą listę (T-4).
- **Nie zrobione z 2.1:** jedna wspólna lista dla wszystkich miejsc w rzędzie (dziś każde ma swoje przyciski), powiadomienie systemowe zostaje z dwoma przyciskami.
- **Testy:** `src/lib/reminderActions.test.ts` (menu, „Za 10 minut”, „Wieczorem”); e2e istniejących przycisków terminów (57 testów zielonych).

## Terminy — „Zakończ serię” (2.4, 2026-10-26)

- **Co robi:** w menu „⋯” przy terminie serii jest „Zakończ serię”: koniec serii ustawia się na bieżącym wystąpieniu (`reminderRepeatUntil` = koniec dnia tego terminu). Termin zostaje do „Gotowe”, po którym seria nie ma następnego wystąpienia i notatka nie ma terminu. Cofnięcie w toaście.
- **Gdzie:** `src/lib/reminderActions.ts` (`endSeriesUpdate`, `ReminderFields` z `reminderRepeatUntil`); `src/components/ReminderQuickActions.tsx`.
- **Testy:** `src/lib/reminderActions.test.ts`.

## Terminy — „Odłóż do…” z datą (2.2, 2026-10-26)

- **Co robi:** w menu „⋯” przy terminie jest „Odłóż do…”. Okno przyjmuje tekst z tym samym parserem co przypomnienie („piątek 8:00”, „jutro 15”, „12.11 9:00”), pokazuje „Ustawię na: …” i nie przyjmuje pustego tekstu, daty w przeszłości ani nierozpoznanej. Zapis odkłada jedno wystąpienie serii i ma cofnięcie w toaście.
- **Ograniczenie serii:** odłożenie po następnym wystąpieniu serii zostaje zastąpione tym wystąpieniem (reguła `snoozeTarget`, bez zmian). Dla serii dziennej dobrze działa wybór przed następnym dniem.
- **Gdzie:** `src/components/SnoozeUntilDialog.tsx`; `src/components/ReminderQuickActions.tsx` (pozycja menu i okno); `src/lib/reminderActions.ts` (`snoozeToUpdate`).
- **Testy:** `src/lib/reminderActions.test.ts`; e2e `e2e/dzis-terminy.spec.ts` („Odłóż do…” na Dziś).

## Terminy — dymek zbiorczy (2.3, 2026-10-26)

- **Co robi:** gdy wypada co najmniej dwa przypomnienia naraz, jest jeden dymek. Przycisk „Odłóż wszystkie o godzinę” odkłada każde wystąpienie o godzinę (`snoozeTarget`, po jednym na notatkę). Jedno „Cofnij” w osobnym dymku przywraca wszystkie terminy. „Zobacz” jest drugim przyciskiem dymku (prowadzi do Terminów).
- **Gdzie:** `src/components/useReminderNotifications.ts` (gałąź `grouped`); cofnięcie przez `firedCbRef` z zapisanymi polami z `reminderFields`.
- **Testy:** `e2e/reminder-toast.spec.ts` (zbiorczy dymek, odłożenie i cofnięcie).

## Terminy — lista zamiast kafli (2.6, T-3, 2026-10-26)

- **Co robi:** w Terminach nad grupami jest przełącznik „Kafle / Lista”. Lista pokazuje wiersze jak na Dziś: tytuł, termin w mono, odznakę serii (ikona z tekstem dla czytnika) i akcje przy terminie. Archiwum też jest w liście.
- **Domyślnie (decyzja T-3):** lista na telefonie (`useIsMobile`), kafle na komputerze. Wybór zapisuje się na tym urządzeniu (`kaczy.remindersLayout.v1`, `null` = jeszcze nie wybrano). Wybór wygrywa z domyślnym.
- **Gdzie:** `src/lib/remindersLayout.ts` (store, `effectiveRemindersLayout`); `src/components/reminders/ReminderListGroups.tsx`; `src/pages/Index.tsx` (przełącznik i warunkowy render kafli/listy).
- **Testy:** `src/lib/remindersLayout.test.ts`; e2e `e2e/reminders-layout.spec.ts` (zapamiętanie po odświeżeniu); istniejące e2e Terminów na desktopie i iPhone 14 zielone.

## Terminy — wygląd odznaki, nagłówków listy i dymka (4.2–4.4, 2026-11-02)

- **Co robi.**
  - **4.2 Odznaka terminu na kaflu:** godzina w JetBrains Mono, zaległy termin z dzwonkiem `BellRing` (w tonie `destructive-ink`), seria z `Repeat` jak dotąd, w jednej linii (`stamp-tag`).
  - **4.3 Nagłówki grup w widoku „Lista”:** kropka w kolorze stanu (czerwona — Zaległe/Przegapione, akcent — Dziś, szara — reszta), ikona grupy (Zaległe `BellRing`, Przegapione `History`, Dziś `CalendarDays`, 7 dni `CalendarRange`, Później `CalendarClock`, Archiwum, Praca) i licznik jako `stamp-tag`. W widoku kafli licznik w `stamp-tag` był już wcześniej (`NoteGroupSection`). Kolejność grup bez zmian (`groupReminders`).
  - **4.4 Dymek przypomnienia:** karta aplikacji (`bg-card`, `rounded-card`) z bursztynowym paskiem z lewej, dzwonek `BellRing` zamiast emoji ⏰, godzina w mono, przyciski 44 px na dotyku. Dźwięk i wibracja bez zmian.
- **Gdzie.** `ReminderBadge` w `src/components/ReminderPicker.tsx`, `GROUP_ICON` i `dotClass` w `src/components/reminders/ReminderListGroups.tsx`, `src/components/ReminderDueToast.tsx`.
- **Przy okazji:** powiadomienie o prywatnej notatce mówiło „Otwórz G i odblokuj skarbiec”, a push „Przypomnienie z G” — teraz „notki” (`useReminderNotifications.ts`, `lib/push/schedule.ts`).
- **Stan planu Terminów.** Zrobione wcześniej: 1.1–1.6, 2.1–2.6, 3.1, 3.3 (T-2), 4.1 (arkusz od dołu na telefonie), 3.2 (2026-11-03, sekcja niżej). Otwarte: 3.4 (termin z treści notatki), 3.5 (tylko w razie potrzeby), 4.5 (animacja odhaczenia — wymaga animowanego wyjścia wierszy).
- **Testy.** Bez nowych testów logiki (sam wygląd); `src/lib/push/schedule.test.ts` z nowym tekstem; przeszły e2e Terminów, Dziś, Kalendarza i axe oraz zrzuty `@visual` (poza znanymi chwiejnymi „praca — komputer”).
- **Commit.** `f79fca1` (2026-11-02).

## Terminy — wcześniejsze przypomnienie (3.2, 2026-11-03)

- **Co robi.** W wyborze terminu (kafel, menu kafla, pasek nowej notatki) jest wiersz **„Wcześniej: Nie / 15 min / 1 h / Dzień”**. Podgląd pod spodem dopisuje „· sygnał 1 h wcześniej”. O tej chwili aplikacja pokazuje dymek **„Za godzinę: <tytuł>”** (z godziną terminu i „Otwórz”) oraz powiadomienie systemowe. Sam termin dzwoni dalej o swojej porze, z „Gotowe” i „Odłóż”. W serii każde wystąpienie ma własny sygnał.
- **Gdzie.** `src/lib/reminderLead.ts` (`LEAD_OPTIONS`, `isLeadMinutes`, `leadAt`, `planLeadReminders`, `leadPhrase`, `leadShort`, `loadFiredLeads`/`saveFiredLeads`), pole w `src/lib/reminderSpec.ts` (`REMINDER_FIELDS`, `readSpec`, `mergeSpec`), `src/lib/yjsStore.ts` (zapis i projekcja), `Note.reminderLead` w `src/hooks/useNotes.ts`, odpalanie w `src/components/useReminderNotifications.ts`, wybór w `src/components/ReminderPicker.tsx` (props `reminderLead`, piąty argument `onSet`), wywołania w `NoteCardBody.tsx`, `NoteCardActions.tsx`, `AddNoteBar.tsx` (`ComposerExtras.reminderLead`) i `Index.tsx` (`handleComposerAdd`), push w `src/lib/push/schedule.ts` (`noteItems`) i `src/lib/push/shown.ts` (`pushKey.noteLead`), `.ics` w `src/lib/icsExport.ts`, kopia w `noteSchema.ts` i scalanie w `mergeNotes.ts`.
- **Jak działa.**
  - **Dane:** `reminderLead` (minuty, liczba całkowita 1–10 080) jest tylko w `reminderSpec`, jak `reminderAllDay` i `reminderBase`. Nie ma osobnego pola w `Y.Map`. Zmiana terminu zostawia sygnał, usunięcie terminu (`reminder: null`, także „Gotowe” na jednorazowym) go czyści (`mergeSpec`). Edycja w Kalendarzu nie podaje pola, więc sygnał zostaje.
  - **Kiedy odpala:** `planLeadReminders` wybiera notatki, dla których minęła chwila `termin − sygnał`, a termin jeszcze nie. Pomija dwa przypadki: notatkę zmienioną po chwili sygnału (`updatedAt`, z minutą zapasu `UPDATE_GRACE_MS`) i odłożone wystąpienie serii (`reminderBase`). Zapas jest dla serii: przesuwa się na następny termin kilka sekund po bieżącym, a przy sygnale równym odstępowi (codziennie + „Dzień”) to dokładnie chwila następnego sygnału. Bez zapasu sygnał miałoby tylko pierwsze wystąpienie (znalazł to przegląd kodu). Dzięki temu ustawienie terminu „za 30 min” z sygnałem „1 h” albo odłożenie o 10 minut nie daje od razu fałszywego „Za 10 min”. Aplikacja otwarta między sygnałem a terminem pokaże go z opóźnieniem.
  - **Raz na wystąpienie:** pokazane sygnały są w localStorage `kaczy.reminderLeads.v1` jako `id:termin`. Wpisy po minionych terminach usuwa `saveFiredLeads` według czasu zapisanego w kluczu, nie według listy notatek. Tuż po starcie lista jest pusta (IndexedDB się wczytuje) i wyczyściłaby zbiór, a sygnał wracałby po każdym przeładowaniu (złapał to `e2e/reminder-lead.spec.ts`). Zapis tylko przy zmianie, nie co 15 s.
  - **Powiadomienia:** systemowe ma ten sam `tag` co termin (`note.id`), więc powiadomienie terminu je zastępuje. Push dostaje osobny wpis `n:<id>:<termin>:lead` bez „Odłóż”, w kategorii „Przypomnienia notatek”. Nadal ma „Gotowe”, bo SW daje je każdemu kluczowi `n:`, a odhaczenie przed czasem ma sens. Notatka prywatna: „Za godzinę: przypomnienie z notatki prywatnej”, bez tytułu.
  - **`.ics`:** drugi `VALARM` z `TRIGGER:-PT<min>M`. Całodniowy ma `TRIGGER;VALUE=DATE-TIME` liczony od 9:00. Wydarzenie odłożonego wystąpienia (`RECURRENCE-ID`) go nie ma.
- **Przy okazji.** Chipy rozpoznanych fraz z paska nowej notatki wydzielone do `src/components/CaptureChips.tsx` (`CaptureChips`; `toggledSet` w `lib/quickCapture.ts`), pod pole Skrzynki (plan Skrzynki 2.1). Na dotyku mają 44 px wysokości.
- **Ograniczenia i zgodność.** Starsza wersja aplikacji nie zna pola. Przypomina tylko o samej porze terminu i zapisując termin przez `mergeSpec`, gubi sygnał, bo przepisuje cały `reminderSpec`. Odznaka na kaflu nie pokazuje sygnału, widać go po otwarciu wyboru terminu. Szkic paska nowej notatki nie zapamiętuje sygnału po przeładowaniu. Paczka startowa 482 688 B gzip (budżet 500 KB).
- **Testy.** Vitest: `src/lib/reminderLead.test.ts` (okno odpalania, `updatedAt`, `reminderBase`, nowy klucz dla wystąpienia, przycinanie bez listy notatek, frazy, `readSpec`, `mergeSpec`, push z odłożonym wystąpieniem, `.ics`), `src/lib/yjsStore.reminder.test.ts` (tylko w `reminderSpec`, synchronizacja, zostaje przy zmianie terminu, gaśnie z terminem). E2E: `e2e/reminder-lead.spec.ts` (dymek przed terminem bez dymku terminu, brak powtórki po przeładowaniu; wybór „1 h” w pickerze zapisuje się i wraca).
- **Commit.** `b1beade` (2026-11-03).

## Terminy — „Nowy termin” z kalendarzem dnia i godziny (2026-10-27)

### Co robi
- W widoku Terminy, w nagłówku obok przełącznika „Kafle / Lista”, jest przycisk **„Nowy termin”**. Otwiera dialog z tytułem, polem **Dzień** (kalendarz przeglądarki), **Godziną**, „Cały dzień”, powtarzaniem i „Do kiedy”. Zapis tworzy notatkę z terminem albo przypina termin do istniejącej notatki.
- Dialog jest ten sam co w Kalendarzu. Różnica: pole **Dzień** działa też przy nowym terminie (wcześniej tylko przy edycji), bo w Terminach nie ma siatki dni, z której można by wziąć dzień.

### Gdzie jest
- `src/components/reminders/NewReminderButton.tsx` — przycisk i dialog, `default export`, ładowany leniwie w `src/pages/Index.tsx` (`NewReminderButton`, `Suspense` w nagłówku Terminów).
- `src/components/calendar/ReminderQuickAddDialog.tsx` — pole „Dzień” bez warunku `isEdit`; `onClearReminder` i `onSkipOccurrence` są opcjonalne (używane tylko w edycji).
- `src/pages/Index.tsx` — `createReminderNote` i `attachReminder` (wspólne dla Terminów; Kalendarz nadal ma równoważne wywołania w `ReminderCalendarView`).

### Jak działa
- Dzień startowy to dzisiaj, liczony przy każdym otwarciu (po północy nie zostaje wczorajszy).
- Pole Dzień i język naturalny w polu tekstowym działają razem: ręczna zmiana dnia (`dayOverride`) wygrywa, a wpisanie tekstu go resetuje.
- Zapis: `createReminderNote` tworzy notatkę przez `addNote`, a serię i „Cały dzień” dokłada patchem `updateNote` (jak w Kalendarzu). Przypięcie do istniejącej notatki idzie przez `attachReminder`.

### Ograniczenia i pułapki
- Pole daty to natywny `<input type="date">`, nie kalendarz z design systemu (LazyCalendar z pickera). Kalendarz pokazuje przeglądarka/system; na telefonie to natywny wybór daty.
- Lista „albo przypnij do istniejącej” bierze notatki z `reminderNotes` (także z archiwum), tak jak Kalendarz.

### Testy
- `e2e/reminders-new-term.spec.ts` — przycisk → dzień i godzina z pól → notatka z terminem na liście (chromium).
- Przeszły też istniejące testy Kalendarza i Terminów: `e2e/reminders-calendar`, `reminders-agenda`, `reminders-layout`, `quick-reminder-enter`, `calendar-phase1`, `reminders-phase2` (19/19 + 1 pominięty, `@mobile`) oraz `vitest` w `src/components/calendar` i `src/components/reminders` (10/10).
- Typecheck czysty; lint bez błędów (jedno ostrzeżenie w `Index.tsx:378`, sprzed zmiany).

### Commit
- `de668e6` (2026-10-27).

## Terminy — termin z treści jako podpowiedź (Terminy 3.4, Plan-nowy 2.5, 2026-11-05)

- **Co robi:** gdy w treści edytowanej notatki jest termin („odbiór w piątek o 10”), a notatka nie ma jeszcze przypomnienia, pod treścią pojawia się podpowiedź z rozpoznaną frazą i datą. Przycisk „Ustaw przypomnienie” ustawia termin (z „Cofnij”), a „×” chowa podpowiedź dla tej frazy. Nic nie ustawia się samo.
- **Gdzie:** `src/lib/dateInText.ts` (`findDateInText`), `src/components/NoteEditor.tsx`.
- **Jak działa:** parser `parseNaturalDate` jest wyrozumiały (np. dowolną liczbę bierze za godzinę), więc w zwykłym tekście szukamy tylko od wyraźnych słów: „jutro”, „pojutrze”, „dziś”, dzień tygodnia, „w piątek”, „za 2 h”, „12.11”, „12 listopada”. Z każdego takiego miejsca bierzemy najkrótszą frazę, którą parser rozumie (jak szybkie dodawanie w Kalendarzu), i dokładamy godzinę zaraz po niej („o 10”, „15:30”). Samotna liczba bez „o” nie jest godziną. Liczy się pierwszy termin w przyszłości.
- **Ograniczenia:** tylko jeden (pierwszy) termin w treści; ukrycie trwa do zamknięcia edytora; brak podpowiedzi w notatce prywatnej i w koszu.
- **Testy:** `src/lib/dateInText.test.ts`, `e2e/date-hint.spec.ts`.

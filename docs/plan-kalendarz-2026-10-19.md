# Plan: Kalendarz — rozbudowa, dopracowanie, ulepszenia (2026-10-19)

Źródła: trzy agenty (mapa kodu, UX/dostępność, pokrycie testami), read-only. Odwołania `plik:linia` z dysku w stanie HEAD po fazie 2 Ustawień. Wyniki agentów nie były jeszcze ręcznie zweryfikowane w przeglądarce — oznaczone „(wnioskowane)”.

## Stan obecny (skrót)

- Widok: `src/components/calendar/ReminderCalendarView.tsx` (392 linie). Nagłówek (poprzedni/następny miesiąc, „Dziś”, eksport .ics, skróty), siatka miesiąca `MonthGrid` (role grid, roving tabindex), `WeekStrip` (tylko na sm+), panel dnia `DayPanel` (lista i oś godzin), `UpcomingDays`, dialog `ReminderQuickAddDialog` (tworzenie, dołączanie, edycja, pomiń, usuń).
- Dane: `expandOccurrences` w `lib/reminderOccurrences.ts` (rozwijanie serii, limit 400), logika serii w `lib/reminderRepeat.ts` (`nextOccurrence`, `snoozeTarget`, `doneTarget`), Praca przez `studyDayMarks` (tylko liczniki w komórkach), Grafik przez `useShifts`.
- Testy: jednostkowe tylko dla logiki (occurrences, repeat, calendarMarks, dayTimeline). Widok i dialog — tylko e2e (`e2e/reminders-calendar.spec.ts`, `day-timeline.spec.ts`, `calendar-shift-edit.spec.ts`).

## Zweryfikowane / najważniejsze problemy

**P0**
1. **Telefon nie przeniesie przypomnienia na inny dzień.** Chipy i przeciąganie tylko sm+ (`DayCell.tsx:163`). Edycja ma godzinę i powtarzanie, bez pola daty (`ReminderQuickAddDialog.tsx:207-232`); pole słowne z datą jest ukryte w edycji (`:188`). Skutek: przesunięcie = usunięcie i ponowne utworzenie, co gubi serię. *Naprawa S: pole daty w edycji zasilające istniejące nadpisanie dnia (`dayOverride`, `:70, :97`).*

**P1**
2. **Pominięcie ostatniego terminu cicho kończy serię** (`ReminderCalendarView.tsx:157` ustawia `reminder: null`), a komunikat jest ten sam co zwykłe pominięcie (`:159`). *S: osobny komunikat „Seria zakończona”.*
3. **Cele dotyku na telefonie w siatce ~38 px** przy 320 px (`DayCell.tsx:104`, wnioskowane). *S.*
4. **Znaczniki tylko kolorem na telefonie:** kropki prognozy i następnego terminu różnią się odcieniem (`DayCell.tsx:152-156`), a cała kropka jest `aria-hidden` (`:146`). Przeszłe/przyszłe rozróżnia tylko kolor (`ReminderChip.tsx:48-50`). *S: kształt (kreska/obwódka) i liczba w etykiecie komórki.*
5. **Powtarzanie nie jest ogłaszane.** Przycisk edycji ma etykietę „Edytuj termin: X” bez godziny i powtarzania (`DayPanel.tsx:179`); podpowiedź jest tylko w `title` (`ReminderChip.tsx:41`). *S.*
6. **Fokus gubi się po przesunięciu klawiaturą, pominięciu i usunięciu.** `moveToDay` zmienia wybrany dzień (`ReminderCalendarView.tsx:201`), więc fokusowany element znika. *M: przenieść fokus na pierwszy element nowego dnia lub na komórkę siatki.*
7. **Praca nie jest w widoku dnia.** Liczniki wizyt są tylko w komórce jako ikona `aria-hidden` (`DayCell.tsx:120-126`); `DayPanel` i `UpcomingDays` nie dostają danych Pracy. *S: przekazać `studyOf` do obu.*

**P2**
8. „Dziś” znika, gdy widoczny jest bieżący miesiąc, nawet gdy wybrany dzień jest gdzie indziej (`ReminderCalendarView.tsx:269`). *S.*
9. Pominięcie jest tylko w dialogu edycji (`ReminderQuickAddDialog.tsx:253-258`). *S: akcja w wierszu serii.*
10. Brak tworzenia wydarzenia całodniowego w UI, mimo że model je obsługuje (`reminderOccurrences.ts:58`, `DayTimeline.tsx:74-95`). *M.*
11. Wybór listy/osi godzin jest stanem lokalnym i resetuje się przy odmontowaniu (`DayPanel.tsx:44`). *S: zapamiętać.*
12. Historia serii nie jest widoczna — przeszłe pominięcia nie zostawiają śladu (`reminderOccurrences.ts:47-48`). *Decyzja produktowa, L.*
13. Brak widoku tygodnia na telefonie (`WeekStrip` ukryty poniżej sm, `:307`). *M.*
14. Praca tylko liczniki, bez listy zgłoszeń i dostaw w dniu. *M.*

**Zweryfikowane drobne błędy (z raportu mapy, do potwierdzenia testem)**
- **Cofnięcie zapomina bazę odłożenia:** `handleAttach` (`:143`), `moveToDay` (`:205`), `handleClear` (`:182`) cofają bez `before.base`, a `Index.tsx:800` zapisuje `reminderBase: undefined` przy każdym zapisie. Tylko `handleSkip` (`:159`) to przywraca. *S, ważne: odłożona seria po cofnięciu traci bazę.*
- **Przeliczanie serii ucina zbyt stare przypomnienia:** `expandOccurrences` liczy każdy krok od `note.reminder` wobec limitu 400, także kroki sprzed widocznego zakresu. Codzienna seria z terminem sprzed ~400 dni nie pokaże nic w bieżącym miesiącu. *M: liczyć tylko kroki w zakresie, a od bliskiego terminu startować.*
- **Pamięć widoku nie działa:** `Index.tsx:792` podaje nową tablicę przy każdym renderze, więc `byDay` przelicza się zawsze. *S: `useMemo` w Index.*
- **DST:** `composeReminderTimestamp` (`reminderTime.ts:34-47`) i `moveToDay` (`:197`) używają `new Date(y,m,d,h,min)`, co przesuwa nieistniejące godziny (np. 02:30 w dniu zmiany czasu). *M.*
- **ICS:** `UNTIL` zapisane w UTC (`icsExport.ts:94`), a `DTSTART` jako czas lokalny (`:88`). RFC 5545 wymaga zgodności typu, ścisłe importery mogą odrzucić regułę. *S.*
- **Duplikaty:** dwie różne funkcje `endOfDay` (`reminderRepeat.ts:108` i `dueTerms.ts:10`); cztery kopie markupu odznaki zmiany (`DayCell.tsx:128-138`, `DayPanel.tsx:83-93`, `UpcomingDays.tsx:58-66`, `WeekStrip.tsx:306-315`); różne etykiety „Bez tytułu” / „Notatka bez tytułu”; `_dayClockSubscriberCount` (test) w kodzie produkcyjnym (`dayClock.ts:82`).

**Brak testów (wg audytu)**
- Pominięcie ostatniego terminu i pominięcie odłożonego wystąpienia — bez testu.
- Seria miesięczna przeciągnięta z 31. — nie ma testu, czy dzień kotwicy się zachowuje (`moveToDay` nie podaje dnia).
- DST: tylko jeden przypadek (29.03, `reminderOccurrences.test.ts:115-124`); luka 02:00–02:59 i cofnięcie czasu (25.10) — bez testu.
- Przełom roku w `groupByDay`; zakres do 23:59:30.
- E2e: brak serii miesięcznej, brak znaczników Pracy, brak DST. Część testów zależy od prawdziwego zegara (`reminders-calendar.spec.ts`); Playwright nie ustawia strefy, Vitest tak (`vitest.config.ts:7`).

## Plan wykonania

**Faza 1 — szybkie poprawki (S)**
- 1a. Pole daty w edycji (telefon) — P0.
- 1b. Osobny komunikat „Seria zakończona” przy pominięciu ostatniego terminu.
- 1c. Cofnięcie zachowuje `reminderBase` (`handleAttach`, `moveToDay`, `handleClear`).
- 1d. Praca w `DayPanel` i `UpcomingDays`.
- 1e. Etykiety dostępności: godzina i powtarzanie w etykiecie edycji; kształt kropek oprócz koloru.
- 1f. „Dziś” zawsze widoczne, gdy wybrany dzień to nie dziś.
- 1g. `useMemo` dla listy przypomnień w Index.
- 1h. Cele dotyku 44 px w siatce na telefonie.

**Faza 2 — struktura (M)**
- 2a. Fokus po przesunięciu, pominięciu i usunięciu.
- 2b. Pominięcie jako akcja w wierszu serii.
- 2c. Zapamiętanie listy/osi godzin.
- 2d. Pole „Wydarzenie całodniowe” w dialogu.
- 2e. Poprawki DST (`composeReminderTimestamp`, `moveToDay`) i zgodność `UNTIL` w ICS.
- 2f. Ujednolicenie duplikatów (endOfDay, odznaka zmiany, etykiety bez tytułu).
- 2g. Ograniczenie `expandOccurrences` do zakresu widoku.

**Faza 3 — nowe możliwości (M–L)**
- 3a. Widok tygodnia na telefonie.
- 3b. Widok do druku.
- 3c. Historia serii — tylko jeśli właściciel zechce (decyzja produktowa).

**Testy (równolegle)**
- T1. Jednostkowe: pominięcie ostatniego i odłożonego (wyodrębnić z komponentu do `reminderRepeat.ts`), przesunięcie serii miesięcznej z 31., DST 02:30 i 25.10, przełom roku, zakres 23:59:30, `movedSignal` z fałszywym zegarem.
- T2. E2e: pominięcie ostatniego terminu krótkiej serii (z `page.clock.setFixedTime`); seria miesięczna z 31 stycznia; znaczniki Pracy w komórce; DST w jednym tygodniu.
- T3. Higiena e2e: stały zegar w `beforeEach` `reminders-calendar.spec.ts`; zamiana `.or(...first())` w `calendar-shift-edit.spec.ts:38` na konkretny nagłówek dialogu.

## Otwarte pytania do właściciela

1. Fokus i telefon: pole daty w edycji (P0) — zgoda?
2. Historia serii (3c): potrzebna, czy zostawiamy?
3. Widok tygodnia i druk (3a, 3b): warte nakładu przy jednym użytkowniku?

## Status 2026-10-20 (bez commita)

- ✅ Faza 1: pole „Dzień” w edycji (1a), „Seria zakończona” (1b), cofnięcie z `reminderBase` (1c), Praca w panelu dnia (1d), etykiety i kształt kropek (1e), „Dziś” zawsze, gdy wybrany dzień nie jest dziś (1f), `reminderNotes` zamiast nowej tablicy (1g). Cele dotyku 1h: wysokość 56 px ok, szerokość ~42 px przy 320 px — pełne 44 px wymaga zmiany układu.
- ✅ Faza 2: fokus po akcji (2a), pominięcie w wierszu (2b), zapamiętany widok (2c), DST (2e: `composeReminderTimestamp`, `moveToDay`, `UNTIL` w ICS), zakres serii (2g).
- ⏸ 2d (całodniowe w dialogu) — wymaga przekazania `allDay` przez `onCreateNote`. 2f (duplikaty) — nie zrobione.
- ⏸ Faza 3 (widok tygodnia na telefonie, druk, historia serii) — czeka na decyzję właściciela z planu.

## Status 2026-10-20, druga część (bez commita)

- ✅ 2d: „Cały dzień” w dialogu (flaga przez zapis, edycję, przeciąganie i cofnięcie).
- ✅ 2f (część): `endOfDay` w `dueTerms.ts` używa wspólnej funkcji. Odznaka zmiany i etykiety „Bez tytułu” zostają.
- ✅ 3a: przełącznik „Miesiąc / Tydzień” na telefonie (pasek tygodnia zamiast siatki).
- ✅ 3b: przycisk „Drukuj” — lista terminów miesiąca przez `PrintRoot`.
- ⏸ 3c (historia serii) — decyzja właściciela, nie zrobiona.

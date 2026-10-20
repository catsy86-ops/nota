# Plan: Przypomnienia (widok „Terminy”) — dopracowanie i rozbudowa (2026-10-20)

Źródła: trzy agenty tylko do odczytu (mapa kodu i ryzyka, przegląd UX/dostępności z użyciem skilli `ux-heuristics` i `design:accessibility-review`, audyt pokrycia testami) oraz istniejący plan `docs/plan-kalendarz-przypomnienia-2026-10-19.md`. Nic nie zmieniono w kodzie. Pozycje oznaczone „(wnioskowane)” nie były sprawdzone w przeglądarce ani testem. Pozycje „niepotwierdzone” nie są błędami w kodzie.

## Kolejność działów (propozycja)

Zgodnie z poleceniem: najpierw dokończyć Kalendarz, potem działy po kolei.

1. **Kalendarz** — plan `docs/plan-kalendarz-2026-10-19.md` (faza 1 zaczyna się od pola daty w edycji).
2. **Przypomnienia** (ten dokument).
3. **Dziś** — `TodayDueList`, licznik zaległych, spójność z Przypomnieniami.
4. **Praca** — terminy serwisu, zamówień i problemów (ta sama definicja „zaległe” co w pkt 2).
5. **Grafik**.
6. **Długi**.
7. **Archiwum i Kosz** — wyszukiwanie i filtry w archiwum (wynika z pkt 2).
8. **Notatki** — największy dział, na końcu.

Przed startem każdego działu: osobny plan w `docs/`, zatwierdzenie zakresu, commit fazy z hashem w `opis.md`.

## Stan obecny (skrót)

- Widok: `src/pages/Index.tsx:700-713` (lista), `src/hooks/useFilteredNotes.ts:39-41, 129-131` (agenda), `src/lib/reminderAgenda.ts:32-54` (`groupReminders`, `countOverdue`), `src/lib/dueTerms.ts:18-23` (`termStatus`).
- Akcje wiersza: `src/components/NoteCardBody.tsx:109-130` („Gotowe”, „Jutro rano”), `src/components/NoteCardActions.tsx:89-94` (pełny `ReminderPicker`).
- Dzwonienie: `src/hooks/useReminderNotifications.ts`, `src/lib/reminderDue.ts`, `src/lib/firedReminders.ts`.
- Licznik: `src/hooks/useOverdueBadge.ts` → `src/components/sidebar/sidebarItems.ts:21`.
- Terminy z Praca: `src/components/study/StudyDueRows` przez `src/lib/study/dueRows.ts`.

## Ustalenia

### P1 — ważne (naprawić najpierw)

1. **Fokus ginie po „Gotowe” i „Jutro rano”.** Po odhaczeniu notatka wypada z listy (`reminder: null`, `NoteCardBody.tsx:115-116`), a fokus wraca na początek. *Naprawa M:* przenieść fokus na następny kafel w grupie albo na nagłówek grupy (`tabIndex=-1`).
2. **„Gotowe” na serii kończy całą serię.** `NoteCardBody.tsx:116` ustawia `reminder: null` i zostawia `reminderRepeat`, a `useReminderNotifications.ts:25-27` (`markDone`) przechodzi do następnego wystąpienia przez `doneTarget`. Dwie różne ścieżki dają różny wynik. Cofnięcie (`:117`) przywraca tylko `reminder`. *(Wg raportu agenta, do potwierdzenia testem.)* *Naprawa S–M:* jedna ścieżka „Gotowe” dla wszystkich terminów, zgodna z powiadomieniem.
3. **„Jutro rano” przepisuje serię.** `NoteCardBody.tsx:128` wysyła `reminder` bez `reminderDay`; `useNotes.ts:245-246` nadpisuje dzień serii, a `reminderSpec.ts:58-59` czyści `reminderBase`. Cofnięcie (`:129`) nie przywraca `reminderDay`. *(Wg raportu agenta, do potwierdzenia.)* *Naprawa S.*
4. **Zaległość tylko kolorem.** Kafel pokazuje „wczoraj, 09:00” w kolorze `text-destructive-ink` (`ReminderPicker.tsx:193-200`); nagłówek grupy „Zaległe” jest tekstem, sam kafel już nie. *Naprawa S:* ikona i `sr-only` „Zaległe:” przy `isPast` (WCAG 1.4.1).
5. **Cel dotyku „Gotowe” i „Jutro” ~32 px** (`NoteCardBody.tsx:119, :131`, `coarse:py-2` przy `text-2xs`; wnioskowane). Projekt wymaga 44 px. *Naprawa S:* `coarse:min-h-11`.
6. **Nagłówki grup to `<p>`** (`NoteGroupSection.tsx:64`), a `section` ma tylko `aria-label`. Nawigacja po nagłówkach nie widzi grup (WCAG 1.3.1). *Naprawa S:* `<h2>` z tą samą klasą.
7. **Najczęstsza akcja jest droga dla nadchodzących terminów.** „Gotowe” jest tylko dla minionych (`NoteCardBody.tsx:109`); na dotyku akcje są za „⋯”. *Naprawa M:* „Gotowe” dla każdego terminu w widoku Terminy.
8. **Obrys fokusu znika na dotyku.** `src/index.css:1086` zdejmuje `outline` i `box-shadow` przy `data-input="touch"` także dla klawiatury (wnioskowane, zależy od ustawiania `data-input`). *Naprawa S.*
9. **Licznik i definicje „zaległe” są rozjechane.** Notatki liczą wg chwili (`dueTerms.ts:19`), serwis wg dnia (`study/service.ts:81`), zamówienia wg dnia lub +3 dni (`shortages.ts:130-135`), problemy po 3 dniach (`study/reminders.ts:44`). Licznik na pasku liczy tylko notatki (`Index.tsx:485`), a lista pokazuje też Pracę (`Index.tsx:701`). *Decyzja D1 niżej.*
10. **Archiwum na liście omija wyszukiwanie i filtry.** Lista bierze archiwum (`Index.tsx:705`), ale `useFilteredNotes.ts:113-137` ich nie filtruje, a nawigacja klawiaturą (`Index.tsx:318`) też ich nie uwzględnia. Komentarz `useOverdueBadge.ts:28` („bez archiwum”) jest nieaktualny. *Naprawa S–M.*

### P2 — porządek i dostępność

11. **Pusty stan przeczy wierszom.** „Brak przypomnień” pokazuje się, gdy `displayNotes` jest puste (`Index.tsx:835`), mimo że pod spodem są wiersze Pracy (`:701`) albo archiwum (`:705`). *Naprawa S.*
12. **Pusty stan bez akcji** (`EmptyState.tsx:34`), choć w notatkach jest skrót klawiszowy. *Naprawa S:* przycisk „Nowa notatka”.
13. **Odłożenie tylko „Jutro rano”.** `snoozeTimes().in10min` jest policzone (`reminderAgenda.ts:61`), ale karta go nie używa. *Naprawa S:* chip „+1 h”.
14. **Warunek „Gotowe” liczony przy renderze.** `reminder <= Date.now()` (`NoteCardBody.tsx:109`) nie odświeża się, gdy termin minie bez zmiany listy (`useOverdueBadge.ts:39-42`, wnioskowane). *Naprawa S:* liczyć przez `termStatus` z odświeżanym `now`.
15. **Mały tekst.** `text-2xs` 11 px (`tailwind.config.ts:97`) i `text-[11px]` w stopce (`NoteCardBody.tsx:201`). *Naprawa S:* 12 px dla terminów.
16. **Przycisk „Przypomnienie” ma tylko `title`** (`ReminderPicker.tsx:89`). *Naprawa S:* `aria-label`.
17. **Ogłoszenie po odhaczeniu** — toast z „Cofnij” (`undoToast.ts:27-45`). Czy sonner ogłasza go przez `aria-live`, do sprawdzenia (wnioskowane). *Naprawa S.*
18. **Otwieranie kafla klawiaturą** — kafel to `role="article"` (`NoteCard.tsx:200`), a otwarcie idzie przez `onClick` na `div` (`NoteCard.tsx:289`). Do sprawdzenia w przeglądarce (wnioskowane).

### P3 — drobne i porządki

19. **Duplikaty.** `endOfDay` w `reminderRepeat.ts:108` i `dueTerms.ts:10` (inne sygnatury); sortowanie terminów w `useFilteredNotes.ts:131` i `reminderAgenda.ts:34`.
20. **Brak „Pomiń” na wierszach listy** — jest tylko w kalendarzu (`ReminderCalendarView.tsx:147`).
21. **Limit push 200** (`study/push/schedule.ts:36, 234-235`): liczba jest pokazana w `PushSettings.tsx:100-102`, więc nie jest całkowicie cicha; serwer też ucina bez logu (`push-server/core.js:56`). Seria może zajmować do 60 pozycji (`schedule.ts:97`).
22. **Pole `reminder` i `reminderDay` zapisywane równolegle** (`yjsStore.ts:70, 264-266, 621-624`); odczyt preferuje spec (`:58-63`). Rozjazd możliwy tylko przy starym kliencie.
23. **Terminy Pracy nie są w liczniku** i pojawiają się dopiero po załadowaniu danych (`StudyDueRows.tsx:15-16`).

### Niepotwierdzone

- **Kaskada powtórnego odpalania zaległej serii przy otwarciu** — ryzyko teoretyczne. Deduplikację robią `handledRef` (w pamięci) i `pushKey.note` (`systemNotification.ts:29-35`). Gdy zapis przesunięcia się nie utrwali przed zamknięciem, `handledRef` znika. Do sprawdzenia testem z zegarem Playwright.
- **Terminy całodniowe** — są (`reminderSpec.ts:25`, `ReminderPicker.tsx:18-21`). Raport wstępny o ich braku był błędny.

## Plan wykonania

**Faza 1 — szybkie poprawki (S), jeden commit**
- 1a. Cel dotyku 44 px dla „Gotowe” i „Jutro” (pkt 5).
- 1b. Nagłówki grup `<h2>` (pkt 6) i `aria-label` przycisku (pkt 16).
- 1c. Zaległość przez ikonę i tekst (pkt 4); tekst 12 px (pkt 15).
- 1d. Pusty stan: uwzględnić wiersze Pracy i archiwum; przycisk „Nowa notatka” (pkt 11, 12).
- 1e. Chip „+1 h” z `in10min` (pkt 13).
- 1f. Obrys fokusu dla klawiatury (pkt 8).
- 1g. Odświeżany `now` dla „Gotowe” (pkt 14); nieaktualny komentarz w `useOverdueBadge.ts:28` (pkt 10).

**Faza 2 — zachowanie terminów (M), osobny commit**
- 2a. Jedna ścieżka „Gotowe” dla wszystkich terminów, także nadchodzących (pkt 2, 7). Wymaga decyzji D2 i D3.
- 2b. „Jutro rano” nie przepisuje `reminderDay`; cofnięcie przywraca oba pola (pkt 3).
- 2c. Fokus po akcji na następnym kaflu albo nagłówku grupy (pkt 1).
- 2d. Archiwum w wyszukiwaniu, filtrach i nawigacji klawiaturą (pkt 10). Wymaga decyzji D4.

**Faza 3 — spójność liczb (M), po decyzji D1**
- 3a. Jedna definicja „zaległe” i licznik obejmujący Pracę (pkt 9, 23).
- 3b. Duplikaty `endOfDay` i sortowania (pkt 19).

**Testy (równolegle z fazami)**
- T1. `src/hooks/useReminderNotifications.test.ts` (nowy): jednorazowe odpala się raz mimo kolejnych ticków co 15 s i zmian `notes`; seria zakończona podczas nieobecności odpala raz; `onSeriesEnded` raz. *Wysokie, M.*
- T2. `src/lib/firedReminders.test.ts`: odpalony wpis + termin zmieniony na inną godzinę w przeszłości — decyzja i test. *Wysokie, S.*
- T3. `src/lib/reminderRepeat.test.ts`: seria dzienna przez przejście na czas letni zachowuje 09:00. *Wysokie, S.*
- T4. `src/components/ReminderPicker.test.tsx` (nowy): zapis zablokowany dla godziny w przeszłości i końca serii przed startem; „Cały dzień” = 09:00. *Wysokie, M.*
- T5. `src/components/calendar/ReminderCalendarView.test.tsx` (nowy): pominięcie środkowego wystąpienia zostawia serię, ostatniego ją kończy. *Średnie, M.*
- T6. `src/hooks/useFilteredNotes.test.ts`: w widoku „reminders” sortowanie rosnące po terminie niezależnie od `sortKey`; archiwum i kosz poza listą. *Średnie, S.*
- T7. `src/lib/reminderTime.test.ts`: `composeReminderTimestamp("02:30")` w dniu zmiany czasu — nie `NaN`, bez cichego przesunięcia. *Średnie, S.*
- T8. `src/components/ReminderDueToast.test.tsx` (nowy): „Odłóż” zamyka dymek i woła właściwy callback; notatka prywatna bez treści. *Niskie–średnie, S.*
- T9. Pusta lista: `groupReminders([])`, `countOverdue([])`, `planDueReminders([])` — dołączyć do `reminderAgenda.test.ts` i `reminderDue.test.ts`. *S.*
- T10. Higiena: `reminderDue.test.ts:89` używa `Date.now()` — przejść na stały zegar. E2e `reminder-toast.spec.ts` i `notification-action.spec.ts` seedują terminy względem prawdziwego czasu — dodać `page.clock`.

## Decyzje do właściciela

- **D1. Definicja „zaległe”:** ujednolicić (np. wg chwili dla notatek i dnia dla Pracy, z liczbą w pasku obejmującą oba) czy zostawić różne i tylko opisać? *Rekomendacja: ujednolicić liczbę w pasku, a definicje per dział zostawić.*
- **D2. „Gotowe” dla nadchodzących terminów:** czy ma być widoczne od razu? *Rekomendacja: tak.*
- **D3. „Gotowe” na serii:** kończy tylko wystąpienie (jak powiadomienie) czy całą serię? *Rekomendacja: wystąpienie, zgodnie z powiadomieniem.*
- **D4. Archiwum na liście Terminów:** pokazywać je i uwzględniać w wyszukiwaniu, czy ukrywać? *Rekomendacja: pokazywać z wyszukiwaniem, ale bez liczenia w „Zaległe”.*

## Status 2026-10-20 (bez commita)

- ✅ Faza 1: punkty 1b (nagłówki `<h2>`), 1a (cele dotyku 44 px), 1c (prefiks „Zaległe:”, bez zmiany rozmiaru tekstu), 1e (chip „+1 h”), 1f (obrys fokusu), 1d (pusty stan z archiwum), 1g (komentarz `useOverdueBadge`).
- ⏸ Nie zrobione z fazy 1: 1g część „odświeżany `now`”, 2 (fokus po akcji — faza 2), 12 (przycisk w pustym stanie), 15 (12 px), 17 (ogłoszenie po odhaczeniu).
- ⏸ Fazy 2 i 3 czekają na decyzje D1–D4.

## Status 2026-10-20 — decyzje D1–D4 (bez commita)

Decyzje właściciela: D1 ujednolicić liczbę (pasek i tytuł liczą to samo co lista, z Pracą); D2 „Gotowe” od razu przy każdym terminie w Terminach; D3 „Gotowe” kończy wystąpienie; D4 archiwum pokazywane i przeszukiwane, poza „Zaległe” i licznikiem.

- ✅ 2a (Gotowe dla wszystkich, wystąpienie w serii), 2b (odłożenie nie przepisuje `reminderDay`), 2c (fokus po akcji), 2d (archiwum w wyszukiwaniu i poza grupami).
- ✅ 3a w zakresie D1 (liczba Pracy na pasku i w tytule), 3b częściowo — brak sprzątania duplikatów (`endOfDay`, sortowania).
- Szczegóły i ograniczenia w `opis.md`, sekcja „Przypomnienia — fazy 2–3 planu wg decyzji D1–D4”.

## Status 2026-10-20 — dokończenie fazy 1

- ✅ 1d (przycisk „Nowa notatka” w pustym widoku Terminy), 15 (odznaka 12 px), 1g część „odświeżany `now`” (`useReminderPassed`).
- ✅ 17 bez zmian w kodzie: sonner ma `aria-live="polite"`.
- Testy: `src/hooks/useReminderPassed.test.ts`, e2e „Nowa notatka” w `e2e/reminders-phase2.spec.ts`.
- Pozostaje z planu: 3b (duplikaty `endOfDay` i sortowania), czyli faza 3 bez sprzątania; następny dział — Dziś.

## Status 2026-10-20 — 3b zrobione

- ✅ 3b: `endOfDayOffset` (dawny `endOfDay` z `dueTerms.ts`, różnił się sygnaturą od `reminderRepeat.ts`) i wspólny komparator `byReminderAsc` w `reminderAgenda.ts`, użyty też w `useFilteredNotes.ts`.
- Testy: unit 1502 w `src/lib` i `src/hooks` zielone; e2e reminders-agenda/calendar/phase2 16/16.

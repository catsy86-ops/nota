# Plan: Kalendarz, przypomnienia i terminy (2026-10-19)

Plan przygotowany przez agenta w trybie odczytu. Kod nie był zmieniany. Liczby odnoszą się do stanu z dnia planowania.

## 1. Stan obecny (skrót)

- Notatka ma `reminder` (ms), `reminderRepeat`, `reminderDay`, `reminderRepeatUntil` (`src/hooks/useNotes.ts`). Kolejne wystąpienia serii liczy się w locie (`src/lib/reminderRepeat.ts`).
- Odpalanie w przeglądarce: `src/hooks/useReminderNotifications.ts`, sprawdzanie co 15 s, rejestr „już odpalone” (`src/lib/firedReminders.ts`).
- Push: harmonogram w `src/lib/push/schedule.ts`, serwer `push-server/core.js` (spóźnienie > 1 h odrzucane).
- Kalendarz: `src/components/calendar/ReminderCalendarView.tsx`, rozwijanie wystąpień `src/lib/reminderOccurrences.ts` (limit 400 na notatkę).
- Widok „Terminy” (`/przypomnienia`): `src/lib/reminderAgenda.ts`, tylko zapisane terminy, bez serii.
- Licznik zaległych: `countOverdue`, używany w tytule karty i znaczku aplikacji.
- Dziś: `src/components/review/TodayDueList.tsx`, bez archiwum i bez terminów z Praca.

## 2. Diagnoza i ryzyka

- **A. Kaskada powtarzalnych przypomnień.** Spóźniona seria może odpalić się wielokrotnie po otwarciu aplikacji (jeden dymek i jedno powiadomienie na każdy zaległy cykl). Wynika z kodu, nie odtworzone. Do sprawdzenia testem z zegarem Playwright.
- **B. Archiwum.** Powiadomienia i push obejmują archiwum, a licznik i Dziś je pomijają. Ta sama zaległa notatka dzwoni, ale nie liczy się w „Zaległe”.
- **C. Dwie definicje „zaległe”.** Notatki: `reminder < now`. Serwis: dzień. Problemy: ponad 3 dni. Zamówienia: ponad 3 dni od zmiany. Push liczy serwis tylko o 7:00 w dniu wizyty, więc zaległy serwis nigdy nie dostaje push.
- **D. Praca poza Terminami i Dziś.** Terminy z Praca nie mają widoku w kalendarzu ani w liczniku.
- **E. Zamówienie bez daty dostawy.** Termin to „3 dni od zamówienia”. Serwis ma dzień bez godziny.
- **F. Różne liczenie serii.** Kalendarz pokazuje serię codzienną każdego dnia, a „Najbliższe 7 dni” zna tylko jeden zapisany termin.
- **G. Dwa miejsca liczą terminy** (kalendarz i Terminy), plus licznik i Dziennik. Brak wspólnego typu „termin”.
- **H. Strefa czasowa.** Zapisany jest absolutny czas. Po zmianie strefy przypomnienie odpala się o innej godzinie lokalnej.
- **I. Brak przypomnienia „cały dzień”.** Notatka zawsze ma godzinę.
- **J. Rozjazd pól w Yjs.** `reminder` i `reminderDay` to osobne wartości LWW. Równoległa zmiana na dwóch urządzeniach może zostawić zły dzień serii miesięcznej.
- **K. Limit push 200.** Kilka serii dziennych zjada limit, a późniejsze serwisy przepadają bez sygnału w UI.
- **L. Brak testu jednostkowego dla `useReminderNotifications`** (kaskada, archiwum, deduplikacja).

## 3. Propozycje

**Kalendarz**
- K1. Widok dnia z osią godzin (M). Ryzyko: układ 320–390 px.
- K2. Kropki dla terminów Praca w kalendarzu, bez edycji (M). Ryzyko: dane Praca muszą być leniwe, żeby nie podnieść budżetu.
- K3. Dopracowanie dodawania z kalendarza: skróty klawiatury (S).

**Przypomnienia**
- P1. Zwinięcie kaskady: jeden dymek „pominięto N, ustaw na następny” i jeden wpis do systemu. Czysta funkcja `planDueReminders` z testami (S–M).
- P2. Polityka archiwum: spójnie (bez dymku i push albo z licznikiem) (S). Wymaga decyzji.
- P3. Odłożenie dla serii, przesuwające całą serię (S).
- P4. Limit push 200 z priorytetem i licznikiem „N z 200” w Ustawieniach (S).
- P5. Przepadłe przypomnienia pokazywać w Terminach jako „przegapione”, nie wysyłać (S).
- P6. Przypomnienie „cały dzień” jako nowa flaga (M–L). Wymaga zmiany schematu.

**Terminy**
- T1. Jedna definicja zaległych (S, po C1).
- T2. „Najbliższe 7 dni” z wystąpieniami serii, oznaczonymi jako prognoza (S).
- T3. Terminy z Praca w Terminach i w Dziś, tylko do odczytu, z linkiem do budowy (M).
- T4. Data dostawy przy zamówieniu (M, zmiana schematu Yjs).
- T5. Zaległy serwis dostaje jedno powiadomienie rano następnego dnia (S).

**Spójność**
- C1. Wspólny moduł `src/lib/dueTerms.ts` z typem `DueTerm` i jedną klasyfikacją dla licznika, Terminów, Dziś, Dziennika i harmonogramu push (M).
- C2. Test parzystości: ten sam zestaw danych daje te same zaległe w aplikacji i w harmonogramie push (S).
- C3. Jedna mutacja `setReminder` zamiast czterech zapisów (S–M), żeby uniknąć rozjazdu LWW.
- C4. Strefa czasowa: opis w GOTCHAS i przeliczanie przy odpaleniu (S, niski priorytet).

## 4. Fazy

- **F0 — siatka bezpieczeństwa:** P1 jako czysta funkcja i testy (kaskada, archiwum, seria, deduplikacja, przesunięcie). Gotowe: Vitest zielony, e2e `reminder-toast` i `reminders-calendar` bez zmian w wynikach, budżet bundla bez przekroczenia.
- **F1 — spójność:** C1, C2, T1, P2. Gotowe: test parzystości, Dziś i licznik zgodne, testy `push-server` zielone.
- **F2 — przypomnienia i terminy dla użytkownika:** T2, P3, P4, P5, C3. Gotowe: e2e z serią w „Najbliższe 7 dni”, e2e push z limitem, weryfikacja w Chrome przy 390 px.
- **F3 — Praca w Terminach i Dziś:** T3, T5, K2. Gotowe: e2e Praca i Dziś zielone, chunk Praca poza paczką startową.
- **F4 — dane (opcjonalnie, po decyzji):** T4, P6, K1. Wymaga zgody na zmianę schematu Yjs.

## 5. Czego nie robić

- Nie trzymać listy pominiętych wystąpień jako tablicy liczb (LWW zgubi zmiany z drugiego urządzenia).
- Nie zmieniać nazwy klucza rejestru „już odpalone” (zgubi stan u wszystkich).
- Nie dokładać Praca do eager-importów `Index.tsx` (budżet 386 KB).
- Nie zakładać, że push działa u użytkownika. Przypomnienia przy otwartej aplikacji muszą działać bez serwera.
- Nie przepisywać kalendarza od zera: `ReminderCalendarView` i `expandOccurrences` działają i mają testy.

## 6. Pytania do użytkownika

1. Czy przypomnienia z notatek w archiwum mają dzwonić i wysyłać push (dziś tak), czy działać tylko jak licznik i Dziś? Od tego zależy P2.
2. Czy termin z Praca (serwis, zamówienie) ma być osobnym rodzajem w Terminach z przyciskiem „Załatwione”, czy tylko odczyt z linkiem do budowy? Od tego zależy T3 i K2.
3. Gdy po zamknięciu aplikacji wraca kilka cykli powtarzalnego przypomnienia: jeden dymek „pominięto N, ustaw na następny” (zalecane, P1), czy każdy cykl osobno, jak dziś?

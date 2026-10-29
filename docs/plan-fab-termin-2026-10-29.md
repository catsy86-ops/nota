# Plan: przycisk „+” na telefonie, data i godzina terminu, UX i QoL (2026-10-29)

Stan sprawdzony w kodzie na dziś. Nic jeszcze nie zmieniono.

## Stan obecny

**Przycisk „+” (`src/components/BottomNav.tsx`, środkowy FAB w pasku dolnym):**
- Stuknięcie otwiera kompozytor (`onNew()`), obraca ikonę o ćwierć obrotu i wysyła haptykę.
- Przytrzymanie 420 ms otwiera arkusz „Nowa” z kaflami: Notatka, Lista zadań, Dyktuj (jeśli przeglądarka ma rozpoznawanie mowy), Zdjęcie, Rysunek.
- Podpowiedź o przytrzymaniu pokazuje się raz (`kaczy.fab.hint.v1`) jako toast.
- Na `/nauka` stuknięcie dodaje wpis z budowy, a notatkę daje dopiero przytrzymanie.

**Termin (`src/components/ReminderPicker.tsx`, `AddNoteBar.tsx`):**
- Picker to `Popover` (`max-w-74`) z szybkimi terminami, polem tekstowym (`QuickReminderInput`), kalendarzykiem, „Cały dzień”, polem godziny `type="time"`, powtarzaniem i polem „Do kiedy” (`type="date"`).
- Parser tekstu (`src/lib/parseNaturalDate.ts`) rozumie „jutro 15:00”, „za 2h”, „rano”, „12 listopada”, więc wpisywanie już działa.
- Akcja „reminder” w kompozytorze już istnieje (`ComposerAction`, `reminderOpenSignal`), ale nie ma jej w arkuszu „Nowa”.

## Problemy (UX na telefonie)

1. **FAB:** podczas przytrzymania nie widać postępu, więc gest jest niewidoczny, dopóki nie zadziała. Arkusz nie ma kafla „Z przypomnieniem”, choć akcja w kompozytorze jest. Nie pamięta, którego rodzaju używano ostatnio. Nie chowa się przy przewijaniu w dół, więc przykrywa dolną część listy.
2. **Picker terminu jako Popover:** na telefonie jest ciasny (kalendarz + 6 pól w małym okienku). Pole godziny i pole „Do kiedy” są poniżej 44 px dotyku (`text-sm`, bez `coarse:`). Brak wyraźnego wyboru „Dziś / Jutro / Pojutrze / Za tydzień”, a presety są jako mała lista bez hierarchii.
3. **Data i godzina w jednym miejscu:** nie ma jednego pola „data + godzina”, które by pokazywało, co zostanie zapisane, zanim użytkownik kliknie „Zapisz”. Kalendarz w Kalendarzu ma to już od K0.2 („Rozpoznano: …”), w kompozytorze tego nie ma.
4. **Ostatnia godzina:** każdy nowy termin zaczyna od 09:00, choć użytkownik zwykle ustawia tę samą porę.

## Plan

### Faza 1: przycisk „+” (S–M)
- **F1.1 (zrobione 2026-10-29)** Pierścień postępu wokół FAB podczas przytrzymania (SVG, 420 ms). Zwolnienie przed progiem anuluje bez śladu. Dla czytnika `aria-describedby` z opisem gestu. Przy `reduced` bez animacji, tylko zmiana koloru.
- **F1.2 (zrobione 2026-10-29)** Kafel „Z przypomnieniem” w arkuszu „Nowa” (`onNew("reminder")`, akcja już istnieje).
- **F1.3 (zrobione 2026-10-29)** Kafel ostatnio używanego rodzaju wyróżniony i na górze. Zapamiętanie w `localStorage` (`kaczy.fab.last.v1`), błąd odczytu = zwykła kolejność.
- **F1.4 (zrobione 2026-10-29)** FAB chowa się przy przewijaniu w dół i wraca przy przewijaniu w górę (z redukcją ruchu: bez animacji). Tylko na liście notatek, nie w Kalendarzu ani Grafiku.
- **F1.5 (zrobione 2026-10-29)** Kafle w arkuszu co najmniej 44 px (`coarse:min-h-11`), skróty opisane dla czytnika.

### Faza 2: data i godzina terminu (M) — F2.1–F2.5 zrobione 2026-10-29 (F2.4: podgląd pisze „· cały dzień” zamiast „cały dzień, 9:00”)
- **F2.1** Na telefonie picker otwiera się jako dolny arkusz (`Sheet`, ta sama treść co Popover), pełna szerokość, pola ≥44 px. Na komputerze zostaje Popover.
- **F2.2** Górny rząd: chipy dnia „Dziś / Jutro / Pojutrze / Za tydzień / Wybierz…”. Kalendarzyk pojawia się dopiero po „Wybierz…”. Pod spodem godzina: pole `type="time"` i chipy 08:00, 12:00, 15:00, 18:00, 20:00.
- **F2.3** Podgląd na żywo: „Zapiszę: jutro, 15:30” pod polami, z tą samą zasadą co „Rozpoznano” w Kalendarzu. Zmiana tekstu aktualizuje pola i podgląd.
- **F2.4** Przełącznik „Cały dzień” nad godziną; po jego włączeniu godzina się chowa, a podgląd mówi „cały dzień, 9:00”.
- **F2.5** Ostrzeżenia przeszłości i końca serii zostają, dostają `aria-live="polite"` i kontrast z tokenów.
- **Model danych bez zmian** (`reminder` jako znacznik czasu, `reminderAllDay`, `reminderRepeat`, `reminderRepeatUntil`). Nie dotykamy Yjs, więc nie trzeba bramki `canWriteSchema`.

### Faza 3: QoL (S) — Q1–Q4 zrobione 2026-10-29
- **Q1 (zrobione 2026-10-29: toast podaje godzinę; „Cofnij” już istniał)** Po zapisie terminu z kompozytora toast „Termin zapisany” z „Cofnij” (wzór z `useCalendarMoves`).
- **Q2 (zrobione 2026-10-29)** Domyślna godzina to ostatnio ustawiona (`kaczy.reminder.lastTime`, z rezerwą 09:00). Dla „Cały dzień” bez zmian.
- **Q3 (zrobione 2026-10-29: dodane skróty dni)** Parser: sprawdzić, że „jutro 15”, „pt 9:30” i „za 90 min” dają oczekiwany wynik, i dopisać testy tam, gdzie brakuje.
- **Q4 (zrobione 2026-10-29)** Szybkie „Dziś, za godzinę” jako pierwszy chip, gdy jest po 8:00 (tylko na telefonie, żeby nie zaśmiecać komputera).

### Faza 4: wygląd (M)
- Przed kodem wizualnym: skill `frontend-design` (reguła z pamięci), potem przegląd `refactoring-ui` i `ux-heuristics`.
- Przegląd dostępności: `design:accessibility-review` i `e2e/a11y.spec.ts` dla arkusza terminu i arkusza „Nowa”.

## Testy

- **Jednostkowe (Vitest):** `parseNaturalDate` (nowe przypadki z Q3), logika chipów dnia i godziny (`src/lib/`), kolejność kafli z `localStorage` z rezerwą.
- **E2e (Playwright, `@mobile`):** przytrzymanie FAB pokazuje postęp i otwiera arkusz; kafel „Z przypomnieniem” otwiera kompozytor z pickerem; arkusz terminu: chip „Jutro” + godzina + „Zapisz” zapisuje właściwy termin; podgląd na żywo zgadza się z zapisem.
- **Dotyk:** `e2e/touch-audit.spec.ts` (44 px) dla FAB, arkuszy i chipów.
- **Zrzuty:** `e2e/skins.spec.ts` dla dotkniętych widoków (telefon, 390 px).
- **Bundle:** `e2e/bundle.spec.ts` (próg 394 KB). Arkusz terminu zostaje w głównej paczce tylko jeśli to konieczne, inaczej leniwie.

## Decyzje (potwierdzone 2026-10-29: D1–D3 tak, D4 ostatnio użyta)

| # | Pytanie | Rekomendacja |
|---|---|---|
| D1 | Picker terminu na telefonie jako dolny arkusz zamiast Popover? | Tak (F2.1). |
| D2 | FAB chowa się przy przewijaniu w dół? | Tak, tylko na liście notatek (F1.4). |
| D3 | Kolejność kafli „Nowa”: Notatka, Z przypomnieniem, Lista, Zdjęcie, Rysunek, Dyktuj? | Tak. Ostatnio używany rodzaj wychodzi na górę (F1.3). |
| D4 | Domyślna godzina: ostatnio użyta czy zawsze 09:00? | Ostatnio użyta, z rezerwą 09:00 (Q2). |

## Kolejność wdrażania

1. Faza 1 (FAB): najmniejsze ryzyko, widoczna poprawa od razu.
2. Faza 2 (picker): największy zysk UX, dotyka `ReminderPicker`, więc z testami e2e przed i po.
3. Faza 3 (QoL) i Faza 4 (wygląd) po zatwierdzeniu wyglądu.

Każdy punkt: test, kod, `opis.md`, commit osobno.

# Plan: dopracowanie, ulepszenie, rozbudowa i upiększenie działu „Terminy” (przypomnienia) (2026-10-25)

Piąty plan z serii „dział po dziale” (po Notatkach, Skrzynce, Dziś i Kalendarzu), w tym samym układzie. Obejmuje widok Terminy (`/przypomnienia`, `view === "reminders"`), wybór terminu (`ReminderPicker`), dymki i powiadomienia, logikę serii i parser dat. Kalendarz ma osobny plan.

## Kontekst

**Co już jest zrobione** (nie powtarzamy):
- Cały termin w jednej wartości `reminderSpec` (LWW), odłożenie jednego wystąpienia serii (`reminderBase`), zaległa seria odpala się raz, „Cały dzień” (9:00), grupy Zaległe / Przegapione / Dziś / 7 dni / Później, „W archiwum”, prognoza serii, licznik zaległych z Pracą, push z limitem 200.
- `plan-dzialy-2026-10-22.md` §6 Poprawa 1: „Jutro” i „+1 h” odkładają jedno wystąpienie (`snoozeReminderUpdate` → `snoozeTarget`, `lib/reminderActions.ts`), wspólne dla kafla, Dziś i Kalendarza.
- §6 Poprawa 2: `ReminderPicker` odświeża stan przy każdym otwarciu (`openChange`, `ReminderPicker.tsx:57`).
- §6 Dopr. 4 częściowo: „X” w pickerze ma `aria-label` („Usuń przypomnienie”, „Bez końca serii”).
- Parser: „jutro o 9”, „jutro 15”, „poniedziałek 15:00”, „15:30”, „pojutrze”, „za 30 min” działają (sprawdzone 2026-10-25 na `parseNaturalDate`).

**Co zostało otwarte (sprawdzone w kodzie 2026-10-25):**

| Skąd | Punkt | Dowód |
|---|---|---|
| plan-dzialy §6 Popr. 3 | Grupy Terminów nie przeliczają się z czasem: `useMemo` zależy od `[view, others]`, więc termin, który minął, zostaje w „Dziś” do następnej zmiany notatek | `Index.tsx:331` |
| §6 Popr. 4 | Seria o godzinie z przeskoku DST (np. 2:30 w marcu) przesuwa się na stałe na 3:30: `setDate` na dacie lokalnej, bez godziny bazowej | `reminderRepeat.ts:17-37`, `push/schedule.ts` |
| §6 Popr. 5 | `seriesDay` bez `reminderDay` bierze dzień z `reminder` (przy odłożeniu to dzień odłożenia), a nie z `reminderBase` | `reminderRepeat.ts:116` |
| §6 Popr. 6 | Parser (stan 2026-10-25, „teraz” = 25.10 0:20): „12.11” → **dziś 12:11**; „o 15”, „w piątek”, „w środę”, „12 listopada”, „12.11.2026”, „2026-11-12”, „za godzinę”, „wieczorem”, „w przyszły poniedziałek” → nic; „jutro wieczorem” → jutro 9:00; „za 2 dni”, „za tydzień” → bieżąca godzina (0:20) zamiast 9:00 | `lib/parseNaturalDate.ts` |
| §6 Dopr. 1 | Różne menu odkładania: dymek ma „Za 10 minut / Jutro o 9:00”, kafel „Jutro / +1 h”, powiadomienie „Odłóż 10 min” i „Gotowe” | `ReminderDueToast.tsx:43-44`, `reminderActions.ts`, `public/sw-notifications.js:51` |
| §6 Dopr. 2 | Akcja z powiadomienia na prywatnej notatce znika bez śladu (`if (note.locked) return`) | `useReminderNotifications.ts:63` |
| §6 Dopr. 3 | Dymek zbiorczy („3 przypomnienia czekają”) ma tylko „Zobacz” | `useReminderNotifications.ts:127` |
| §6 Dopr. 4 | Dymek: emoji ⏰, przyciski `size="sm"` bez 44 px na dotyku; „W archiwum” bez sortowania po terminie | `ReminderDueToast.tsx:31,37`, `Index.tsx:332` |
| §6 Rozb. 1–4 | Powtarzanie tylko codziennie / co tydzień / co miesiąc; brak wcześniejszego przypomnienia; brak „przed zmianą / po zmianie”; brak „Odłóż do…” z datą | `reminderRepeat.ts:1`, brak w `lib/` |
| §6 Wygląd 1 | Powtarzanie w pickerze jako natywny `<select>`, cele dotyku < 44 px | `ReminderPicker.tsx:172` |
| §6 Wygląd 2–4 | Odznaka terminu na kaflu: ikona `Bell` 10 px, bez „dziś / jutro” jako stempla; Praca nad grupami (przed „Zaległe”); dymek `bg-background rounded-lg`, nie w stylu karty | `ReminderPicker.tsx:240-261`, `Index.tsx:807`, `ReminderDueToast.tsx:28` |
| opis.md | Kompozytor bez „Cały dzień”; „Nowa notatka” z pustych Terminów otwiera zwykły kompozytor, nie kompozytor z terminem; brak e2e odłożenia serii i testu na telefonie | `opis.md` (Przypomnienia — Ograniczenia) |
| nowe | Terminy to siatka pełnych kafli — przy 20 terminach dużo przewijania; Dziś ma już zwartą listę wierszy (`TodayDueList`) | `Index.tsx:812` (`renderGrid`) |
| nowe | Brak jawnego „Zakończ serię” (dziś: picker → „Bez końca” i data końca, albo usunięcie terminu) | `ReminderPicker.tsx` |

**Powiązania:**
- Dziś 1.1 / D-1 („cały dzień” zaległy od jutra) zmienia `termStatus` — wspólne dla Terminów; robić raz, w planie Dziś.
- Kalendarz 1.1 (zaległy ≠ załatwiony) i 1.6 (adres dnia) — z linku „w kalendarzu” przy terminie.
- Skrzynka 2.1 i kompozytor używają tego samego parsera (`quickCapture.ts` → `parseNaturalDate`) — poprawki parsera (1.3) działają od razu w trzech miejscach.
- Push: serwer gotowy w kodzie, wdrożenie odłożone (decyzja 2026-10-21: Web Push lokalnie). Punkty dotykające `push/schedule.ts` muszą działać w obu trybach.

**Ograniczenia:**
- **Paczka startowa** (próg 401 KB): `ReminderPicker`, odznaka i parser są w paczce startowej. Nowe rodzaje powtarzania i wcześniejsze przypomnienie — logika w `lib/` mała; picker w wersji rozbudowanej leniwy (sekcja „Więcej opcji”).
- **Dane i zgodność:** nowe rodzaje powtarzania (3.1) i wcześniejsze przypomnienie (3.2) to nowe wartości w `reminderSpec`. Starsza wersja aplikacji nie zna np. `"workdays"` — musi dostać czytelny zapasowy odpowiednik (stare pole `reminderRepeat` = najbliższy znany rodzaj). **Decyzja T-1.** Test zgodności: `reminderSpec.test.ts`, `yjsStore.reminder.test.ts`, `fullBackup.test.ts`, eksport `.ics` (`RRULE` dla nowych rodzajów).
- **Prywatność:** tytuły `locked` jako „Notatka prywatna” w dymkach, powiadomieniach, push i `.ics` (już tak jest).
- **Czas:** wszystko, co przechodzi „Dziś → Zaległe”, odświeża się bez interakcji (zegar minutowy albo `setTimeout` do najbliższej granicy, jak `useReminderPassed`), bez stałego timera co sekundę.
- **7 motywów, redukcja ruchu, WCAG 2.2 AA.** Przed zmianą wyglądu skill `frontend-design`. Kolejność w punkcie: test → kod → `opis.md` → commit.

Legenda: W = wartość (1–3), N = nakład (S/M/L).

---

## Etap 1: poprawki (najpierw)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | **Grupy przeliczają się z czasem:** hook `useNextBoundary(notes)` — `setTimeout` do najbliższego terminu albo północy (jak `useReminderPassed`), wynik w zależnościach `useMemo`. Test z przesuniętym zegarem: termin przechodzi z „Dziś” do „Zaległe” bez zmiany notatek. | `Index.tsx:331`, nowy `hooks/useNextBoundary.ts` | 3 | S |
| 1.2 | **DST w serii:** następne wystąpienie liczone z godziny bazowej (godzina i minuta z pierwszego terminu serii albo `reminderBase`), a nie z poprzedniego wystąpienia. W dniu przeskoku 2:30 → 3:00 (najbliższa istniejąca), następnego dnia znów 2:30. To samo w `push/schedule.ts`. Testy w `Europe/Warsaw` (marzec i październik). | `reminderRepeat.ts`, `push/schedule.ts` | 2 | M |
| 1.3 | **Parser dat:** „w piątek”, „w środę” (przyimek „w/we”), „12.11”, „12.11.2026”, „12/11”, ISO, „12 listopada” (dopełniacz miesięcy), „o 15” (dziś, a jeśli minęło — jutro), pory dnia („rano” 9:00, „po południu” 15:00, „wieczorem” 18:00) samodzielnie i po dacie, „za godzinę / za 3 godziny”, „w przyszły poniedziałek”. „za 2 dni”, „za tydzień” → 9:00 zamiast bieżącej godziny. „12.11” nigdy jako godzina (godzina tylko z „:”). Tabela przypadków jako test (`parseNaturalDate.test.ts`). | `lib/parseNaturalDate.ts` | 3 | M |
| 1.4 | **`seriesDay` przy odłożeniu:** `reminderDay ?? dzień(reminderBase ?? reminder)`. Test na starej notatce bez `reminderDay`. | `reminderRepeat.ts:116` | 1 | S |
| 1.5 | **Akcja z powiadomienia na prywatnej notatce:** zamiast ciszy — odłożenie i „Gotowe” działają (nie wymagają treści, tylko pól terminu z jawnej projekcji); jeśli zapis wymaga odblokowania, dymek „Odblokuj skarbiec, żeby odłożyć” z przyciskiem. | `useReminderNotifications.ts:63` | 2 | S |
| 1.6 | **„W archiwum” po terminie** (`byReminderAsc`), jak grupy. | `Index.tsx:332` | 1 | S |

## Etap 2: jedno odkładanie, szybsze ustawianie

| # | Co | W | N |
|---|----|---|---|
| 2.1 | **Jedno menu „Odłóż” wszędzie** (kafel, Dziś, Kalendarz, dymek, powiadomienie systemowe): „Za 10 min · Za godzinę · Wieczorem (18:00) · Jutro rano (9:00) · Wybierz…”. Jedna lista w `lib/reminderActions.ts` (`SNOOZE_OPTIONS`), „Wieczorem” znika po 17:30. Kafel i Dziś: dwa najczęstsze jako przyciski, reszta w „⋯”. Powiadomienie systemowe: dwa przyciski (limit systemu), „10 min” i „Jutro rano”. | 3 | M |
| 2.2 | **„Odłóż do…” z datą** (pozycja „Wybierz…” z 2.1): mały kalendarz z polem tekstowym parsera („piątek 8:00”). Dla serii odkłada jedno wystąpienie (`snoozeTarget`). | 2 | S |
| 2.3 | **Dymek zbiorczy:** „Odłóż wszystkie o godzinę” i „Zobacz” (lista w Terminach). Jedno „Cofnij” dla całości. | 1 | S |
| 2.4 | **„Zakończ serię”** w menu terminu serii: ustawia koniec na bieżące wystąpienie (po „Gotowe” notatka nie ma terminu), z „Cofnij”. | 2 | S |
| 2.5 | **Kompozytor:** „Cały dzień” w wyborze terminu paska nowej notatki; „Nowa notatka” z pustych Terminów otwiera kompozytor z otwartym polem terminu (nowa akcja `"reminder"` w `ComposerAction`, `AddNoteBar.tsx:49`). | 2 | S |
| 2.6 | **Lista zamiast siatki w Terminach** (przełącznik „Kafle / Lista”, zapamiętany): wiersz jak w `TodayDueList` — tytuł, termin w mono, odznaka serii, akcje. Domyślnie lista na telefonie. **Decyzja T-3.** | 3 | M |

## Etap 3: rozbudowa

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **Więcej powtarzania:** dni robocze (pn–pt), co 2 tygodnie, co rok, wybrane dni tygodnia, „co N dni”. Model: `reminderRepeat` rozszerzony + `reminderRepeatDays` / `reminderRepeatEvery` w `reminderSpec`; `.ics` z `BYDAY` / `INTERVAL`; push i prognoza przez `nextInSeries`. Najpierw zgodność (T-1). | 3 | L |
| 3.2 | **Wcześniejsze przypomnienie:** „15 min / 1 h / dzień wcześniej” jako drugi sygnał przed terminem (pole `reminderLead` w minutach). Odpala dymek „Za godzinę: …”, termin dalej dzwoni o swojej porze. W push osobny wpis. `.ics`: drugi `VALARM` z `TRIGGER:-PT1H`. | 2 | M |
| 3.3 | **„Przed zmianą / po zmianie”** z Grafiku: szybkie terminy w pickerze „30 min przed jutrzejszą zmianą”, „po dzisiejszej zmianie” (liczone przez `currentAndNextShift`, leniwie). Zapis to zwykły termin (bez wiązania z Grafikiem); przy zmianie grafiku nic się nie przesuwa — dymek o tym mówi. **Decyzja T-2** (zwykły termin czy powiązany). | 2 | M |
| 3.4 | **Termin z treści notatki:** w edytorze data w tekście („w piątek o 10 odbiór”) podświetlona jak podpowiedź; klik → „Ustaw przypomnienie”. Ten sam parser z 1.3, tylko podpowiedź (nic nie ustawia się samo). | 1 | M |
| 3.5 | **Historia serii** (odłożona przez właściciela w `opis.md` Kalendarza): ile razy „Gotowe” w serii, ostatnie 10 dat. Dopiero, jeśli będzie potrzeba (np. leki, odżywki). | 1 | M |

## Etap 4: wygląd (po fundamencie z planu przekrojowego)

| # | Co | W | N |
|---|----|---|---|
| 4.1 | **Picker na telefonie:** arkusz od dołu (`ResponsiveDialog`) zamiast popovera, szybkie terminy jako duże chipy, powtarzanie jako `ToggleGroup` (zamiast `<select>`), wszystkie cele 44 px. Na komputerze popover jak dziś. | 2 | M |
| 4.2 | **Odznaka terminu na kaflu:** godzina w JetBrains Mono, „dziś” / „jutro” jako `stamp-tag`, zaległy z ikoną `BellRing` w tonie `destructive-ink`, seria z `Repeat`. Wysokość jednej linii w wąskim kaflu (ograniczenie z `opis.md`). | 2 | S |
| 4.3 | **Kolejność i nagłówki grup:** Zaległe → Przegapione → Dziś → Praca → 7 dni → Później → W archiwum → Prognoza; ikona i kolorowa kropka przy każdym nagłówku, liczba jako `stamp-tag`. | 1 | S |
| 4.4 | **Dymek przypomnienia w stylu aplikacji:** `bg-card`, `rounded-card`, bursztynowy pasek z lewej (kolor stanu), ikona `BellRing` zamiast ⏰, przyciski 44 px na dotyku, wejście z dołu na telefonie. Dźwięk i wibracja bez zmian. | 1 | S |
| 4.5 | **Odhaczenie z ruchem:** „Gotowe” na wierszu/kaflu — ptaszek rysuje się, wiersz zwija wysokością, licznik grupy „pyka”. Przy redukcji ruchu bez animacji. | 1 | S |

## Etap 5: QA działu

- E2E: odłożenie serii (wystąpienie, nie seria), DST (zegar Playwright w `Europe/Warsaw`, 29.03 i 25.10), przejście „Dziś → Zaległe” bez interakcji (1.1), menu odkładania w czterech miejscach, akcja z powiadomienia (SW) na prywatnej notatce.
- Pełny przebieg e2e przypomnień (`reminder-toast`, `reminders-agenda`, `reminders-phase2`, `dzis-terminy`, `reminders-calendar`) — ostatni pełny 2026-10-20.
- Zrzuty `@visual`: Terminy (kafle, lista, pusty), picker (komputer, telefon), dymek pojedynczy i zbiorczy × 7 motywów.
- axe: Terminy, picker, dymek.
- Ręcznie na telefonie: powiadomienie z przyciskami, odłożenie z ekranu blokady, picker jako arkusz.

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| T-1 | Nowe rodzaje powtarzania (3.1): co widzi starsza wersja aplikacji na drugim urządzeniu? | Zapasowe stare pole `reminderRepeat` = najbliższy znany rodzaj (dni robocze → codziennie, co 2 tyg. → co tydzień, co rok → co miesiąc z dniem), nowa wartość w `reminderSpec`. Stara wersja przypomni częściej, ale nie zgubi terminu. Przed 3.1 zaktualizować wszystkie urządzenia. |
| T-2 | „Przed zmianą / po zmianie” (3.3): zwykły termin czy powiązany z Grafikiem (przesuwa się ze zmianą)? | Zwykły termin. Powiązanie wymaga nowego pola i obsługi w push; zysk mały, bo zmiany rzadko się przesuwają. |
| T-3 | Terminy domyślnie jako lista (2.6)? | Lista na telefonie, kafle na komputerze; przełącznik zapamiętany per urządzenie. |
| T-4 | Powiadomienie systemowe: które dwa przyciski (limit systemu)? | „Gotowe” i „Odłóż 10 min” (jak dziś), „Jutro rano” w dymku po otwarciu. |

## Kolejność wdrażania

1. Etap 1: 1.1, 1.3, 1.6, 1.4, 1.5, 1.2.
2. Etap 2: 2.1, 2.4, 2.5, 2.6 (po T-3), 2.2, 2.3.
3. Fundament z planu przekrojowego, potem Etap 4: 4.2, 4.3, 4.4, 4.1, 4.5.
4. Etap 3: 3.2, 3.1 (po T-1), 3.3 (po T-2), 3.4, 3.5 (tylko na życzenie).
5. Etap 5 na koniec (pełny przebieg e2e przypomnień przed Etapem 1 jako punkt odniesienia).

Następny plan w serii: **Grafik** (kolejność działów z `plan-dzialy-2026-10-22.md`), potem **Praca**.

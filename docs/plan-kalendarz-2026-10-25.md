# Plan: dopracowanie, ulepszenie, rozbudowa i upiększenie działu „Kalendarz” (2026-10-25)

Czwarty plan z serii „dział po dziale” (po Notatkach, Skrzynce i Dziś), w tym samym układzie.

> **Status 2026-10-27:** zrobione 1.5, 1.7, część 2.5, 2.7, 3.4, 4.1, 4.5, 4.6. Otwarte punkty przeniesione do `docs/plan-praca-kalendarz-grafik-2026-10-27.md` (Kalendarz K1–K4) — tam aktualny stan.

## Kontekst

**Co już jest zrobione** (nie powtarzamy):
- Siatka miesiąca z terminami, zmianami z Grafiku, świętami i znacznikami Pracy (kask z liczbą); panel dnia „Lista | Oś godzin” (`DayTimeline`, wybór zapamiętany); dialog terminu z językiem naturalnym, „Cały dzień”, powtarzaniem, polem „Dzień” w edycji; Ctrl+Enter; przeciąganie i Shift+←/→; pominięcie wystąpienia serii; wydruk miesiąca; eksport `.ics`; import `.ics`; edycja zmiany z kalendarza (`calendar-shift-edit`).
- `plan-dzialy-2026-10-22.md` §5 Poprawa 1: edycja odłożonego wystąpienia nie przesuwa serii (`edit.base` → `onAttachReminder`, `ReminderQuickAddDialog.tsx:160`).
- §5 Poprawa 2: „jutro 15:00 dentysta” daje godzinę 15:00 i tytuł „dentysta” (`ReminderQuickAddDialog.tsx:98-106`).
- §5 Rozbudowa 2: „Gotowe / Jutro rano / +1 h” w panelu dnia (`ReminderQuickActions`, Fala 5).
- §5 Wygląd 1: na telefonie „.ics” i „Drukuj” w menu „⋯” (Fala 4). „Dziś” w nagłówku ma 44 px na dotyku.

**Odrzucone przy sprawdzeniu:** §5 Poprawa 3 („całodniowy jako 09:00” w chipie i panelu) — godzina zawsze widoczna to świadoma decyzja `b59ec64` (`opis.md` → Przypomnienia). Zostaje; zmienia ją tylko wygląd 4.2 (kształt paska), nie tekst.

**Co zostało otwarte (sprawdzone w kodzie 2026-10-25):**

| Skąd | Punkt | Dowód |
|---|---|---|
| plan-dzialy §5 Popr. 4 | Zaległy termin w siatce wygląda jak załatwiony: szary `bg-muted` jak przeszłość | `ReminderChip.tsx:47-49` |
| §5 Popr. 5 | `.ics`: cały dzień jako 9:00–9:15 zamiast `VALUE=DATE`; odłożona seria eksportuje `DTSTART` z odłożonego terminu, nie z `reminderBase`; seria zakończona (`reminderRepeatUntil` w przeszłości) nadal eksportowana | `icsExport.ts:87-89`, `exportableReminders` |
| §5 Popr. 6 | „Cały dzień” w dialogu: etykieta z polem 16 px, bez `coarse:min-h-11` | `ReminderQuickAddDialog.tsx:227` |
| §5 Dopr. 1 | Wybór „Miesiąc / Tydzień” na telefonie nie jest zapamiętany | `ReminderCalendarView.tsx:70` (`useState`) |
| §5 Dopr. 2 | Po stuknięciu dnia panel bywa poza ekranem (brak przewinięcia na dotyku) | brak `scrollIntoView` w `calendar/` |
| §5 Dopr. 3 | Przeszłość: dialog kalendarza ostrzega i pozwala zapisać, `ReminderPicker` blokuje zapis | `ReminderQuickAddDialog.tsx:282`, `ReminderPicker.tsx:214` |
| §5 Rozb. 1 | Z kalendarza nie da się otworzyć notatki (panel dnia i dialog tylko edytują termin) | `ReminderCalendarView.tsx:60` (brak `onOpenNote` w propsach) |
| §5 Rozb. 3–5 | Brak znaczników Pracy w `WeekStrip` i `UpcomingDays`; brak filtra warstw; brak tygodnia z osią godzin | `opis.md` (Kalendarz — Ograniczenia), `WeekStrip.tsx`, `UpcomingDays.tsx` |
| §5 Wygląd 2–5 | Stany tylko kolorem; kontrast chipów (`bg-primary/12`, `border-primary/40`) w Neonie, Matrycy, Zorzy, ciemnym; brak linii „teraz” na osi; komórka na 320 px ma ~42 px | `ReminderChip.tsx:46-49`, `opis.md` |
| a11y | `e2e/a11y.spec.ts` „kalendarz — hydraulika”: kontrast przy „dziś” nie przechodzi (opisany jako niestabilny w planie Praca) | `docs/plan-praca-2026-10-24.md` (log 2026-10-25) |
| opis.md | Zmiana przez północ rysuje się na osi tylko do 24:00; przerwa bez godziny nie ma miejsca na osi | `opis.md` (Kalendarz — Ograniczenia) |
| nowe | Brak adresu do konkretnego dnia (`/kalendarz?dzien=2026-10-26`); potrzebny dla Dziś 2.2 („Jutro: …” → Kalendarz na jutrze) i push | `lib/viewRoute.ts:23` |
| opis.md | E2E Kalendarza od zmian z 2026-10-20 nieuruchamiane w całości | `opis.md` (Kalendarz — Testy) |

**Powiązania:** Dziś 2.4 osadza `DayTimeline` — poprawki osi (2.4, 4.4 tutaj) robić przed nim. Dziś 2.2 potrzebuje adresu dnia (1.6 tutaj). Fundament wyglądu z `docs/plan-ui-ux-qol-2026-10-25.md` przed Etapem 4. Plan Terminów (następny) przejmie widok Przypomnień; tu tylko widok kalendarza.

**Ograniczenia:**
- **Paczka:** Kalendarz jest leniwy (`loadCalendarView`), więc ma luz, ale nowa oś tygodnia (3.3) w osobnym chunku ładowanym na `xl`.
- **Dane:** bez nowych pól. `.ics` i adres dnia to tylko odczyt. Filtr warstw i widok to preferencje urządzenia (`localStorage`, wzór `kaczy.calendar.dayView`).
- **Model terminu:** jeden timestamp na notatkę; prognozy serii są rysunkiem. Nic w tym planie nie obiecuje edycji pojedynczego wystąpienia poza pominięciem i odłożeniem.
- **Prywatność:** notatki `locked` jako „Notatka prywatna” w chipach, panelu, wydruku i `.ics` (eksport już to robi: `titleOf`).
- **7 motywów, redukcja ruchu, WCAG 2.2 AA.** Przed zmianą wyglądu skill `frontend-design`. Kolejność w punkcie: test → kod → `opis.md` → commit.

Legenda: W = wartość (1–3), N = nakład (S/M/L).

---

## Etap 1: poprawki (S, najpierw)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | **Zaległy ≠ załatwiony:** chip po terminie, który nadal czeka, w tonie `destructive` (obwódka i tekst `destructive-ink`), z „zaległe” w `aria-label`/`title`. Kropka w komórce z tym samym rozróżnieniem. Status przez `termStatus` (jedna definicja, także po D-1 z planu Dziś). | `ReminderChip.tsx`, `DayCell.tsx` | 3 | S |
| 1.2 | **`.ics` cały dzień:** `DTSTART;VALUE=DATE:20261026` + `DTEND;VALUE=DATE` dzień później, `VALARM` `-PT0M` od 9:00 jako `TRIGGER;VALUE=DATE-TIME`. Import (`icsImport.ts`) już czyta `VALUE=DATE` — test w obie strony. | `icsExport.ts` | 2 | S |
| 1.3 | **`.ics` seria:** `DTSTART` z `reminderBase` przy odłożonym wystąpieniu (odłożone jako osobny `VEVENT` z `RECURRENCE-ID`); seria z `reminderRepeatUntil` w przeszłości pominięta w `exportableReminders`. | `icsExport.ts` | 2 | S |
| 1.4 | **„Cały dzień” 44 px na dotyku** w obu miejscach (dialog Kalendarza i `ReminderPicker`): `coarse:min-h-11`, cała etykieta klikalna. Oba mają dziś zwykły checkbox 16 px. | `ReminderQuickAddDialog.tsx:227`, `ReminderPicker.tsx:154` | 1 | S |
| 1.5 | **Przeszłość jednakowo:** dialog i `ReminderPicker` z tą samą regułą (ostrzeżenie + zapis z potwierdzeniem albo blokada). **Decyzja K-1.** | `ReminderQuickAddDialog.tsx:282`, `ReminderPicker.tsx:214` | 1 | S |
| 1.6 | **Adres dnia:** `/kalendarz?dzien=YYYY-MM-DD` otwiera miesiąc i zaznacza dzień (parametr zdjęty z adresu po odczycie, jak `?powtorka=1`). Używają: Dziś 2.2, push terminu, paleta („Kalendarz: jutro”). | `ReminderCalendarView.tsx`, `lib/viewRoute.ts` | 2 | S |
| 1.7 | **a11y „kalendarz — hydraulika”:** ustalić, czy to kontrast tokenu „dziś” w Hydraulice (wtedy poprawić token), czy niestabilność testu (wtedy czekać na stan). Zdjąć z listy „znanych wyjątków”. | `skins.css` (Hydraulika), `e2e/a11y.spec.ts` | 2 | S |

## Etap 2: codzienna praca z kalendarzem

| # | Co | W | N |
|---|----|---|---|
| 2.1 | **„Otwórz notatkę”** w panelu dnia (ikona przy terminie) i w dialogu edycji (link w stopce). Zamyka dialog, otwiera notatkę w edytorze; „Wstecz” wraca do kalendarza na ten sam dzień (adres z 1.6). Nowy prop `onOpenNote` z `Index.tsx`. | 3 | S |
| 2.2 | **Zapamiętany widok na telefonie** („Miesiąc / Tydzień”) w `localStorage`, jak `dayView`. | 2 | S |
| 2.3 | **Panel dnia na ekranie:** po stuknięciu dnia na dotyku `scrollIntoView({ block: "nearest" })` panelu (z `prefers-reduced-motion` → `behavior: "auto"`). | 2 | S |
| 2.4 | **Oś godzin bez dziur:** zmiana przez północ rysuje się do końca następnego dnia na osi tego dnia („do 06:00 jutro”), a na osi następnego dnia jako kontynuacja od 00:00. Przerwa bez godziny jako znacznik „przerwa 30 min” przy pasku. | 2 | M |
| 2.5 | **Przesuwanie miesięcy palcem** na telefonie (gest w poziomie na siatce) i klawiszami PageUp/PageDown na komputerze. Strzałki zostają. Zgodne z decyzją o gestach z planu mobile (4.1). | 1 | S |
| 2.6 | **Szybkie dodanie z komórki:** podwójne kliknięcie dnia (komputer) albo przytrzymanie (telefon) otwiera dialog terminu na ten dzień od razu, bez kroku „zaznacz dzień → +”. | 2 | S |
| 2.7 | **Podpowiedzi skrótów widoczne:** `HoverTip` z `<kbd>` przy „+”, strzałkach i „Dziś”; Kalendarz w `ShortcutsDialog` (Ctrl+Enter, Shift+←/→, PageUp/PageDown, `T` = dziś). | 1 | S |

## Etap 3: rozbudowa

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **Znaczniki Pracy wszędzie:** kask z liczbą w `WeekStrip` i `UpcomingDays` (ten sam `useStudyDayMarks`). Zdejmuje ograniczenie z `opis.md`. | 2 | S |
| 3.2 | **Filtr warstw:** chipy „Terminy · Grafik · Praca · Święta” nad siatką (włącz/wyłącz), zapamiętane. Przy wyłączonym Grafiku siatka bez kolorów zmian — czytelniejsza dla samych terminów. | 2 | M |
| 3.3 | **Tydzień z osią godzin na `xl`:** 7 kolumn × godziny, paski zmian i terminy w godzinach, linia „teraz”. Przeciąganie terminu w pionie zmienia godzinę (z „Cofnij”), w poziomie dzień. Na mniejszych ekranach bez zmian. Osobny chunk. | 2 | L |
| 3.4 | **Agenda miesiąca** jako trzeci widok („Miesiąc / Tydzień / Lista”): dni z terminami, zmianą i Pracą jedno pod drugim, bez pustych dni. Na telefonie szybsza niż siatka przy wielu terminach. Ta sama lista co wydruk (`CalendarPrintList`). | 2 | M |
| 3.5 | **Liczniki miesiąca w nagłówku:** „12 terminów · 18 zmian · 3 wizyty” (czytnik: jedno zdanie). Klik w licznik = filtr z 3.2. | 1 | S |
| 3.6 | **Subskrypcja zamiast pobierania `.ics`** (adres `webcal://` z serwera push) — tylko jeśli serwer push zostanie wdrożony. **Decyzja K-2.** | 1 | M |

## Etap 4: wygląd (po fundamencie z planu przekrojowego)

| # | Co | W | N |
|---|----|---|---|
| 4.1 | **Stany kształtem, nie tylko kolorem:** zapisany termin — pełny chip; prognoza — przerywana obwódka (jest); zaległy — czerwona krawędź z lewej (z 1.1); całodniowy — pasek na całą szerokość komórki nad chipami; kropki: kółko termin, kwadrat Praca, romb święto. Legenda pod siatką (zwijana). | 2 | S |
| 4.2 | **Kontrast chipów w motywach:** tła i obwódki chipów z tokenów z kontrolą 3:1 (`contrastTokens.test.ts` rozszerzony o `--chip-*`) zamiast `bg-primary/12` i `border-primary/40`. | 2 | S |
| 4.3 | **Komórka na telefonie:** numer dnia `text-sm` w kółku przy „dziś”, kropki wyśrodkowane pod numerem, kolor zmiany jako dolny pasek 3 px zamiast tła całej komórki (czytelniejsze przy wielu kolorach). Na 320 px komórka 44 px przez mniejsze odstępy siatki. | 2 | M |
| 4.4 | **Linia „teraz” na osi** (dzień i tydzień): bursztynowa kreska z godziną w JetBrains Mono, przesuwa się co minutę; przy otwarciu osi przewinięcie do „teraz”. | 1 | S |
| 4.5 | **Ruch:** przejście miesięcy przesunięciem w kierunku strzałki (`view-transition` z kierunkiem albo `motion`), wejście panelu dnia z komórki (`view-transition-name` na zaznaczonej komórce). Przy redukcji ruchu przenikanie. | 1 | S |
| 4.6 | **Nagłówek:** nazwa miesiąca w kroju wyświetlanym stylu, rok mniejszy i wyszarzony, gdy bieżący; „Dziś” jako pigułka akcentu tylko, gdy jesteś poza bieżącym miesiącem. | 1 | S |

## Etap 5: QA działu

- Uruchomić całe e2e Kalendarza (`reminders-calendar`, `reminders-agenda`, `day-timeline`, `calendar-phase1`, `calendar-phase2`, `calendar-shift-edit`) — od 2026-10-20 nie było pełnego przebiegu.
- Zrzuty `@visual`: miesiąc (pełny, pusty), tydzień, panel dnia (lista, oś), dialog, agenda × 7 motywów × komputer i telefon (320, 390 px).
- axe: siatka, panel, oś, dialog, filtr warstw — we wszystkich motywach (po 1.7 bez wyjątków).
- `.ics`: plik z 1.2–1.3 zaimportowany ręcznie do Google Calendar i kalendarza iOS (cały dzień, seria z odłożeniem, zakończona seria).
- Test zegara (Playwright `clock`): zaległy chip po minięciu terminu, linia „teraz”, północ z nocką na osi.

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| K-1 | Termin w przeszłości (1.5): ostrzegać i pozwolić zapisać czy blokować wszędzie? | Ostrzegać i pozwalać (jak dziś w Kalendarzu). Wpisanie zaległej sprawy „na wczoraj” ma sens; przypomnienie odezwie się od razu. `ReminderPicker` dostaje to samo. |
| K-2 | Subskrypcja kalendarza `webcal://` (3.6)? | Odłożyć, dopóki serwer push nie jest wdrożony (decyzja z 2026-10-21: Web Push lokalnie). |
| K-3 | Tydzień z osią godzin (3.3) czy agenda (3.4) najpierw? | Agenda najpierw: działa też na telefonie i reużywa listy wydruku. Oś tygodnia to L i tylko na `xl`. |

## Kolejność wdrażania

1. Etap 1: 1.1, 1.6, 1.4, 1.2, 1.3, 1.7, 1.5 (po K-1).
2. Etap 2: 2.1, 2.2, 2.3, 2.6, 2.4, 2.7, 2.5.
3. Etap 3: 3.1, 3.4, 3.2, 3.5, 3.3 (po K-3), 3.6 (po K-2).
4. Fundament z planu przekrojowego, potem Etap 4: 4.1, 4.2, 4.3, 4.4, 4.6, 4.5.
5. Etap 5 na koniec (pełny przebieg e2e można zrobić od razu, przed Etapem 1, jako punkt odniesienia).

Następny plan w serii: **Terminy** (kolejność działów z `plan-dzialy-2026-10-22.md`).

# Plan: dopracowanie, ulepszenie, rozbudowa i upiększenie działu „Grafik” (2026-10-25)

Szósty plan z serii „dział po dziale” (po Notatkach, Skrzynce, Dziś, Kalendarzu i Terminach), w tym samym układzie.

## Kontekst

**Co już jest zrobione** (nie powtarzamy):
- Rdzeń opisany w `opis.md` („Grafik — stan aktualny”): siatka i tydzień, rodzaje zmian, pędzel, przeciąganie, cykle, kopiowanie, karta „Teraz”, rachunek z normą i okresem rozliczeniowym, etat, urlop, rok, premie, wiele grafików, `.ics`, CSV, PNG, Yjs.
- `plan-dzialy-2026-10-22.md` §7 Poprawa 1 (`.ics` wielu grafików, `icsScope`), 2 („Skończyłem teraz” 4 h po końcu, `recentlyEndedShift`), 3 (start = koniec odrzucany), 5 (noc zmiany czasu 9 h w siatce, oknie i tygodniu) — Fala 1.
- §7 Rozbudowa 1 (kotwica cyklu, „Przedłuż cykl”) i 2 (dodatek nocny jako informacja, stawka 2026 z rozporządzenia) — Fala 5.
- §7 Wygląd 1 częściowo: eksporty na telefonie w menu „Udostępnij” (Fala 4).
- Ctrl+Z na widoku Grafiku cofa ostatnią zmianę (`undoShifts`, `Index.tsx:288`); nałożenie cyklu, malowanie, przeniesienie, wklejenie i kopiowanie tygodnia mają „Cofnij” w dymku.
- Jeden region `aria-live` (`a20363f`), wspólna klasa przycisków paska, tony chipów (UI partia 3).

**Co zostało otwarte (sprawdzone w kodzie 2026-10-25):**

| Skąd | Punkt | Dowód |
|---|---|---|
| plan-dzialy §7 Popr. 4 | Cykl nadpisuje urlop, L4 i notatki dni bez ostrzeżenia ani podglądu; „Cofnij” jest, ale tylko w dymku | `ShiftsView.tsx:255`, `PatternDialog.tsx` |
| §7 Popr. 6 | „Dodatek za nadgodziny” w rachunku to różnica `earnings − bonusTotal − base` — zaokrąglenia mogą dać „0,01 zł” albo rozjazd z sumą | `ShiftSummary.tsx:203` |
| §7 Popr. 7 | Stan schowka (Ctrl+C) jest w akapicie podpowiedzi, który po „Rozumiem” staje się `sr-only` — schowek niewidoczny | `ShiftsView.tsx:382,386` |
| §7 Popr. 8 | Pędzel przy zmianie rodzaju gubi `extraMin`, `offSchedule`, `inLieu` (zostawia tylko notatkę); CSV „Do” = koniec z planu, nie faktyczny (z odchyleniem); saldo urlopu w `useMemo([data, year])` nie przelicza się po północy | `yShifts.ts:116`, `timesheet.ts:34`, `ShiftSummary.tsx:54` |
| §7 Dopr. 1 | Cofanie tylko z klawiatury i z dymku — na telefonie brak przycisku „Cofnij / Ponów” | `Index.tsx:288` |
| §7 Dopr. 2 | Krótki odpoczynek tylko jako zdanie pod siatką; dni nie są przyciskami, w komórce brak znacznika | `ShiftSummary.tsx:101` |
| §7 Dopr. 3 | Cykl startuje od 1. dnia oglądanego miesiąca, nie od dziś ani od dnia po ostatnim wpisie | `ShiftsView.tsx:535` (`defaultStart`) |
| §7 Dopr. 4 | `autoFocus` w oknie rodzaju zmiany otwiera klawiaturę na telefonie | `ShiftTypeDialog.tsx:117` |
| §7 Dopr. 5–7 | Brak „(+1 dzień)” przy zmianie przez północ i ostrzeżenia > 16 h; pusty miesiąc bez akcji; pole stawki czyta „1 000” jako 1 zł (`parseFloat`), „abc” po cichu; dodatek 50% i 100% w jednej linii | `ShiftSettingsDialog.tsx:22`, `ShiftSummary.tsx:222` |
| §7 Rozb. 3–7 | Brak odbioru nadgodzin i salda, „przepracowane do dziś” i prognozy, urlopu w godzinach (system równoważny), odpoczynku tygodniowego 35 h, nakładki drugiego grafiku, zamiany zmian, kopiowania miesiąca, szacunku urlopu/L4 w zarobku | brak w `lib/shifts/` |
| §7 Wygląd 2–6 | Brak znaczników w komórce (noc, odpoczynek, praca poza grafikiem); zmiany pracy jako pełne nasycone tło w ciemnym motywie; „Razem brutto” na dole rachunku; domyślny „Dzień” `#f59e0b` = bursztyn marki; tabela roku na 390 px, numer tygodnia ISO, znacznik normy | `ShiftMonthGrid.tsx:169-170`, `model.ts:201`, `ShiftSummary.tsx:231` |
| Fala 5 | Dodatek nocny 20% nie wchodzi do zarobku (decyzja do sprawdzenia z kadrami: czy dochodzi do dodatku 100% za porę nocną) | `opis.md` (Grafik — Fala 5) |
| opis.md | Brak testu komponentu przełącznika grafików; e2e Grafiku nie uruchomione po ostatnich zmianach; obraz PNG bez testu (canvas) | `opis.md` (Grafik — Ograniczenia, Testy) |

**Powiązania:**
- Dziś 2.1 reużywa logiki `NowCard` (`useShiftNow`) — wydzielenie hooka robić tu (2.5) albo w planie Dziś, raz.
- Kalendarz 2.4 (zmiana przez północ na osi) i Terminy 3.3 („przed zmianą”) czytają z `currentAndNextShift`.
- Praca: godziny na budowach (`siteHours`) liczą się z dnia Grafiku — zmiana rachunku dnia (1.4, 3.1) ma test w `siteHours.test.ts`.
- Plan przekrojowy 3.9 (paleta w kontekście: „Dodaj zmianę dziś”, „Skończyłem teraz”) — wchodzi tu jako 2.7.

**Ograniczenia:**
- **Paczka startowa** (próg 401 KB): `lib/shifts/index.ts` (barrel) jest w paczce startowej. Nowe moduły (`overtimeBank.ts`, `weeklyRest.ts`, `forecast.ts`) importować bezpośrednio w leniwych komponentach, nie przez barrel.
- **Dane:** każdy nowy rekord (odbiór nadgodzin, zamiana) jako osobny klucz mapy Yjs grafiku (jak premie), przez `clean*` i `migrate`, z testem scalania dwóch dokumentów i kopii (`yShifts.test.ts`, `fullBackup.test.ts`). Wiele grafików: każda nowa mapa z prefiksem `id:`.
- **Prawo pracy:** rachunek to szacunek brutto, nie lista płac. Każda nowa reguła (35 h, urlop w godzinach, odbiór 1:1 / 1:1,5) z odnośnikiem do artykułu KP w komentarzu i testem na przykładzie liczbowym.
- **7 motywów, redukcja ruchu, WCAG 2.2 AA.** Przed zmianą wyglądu skill `frontend-design`. Kolejność w punkcie: test → kod → `opis.md` → commit.

Legenda: W = wartość (1–3), N = nakład (S/M/L).

---

## Etap 1: poprawki (najpierw)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | **Cykl nie zjada urlopu po cichu:** w oknie cyklu podsumowanie przed nałożeniem („zastąpi: 3 dni urlopu, 1 L4, 2 notatki”) i pole „Pomiń dni z nieobecnością i notatką” (domyślnie włączone). | `PatternDialog.tsx`, `pattern.ts` (`planPattern` → lista zastąpionych) | 3 | S |
| 1.2 | **Dodatek za nadgodziny liczony wprost:** `monthSummary` zwraca `overtimePremium` (dobowe 50/100% + okresowe) jako własną kwotę, rachunek ją pokazuje, suma = podstawa + dodatek + premie co do grosza. Test na przypadku z „0,01 zł”. | `summary.ts:341`, `ShiftSummary.tsx:203` | 2 | S |
| 1.3 | **Schowek widoczny:** „Schowek: Ranna z notatką · Wyczyść” jako osobny chip nad siatką (widoczny także po „Rozumiem”), znika po wklejeniu lub Esc. | `ShiftsView.tsx:386` | 1 | S |
| 1.4 | **Pędzel zachowuje szczegóły dnia:** przy zmianie rodzaju zostają `extraMin`, `offSchedule`, `inLieu`; własne godziny (`hours`) zdejmowane, bo należą do starego rodzaju — dymek to mówi z „Cofnij”. | `yShifts.ts:116` | 2 | S |
| 1.5 | **CSV z faktycznym końcem:** kolumna „Do” = koniec planu + odchylenie; nowa kolumna „Do (plan)”. Zgodność: kolejność kolumn opisana w `opis.md`. | `timesheet.ts:34` | 1 | S |
| 1.6 | **Saldo urlopu po północy:** `useDayClock()` w `ShiftSummary` i dzień w zależnościach `useMemo`. | `ShiftSummary.tsx:54` | 1 | S |
| 1.7 | **Kwoty bez cichych błędów:** wspólny `parseMoney` („1 000”, „1 000,50”, „1.000,50”, spacja twarda), błąd przy polu („Wpisz kwotę, np. 32,50”) zamiast zapisu `NaN` albo 1 zł. Stawka, premia, dodatek nocny. | `ShiftSettingsDialog.tsx:22`, `ShiftSummary.tsx` (`BonusPanel`) | 2 | S |
| 1.8 | **`autoFocus` tylko na komputerze** (`!IS_TOUCH`) w oknie rodzaju zmiany. | `ShiftTypeDialog.tsx:117` | 1 | S |

## Etap 2: codzienna praca z grafikiem

| # | Co | W | N |
|---|----|---|---|
| 2.1 | **Cofnij / Ponów na telefonie:** dwa przyciski w pasku pędzla (ikony 44 px), aktywne według `canUndo` / `canRedo` (`Y.UndoManager` już jest; dołożyć `redo`). Ctrl+Shift+Z ponawia. | 3 | S |
| 2.2 | **Krótki odpoczynek i doba:** znacznik ⚠ w komórce dnia z odpoczynkiem < 11 h; w podsumowaniu dni jako przyciski (otwierają dzień). Przy zmianie „22:00–06:00” etykieta „(+1 dzień)”, przy zmianie > 16 h ostrzeżenie w oknie dnia i rodzaju. | 2 | S |
| 2.3 | **Cykl od właściwego dnia:** domyślny start = dziś (w bieżącym miesiącu) albo dzień po ostatnim wpisie (w innym), z podpowiedzią „od dnia po ostatniej zmianie”. | 2 | S |
| 2.4 | **Pusty miesiąc z akcją:** „Nałóż cykl”, „Skopiuj poprzedni miesiąc” (nowe `planMonthCopy` w `move.ts`, z dopasowaniem dni tygodnia albo dat — wybór w oknie), „Przedłuż cykl” jeśli jest zapisany. | 2 | M |
| 2.5 | **Wspólny hook `useShiftNow`** (z `NowCard`): bieżąca / następna / zakończona zmiana z minutowym zegarem. Używają: `NowCard`, Dziś 2.1, widżet, trening mózgu. | 2 | S |
| 2.6 | **Zamiana zmian ⇄:** przeciągnięcie na zajęty dzień pyta „Przenieś / Skopiuj / Zamień”; zamiana jednym zapisem z „Cofnij”. | 1 | S |
| 2.7 | **Paleta w Grafiku:** „Dodaj zmianę dziś”, „Skończyłem teraz”, „Nałóż cykl”, „Pokaż dzień…”, „Obraz miesiąca”. | 1 | S |

## Etap 3: rachunek i prawo pracy

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **„Przepracowane do dziś” i prognoza:** w podsumowaniu bieżącego miesiąca dwie liczby — do dziś i na koniec miesiąca według grafiku (godziny, nadgodziny, zarobek). Pasek z znacznikiem normy (§7 Wygląd 6). | 3 | S |
| 3.2 | **Odbiór nadgodzin i saldo:** wpis dnia „odbiór nadgodzin” (rodzaj nieobecności `timeOff` albo flaga), saldo godzin w okresie: wypracowane − odebrane, z wyborem 1:1 (na wniosek pracownika) albo 1:1,5 (z inicjatywy pracodawcy, art. 151² KP). Odebrane nie wchodzą do dodatku. | 3 | M |
| 3.3 | **Urlop w godzinach (system równoważny):** dzień urlopu = godziny z grafiku tego dnia (art. 154² KP), saldo w godzinach i dniach; dziś 12-h zmiana liczy się jak 8-h dzień i zawyża saldo. Tylko przy `workSystem: "equivalent"`. | 2 | M |
| 3.4 | **Odpoczynek tygodniowy 35 h** (art. 133 KP): w każdym tygodniu sprawdzenie najdłuższej przerwy; tydzień bez 35 h jako ⚠ obok krótkiego odpoczynku. | 2 | S |
| 3.5 | **Dodatek nocny do zarobku** — tylko po decyzji G-1 (kadry). Dziś informacja przy kafelku „W nocy”. | 1 | S |
| 3.6 | **Szacunek urlopu i L4 w zarobku:** urlop wg średniej godzinowej z 3 miesięcy, L4 80% (albo 100% przy oznaczeniu) — jako osobne linie „szacunek”, wyłączalne. **Decyzja G-2.** | 1 | M |
| 3.7 | **Dodatek 50% i 100% w osobnych liniach** rachunku (z 1.2), „—” zamiast „0,00 zł” w pustych pozycjach. | 1 | S |

## Etap 4: wiele grafików i eksporty

| # | Co | W | N |
|---|----|---|---|
| 4.1 | **Nakładka drugiego grafiku:** w siatce cienki pasek koloru zmiany z wybranego innego grafiku (np. partnera), tylko do odczytu; włączana w przełączniku grafików. Pokazuje wspólne wolne dni. | 1 | M |
| 4.2 | **Kopiowanie zakresu** (dni od–do na inny początek) — rozszerzenie 2.4 i kopiowania tygodnia. | 1 | S |
| 4.3 | **Obraz miesiąca: wybór motywu** (jasny / ciemny / aktywny styl) i opcjonalnie dwa miesiące na jednym obrazie. | 1 | S |
| 4.4 | **Test przełącznika grafików** (komponent + przepinanie przez store) — zaległość z `opis.md`. | 2 | S |

## Etap 5: wygląd (po fundamencie z planu przekrojowego)

| # | Co | W | N |
|---|----|---|---|
| 5.1 | **Znaczniki w komórce:** ☾ godziny nocne, ⚠ odpoczynek (2.2), kropka „poza grafikiem” / „w zamian”, ↑/↓ nadgodziny (jest). Maks. 2 znaczniki w komórce, reszta w `aria-label`. | 2 | S |
| 5.2 | **Ciemny motyw i style:** zmiany pracy jako `color-mix` tła z obwódką w kolorze zmiany (jak nieobecności dziś), tekst przez `shiftTextOnCard`; kontrast 3:1 w teście `contrastTokens` dla palety `SHIFT_COLORS` na tle każdego stylu. | 2 | S |
| 5.3 | **Paleta domyślna:** „Dzień” z bursztynu marki na inny ciepły odcień, czerwień zarezerwowana dla świąt; zmiana tylko dla nowych grafików (istniejące kolory zostają). | 1 | S |
| 5.4 | **Rachunek: „Razem brutto” u góry** obok „Przepracowane” (duża liczba w JetBrains Mono), szczegóły rachunku i premie zwijane. | 2 | M |
| 5.5 | **Mniej nad siatką na 390 px:** przełącznik grafików jako „Grafik ▾” przy tytule widoku, przełącznik Miesiąc/Tydzień i nawigacja w jednym rzędzie (jak w poziomie, `short:`). | 2 | M |
| 5.6 | **Drobne:** numer tygodnia ISO w widoku tygodnia i jako kolumna w siatce (opcja), tabela roku z przewijaniem poziomym i przyklejoną kolumną miesiąca na 390 px, fala pieczątek przy nałożeniu cyklu (CSS, stagger, bez przy redukcji ruchu). | 1 | S |
| 5.7 | **Haptyka** przy „Skończyłem teraz” i nałożeniu cyklu (`lib/haptics.ts`, plan przekrojowy 2.8). | 1 | S |

## Etap 6: QA działu

- Pełne e2e Grafiku (`shifts`, `shifts-week`, `shifts-landscape`, `calendar-shift-edit`, `touch-targets`, `mobile-layout`) przed Etapem 1 jako punkt odniesienia i po każdym etapie.
- Rachunek: tabela przypadków (system podstawowy i równoważny, etat 1/2, okres 3 mies., noc, niedziela, święto, odbiór nadgodzin, urlop w godzinach) w `summary.test.ts` — liczby sprawdzone ręcznie z przykładami z KP.
- Zrzuty `@visual`: miesiąc (pełny, pusty), tydzień, rachunek, okna × 7 motywów × telefon pionowo i poziomo, komputer.
- axe: siatka, okna, rachunek, przełącznik grafików.
- Ręcznie na telefonie: Cofnij/Ponów, obraz miesiąca (udostępnianie), „Skończyłem teraz”.

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| G-1 | Dodatek nocny 20% (art. 151⁸) do zarobku, obok dodatku 100% za nadgodziny w porze nocnej? | Sprawdzić z kadrami. Prawnie dodatek nocny przysługuje za każdą godzinę w porze nocnej niezależnie od nadgodzin; jeśli kadry potwierdzą — dodać jako osobną linię (3.5). |
| G-2 | Szacunek wynagrodzenia za urlop i L4 (3.6)? | Tak, jako wyłączalne linie „szacunek” — bez tego miesiąc z urlopem pokazuje zaniżony zarobek. |
| G-3 | Odbiór nadgodzin (3.2): domyślny przelicznik? | 1:1 (wniosek pracownika) — najczęstszy przypadek na budowie; 1:1,5 do wyboru przy wpisie. |
| G-4 | Kopiowanie poprzedniego miesiąca (2.4): po dniach tygodnia czy po datach? | Po dniach tygodnia (pn → pn) domyślnie, bo grafiki są tygodniowe; po datach jako opcja. |

## Kolejność wdrażania

1. Pełne e2e Grafiku (punkt odniesienia).
2. Etap 1: 1.1, 1.2, 1.7, 1.4, 1.3, 1.5, 1.6, 1.8.
3. Etap 2: 2.1, 2.2, 2.3, 2.4 (po G-4), 2.5 (razem z Dziś 2.1), 2.7, 2.6.
4. Etap 3: 3.1, 3.7, 3.4, 3.2 (po G-3), 3.3, 3.5 (po G-1), 3.6 (po G-2).
5. Fundament z planu przekrojowego, potem Etap 5: 5.2, 5.1, 5.4, 5.5, 5.3, 5.6, 5.7.
6. Etap 4: 4.4, 4.2, 4.1, 4.3.
7. Etap 6 na koniec.

Następny plan w serii: **Praca** (dziennik budowy i nauka), potem pozostałe działy (Długi, Ćwiczenia, Ustawienia, powłoka) według `plan-dzialy-2026-10-22.md`.

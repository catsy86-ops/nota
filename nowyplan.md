# Nowy plan: dopracowanie, wygląd i QoL (2026-11-05)

> **Status (2026-11-05):** Etapy 0–6 zrobione (Etap 3: fc5310f, Etap 4: d495ac2, Etap 5: 12035f1, Etap 6: d09405a1). Dalej Etap 7 (QA). Otwarte: toast nad otwartym arkuszem na telefonie (4.5), okruszek Praca → budowa (5.8; karta budowy to okno), widoki poza kopią JSON i bez wyboru kolumn (6.1), `mobile-layout.spec.ts:44`. NP-5 przyjęte według rekomendacji.

## 1. Skąd ten plan

- Funkcje są prawie kompletne. Kierunek „Zeszyt” (kratka, bursztyn, długopis, Plus Jakarta Sans + JetBrains Mono, 10 stylów × 2 schematy) i główka kartki (`ViewTitle`) są już wdrożone. Największe różnice w jakości są teraz **między działami**, nie wewnątrz jednego działu. Każdy dział po swojemu ustawia szerokość strony i rozwiązuje akcje, puste stany, karty i przełączniki.
- Źródła:
  - zrzuty wzorcowe `e2e/visual.spec.ts-snapshots` z 01–03.11 (1440×900 i 390×844; Zeszyt jasny i ciemny, Neon);
  - otwarte punkty z `docs/plan-*.md` (linie „Status (2026-11-03)”);
  - liczby z kodu z 2026-11-05: 93 × `uppercase tracking-wider`, 43 pliki z `framer-motion`, `EmptyState` użyty tylko w `Index.tsx`, 366 wywołań `toast`.
- Plan **zbiera w jednym miejscu** otwarte punkty wyglądu i QoL z planów działów (każdy z numerem źródłowym), żeby nie szukać ich w 25 plikach. Do tego dochodzą nowe ustalenia ze zrzutów, oznaczone **nowe**.

## 2. Co widać na zrzutach

| # | Problem | Gdzie | Waga |
|---|---|---|---|
| V1 | **Cztery różne szerokości i wyrównania treści.** Notatki i Skrzynka: kompozytor ok. 36rem przy lewej krawędzi, siatka na całą szerokość. Długi: kolumna `max-w-2xl` pośrodku (`DebtsView.tsx:85`). Dziś: karty szerokie na 1110 px, każda z jedną linijką treści. Plany: opis po lewej, przycisk przy prawej krawędzi okna. | wszystkie działy (komputer) | duża |
| V2 | **Akcje widoku za każdym razem gdzie indziej.** Terminy: „Nowy termin” i „Kafle/Lista” w osobnym wierszu po prawej. Plany: „Nowa analiza” w wierszu opisu. Długi: „Ukryj kwoty”. Skrzynka: „Porządkuj” przy prawej krawędzi kompozytora. Kalendarz: druk i `.ics` w pasku miesiąca. `ViewTitle` nie ma miejsca ani na akcje, ani na jednozdaniowy opis. | Terminy, Plany, Długi, Skrzynka, Kalendarz | duża |
| V3 | **Pusty pasek u góry na komputerze** w Kalendarzu, Grafiku, Pracy, Planach i Długach: zostaje tylko przycisk panelu i eksport. Pole szukania znika, bo `viewSearches` jest fałszywe (`AppHeader.tsx:132`). Na telefonie te widoki mają lupę, a na komputerze nic. | pasek u góry | średnia |
| V4 | **Tabliczka „NOTKI · ARKUSZ 1/1” jest przyklejona do rogu okna** (`PaperBackdrop.tsx:42`, `.paper-stamp` w `index.css:728`). Prześwituje między kartami i ląduje obok treści (Dziś, Długi, Kalendarz). | komputer | średnia |
| V5 | **Puste stany w pięciu różnych stylach.** Terminy i Długi: szkic i przycisk. Plany: sam tekst „Brak analiz”. Kalendarz: 35 pustych białych kafli. Ćwiczenia: jedno zdanie i od razu cały formularz. Długi: saldo 0,00 zł, formularz **i** pusty stan pod nim, czyli trzy komunikaty o tym samym. | Plany, Kalendarz, Ćwiczenia, Długi, Grafik | duża |
| V6 | **Przełączniki widoku w trzech wyglądach.** Tekst w bursztynowej pigułce: Terminy („Kafle/Lista”), Kalendarz („Siatka/Lista/Oś tygodnia”). Biały segment: Grafik („Miesiąc/Tydzień”), Ćwiczenia. Szare zakładki: Praca („Quiz/Tablica…”). Do tego filtry Kalendarza to cztery bursztynowe chipy z „0”. | Terminy, Kalendarz, Grafik, Praca, Ćwiczenia | średnia |
| V7 | **Nieaktywny główny przycisk wygląda na zepsuty.** To bursztyn z `opacity-50` (`button.tsx:9`). Na kremowym tle napis ma za mały kontrast i nie mówi, czego brakuje. Przykłady: „Dodaj” w Ćwiczeniach, „Dodaj premię” w Grafiku. | formularze | średnia |
| V8 | **Kalendarz na komputerze.** Pasek tygodnia nad siatką miesiąca powtarza ten sam tydzień. Karty „Dziś” i „Jutro” stoją obok siebie i są za wąskie: data przy „Jutro” łamie się na dwie linie. | Kalendarz | średnia |
| V9 | **Taśma Zeszytu zasłania tytuł.** Na przypiętej notatce leży pośrodku karty, `top: 6px` (`signatures.css:453`). W wąskim kaflu na telefonie zakrywa koniec tytułu („Zakupy”). | Notatki, telefon | mała |
| V10 | **Pasek boczny jest przeładowany.** Slogan pojawia się dwa razy (pod logo i w stopce), a „NOTKI v1.0” jest wpisane na sztywno (`AppSidebar.tsx:375`). Sześć pozycji narzędziowych na dole konkuruje z nawigacją. Archiwum i Kosz wiszą między grupami bez nagłówka. ETYKIETY i FOLDERY mają inny przepis nagłówka niż CODZIENNIE i PRACA. | pasek boczny | średnia |
| V11 | **Praca:** postęp „0 z 18” to 18 pustych kwadracików z podpisami w trzech miejscach. Narzędzia (Statystyki, Wysokości, Kalkulatory) to blade pigułki bez ramki. | Praca | mała |
| V12 | **Na dotyku każdy kafel stale pokazuje puste pole wyboru** w rogu. To szum przy każdej notatce. | Notatki, telefon | mała |
| V13 | **Grafik na telefonie jest bardzo długi.** Pod kalendarzem jest jeszcze ok. 1000 px statystyk, urlopu, premii i paska wypłaty. Pasek narzędzi ucina się bez znaku, że da się go przewinąć. **Do potwierdzenia:** wzorce `grafik-telefon-*` są z 28.10, czyli sprzed główki kartki. | Grafik | średnia |

## 3. Zasady wyglądu

Każdy punkt planu stosuje te same reguły. Przegląd sprowadza się wtedy do jednego pytania: czy ten widok łamie którąś z nich?

1. **Jedna anatomia strony:** główka (linijka, tytuł, jedno zdanie opisu, akcje po prawej), pod nią pasek narzędzi widoku (filtry, przełącznik), na końcu treść. Na telefonie akcje schodzą pod tytuł i tworzą jeden rząd.
2. **Trzy szerokości**, każda wyrównana do lewej krawędzi główki:
   - czytanie: ok. 42rem (notatka, ustawienia);
   - formularz: ok. 48rem (Długi, Ćwiczenia, kompozytor);
   - pulpit: do ok. 80rem (Dziś, Kalendarz, Grafik, Praca, siatka notatek).
   Żaden blok nie stoi samotnie wyśrodkowany.
3. **Jedna karta:** nagłówek (ikona, tytuł zdaniem, meta, akcja po prawej), treść i opcjonalna stopka z linkiem. Pusta karta zajmuje jedną linijkę, nie pełną wysokość.
4. **Trzy kontrolki wyboru:**
   - zakładki (`ui/tabs.tsx`) do przełączania części działu;
   - przełącznik segmentowy (`ui/toggle-group.tsx`) do trybu widoku;
   - chip (`ui/chip.ts`) do filtrów; chip z licznikiem 0 jest przygaszony.
5. **Bursztyn znaczy tylko trzy rzeczy:** „tu jesteś”, główna akcja i „dziś”. Wszystko inne jest neutralne. To zasada z planu wyglądu z 01.11; tutaj pilnuje jej test.
6. **Zdania, nie wersaliki.** Wyjątki: linijka mono w główce, pieczątki (`stamp-tag`) i skróty klawiszy.
7. **Ruch z jednego słownika** (czasy i krzywe), zawsze z wariantem bez ruchu.
8. **Bez nowych krojów i zależności.** Zapas precache to ok. 29 KiB (stan z 03.11), więc każdy etap kończy się pomiarem w `e2e/bundle.spec.ts`.

## 4. Etapy

Oznaczenia: W to wartość (1–3), N to nakład (S/M/L). „Źródło” wskazuje punkt w planie działu, z którego punkt jest przejęty.

### Etap 0: punkt wyjścia (S, robimy najpierw)

| # | Co | Gdzie | W | N |
|---|---|---|---|---|
| 0.1 | **Świeże zrzuty** wszystkich działów w 390 i 1440 px (Zeszyt jasny i ciemny, Hydraulika), potem przegląd. Odświeżyć wzorce starsze niż główka kartki: `grafik-telefon-*` z 28.10 oraz `notatki-telefon-matrix` i `praca-telefon-matrix` z 25.10. | `e2e/visual.spec.ts` | 3 | S |
| 0.2 | **Brakujące wzorce:** Ustawienia (4 karty), otwarta notatka, paleta poleceń, arkusz „Więcej”, Skarbiec, pusta aplikacja przy pierwszym uruchomieniu, szukanie bez trafień, a dla Dziś i Kalendarza także 1920 px. | `e2e/visual.spec.ts` | 3 | S |
| 0.3 | **Liczby wyjściowe** do miar z punktu 7: wersaliki, `opacity-50` na głównym przycisku, liczba wariantów pustego stanu, rozmiar paczki. | — | 2 | S |

**Wynik Etapu 0 (2026-11-05, commit cb80583):**

- **0.1, zrobione.** Cały zestaw `test:visual` przeszedł bez zmian poza Dziś. Wzorce z 25.10 i 28.10 (`grafik-telefon-*`, `notatki-telefon-matrix`, `praca-telefon-matrix`) zgadzają się z obecnym wyglądem, więc nie trzeba ich odnawiać. Sześć zrzutów `dzis-*` odświeżone, bo zmieniła je karta zmiany i pusty dzień z Plan-nowy 2.4. Doszedł ciemny Zeszyt dla pięciu głównych działów.
- **0.2, zrobione.** 63 nowe wzorce w `e2e/visual.spec.ts`: 4 karty Ustawień, otwarta notatka, paleta poleceń, okno hasła Skarbca, pierwsze uruchomienie, szukanie bez trafień i arkusz „Więcej” (każdy w Zeszycie jasnym i ciemnym oraz w Hydraulice), do tego Dziś i Kalendarz w 1920 px. Razem z 10 zrzutami ciemnego Zeszytu z 0.1 przybyło 73 wzorców, w sumie 227, wszystkie zielone w drugim przebiegu.
- **0.3, liczby wyjściowe:**

| Miara | Stan 2026-11-05 | Cel |
|---|---|---|
| `uppercase tracking-wider` w `src` | 88 (113 × `uppercase` w 74 plikach `.tsx`) | 0 poza wyjątkami |
| `disabled:opacity-50` | 22, w tym bazowy `Button` (`button.tsx:9`) | 0 na głównym przycisku |
| Pusty stan | 4 komponenty: `EmptyState` (tylko `Index.tsx`), `EmptySketch` (Długi, dziennik Pracy), `EmptyShifts` (Grafik), `EmptyIllustration`; do tego ok. 37 plików z własnym tekstem „Brak…/Nic…” | 1 (`EmptyState`) |
| Przełącznik widoku | `ToggleGroup` w 9 plikach, `Segmented` w 4, `TabsList` w 2 | 1 komponent na rolę |
| `framer-motion` | 49 plików | wg NP-5 |
| Wywołania `toast` | 372 | — |
| Wejściowy JS (gzip) | 441,8 KB (60 plików) | ≤ 500 KB |
| Precache | 3,984 MiB (230 plików), **zapas 16,3 KiB** | ≤ 4,0 MiB, zapas ≥ 10 KiB |

Zapas precache jest mniejszy niż 29 KiB zakładane w §3 p. 8. Etapy 1–2 muszą więc oddawać tyle, ile dodają, albo trzeba podjąć decyzję o progu.

**Nowe ustalenia z przeglądu zrzutów** (uzupełniają §2):

- **V14:** na 1440 × 900 pasek boczny jest wyższy niż okno, a stopka „NOTKI v1.0” wychodzi poza ekran. To wzmacnia V10.
- **V15:** przy szukaniu bez trafień na telefonie baner „Zainstaluj notki” stoi nad pustym stanem i odsuwa go w dół.
- **V16:** w 1920 px treść Dziś kończy się na ok. 1780 px, ale karty mają po 1360 px szerokości i po jednej linijce treści. Kalendarz zostawia ok. 140 px pustego miejsca za panelem dnia, a karty „Dziś” i „Jutro” nadal łamią datę. Potwierdza V1 i V8.
- **V7 na żywo:** nieaktywny przycisk „Ustaw hasło” w oknie Skarbca (`skarbiec-*`) jest bladym bursztynem.

### Etap 1: szkielet strony (fundament)

| # | Co | Gdzie | W | N |
|---|---|---|---|---|
| 1.1 | **Główka z opisem i akcjami.** `ViewTitle` dostaje dwa nowe pola: `lead` (jedno zdanie) i `actions` (po prawej, a na telefonie rząd pod tytułem). Do `actions` trafiają „Nowy termin”, „Nowa analiza”, „Ukryj kwoty”, „Porządkuj” oraz druk i `.ics`. Przełączniki widoku idą do paska narzędzi pod główką. **Nowe** (V2). | `src/components/ViewTitle.tsx`, widoki | 3 | M |
| 1.2 | **Trzy szerokości** jako tokeny (`--page-read`, `--page-form`, `--page-wide`) i jedna lewa krawędź z główką. Długi i Ćwiczenia tracą `mx-auto`, a Dziś dostaje limit 80rem. **Nowe** (V1). | `src/index.css`, widoki | 3 | M |
| 1.3 | **Szukanie w każdym widoku.** Tam, gdzie nie ma pola szukania notatek (`viewSearches` = false), w tym samym miejscu paska stoi przycisk w kształcie pola: „Szukaj i polecenia… Ctrl+K”. Otwiera paletę, także na komputerze. **Nowe** (V3). | `src/components/AppHeader.tsx:132–142` | 2 | S |
| 1.4 | **Tabliczka na końcu kartki.** `.paper-stamp` przechodzi z warstwy tła na koniec treści widoku: stoi statycznie po ostatniej sekcji, więc nie prześwituje między kartami. Napis dalej wybiera `html[data-view]`. **Nowe** (V4, decyzja NP-3). | `src/components/PaperBackdrop.tsx`, `src/index.css:726–761` | 1 | S |

**Wynik Etapu 1 (2026-11-05):** 1.1–1.4 zrobione, opis w `opis.md` („Wspólne — szkielet strony”).

- **1.1:** `PageActions` (portal z widoku do główki) i `lead` w `ViewTitle`. W akcjach: „Nowy termin”, „Nowa analiza”, „Ukryj kwoty”, „Porządkuj” (od `md`), „Drukuj” i „.ics”; menu „⋯” Kalendarza na telefonie zniknęło. Opis mają Długi i Plany.
- **1.2:** tokeny `--page-read/form/wide`. Treść i pasek do 80rem, a Długi, Ćwiczenia, kompozytor i Skrzynka w kolumnie 48rem przy lewej krawędzi. Dziś nie dostał osobnego limitu, bo limit 80rem dotyczy całej treści.
- **1.3:** przycisk „Szukaj i polecenia… Ctrl+K” w pasku na komputerze tam, gdzie nie ma pola szukania notatek.
- **1.4:** tabliczka jako ostatni element `<main>`; zniknął wyjątek dla Grafiku.
- **Miary po Etapie 1:** wejściowy JS 442,4 KB gzip, precache 3,988 MiB (zapas 12,6 KiB, czyli 3,7 KiB mniej, razem z osią dnia). axe 241/241, Vitest 3045/3045, zrzuty 227/227. Smoke `tabs.spec.ts` padał 5. dnia miesiąca (nazwa dnia z „dziś”); test poprawiony.

**Poza planem (2026-11-05, prośba właściciela):** Plany to teraz zakładka Pracy. Nie ma ich w pasku bocznym ani w „Więcej”, a `/plany`, paleta i `g r` otwierają zakładkę. Opis w `opis.md` („Plany jako zakładka Pracy”). Precache po zmianie: 3,989 MiB (zapas 11,6 KiB). Smoke `composer.spec:18` pada pod 3 workerami także na commicie sprzed sesji (4f4c4a2), czyli to istniejąca niestabilność.

### Etap 2: wspólne elementy

| # | Co | Gdzie | W | N |
|---|---|---|---|---|
| 2.1 | **`SectionCard`: jedna karta** według zasady 3. Używają jej karty Dziś, karty „Dziś” i „Jutro” w Kalendarzu, saldo Długów, podsumowanie Grafiku i karty Ustawień. Pusta karta ma jedną linijkę. Źródło: Ustawienia 5.1, rozszerzone na całą aplikację. | nowy `src/components/ui/section-card.tsx` | 3 | M |
| 2.2 | **Kontrolki wyboru według zasady 4:** <ul><li>do `toggle-group.tsx`: Terminy („Kafle/Lista”), Kalendarz („Siatka/Lista/Oś tygodnia”, „Lista/Oś godzin”), Grafik („Miesiąc/Tydzień”);</li><li>do `tabs.tsx`: Praca i Ćwiczenia;</li><li>filtry Kalendarza: chip z licznikiem, przygaszony przy zerze.</li></ul> Źródło: Ustawienia 5.3, plus **nowe** (V6). | widoki | 2 | M |
| 2.3 | **`Stat`: jeden wygląd liczby.** Liczba w mono z cyframi tabelarycznymi, jednostka mniejsza, etykieta zdaniem, opcjonalnie pasek. Dla Długów, „Przepracowane” w Grafiku, Pracy i Statystyk. `animated-number.tsx` zostaje w środku. **Nowe**. | nowy `src/components/ui/stat.tsx` | 2 | S |
| 2.4 | **Nieaktywny przycisk mówi, czego brakuje.** Zamiast `opacity-50`: neutralne tło i tekst w pełnym kontraście. Pod formularzem jedna linijka, np. „Wpisz nazwę” (`aria-describedby`). Druga możliwość: przycisk zostaje aktywny, a walidacja rusza po kliknięciu. **Nowe** (V7). | `src/components/ui/button.tsx:9`, formularze | 2 | S |
| 2.5 | **Jeden pusty stan:** `EmptyState` i `EmptyIllustration` we wszystkich działach. <ul><li>Plany: szkic zamiast samego tekstu.</li><li>Kalendarz: miesiąc bez terminów to jedna linijka nad siatką, a puste dni nie mają białych kafli.</li><li>Grafik: miesiąc bez zmian.</li><li>Ćwiczenia: najpierw przycisk, formularz po kliknięciu.</li><li>Skarbiec.</li><li>Szukanie bez trafień: z „Szukaj też w archiwum”.</li></ul> **Nowe** (V5). | `src/components/EmptyState.tsx`, widoki | 3 | M |
| 2.6 | **Wersaliki → zdania** (93 miejsca), z testem strażnikiem i listą wyjątków. Źródła: Powłoka 4.1, Ustawienia 5.2, Ćwiczenia 4.5 (`h3 text-xs`). | cały `src/` | 2 | M |

**Wynik Etapu 3 (2026-11-05, commit fc5310f na master):** 3.1–3.8 zrobione poza dwoma punktami 3.1 (maska na końcu treści i 70ch w edytorze). Opis w `opis.md` („Wspólne — działy, Etap 3”). Zrzuty 227/227 odświeżone, axe 239/241 przed poprawką (Miedź: tło aktywnego wiersza 10%) i potem zielone.

**Wynik Etapu 2 (2026-11-05):** 2.1–2.6 zrobione, opis w `opis.md` („Wspólne — elementy wspólne”). Próg precache podniesiony do 4,2 MiB (decyzja właściciela).

- **2.1:** `SectionCard` w kartach Dziś, sekcjach Ćwiczeń i premiach Grafiku. Karty „Dziś / Jutro” w Kalendarzu, oś dnia i Ustawienia zostają na Etap 3.
- **2.2:** `ToggleGroup` w Terminach, Kalendarzu (3 przełączniki) i Grafiku; `Tabs` w Ćwiczeniach; chip filtra z zerem przygaszony (`filterChipClass`).
- **2.3:** `Stat` w Długach, Grafiku i Pracy.
- **2.4:** nieaktywny przycisk bez `opacity-50`; `MissingHint` w Ćwiczeniach, premii i Skarbcu.
- **2.5:** `StatusPanel` w Planach, Długach i Grafiku; pusty miesiąc i puste dni w Kalendarzu; formularz odżywek zwinięty, gdy są wpisy (NP-7). Skarbiec i „Szukaj też w archiwum” bez zmian (patrz `opis.md`).
- **2.6:** 96 linijek bez wersalików, strażnik `src/test/sentenceCase.test.ts`.
- **Miary:** `uppercase` poza wyjątkami 0 (było 88), `disabled:opacity-50` na głównym przycisku 0, precache 3,987 MiB z 4,2 MiB.

### Etap 3: działy (każdy M, niezależne od siebie)

| # | Co | Gdzie | W | N |
|---|---|---|---|---|
| 3.1 | **Notatki:** <ul><li>taśma Zeszytu na górnej krawędzi karty, nie na tytule (V9);</li><li>data względna („dziś 12:00”, „wczoraj”), a rok tylko wtedy, gdy jest inny niż bieżący; wszystko w `<time>` (Notatki 1.6 i **nowe**);</li><li>koniec długiej treści wygaszony maską (Notatki 4.2);</li><li>szerokość czytania 70ch w edytorze (Notatki 4.3);</li><li>pole wyboru na dotyku tylko w trybie zaznaczania (V12, NP-2).</li></ul> | `src/styles/skins/signatures.css:453`, `NoteCardBody.tsx`, `NoteCard.tsx` (pliki z CRLF) | 2 | M |
| 3.2 | **Dziś:** dokończyć według `Plan-nowy.md` 2.4 (oś dnia; 3.2, czyli dwie kolumny od `lg`; 3.5; 4.2), już na kartach z 2.1. Kryterium wyglądu: przy pustym dniu cały dzień mieści się na 1440 px bez przewijania. | `src/components/review/TodayCards.tsx` | 3 | M |
| 3.3 | **Kalendarz (komputer):** <ul><li>pasek tygodnia tylko w widoku „Lista” i na telefonie (V8, NP-6);</li><li>karty „Dziś” i „Jutro” jedna pod drugą w bocznej kolumnie;</li><li>dni bez wpisów bez białego kafla: widać kratkę zeszytu i kreskę dnia, więc termin wyróżnia się kolorem działu.</li></ul> | `calendar/ReminderCalendarView.tsx`, `WeekStrip.tsx`, `dayCellStyles.ts` | 2 | M |
| 3.4 | **Grafik (telefon)**, po 0.1: <ul><li>podsumowanie miesiąca jako jedna karta „Miesiąc w liczbach” (`Stat`);</li><li>urlop, premie i pasek wypłaty rozwijane;</li><li>pasek narzędzi z wygaszeniem krawędzi, jak w Planach.</li></ul> (V13) | `src/components/shifts/ShiftsView.tsx` i podsumowanie | 2 | M |
| 3.5 | **Praca:** <ul><li>postęp jako trzy odcinki (Woda użytkowa, Kanalizacja, Wspólne) z licznikiem zamiast 18 kwadracików;</li><li>narzędzia jako rząd przycisków z ikoną i podpisem;</li><li>zakładki na `tabs.tsx`.</li></ul> (V11) | `src/components/study/*` | 1 | S |
| 3.6 | **Długi i Ćwiczenia:** gdy są wpisy, formularz zwija się do „+ Nowy wpis”. Bez wpisów zostaje jeden pusty stan z przyciskiem, który rozwija formularz. Znika zestaw: saldo 0,00 zł, formularz i pusty stan naraz. (V5, NP-7) | `debts/DebtsView.tsx`, `cwiczenia/*` | 2 | S |
| 3.7 | **Pasek boczny:** <ul><li>slogan tylko raz, pod logo;</li><li>stopka jako jeden rząd ikon (paleta, schemat, ustawienia) i „O aplikacji” z wersją z builda zamiast „NOTKI v1.0”;</li><li>„Trening mózgu” i „Zainstaluj” przechodzą do „Narzędzi”;</li><li>Archiwum i Kosz trafiają do grupy (NP-4);</li><li>ETYKIETY i FOLDERY mają ten sam przepis nagłówka co grupy;</li><li>wskaźnik aktywnego działu w odcieniu działu.</li></ul> Źródła: Ustawienia 4.1, Powłoka 4.2, plus **nowe** (V10). | `AppSidebar.tsx`, `sidebar/*` | 2 | M |
| 3.8 | **Ustawienia:** <ul><li>Ustawienia 1.2: jeden słownik („kopia”, „styl”, „krój”);</li><li>Ustawienia 1.3: `pluralPl`;</li><li>Ustawienia 2.4: kolejność w karcie Sync;</li><li>Ustawienia 5.1: karty na `SectionCard`.</li></ul> | `src/components/settings/*`, `SyncSettings.tsx` | 2 | S |

### Etap 4: ruch i drobny szlif

| # | Co | Gdzie | W | N |
|---|---|---|---|---|
| 4.1 | **Słownik ruchu:** jeden `motion.css` (3 czasy, 2 krzywe) i komplet mikrointerakcji: wciśnięcie, rysowany ptaszek, puls licznika, drgnięcie pola przy błędzie. Proste wejścia przechodzą z `framer-motion` na CSS według NP-5. Źródła: UI/QoL 2.7, D-3. | `src/styles/`, 43 pliki | 2 | M |
| 4.2 | **Jedno odhaczenie** w Terminach, na liście zadań i w Dziś: ten sam rysowany ptaszek i zwinięcie wiersza, bez ruchu przy redukcji. Źródła: Terminy 4.5, Dziś 3.5. | `ui/checkbox.tsx`, listy | 2 | S |
| 4.3 | **Haptyka tam, gdzie jej brakuje:** koniec zmiany w Grafiku, odhaczenie w Terminach, zapis wpisu w Pracy. Źródło: UI/QoL 2.8. | `src/lib/haptics.ts` | 1 | S |
| 4.4 | **Fonty bez skoku układu:** `size-adjust` i `ascent-override` dla fontu zastępczego aktywnego kroju. Źródło: UI/QoL 4.2. | `src/styles/` | 1 | S |
| 4.5 | **Przegląd 366 toastów.** Każdy to jedno zdanie z czasownikiem, a przy zmianie danych ma „Cofnij”. Toast nigdy nie zasłania otwartego arkusza: sprawdzić Fazę 4 planu wyglądu na nowych zrzutach. **Nowe**. | `ui/sonner.tsx`, wywołania | 1 | S |

### Etap 5: QoL na co dzień (najpierw W3)

| # | Co | Gdzie | W | N |
|---|---|---|---|---|
| 5.1 | **Ostatnie notatki:** sekcja „Ostatnie” w palecie i w pasku bocznym (10 pozycji) oraz Alt+← / Alt+→ po historii otwieranych notatek. `lib/lastOpened.ts` już zapisuje otwarcia. Źródło: Notatki 2.7. | `CommandPalette.tsx`, pasek boczny | 3 | S |
| 5.2 | **Przeciąganie pozycji listy zadań.** `@dnd-kit/sortable` jest już w paczce. Uchwyt ma 44 px, a Alt+↑/↓ zostaje. Źródło: Notatki 2.1. | `src/components/ChecklistEditor.tsx` | 3 | M |
| 5.3 | **Szukaj wszędzie** (rozwinięcie 1.3): paleta zwraca też terminy, wpisy Pracy, budowy i ustawienia, pogrupowane według rodzaju. **Nowe**. | `src/components/CommandPalette.tsx` | 3 | M |
| 5.4 | **Klawisze M i L na siatce**, a w podpowiedziach kafla wszystkie klawisze. Źródło: Notatki 2.3. | `src/lib/gridKeyboardNav.ts:225` | 2 | S |
| 5.5 | **Załączniki:** „Otwórz” PDF i obraz w nowej karcie oraz galeria obrazów notatki na komponencie z Pracy. Źródła: Notatki 1.4 i 1.5. | `AttachmentsList.tsx`, `study/PhotoGallery.tsx` | 2 | M |
| 5.6 | **Sync bez zgadywania:** zrozumiały komunikat w miejsce surowego „Błąd połączenia: {lastError}” i lista „Ostatnio widziane” urządzeń. Źródła: Ustawienia 1.1 i 2.2. | `src/components/SyncSettings.tsx:139` | 2 | S |
| 5.7 | **„O aplikacji”:** wersja i data builda, stan Service Workera, „Nowa wersja gotowa — Odśwież”. Źródło: Ustawienia 4.1 (wspólne z 3.7). | ustawienia, pasek boczny | 2 | S |
| 5.8 | **Okruszki:** folder → podfolder, Praca → budowa; na telefonie skrót „‹ Rodzic”. Źródło: Powłoka 2.6. | `ViewTitle.tsx` | 1 | M |
| 5.9 | **Domyślny szablon folderu.** Źródło: Notatki 2.8. | mapa folderów (jedna wartość LWW) | 2 | M |
| 5.10 | **Dokończyć „Cofnij” i Esc:** <ul><li>dymek z „Cofnij” i `aria-expanded` (Notatki 1.2);</li><li>rysunek chroniony przed Esc i kliknięciem w tło, „Wyczyść” z cofnięciem (Notatki 1.3).</li></ul> | `NoteCard*`, rysowanie | 2 | S |

### Etap 6: większe rzeczy (po Etapach 1–5, osobna decyzja)

| # | Co | W | N |
|---|---|---|---|
| 6.1 | Zapisane widoki (Notatki 6.2). | 3 | L |
| 6.2 | Porównanie wersji słowami (Notatki 5.1). | 2 | M |
| 6.3 | Rysowanie na zdjęciu notatki (Notatki 5.2). | 2 | S |

### Etap 7: QA

- Zrzuty z 0.1 i 0.2 dostają nowe wzorce dopiero po przeglądzie różnic.
- `e2e/a11y.spec.ts` we wszystkich 10 stylach × 2 schematach.
- Przegląd zrzutów skillami `frontend-design`, `refactoring-ui` i `ux-heuristics`.
- Ręczne QA na telefonie łączymy z jedną sesją Cyklu 4 z `Plan-nowy.md`.

## 5. Kolejność i apetyt

1. Najpierw dokończyć `Plan-nowy.md` 2.4 (Dziś). Punkt 3.2 tego planu potrzebuje karty z 2.1, więc Dziś domknąć na nowej karcie albo zaraz po niej.
2. Potem Etap 0, Etap 1 i Etap 2. To wspólny fundament na ok. 1 tydzień. Bez niego Etap 3 robiłby każdy dział po swojemu po raz drugi.
3. Etapy 3 i 5 robimy dział po dziale: wygląd i QoL jednego działu w jednym etapie i jednym commicie. Kolejność działów:
   1. Notatki;
   2. Kalendarz;
   3. pasek boczny;
   4. Długi i Ćwiczenia;
   5. Grafik;
   6. Praca;
   7. Ustawienia.
4. Etap 4 idzie równolegle, małymi krokami. Etap 6 tylko po decyzji. Etap 7 na końcu.
5. W `Plan-nowy.md` ten plan to tor „wygląd i QoL”, obok Cykli 2 i 3. Punkt przejęty z planu działu odhaczamy w obu miejscach.

## 6. Decyzje właściciela

| Kod | Pytanie | Rekomendacja |
|---|---|---|
| NP-1 | Jak duża ma być zmiana wizualna? | Szlif w obrębie Zeszytu i 10 stylów: bez nowej palety i bez nowych krojów. Nowy wygląd domyślny to temat na osobny plan. |
| NP-2 | Czy pole wyboru na kaflu ma być widoczne na dotyku? | Ukryte do czasu wejścia w tryb zaznaczania (np. przez przytrzymanie kafla). |
| NP-3 | Co z tabliczką „ARKUSZ 1/1”? | Na końcu treści. Inne możliwości: tylko w pustych widokach albo wcale. |
| NP-4 | Gdzie mają być Archiwum i Kosz w pasku bocznym? | Na końcu grupy „Osobiste”. |
| NP-5 | Co z `framer-motion` (D-3)? | Proste wejścia i naciśnięcia przenieść na CSS. `AnimatePresence` przy listach i arkuszach zostaje. |
| NP-6 | Czy pasek tygodnia w Kalendarzu zostaje na komputerze? | Tylko w widoku „Lista”. |
| NP-7 | Czy formularze w Długach i Ćwiczeniach zawsze są rozwinięte? | Zwinięte, gdy są już wpisy. Przy pierwszym wpisie rozwinięte. |

## 7. Miary (sprawdzane po każdym etapie)

- Paczka: wejściowy JS ≤ 500 KB gzip, precache ≤ 4,2 MiB (`e2e/bundle.spec.ts`; podniesione z 4,0 MiB 2026-11-05). Zapas precache nie może spaść poniżej 10 KiB bez decyzji.
- `uppercase tracking-wider` poza listą wyjątków: z 93 do 0 (pilnuje test strażnik).
- `disabled:opacity-50` na głównym przycisku: 0.
- Pusty stan: jedna implementacja (`EmptyState`) we wszystkich działach.
- Przełącznik widoku: jeden komponent.
- axe: 0 naruszeń w `e2e/a11y.spec.ts`.
- Zrzuty wzorcowe: aktualne dla wszystkich działów (0.2).
- `npm run check`: najwyżej 3,5 min.

## 8. Czego nie robimy

- Nie zmieniamy palety, nie dodajemy krojów ani stylów.
- Nie dodajemy zależności (arkusze, animacje, ikony). Wystarczą Radix, lucide, `toggle-group` i `sheet-snap`.
- Nie przepisujemy działów od zera.
- Zmiany wyglądu nie ruszają danych w Yjs. Nowe klucze dochodzą tylko w 5.9 i 6.1, wzorcem jednej wartości LWW.
- Nie wirtualizujemy list bez pomiaru.

## 9. Jak sprawdzamy

Definicja „zrobione” jest taka jak w `Plan-nowy.md` §1 p. 4.

- Każdy etap:
  - Vitest dla logiki (`src/lib/**`);
  - e2e dla ścieżki użytkownika;
  - axe dla nowego UI;
  - `npm run check`.
- Zrzuty: `npm run test:visual -- -g "<dział>" --update-snapshots=all`, dopiero po obejrzeniu różnic.
- Budżety: `e2e/bundle.spec.ts` po buildzie.
- Przed commitem: `simplify` i `code-review` na diffie etapu, a w `opis.md` opis każdej zmienionej funkcji.
- Na koniec: jedna sesja na telefonie (Cykl 4).

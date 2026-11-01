# Plan dopracowania wyglądu — 2026-11-01

Źródło: QA w Puppeteer 2026-11-01 — wszystkie działy na 390×844 i 1440×900, styl Zeszyt (ciemny i jasny w zrzutach `visual.spec`).
Kierunek wizualny zostaje: „zeszyt” (kratka, bursztyn, długopis, Plus Jakarta Sans + JetBrains Mono), 10 stylów.
Ten plan nie zmienia palety ani krojów — porządkuje to, co już jest, żeby każdy dział wyglądał jak kartka z tego samego zeszytu.

## Co widać na zrzutach

| # | Problem | Gdzie | Waga |
|---|---|---|---|
| W1 | **Trzy różne nagłówki.** (a) Notatki, Dziś, Skrzynka: w pasku tylko ikony widoku, duży tytuł na stronie. (b) Kalendarz, Plany: tytuł w pasku z podkreśleniem, ikona szukania pośrodku paska. (c) Długi, Ćwiczenia: tytuł w pasku **i** drugi raz na stronie z „PRYWATNE”. Grafik i Praca: logo N w pasku, duży tytuł na stronie. | wszystkie działy | duża |
| W2 | **Za dużo podkreśleń bursztynem.** Tytuł w pasku, tytuł strony, „Dziennik budowy”, „Odżywki”, „Terminy” w karcie Dziś, „Sprawdź, co umiesz”, nazwa analizy w Planach. Akcent przestaje znaczyć „tu jesteś”. | wszędzie | duża |
| W3 | **Trzy poziomy tytułów jeden pod drugim.** Praca → Dziennik budowy → Dziennik. Grafik → „Grafik: Główny” → „Listopad 2026”. | Praca, Grafik | średnia |
| W4 | **Ikona szukania „wisi” pośrodku paska** na telefonie, oderwana od innych ikon. | Kalendarz, Plany, Grafik, Praca, Długi | średnia |
| W5 | **Edytor Planów na telefonie:** poziomy zrzut zajmuje pas ok. 150 px w ciemnym polu ~330 px; pasek narzędzi ucina ostatnią ikonę bez znaku, że się przewija; panel pod spodem wymaga przewijania strony. | Plany | duża (to narzędzie pracy) |
| W6 | **Toasty na treści.** „Zapisano” w Planach na akapicie panelu; „Nowa odznaka” na treści w każdym zrzucie wzorcowym. | Plany, wszystkie | średnia |
| W7 | **Długie teksty pomocy na telefonie.** Grafik: 4 linie o przeciąganiu; Plany: akapit w każdej sekcji panelu; Praca: opis pustego dziennika. | Grafik, Plany, Praca | średnia |
| W8 | **„Więcej” świeci się dla 9 działów** — w Planach, Długach czy Kosz dolny pasek nie mówi, gdzie jestem. | dolny pasek | średnia |
| W9 | Drobne: „Pożyczyłem od” łamie się w przełączniku 2×2 (Długi); pole „Szukaj terminów” niższe od reszty kontrolek (Kalendarz); pusty stan Planów na komputerze to mały blok na środku pustej strony. | Długi, Kalendarz, Plany | mała |

## Sygnatura: „główka kartki”

Jeden nagłówek strony dla każdego działu, jak nagłówek kartki w zeszycie:

```
 CODZIENNIE · niedziela, 1 listopada        ← mono, mały, grupa działu + data
 Kalendarz                                   ← Jakarta, duży
 ───────────── (jedno pociągnięcie długopisem, tylko tutaj)
```

- Pasek u góry (`AppHeader`) staje się czystym paskiem narzędzi: panel boczny, szukanie, akcje widoku — **bez tytułu** na telefonie (decyzja D-W1).
- Tytuł, grupa (Codziennie / Praca / Osobiste — z paska bocznego) i data są w jednym komponencie strony, wszędzie tak samo. „PRYWATNE” w Długach i Ćwiczeniach staje się tą linijką grupy, nie osobnym napisem.
- Podkreślenie długopisem (`pen-underline`) zostaje **tylko** w główce kartki i na aktywnej zakładce. Nagłówki sekcji: mono, wersaliki, bez podkreślenia (`kicker`).
- To jest jedno ryzyko tego planu: na telefonie znika tytuł z paska, więc główka kartki musi być zawsze widoczna po wejściu (przy przewijaniu tytuł wraca do paska w małej wersji — jak w iOS).

## Fazy

| Faza | Zakres | Rozmiar |
|---|---|---|
| **0** | Zrzuty referencyjne wszystkich 14 widoków (dziś `visual.spec` ma 5): dodać Dziś, Skrzynkę, Plany (lista i edytor), Długi, Ćwiczenia, Archiwum, Kosz. 390 i 1440 px, Zeszyt jasny i ciemny + Hydraulika. Wyłączyć toast odznaki w zrzutach. | S |
| **1** | **Główka kartki** (W1, W3, W4): komponent `PageHead` (grupa, data, tytuł, opcjonalne akcje po prawej), wpięty we wszystkie działy; `AppHeader` bez tytułu na telefonie, szukanie w prawej grupie ikon; zwinięty tytuł w pasku po przewinięciu. Praca: „Dziennik budowy” → zakładki pod główką, bez trzeciego tytułu. Grafik: nazwa grafiku jako przełącznik w linijce grupy. | L |
| **2** | **Dyscyplina akcentu** (W2): przegląd użyć `pen-underline` i bursztynu; zostają: główka kartki, aktywna zakładka, główny przycisk, „dziś” w kalendarzu. Nagłówki sekcji i kart na `kicker`. Sprawdzić w 10 stylach (Neon i Matryca mają własne akcenty). | M |
| **3** | **Edytor Planów na telefonie** (W5): edytor domyślnie na pełny ekran (D-W3); płótno wypełnia wysokość, panel jako arkusz od dołu z trzema wysokościami (pasek narzędzia → podstawowe → pełny); pasek narzędzi z wygaszeniem krawędzi albo „⋯” dla Zestawienia; przy poziomym zrzucie podpowiedź „obróć telefon” raz. | L |
| **4** | **Warstwa komunikatów** (W6): toasty nad dolnym paskiem i nigdy nad otwartym arkuszem; odznaki w kolejce do chwili bez interakcji; „Zapisano” w Planach jako cichy znacznik przy nazwie analizy (jak status zapisu w notatkach), nie toast. | M |
| **5** | **Tekst i gęstość** (W7, W9): podpowiedzi do jednego zdania + „Więcej” albo „?” (zasada D-W4); akapity w panelu Planów → jedno zdanie pod nagłówkiem sekcji; „Od kogo” / „Komu” w Długach; pole szukania terminów w wysokości kontrolek. Przegląd skillami `ux-heuristics` i `refactoring-ui`. | M |
| **6** | **Dolny pasek** (W8): gdy aktywny dział jest w „Więcej”, piąty przycisk pokazuje jego ikonę i nazwę (np. „Plany”), a przytrzymanie/stuknięcie dalej otwiera „Więcej” (D-W2). | S |
| **7** | **Komputer:** pusty stan Planów jako trzy kroki (zrzut → skala → trasy; to prawdziwa kolejność, więc numeracja ma sens) obok przykładowego planu; edytor z panelem bocznym na stałe; pasek boczny przy 900 px bez przewijania (grupy już się zwijają w `AppSidebar.tsx`; do decyzji, czy „Osobiste” domyślnie zwinięte). | M |
| **8** | **QA:** `visual.spec` (Faza 0) z nowymi wzorcami, `a11y.spec` we wszystkich stylach, przegląd `frontend-design` + `refactoring-ui` na zrzutach, telefon (dotyk, arkusz Planów, toasty). | M |

Kolejność: 0 → 1 → 2 (fundament wspólny), potem 3–7 niezależnie, 8 na końcu. Budżet paczki bez zmian (żadnych nowych zależności; arkusz od dołu budujemy na istniejącym `Sheet` z Radix Dialog, bez `vaul`).

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| D-W1 | Tytuł działu: w pasku czy na stronie? | Na stronie (główka kartki); w pasku tylko zwinięty po przewinięciu. |
| D-W2 | Dolny pasek: piąty przycisk pokazuje aktywny dział z „Więcej”? | Tak. |
| D-W3 | Edytor Planów na telefonie domyślnie na pełny ekran? | Tak; powrót strzałką jak dziś. |
| D-W4 | Podpowiedzi: jedno zdanie + „?”, czy ukryte za „?” całkiem? | Jedno zdanie + „Więcej” przy pierwszym wejściu, potem tylko „?”. |
| D-W5 | „Grupa · data” w główce każdego działu, czy data tylko w Dziś/Kalendarzu/Grafiku/Pracy? | Grupa wszędzie, data tylko tam, gdzie dzień ma znaczenie. |

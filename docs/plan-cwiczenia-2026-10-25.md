# Plan: dopracowanie, ulepszenie, rozbudowa i upiększenie działu „Ćwiczenia” (2026-10-25)

Dziewiąty plan z serii „dział po dziale”, w tym samym układzie. Dział ma trzy części: Odżywki, Trening, Dieta (`/cwiczenia`).

## Kontekst

**Co już jest zrobione** (nie powtarzamy):
- Odżywki z porą dnia, odhaczaniem „dziś N z M” i przypomnieniem (notatka z serią dzienną); trening z planem dni, zapisem serii, „Użyj ostatnich”, przerwą 1:30, limitem hantli, rekordem i sparklajnem; dieta z sumą kcal i białka, celami i tygodniem. Wszystko w Yjs z kluczem na pozycję, w kopii, z „Cofnij”.
- `plan-dzialy-2026-10-22.md` §11 Poprawa 1 (godzina przypomnienia zapisuje się przy wyjściu z pola, kosz nie zaśmiecony) i 2 (ciężar spoza kroku 0,5 kg odrzucany z komunikatem) — Fala 1.
- §11 Poprawa 3 (przerwa ogłasza tylko koniec, `role="status"`, `TrainingSection.tsx:499`) i 5 (pola celu planu mają `aria-label`, `:413-414`).
- §11 Rozbudowa 1: własne ćwiczenia (`trainingExercises`, limit 30) — Fala 5.
- §11 Wygląd 1: zakładki Odżywki / Trening / Dieta na telefonie — Fala 4.
- Dopracowanie: progres w `useMemo` (`TrainingSection.tsx:25`).

**Co zostało otwarte (sprawdzone w kodzie 2026-10-25):**

| Skąd | Punkt | Dowód |
|---|---|---|
| nowe | **Tylko trzy partie i dwa sprzęty:** `MuscleGroup = "klatka" \| "biceps" \| "triceps"`, `Equipment = "ławka" \| "hantle"`. Własne ćwiczenie też musi być z tych trzech partii — pleców, barków, nóg, brzucha nie da się zapisać nawet jako własnego | `lib/training/catalog.ts:6-7,18,67` |
| §11 Popr. 4 | Przerwa startuje po zapisie całego wpisu (wszystkich serii naraz), a nie po serii — nie pasuje do treningu na żywo | `TrainingSection.tsx:38` |
| §11 Popr. 6 | Cele diety: formularz bierze wartości tylko przy montażu (zmiana z drugiego telefonu nie dochodzi), brak potwierdzenia zapisu, przycisk zablokowany bez powodu; białko zaokrąglane do całości (22,5 g → 23) | `DietSection.tsx:141-162`, `opis.md` (Ćwiczenia — Ograniczenia) |
| §11 Dopr. | Ustawienia treningu (przypomnienie, sprzęt) na górze karty, przed zapisem; plan dnia nie prowadzi przez trening („2/4”); brak zapisu „wczoraj” (formularze zawsze dziś); pusty stan bez rysunku | `TrainingSection.tsx:35-38`, `opis.md` |
| §11 Rozb. 2–5 | Brak szybkiego posiłku z ostatnich i „Powtórz wczoraj”; brak masy ciała; odżywki bez historii 7 dni i bez edycji (tylko usuń i dodaj); „Wziąłem” nie zamyka przypomnienia (i odwrotnie); brak „Nowy rekord” | `grep` w `components/cwiczenia`, `lib/supplements` |
| §11 Wygląd 1–3 | Brak paska „dziś” nad zakładkami; brak postępu do celu diety i słupków 7 dni (jest tabelka); sparklajn bez rekordu; przerwa jako tekst, nie pierścień; nagłówki sekcji `h3 text-xs` | `DietSection.tsx:172`, `TrainingSection.tsx:43,88,303` |
| opis.md | Wskazówki ćwiczeń „do sprawdzenia przez właściciela”; brak ćwiczeń na czas (deska) i bez ciężaru z dociążeniem; e2e działu tylko zakładki i własne ćwiczenia | `opis.md` (Ćwiczenia), `e2e/cwiczenia-*.spec.ts` |

**Powiązania:** Dziś 4.3 (wiersz „Odżywki 2 z 5 · Trening: plan na dziś”), Terminy (przypomnienia odżywek i treningu to notatki z serią — 2.3 tutaj łączy „Gotowe” z odhaczeniem), Skrzynka (notatki przypomnień bez etykiety trafiają do Skrzynki — to samo co w Długach 1.2).

**Ograniczenia:**
- **Paczka startowa:** widok leniwy; `catalog.ts` i model mają zostać małe.
- **Zgodność danych (ważne przy 1.1):** starsza wersja odrzuca ćwiczenie z nieznaną partią (`cleanCustomExercise`, `catalog.ts:67`) i nieznane id (`isKnownExercise`) — przy zapisie planu może je zgubić. Nowe partie i sprzęt wymagają aktualizacji wszystkich urządzeń przed użyciem albo zapasowej wartości. **Decyzja C-1.**
- **Zdrowie:** aplikacja nie doradza dawek odżywek ani diety; wskazówki ćwiczeń to opis techniki, sprawdzony przez właściciela.
- **7 motywów, redukcja ruchu, WCAG 2.2 AA.** Przed zmianą wyglądu skill `frontend-design`. Kolejność w punkcie: test → kod → `opis.md` → commit.

Legenda: W = wartość (1–3), N = nakład (S/M/L).

---

## Etap 1: poprawki (najpierw)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | **Więcej partii i sprzętu:** partie: plecy, barki, nogi, pośladki, brzuch, przedramiona, całe ciało; sprzęt: masa ciała, drążek, sztanga, gumy, maszyna, kettlebell. Katalog startowy +2–3 ćwiczenia na partię (wskazówki do sprawdzenia przez właściciela). Po C-1. Test: stare dane bez zmian, nowe partie przez `cleanCustomExercise`. | `lib/training/catalog.ts`, `TrainingSection.tsx` (`NewExerciseForm`) | 3 | M |
| 1.2 | **Przerwa po serii:** w zapisie treningu przy każdej serii „✓ Zrobiona” (odhacza wiersz i startuje przerwę); zapis wpisu na końcu albo automatycznie po ostatniej serii. Czas przerwy do wyboru (60 / 90 / 120 / 180 s), zapamiętany. | `TrainingSection.tsx` (`LogForm`, `RestTimer`) | 2 | M |
| 1.3 | **Cele diety:** formularz synchronizuje się z danymi (jak godzina przypomnienia, L6), „Zapisano cele” w dymku, przy zablokowanym przycisku komunikat przy polu („Kalorie: 500–10 000”). Białko z jednym miejscem po przecinku. | `DietSection.tsx:141`, `lib/diet/model.ts` (`cleanAmount`) | 2 | S |
| 1.4 | **Notatki przypomnień na swoim miejscu:** notatki odżywek i treningu dostają etykietę `ćwiczenia` (nie trafiają do Skrzynki). Istniejące — przy następnej zmianie godziny. | `CwiczeniaView.tsx:30` (`addNote(…, [], …)`), `TrainingSection.tsx:444` | 1 | S |

## Etap 2: codzienne używanie

| # | Co | W | N |
|---|----|---|---|
| 2.1 | **Plan dnia prowadzi przez trening:** „Zacznij: Klatka i triceps” → kolejne ćwiczenia planu po zapisie poprzedniego, licznik „2/4”, „Pomiń ćwiczenie”, na końcu podsumowanie (objętość, czas, rekordy). | 3 | M |
| 2.2 | **Ustawienia treningu niżej:** przypomnienie i limit hantli w zwijanym „Ustawienia treningu” na dole karty; na górze plan i zapis. | 2 | S |
| 2.3 | **„Wziąłem” zamyka przypomnienie:** odhaczenie odżywki na dziś przestawia notatkę-przypomnienie na następny dzień (jak „Gotowe”); „Gotowe” w Terminach przy notatce odżywki odhacza ją na dziś. Powiązanie przez `reminderNoteId`. | 2 | M |
| 2.4 | **Szybki posiłek:** pod polem opisu 5 ostatnich różnych posiłków jako pigułki (wypełniają kcal i białko), „Powtórz wczoraj” kopiuje wczorajsze posiłki na dziś (z „Cofnij”). | 3 | S |
| 2.5 | **Zapis z innym dniem:** pole „Dzień” w posiłku i treningu (domyślnie dziś, „wczoraj” jako pigułka). | 2 | S |
| 2.6 | **Edycja odżywki:** nazwa, dawka, pora, godzina przypomnienia (przenosi notatkę). | 2 | S |
| 2.7 | **Ćwiczenia na czas i z masą ciała:** seria może mieć czas (s) zamiast powtórek (deska, wisy) i ciężar dodatkowy przy masie ciała (pompki z obciążeniem). Pole `seconds` w `TrainingSet` przez dopisanie. Po C-1. | 2 | M |

## Etap 3: rozbudowa

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **Masa ciała:** wpis wagi (kg, raz dziennie, ostatni wygrywa), wykres 30 / 90 dni ze średnią 7-dniową (wahania dzienne nie straszą), opcjonalny cel. Mapa `bodyWeight` (dzień → kg). | 2 | M |
| 3.2 | **Odżywki: 7 dni zgodności** — przy każdej odżywce 7 kropek (wzięta / nie), „6/7 w tym tygodniu”. Z istniejącego `supplementLog`, bez nowych danych. | 2 | S |
| 3.3 | **„Nowy rekord”:** po zapisie serii cięższej niż dotychczasowy rekord pieczątka przy ćwiczeniu i krótka nagroda (`dayDoneReward`-podobna, wyłączalna w efektach). | 1 | S |
| 3.4 | **Historia ćwiczenia:** stuknięcie w ćwiczenie w Progresie → lista sesji (data, serie, objętość) i wykres z osią dat; szacowany 1RM (Epley) jako informacja. | 2 | M |
| 3.5 | **Tydzień treningowy:** licznik „3 treningi w tym tygodniu”, serie na partię w tygodniu (czy któraś partia nie jest pomijana). | 1 | S |

## Etap 4: wygląd (po fundamencie z planu przekrojowego)

| # | Co | W | N |
|---|----|---|---|
| 4.1 | **Pasek „dziś”** nad zakładkami (telefon) i nad sekcjami (komputer): „Odżywki 2/5 · Trening: Klatka (2/4) · 1 450 kcal / 2 200” — stuknięcie przenosi do sekcji. | 2 | S |
| 4.2 | **Postęp diety:** pierścienie albo paski kcal i białka do celu, pod spodem słupki 7 dni (zamiast tabelki), dzisiejszy wyróżniony. | 2 | S |
| 4.3 | **Wykres progresu z rekordem:** punkt rekordu wyróżniony, ostatnia wartość podpisana; przy 3.4 pełny wykres z osią. | 1 | S |
| 4.4 | **Przerwa jako pierścień** (SVG, `stroke-dashoffset`) z dużym licznikiem w JetBrains Mono, „+30 s” i „Pomiń” 44 px; przy redukcji ruchu bez płynnego ruchu pierścienia. | 1 | S |
| 4.5 | **Hierarchia nagłówków:** sekcje `h2` z ikoną, podsekcje (`Plan dni`, `Dziś`, `Progres`) jako `section-label` zamiast `h3 text-xs`; puste stany z rysunkiem kreską i jednym przyciskiem (po N-3). | 1 | S |

## Etap 5: QA działu

- E2E `cwiczenia.spec.ts`: odżywka (dodanie, odhaczenie, edycja, przypomnienie), trening przez plan dnia z przerwą po serii, posiłek z ostatnich, „Powtórz wczoraj”, cele diety, masa ciała.
- Testy zgodności: stare wpisy i plany po 1.1 i 2.7 (starsza wersja ich nie gubi albo jest ostrzeżona — zależnie od C-1); dwa dokumenty Yjs: odhaczenie odżywki i „Gotowe” w Terminach naraz (2.3).
- Zrzuty `@visual` i axe: trzy sekcje, przerwa, wykresy × 7 motywów × telefon.
- Ręcznie na telefonie: wibracja po przerwie, trening „na żywo” z przerwami.

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| C-1 | Nowe partie, sprzęt i serie na czas (1.1, 2.7): co ze starszą wersją aplikacji na drugim urządzeniu? | Zaktualizować wszystkie urządzenia przed wdrożeniem (plan Pracy 3.1 — ostrzeżenie o starszej wersji — robi to bezpiecznym). Bez zapasowych wartości: „plecy” udające „klatkę” zafałszowałyby progres. |
| C-2 | Masa ciała (3.1): w Ćwiczeniach czy osobno? | W Ćwiczeniach, jako czwarta zakładka „Waga” albo karta w Diecie — mniej działów w menu. |
| C-3 | Baza produktów (kcal z listy)? | Nie. Ręczny wpis + ostatnie posiłki (2.4) wystarczą; baza to duży plik i licencja danych. |
| C-4 | Wskazówki do ćwiczeń (1.1): kto je pisze? | Szkic w kodzie, do akceptacji przez właściciela przed wydaniem (jak dziś). |

## Kolejność wdrażania

1. Etap 1: 1.3, 1.4, 1.2, 1.1 (po C-1, C-4).
2. Etap 2: 2.4, 2.1, 2.2, 2.5, 2.6, 2.3, 2.7 (po C-1).
3. Etap 3: 3.2, 3.3, 3.1 (po C-2), 3.4, 3.5.
4. Fundament z planu przekrojowego, potem Etap 4.
5. Etap 5 na koniec.

Następny plan w serii: **Skarbiec**, potem **Ustawienia i synchronizacja** oraz **powłoka** (`plan-dzialy-2026-10-22.md` §0, §12–13).

## Status 2026-10-26

- **C-1** (aktualizacja urządzeń przed nowymi partiami): decyzja zostaje; wdrożenie nowych partii (1.1) dopiero po aktualizacji wszystkich urządzeń. Kod 1.1 jest w repozytorium.
- **C-2** (masa ciała w Ćwiczeniach): zrobione — zakładka „Waga” (`src/components/cwiczenia/WeightSection.tsx`, `src/lib/weight/`).
- **C-3** (bez bazy produktów): decyzja „nie” bez zmian w kodzie.
- **C-4** (wskazówki ćwiczeń): szkic 18 nowych ćwiczeń w `src/lib/training/catalog.ts` czeka na akceptację właściciela przed wydaniem.
- **2.7** (ćwiczenia na czas i z masą ciała): nie zrobione, po C-1.


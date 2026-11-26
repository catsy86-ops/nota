# Plan: Ćwiczenia — ulepszenie, dopracowanie, rozwój (2026-11-15)

> **Status:** realizacja w toku (2026-11-20): C1.4 zrobione. Poprzedni plan (`plan-cwiczenia-2026-10-25.md`) został zrobiony 12.11 (1.2, 2.1–2.7, 3.4, 4.x). Linie „Status” w tamtym pliku są starsze niż kod — przed każdym punktem sprawdź stan w `src/`.

## 1. Diagnoza

Co jest: odżywki z odhaczaniem i przypomnieniem, trening (plan dni, sesja `session.ts`, przerwa, rekordy, 1RM, sparklajn, katalog 33 ćwiczeń w 10 partiach, własne ćwiczenia), dieta (kcal i białko, cele, szybki posiłek, „powtórz wczoraj”, 7 dni), masa ciała z wykresem 30/90 dni.

Czego nie ma (sprawdzone w `src/lib/training`, `diet`, `supplements`, `weight` i `src/components/cwiczenia`):

- podpowiedzi „co dziś dołożyć” — jest historia, nie ma wniosku;
- widoku regularności (seria dni, kalendarz treningów);
- węglowodanów i tłuszczu w diecie, ulubionych posiłków;
- eksportu danych (CSV);
- blokady wygaszania ekranu w czasie sesji (w Pracy `useWakeLock.ts` już jest);
- obwodów ciała;
- nowe elementy z 12.11 (pierścień przerwy, pasek „dziś”, paski diety, edycja odżywki) nie były oglądane w przeglądarce;
- `TrainingSection.tsx` ma 717 linii, `CwiczeniaView.tsx` 427.

Znane ograniczenie z `opis.md`: odhaczenie odżywki w Ćwiczeniach i „Gotowe” w Przypomnieniach nie zamykają się nawzajem.

## 2. Zasady

1. Zapis serii na siłowni: jedną ręką, bez pisania, najwyżej dwa stuknięcia.
2. Aplikacja podpowiada, nie decyduje — każdą sugestię można zignorować.
3. Bez bazy produktów i bez kont (decyzja C-3 zostaje).
4. Dane w Yjs, jeden klucz na wpis, wszystko przez `clean*`; nowe pola opcjonalne.
5. Treść wskazówek do ćwiczeń zatwierdza właściciel (C-4).

## 3. Miary

| Miara | Dziś | Cel |
|---|---|---|
| Stuknięcia na zapis serii „jak ostatnio” | do zmierzenia | ≤ 2 |
| Stuknięcia na posiłek z ulubionych | — | 1 |
| `TrainingSection.tsx` | 717 linii | ≤ 300 |
| Nowe elementy z 12.11 obejrzane na 390 px w obu schematach | nie | tak |

## Etap 1: dopracowanie tego, co jest

| Nr | Punkt | Rozmiar |
|---|---|---|
| C1.1 | **Przegląd wizualny** elementów z 12.11 na 390 px, jasny i ciemny, 2–3 style; zrzuty przez `playwright.visual.config.ts`. Poprawki od razu. | S |
| C1.2 ✅ 2026-11-25 (743 → 171 linii; `LogForm`, `RestTimer`, `ProgressList`, `PlanForms`, `EquipmentForm`, `trainingFormat`) | **Podział `TrainingSection.tsx`**: `LogForm`, `RestTimer`, `ProgressList`, `PlanForm`, `EquipmentForm` w osobnych plikach. Bez zmian zachowania. | M |
| C1.3 ✅ 2026-11-25 (z Q3.1: sesja i przerwa) | **Ekran nie gaśnie w sesji** — `useWakeLock` na czas trwania `TrainingSession`. | S |
| C1.4 ✅ `d2051d4c` 2026-11-18 | **Odhaczenie = „Gotowe”.** Odhaczenie odżywki przesuwa serię jej notatki-przypomnienia, a „Gotowe” w powiadomieniu odhacza odżywkę (po `reminderNoteId`). Jedna funkcja w `src/lib/supplements/`, wołana z obu stron. | M |
| C1.5 | **Akceptacja katalogu** (C-4): właściciel czyta wskazówki 33 ćwiczeń; poprawki treści. | S, właściciel |

## Etap 2: trening, który prowadzi

| Nr | Punkt | Rozmiar |
|---|---|---|
| C2.1 ✅ 2026-11-25 | **Podpowiedź progresji** (podwójna progresja): gdy w ostatniej sesji wszystkie serie osiągnęły górę celu powtórek — „dołóż 0,5–1 kg”; gdy nie — „te same kg, o powtórkę więcej”. Czysta funkcja `suggestNext(history, plan, equipment)` w `src/lib/training/`, z testami; szanuje limit hantli z „Sprzętu”. | M |
| C2.2 | **Zapis serii jednym stuknięciem:** duży przycisk „Zrobione: 10 × 20 kg” z wartościami z podpowiedzi, obok −/+ dla powtórek i kg. Pola liczbowe zostają jako droga zapasowa. | M |
| C2.3 ✅ 2026-11-26 | **Opcjonalne RIR** („ile zostało w zapasie”: 0–4) przy serii — jedno stuknięcie, niewymagane. Zasila C2.1: zapas 3+ oznacza „dołóż”. | S |
| C2.4 ✅ 2026-11-25 | **Rozgrzewka:** przy pierwszym ćwiczeniu dnia propozycja 2 serii wstępnych (50% i 75% ciężaru roboczego), niezapisywanych do rekordów. | S |
| C2.5 ✅ 2026-11-25 | **Tydzień lżej:** po 6 tygodniach z rzędu bez przerwy podpowiedź „ten tydzień −40% objętości”; do odrzucenia jednym stuknięciem. | S |
| C2.6 | **Koniec przerwy przy zgaszonym ekranie** — powiadomienie systemowe; w pełni dopiero po F1 z `plan-fable-2026-11-15.md`. | zależne |

## Etap 3: regularność i obraz

| Nr | Punkt | Rozmiar |
|---|---|---|
| C3.1 | **Kalendarz regularności:** siatka 12 tygodni (trening, odżywki, dieta wpisana) w SVG, z opisem dla czytnika ekranu. | M |
| C3.2 ✅ 2026-11-25 (serie na partię były od 3.5 z 02.11; dodane pominięte duże partie) | **Tygodniowa objętość na partię** (serie na klatkę, plecy, nogi…) z zaznaczeniem partii pominiętych. Dane są w dzienniku i katalogu. | S |
| C3.3 ✅ 2026-11-25 | **Podsumowanie miesiąca:** liczba treningów, nowe rekordy, średnie kcal i białko, zmiana masy. Do udostępnienia jako tekst. | S |
| C3.4 | **Obwody ciała** (pas, klatka, ramię, udo) w zakładce „Waga”: nowa mapa Yjs według wzoru masy ciała, wykres ten sam. | M |
| C3.5 ✅ 2026-11-25 (`src/lib/csv.ts` wspólny z Długami, `src/lib/fitnessCsv.ts`) | **Eksport CSV** treningów, posiłków i masy — ten sam format co w Długach (średnik, BOM, ochrona przed formułami); wspólny pomocnik zamiast kopii. | S |

## Etap 4: dieta

| Nr | Punkt | Rozmiar |
|---|---|---|
| C4.1 | **Ulubione posiłki:** przypięte pigułki nad „ostatnimi”; zapis jednym stuknięciem. Mapa Yjs `dietFavorites`. | S |
| C4.2 | **Węglowodany i tłuszcz** jako pola opcjonalne, domyślnie ukryte (przełącznik „pełne makro”). Cele dzienne odpowiednio. | M |
| C4.3 ✅ 2026-11-25 | **Cel białka z masy ciała:** podpowiedź „1,6–2,2 g na kg” liczona z ostatniego pomiaru, do przyjęcia jednym stuknięciem. | S |
| C4.4 ✅ 2026-11-25 | **Średnia z 7 dni wobec celu** jako jedno zdanie nad listą („średnio 2 150 kcal, cel 2 400”). | S |
| C4.5 | **Etykieta ze zdjęcia** (eksperyment): OCR tabeli wartości odżywczych przez `tesseract.js`, który już jest w projekcie; wynik zawsze do poprawienia. Tylko za flagą funkcji próbnych. | M |

## Etap 5: do decyzji

| Nr | Punkt | Uwaga |
|---|---|---|
| C5.1 | **Kroki i tętno z telefonu** (Health Connect). | Możliwe tylko w powłoce Android z F1 — nie wcześniej. |
| C5.2 | **Stoper i ćwiczenia na czas** (deska, interwały). | Zmienia model serii (czas zamiast powtórek) — osobny projekt. |
| C5.3 | **Gotowe plany** (FBW, góra/dół, PPL) do wstawienia jednym stuknięciem. | Treść do akceptacji jak C-4. |

## Decyzje właściciela

- **CW-1:** podpowiedź progresji włączona domyślnie czy do włączenia (C2.1).
- **CW-2:** pełne makro — potrzebne czy zostaje kcal i białko (C4.2).
- **CW-3:** gotowe plany treningowe (C5.3).

## Kolejność i narzędzia

C1.1, C1.3 → C1.2 → C2.1, C2.2 (największa dźwignia) → C1.4 → Etap 3 → Etap 4.

Skill `frontend-design` przed zmianami wyglądu, `refactoring-ui` i `ux-heuristics` przy przeglądzie; Vitest dla całej logiki w `src/lib/training`, `diet`, `supplements`; `e2e/a11y.spec.ts` przed zamknięciem; każde nowe pole w `noteSchema.ts` i w teście pełnej kopii; opis w `opis.md`.

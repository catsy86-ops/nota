# Plan: Praca — ulepszenie, dopracowanie, rozwój (2026-11-15)

> **Status:** zapisany, realizacja nie zaczęta. Kontynuuje `plan-praca-budowa-2026-11-10.md` (fazy B0–B5 w większości zrobione) i `plan-wyceny-klienci-2026-11-13.md` (zrobiony). Nie powtarza ich punktów.

## 1. Diagnoza

- **Funkcji jest więcej niż dowodów, że są używane.** `src/lib/study/` ma ok. 130 modułów, `src/components/study/` ok. 100 plików. Są już m.in. skaner kodów, poziomica, aparat z latarką, NFC, kontakty z telefonu, podsumowanie AI, minutnik próby, kilometrówka, odcisk dokumentu, wyceny, klienci, faktury FA(3).
- **Brakuje pomiaru w terenie.** B0.2 (sesja QA na telefonie) i B0.3 (tydzień obserwacji) są otwarte od 10.11. Licznik użycia (`usage.ts`, Ustawienia → Diagnostyka) istnieje, ale nikt jeszcze nie podjął na jego podstawie decyzji.
- **Dwa duże pliki** zostały: `JournalEntrySheet.tsx` (1083 linie, B1.6 częściowo) i `SiteCardDialog.tsx` (706).
- **Pieniądze są w kilku miejscach:** rozliczenie budowy (`billing.ts`), zlecenia ze statusem (`jobs.ts`: wycena → umówione → zrobione → zapłacone), wyceny, faktury (`src/lib/ksef/`), przypomnienia o należności, podsumowanie miesiąca. Każde działa, ale nie ma jednego miejsca „co mi wiszą i co mam wystawić”.

Wniosek: następny krok to nie nowe funkcje, tylko pomiar, uproszczenie i spięcie tego, co jest.

## 2. Zasady

1. Przed każdym punktem sprawdź w kodzie, czy nie jest już zrobiony (lekcja z 12.11).
2. Nowa funkcja wchodzi tylko, gdy skraca codzienną czynność albo zamyka pętlę pieniędzy.
3. Dane zostają w Yjs i na urządzeniu; żadnych nowych serwerów w tym planie.
4. Budżety z `e2e/bundle.spec.ts` bez podnoszenia; Praca zostaje poza paczką startową.

## 3. Miary

| Miara | Dziś | Cel |
|---|---|---|
| Stuknięcia na „Zakończ dzień” | do zmierzenia w `workday.spec.ts` | ≤ 6 |
| Funkcje nieużyte przez 30 dni widoczne na pierwszym ekranie | nieznane (z `usage.ts`) | 0 |
| `JournalEntrySheet.tsx` | 1083 linie | ≤ 400 |
| INP p75 w Pracy (Pixel 7, CPU ×4) | 216 ms na Dzienniku | ≤ 200 ms na każdej zakładce |
| Należności bez przypomnienia po 14 dniach | nieznane | 0 |

## Etap 1: pomiar i decyzje (bez nowego kodu)

| Nr | Punkt | Rozmiar |
|---|---|---|
| R1.1 | **Sesja QA na telefonie** (B0.2): scenariusz „dzień hydraulika” w rękawicach, w słońcu, w trybie samolotowym, z 300 zdjęciami. Lista kontrolna `docs/qa-praca-telefon.md`. | S, właściciel |
| R1.2 | **Tydzień obserwacji** (B0.3): uwagi w Skrzynce z etykietą `#praca-uwagi`. | S, właściciel |
| R1.3 | **Przegląd licznika użycia** po tygodniu: tabela „używane / nieużywane”. Dla każdej nieużywanej funkcji decyzja: zostaje, idzie pod „Więcej”, znika. | S |
| R1.4 | **Pomiar stuknięć** w trzech codziennych ścieżkach (wpis ze zdjęciem, brak materiału, koniec dnia) i wpisanie liczb do tabeli miar. | S |

Wynik Etapu 1 może zmienić kolejność Etapów 2–4.

## Etap 2: uproszczenie i dług

| Nr | Punkt | Gdzie | Rozmiar |
|---|---|---|---|
| R2.1 | **Dokończyć podział `JournalEntrySheet.tsx`** (B1.6): reduktor szkicu w `src/lib/study/draft.ts`, sekcje etapu, zdjęć, lokalizacji i próby w `components/study/entry/`. Najpierw testy charakteryzujące reduktor. | `JournalEntrySheet.tsx` | M |
| R2.2 | **Podział `SiteCardDialog.tsx`** na pięć segmentów jako osobne, leniwie ładowane komponenty (Dziś, Materiał, Punkty, Pieniądze, Papiery). | `SiteCardDialog.tsx` | M |
| R2.3 | **Schować nieużywane** według R1.3: jeden wiersz „Więcej narzędzi” w karcie zamiast stałych przycisków. | karta budowy, zakładka Budowa | S |
| R2.4 | **Eksperymenty za flagą.** NFC, podsumowanie AI i poziomica dostają wspólny przełącznik „Funkcje próbne” w Ustawieniach; domyślnie wyłączone, jeśli R1.3 pokaże brak użycia. | flagi funkcji (Faza 0 planu rozbudowy) | S |
| R2.5 | **„Zacznij dzień”** — brakująca połowa B2.4: budowa z lokalizacji albo Grafiku, godzina wejścia, plan na dziś, jednym arkuszem. | `endDay.ts` jako wzór | M |
| R2.6 | **Testy e2e bez `waitForTimeout`** w specyfikacjach Pracy (część z 51 w całym e2e). | `e2e/site-*.spec.ts`, `workday.spec.ts` | M |

## Etap 3: pieniądze w jednym miejscu

| Nr | Punkt | Rozmiar |
|---|---|---|
| R3.1 | **Ekran „Należności”.** Jedna lista: budowy z saldem do zapłaty, zlecenia „zrobione, niezapłacone”, faktury wystawione bez wpłaty. Sortowanie po liczbie dni. Czysta funkcja zbierająca z `billing.ts`, `jobs.ts` i faktur; bez nowych danych. | M |
| R3.2 | **Oś zlecenia.** Na karcie zlecenia i klienta jeden pasek etapów: wycena → zaliczka → realizacja → protokół → faktura → zapłata → gwarancja, liczony z istniejących danych. Stuknięcie w brakujący etap otwiera właściwe narzędzie. | M |
| R3.3 | **„Do wystawienia”.** Zlecenie w stanie „zrobione” bez faktury pojawia się na Dziś z przyciskiem „Wystaw fakturę” (przenosi pozycje z wyceny). | S |
| R3.4 | **Wpłata częściowa i zaliczka** widoczne w R3.1 jako pasek „zapłacono 40%” (ten sam wzór co pasek spłaty w Długach). | S |
| R3.5 | **Eksport dla księgowej za miesiąc:** jeden ZIP z fakturami XML i PDF, CSV kilometrówki i zestawieniem; szyfrowany tak jak eksport faktur. | M |
| R3.6 | **KSeF Etap 2** zostaje odłożony (wymaga serwera i decyzji o hostingu). Nie wchodzi do tego planu. | — |

## Etap 4: teren

| Nr | Punkt | Rozmiar |
|---|---|---|
| R4.1 | **Tryb jednej ręki** na zakładce Budowa: wszystkie główne akcje w dolnej połowie ekranu, cele 56 px. Zmiana rozmiaru tylko tutaj i po uzgodnieniu — ogólne powiększenie `Button` na dotyku zostało cofnięte. | M |
| R4.2 | **Kolejka zdjęć bez czekania:** zdjęcie zapisuje się od razu, miniatura i zmniejszanie w tle (Worker), z widocznym licznikiem „przetwarzam 3”. Najpierw pomiar, czy dziś blokuje. | M |
| R4.3 | **Raport dnia głosem:** „Zakończ dzień” czyta podsumowanie na głos (`speechSynthesis`), żeby dało się je sprawdzić z brudnymi rękami. Do wyłączenia. | S |
| R4.4 | **Wzorce powtarzalnych budów:** „Nowa budowa z poprzedniej” (B3.7) rozszerzone o zapisane wzorce („łazienka”, „kotłownia”) z etapami i punktami. | S |
| R4.5 | **Powiadomienia natywne** dla próby szczelności i końca dnia — po F1 z `plan-fable-2026-11-15.md`. Bez niego minutnik działa tylko przy otwartej aplikacji. | zależne |

## Etap 5: Nauka

Bez zmian w zakresie. Otwarte: więcej pytań (czeka na źródła od właściciela) i własne tematy (osobny projekt). Jeden mały punkt: **R5.1** pytanie z problemu „Jak rozwiązane?” jednym stuknięciem do „Moich pytań”, jeśli jeszcze nie ma (sprawdzić w `studyCustom`).

## Decyzje właściciela

- **PR-1:** co z funkcjami nieużywanymi przez 30 dni — chować czy usuwać (R2.3).
- **PR-2:** czy „Należności” to nowa zakładka Pracy, czy sekcja na Dziś (R3.1).
- **PR-3:** czy tryb jednej ręki ma być domyślny na telefonie (R4.1).

## Kolejność i narzędzia

Etap 1 → R2.1, R2.2 → Etap 3 → reszta Etapu 2 → Etap 4.

Przy zmianach wyglądu skill `frontend-design` przed kodem; `performance-engineer` przy R2.2 i R4.2; `security-reviewer` przy R3.5; `e2e/a11y.spec.ts` przed zamknięciem etapu; opis w `opis.md` po każdym punkcie.

# Plan: Długi — ulepszenie, dopracowanie, rozwój (2026-11-15)

> **Status:** realizacja w toku (2026-11-20): L2.1, L2.4, L4.3 zrobione. Poprzedni plan (`plan-dlugi-2026-10-25.md`) ma zrobione Etapy 1–4; z niego zostają tylko QA na telefonie (Etap 5) i punkt 3.5 (decyzja D-3).

## 1. Diagnoza

Dział jest kompletny jako zeszyt „kto komu ile”: cztery rodzaje wpisu, saldo, pasek spłaty, termin zwrotu z przypomnieniem, łączenie osób, eksport CSV, ukrywanie kwot, wykrywanie podwójnego rozliczenia.

Czego nie ma (sprawdzone w `src/lib/debts/` i `DebtsView.tsx`):

- spłaty w ratach — jest tylko jeden termin zwrotu;
- wspólnych wydatków („zapłaciłem za trzech”);
- danych do przelewu w wiadomości „Wyślij”;
- obrazu w czasie — wykresu salda ani podsumowania miesiąca;
- dowodu (zdjęcie paragonu, potwierdzenie);
- innej waluty niż złoty;
- `DebtsView.tsx` ma 792 linie w jednym pliku.

## 2. Zasady

1. Dział zostaje prosty: wpis w trzech polach, bez obowiązkowych nowych pól.
2. Każdy wpis to nadal osobny klucz mapy Yjs `debts`; nowe pola są opcjonalne, a `cleanDebt` odrzuca złe wartości. Starsze urządzenie ma widzieć nowe wpisy jako zwykłe (reguła `formatSchema.ts`: nowy kształt zapisujemy dopiero, gdy wszystkie widziane urządzenia go znają).
3. Kwoty w groszach, bez ułamków.
4. Prywatność: nic z kwotami nie trafia do tytułów powiadomień przy włączonym ukrywaniu.

## 3. Miary

| Miara | Dziś | Cel |
|---|---|---|
| Stuknięcia: „zapłaciłem 120 zł za trzech” | 3 osobne wpisy | 1 formularz |
| `DebtsView.tsx` | 792 linie | ≤ 300, reszta w osobnych plikach |
| Pokrycie `src/lib/debts/` | do zmierzenia | ≥ 95% |

## Etap 1: porządek (bez zmian dla użytkownika)

| Nr | Punkt | Rozmiar |
|---|---|---|
| L1.1 | **Podział `DebtsView.tsx`** na `Summary`, `AddForm`, `People`, `PersonSheet`, `EditDebtForm` w osobnych plikach `src/components/debts/`. Bez zmian zachowania; testy `DebtsView.test.tsx` i `debts-plan.spec.ts` zielone. | M |
| L1.2 | **Testy własności** (`fast-check`): saldo nie zależy od kolejności wpisów; scalenie dwóch dokumentów w obie strony daje to samo; „Cofnij” po każdej operacji przywraca stan co do wpisu. | S |
| L1.3 | **QA na telefonie** (zaległy Etap 5): formularz przy dużym kroju, arkusz osoby, udostępnianie. | S, właściciel |

## Etap 2: spłaty i przypomnienia

| Nr | Punkt | Rozmiar |
|---|---|---|
| L2.1 ✅ `42f7502a` 2026-11-18 | **Raty.** Przy „Pożyczyłem” i „Pożyczyłem od” opcja „w ratach”: liczba rat i dzień miesiąca. Powstaje jedna notatka z przypomnieniem miesięcznym do daty końca (mechanizm serii już jest: `reminderRepeat`, `reminderRepeatUntil`). W arkuszu osoby: „rata 2 z 6 · 200 zł”, przycisk „Rata wpłacona” dopisuje spłatę. | M |
| L2.2 | **Grzeczne przypomnienie.** W „Wyślij” drugi wzór wiadomości: krótkie przypomnienie z kwotą i terminem, zamiast pełnej historii. | S |
| L2.3 | **Dane do przelewu.** Opcjonalny numer konta i telefon do BLIK-a z ustawień (dla Pracy są już w `companyPrefs.ts`; tu osobne, prywatne pole) dopisywane do wiadomości. | S |
| L2.4 ✅ `2a2cf5d0` 2026-11-18 | **Zaległe na Dziś.** Termin zwrotu po dacie pokazuje się na Dziś jako „Ania: 300 zł, 5 dni po terminie” z akcjami „Oddane” i „Przypomnij”. Sprawdzić, co już daje notatka z etykietą `długi`, i nie dublować. | S |

## Etap 3: wspólne wydatki

| Nr | Punkt | Rozmiar |
|---|---|---|
| L3.1 | **„Zapłaciłem za…”** Formularz: kwota, za co, osoby (z podpowiedzi), podział równy albo kwoty ręcznie. Zapis to zwykłe wpisy „Pożyczyłem” — po jednym na osobę, w jednej transakcji Yjs, ze wspólnym opcjonalnym polem `groupId`. „Cofnij” usuwa całą grupę. Reszta z dzielenia groszy idzie do pierwszej osoby. | M |
| L3.2 | **Grupa w historii.** Wpisy z tym samym `groupId` mają w historii znacznik „pizza · 3 osoby”; stuknięcie pokazuje wszystkich. | S |

Bez „grup wyjazdowych” i upraszczania długów między wieloma osobami — to inna aplikacja.

## Etap 4: obraz i dowód

| Nr | Punkt | Rozmiar |
|---|---|---|
| L4.1 | **Wykres salda osoby** w arkuszu: linia z `runningBalances` (dane już są), bez nowej biblioteki — SVG jak `Sparkline` w Ćwiczeniach. | S |
| L4.2 | **Miesiąc w liczbach** pod podsumowaniem: pożyczono, oddano, zmiana salda; zwinięte domyślnie. | S |
| L4.3 ✅ `55881847` 2026-11-18 | **Zdjęcie dowodu.** Jedno zdjęcie przy wpisie przez istniejący magazyn obrazów (skrót treści w Yjs, plik w IndexedDB, synchronizacja jak obrazy notatek). Przy ukrytych kwotach miniatura rozmyta. | M |
| L4.4 | **PDF „Rozliczenie”** dla osoby (`jspdf` już jest w projekcie, ładowany leniwie): historia, saldo, data. Odpowiednik „Wyślij” do wydruku. | S |

## Etap 5: do decyzji

| Nr | Punkt | Uwaga |
|---|---|---|
| L5.1 | **Inna waluta** (EUR). Opcjonalne pole `currency` we wpisie; salda liczone osobno na walutę, bez przeliczania kursów. | Zmienia podsumowanie i pasek proporcji — tylko jeśli realnie potrzebne. |
| L5.2 | **Powiązanie z klientem z Pracy.** | Zalecane: nie. Należności firmowe mają swoje miejsce (ekran „Należności” w planie Pracy); Długi zostają prywatne. |
| L5.3 | **Punkt 3.5 ze starego planu** (D-3). | Czeka na decyzję od 25.10. |

## Decyzje właściciela

- **DL-1:** raty — jedna notatka z serią miesięczną (zalecane) czy osobna notatka na każdą ratę.
- **DL-2:** wspólne wydatki — czy w ogóle potrzebne.
- **DL-3:** waluta (L5.1) — tak czy nie.

## Kolejność i narzędzia

Etap 1 → L2.4, L2.2, L2.3 (małe, od razu przydatne) → L2.1 → Etap 4 → Etap 3 po DL-2.

Skill `frontend-design` przed zmianami wyglądu; `security-reviewer` przy L4.3 (zdjęcia w synchronizacji) i L2.3 (numer konta w kopii zapasowej); `e2e/a11y.spec.ts` przed zamknięciem; kopia zapasowa — każde nowe pole dopisać w `noteSchema.ts` i sprawdzić w `fullBackup.test.ts`; opis w `opis.md`.

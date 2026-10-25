# Plan: dopracowanie, ulepszenie, rozbudowa i upiększenie działu „Długi” (2026-10-25)

Ósmy plan z serii „dział po dziale”, w tym samym układzie. Dział jest mały (`DebtsView.tsx` 394 linie, `lib/debts` ~320), więc plan też.

## Kontekst

**Co już jest zrobione** (nie powtarzamy):
- Cztery rodzaje wpisu (pożyczyłem, oddał mi, pożyczyłem od, oddałem), saldo osoby i podsumowanie, „Oddał całość / Oddałem całość” z „Cofnij”, historia z edycją i usuwaniem (z „Cofnij”), kwoty w groszach (`parseAmount` przyjmuje „1 234,5”), Yjs z kluczem na wpis, kopia scalająca, limit 2000.
- `plan-dzialy-2026-10-22.md` §10 Poprawa 1 w logice: `repaidShare` liczy obie strony salda, 100% tylko przy zerze, `floor` (maks. 99) (`model.ts:124`, Fala 1). Poprawa 2: kolory historii według wpływu na saldo (Fala 1).
- §10 Rozbudowa 1: termin zwrotu przy dodawaniu („Pożyczyłem” / „Pożyczyłem od”) jako notatka z przypomnieniem o 9:00 (`dueNoteId`, Fala 5).

**Co zostało otwarte (sprawdzone w kodzie 2026-10-25):**

| Skąd | Punkt | Dowód |
|---|---|---|
| nowe | **Przypomnienie o zwrocie dzwoni po spłacie.** `dueNoteId` jest zapisywany i nigdzie nie czytany: „Oddał całość”, spłata do zera ani usunięcie wpisu nie zdejmują terminu z notatki „Zwrot od …” | `DebtsView.tsx:86,255`, `grep dueNoteId` |
| §10 Popr. 1 (widok) | Pasek spłaty tylko przy osobie z „Pożyczyłem” (`lent > 0`); przy samym „Pożyczyłem od” brak paska, a `aria-label` podaje kwotę tylko z `lent` | `DebtsView.tsx:203,214` |
| §10 Popr. 3 | Wybór rodzaju to `role="radio"` bez strzałek i bez jednego punktu tabulacji; w edycji przyciski `py-1.5 text-xs` (< 44 px) | `DebtsView.tsx:97-118,331-343` |
| §10 Popr. 4 | Edycja słabsza niż dodawanie: bez `aria-invalid` i podpowiedzi osób (`datalist`), bez „Cofnij” po zapisie, bez terminu zwrotu (termin tylko przy dodawaniu) | `EditDebtForm`, `opis.md` (Długi — Fala 5) |
| §10 Popr. 5 | „Oddał całość” na dwóch telefonach naraz daje dwie spłaty — saldo przeskakuje na drugą stronę bez ostrzeżenia | `DebtsView.tsx:255` |
| §10 Popr. 6 | Dzień w formularzu (`useState(localDayKey())`) nie przechodzi na nowy dzień po północy; mieszany język: „My jesteśmy winni” w podsumowaniu, „Ty jesteś winien” na liście i w arkuszu; nagłówek „Prywatne”, choć dział nie jest chroniony | `DebtsView.tsx:24,62,211,272` |
| §10 Dopr. | Pusty stan bez rysunku; sumy bez animacji liczby; rozliczeni na dole, ale nie zwinięci; historia bez salda narastającego i podziału na miesiące; formularz zawsze rozwinięty nad listą (na telefonie lista zaczyna się pod 600 px) | `DebtsView.tsx:31,192` |
| §10 Rozb. 2–4 | Brak zmiany nazwy i łączenia osób (zmiana imienia w edycji przenosi jeden wpis); brak „Wyślij stan osobie”; brak ukrywania kwot; brak eksportu CSV | `opis.md` (Długi — Ograniczenia) |
| §10 Wygląd | Brak paska „nam winni / my winni” w proporcji, inicjału w kółku, paska spłaty kreską długopisu, siatki 2×2 przy dużym kroju na 390 px | — |
| opis.md | Tylko złote; brak testu e2e całego działu poza terminem (`debts-due.spec.ts`) — reszta sprawdzana ręcznie | `opis.md` (Długi — Testy) |

**Powiązania:** Terminy (termin zwrotu to zwykła notatka z przypomnieniem — „Gotowe” w Terminach mogłoby pytać „Oznaczyć jako oddane?”, punkt 2.3), Dziś (wiersz terminu), Skarbiec (decyzja D-2 o ochronie działu), Skrzynka (notatka „Zwrot od…” nie ma folderu ani etykiety → trafia do Skrzynki; punkt 1.2).

**Ograniczenia:**
- **Paczka startowa:** widok leniwy, `lib/debts/model.ts` mały — bez nowych zależności.
- **Dane:** nowe pola (`mergedInto`, waluta) tylko przez dopisanie i `cleanDebt`; test dwóch dokumentów Yjs i kopii (`yDebts.test.ts`, `fullBackup.test.ts`).
- **Prywatność:** kwoty to dane wrażliwe — „Wyślij stan” i CSV tylko na wyraźne stuknięcie, bez podglądu w powiadomieniach (tytuł notatki z kwotą to dziś wyjątek — punkt 1.2).
- **7 motywów, redukcja ruchu, WCAG 2.2 AA.** Przed zmianą wyglądu skill `frontend-design`. Kolejność w punkcie: test → kod → `opis.md` → commit.

Legenda: W = wartość (1–3), N = nakład (S/M/L).

---

## Etap 1: poprawki (najpierw)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | **Spłata zdejmuje termin:** gdy saldo osoby spada do zera (albo przechodzi na drugą stronę) — „Oddał całość”, spłata, edycja — notatki z `dueNoteId` tej osoby tracą przypomnienie (`reminder: null`), z „Cofnij” w tym samym dymku. Usunięcie wpisu z terminem pyta: „Usunąć też przypomnienie o zwrocie?”. Test: spłata całości → notatka bez terminu. | `DebtsView.tsx` (`settle`, `remove`), prop `clearReminder` z `Index.tsx` | 3 | S |
| 1.2 | **Notatka terminu na swoim miejscu:** notatka „Zwrot od…” dostaje etykietę `długi` (nie trafia do Skrzynki), a tytuł bez kwoty, gdy włączone ukrywanie kwot (3.3). Istniejące notatki bez zmian. | `DebtsView.tsx:84`, `Index.tsx:937` (`addReminderNote` daje `[]` etykiet) | 2 | S |
| 1.3 | **Pasek spłaty po obu stronach:** pokazywany, gdy osoba ma cokolwiek do spłaty w którąkolwiek stronę; `aria-label` „Oddano 40% z 500 zł” z kwotą strony salda (`repaidShare` + nowa `debtSide`). | `DebtsView.tsx:203-215`, `model.ts` | 2 | S |
| 1.4 | **Wybór rodzaju jak należy:** `ToggleGroup` z `ui/` (strzałki, jeden punkt tabulacji, `aria-pressed`) zamiast ręcznych `role="radio"`, w dodawaniu i edycji; w edycji 44 px na dotyku. | `DebtsView.tsx:97,331` | 2 | S |
| 1.5 | **Edycja jak dodawanie:** `aria-invalid` + `aria-describedby`, `datalist` osób, „Cofnij” po zapisie (poprzedni wpis), pole terminu zwrotu (tworzy, zmienia albo zdejmuje notatkę). | `EditDebtForm` | 2 | S |
| 1.6 | **Podwójne rozliczenie:** po synchronizacji, gdy osoba ma dwa wpisy „całość” w ciągu minuty z różnych urządzeń i saldo jest po drugiej stronie, baner w arkuszu osoby: „Rozliczono dwa razy — usunąć drugi wpis?”. Wpis „całość” oznaczony polem `settle: true`. | `PersonHistory`, `model.ts` | 2 | M |
| 1.7 | **Dzień i język:** dzień formularza odświeżany po północy (`useDayClock`), jedna forma: „Jesteś winien” wszędzie (albo „My jesteśmy winni” wszędzie — **Decyzja D-1**), nagłówek „Prywatne” → bez nagłówka albo „Tylko na Twoich urządzeniach”. | `DebtsView.tsx` | 1 | S |

## Etap 2: codzienne używanie

| # | Co | W | N |
|---|----|---|---|
| 2.1 | **Formularz zwinięty na telefonie:** „+ Nowy wpis” rozwija formularz (stan zapamiętany); lista osób od razu pod podsumowaniem. W arkuszu osoby przycisk „+ Wpis z {imię}” z wypełnioną osobą. | 3 | S |
| 2.2 | **Historia czytelniejsza:** saldo narastające przy każdym wpisie („po tym: 350 zł”), nagłówki miesięcy, najnowsze na górze (jest). | 2 | S |
| 2.3 | **„Gotowe” w Terminach przy notatce zwrotu** pyta: „Oznaczyć jako oddane?” → wpis spłaty na kwotę z salda (z „Cofnij”). Powiązanie przez `dueNoteId` (odwrotne wyszukanie). | 2 | M |
| 2.4 | **Rozliczeni zwinięci:** sekcja „Rozliczeni (N)” na dole listy, domyślnie zwinięta. | 1 | S |
| 2.5 | **Szukanie osoby** przy więcej niż 8 osobach (pole nad listą, bez polskich znaków). | 1 | S |

## Etap 3: rozbudowa

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **Zmiana nazwy i łączenie osób:** w arkuszu osoby „Zmień nazwę” (wszystkie wpisy naraz) i „Połącz z…” (wpisy innej osoby przechodzą pod tę nazwę). Jedna transakcja Yjs, „Cofnij”. | 2 | M |
| 3.2 | **Wyślij stan osobie:** „Wyślij” w arkuszu → `navigator.share` z tekstem: saldo, lista wpisów (data, rodzaj, kwota, za co). Na komputerze kopia do schowka. | 2 | S |
| 3.3 | **Ukrywanie kwot:** przełącznik oka w nagłówku — kwoty jako „•••” do stuknięcia (podsumowanie, lista, arkusz), stan zapamiętany na urządzeniu. Pomaga, gdy ktoś patrzy w telefon. | 2 | S |
| 3.4 | **Eksport CSV** wszystkich wpisów (data, osoba, rodzaj, kwota, za co, saldo osoby). | 1 | S |
| 3.5 | **Inna waluta** (EUR) przy wpisie, saldo osobno na walutę. **Decyzja D-3** — tylko jeśli potrzebne. | 1 | M |

## Etap 4: wygląd (po fundamencie z planu przekrojowego)

| # | Co | W | N |
|---|----|---|---|
| 4.1 | **Podsumowanie z proporcją:** pod dwoma kwotami pasek „nam winni / my winni” w proporcji, liczby przez `AnimatedNumber` (jest w `ui/`). | 2 | S |
| 4.2 | **Osoba z inicjałem:** kółko z inicjałem w kolorze z palety motywu (stały kolor z `personKey`), saldo w JetBrains Mono. | 1 | S |
| 4.3 | **Pasek spłaty kreską długopisu** w Zeszycie (`html[data-skin="zeszyt"]`), w innych stylach jak dziś. | 1 | S |
| 4.4 | **Pusty stan z rysunkiem** kreską (portfel / dłonie) i jednym przyciskiem „Dodaj pierwszy wpis” (po decyzji N-3 planu Notatek). | 1 | S |
| 4.5 | **Duży krój na 390 px:** siatka rodzajów 2×2 przechodzi na 1×4 przy powiększonym tekście (`@container`). | 1 | S |

## Etap 5: QA działu

- E2E `debts.spec.ts`: cztery rodzaje, saldo w obie strony, „Oddał całość” zdejmuje termin (1.1), edycja z terminem (1.5), łączenie osób (3.1), ukrywanie kwot (3.3).
- Test dwóch dokumentów Yjs: równoczesne „Oddał całość” (1.6), zmiana nazwy osoby na jednym telefonie i nowy wpis na drugim (3.1).
- Zrzuty `@visual` i axe: widok, arkusz osoby, edycja × 7 motywów × telefon.

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| D-1 | Jedna forma: „Jesteś winien” czy „My jesteśmy winni”? | „Jesteś winien” — aplikacja jest jednoosobowa, liczba mnoga brzmi jak firma. |
| D-2 | Długi za skarbcem (blokada jak notatki prywatne)? | Na razie nie; ukrywanie kwot (3.3) wystarcza na „ktoś patrzy w telefon”. Wrócić, jeśli kwoty będą duże. |
| D-3 | Inna waluta (3.5)? | Nie, dopóki nie pojawi się potrzeba. |
| D-4 | Usunięcie wpisu z terminem (1.1): pytać czy zawsze zdejmować przypomnienie? | Pytać — przypomnienie bywa celowo zostawiane („i tak oddać”). |

## Kolejność wdrażania

1. Etap 1: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7 (po D-1), 1.6.
2. Etap 2: 2.1, 2.2, 2.4, 2.3, 2.5.
3. Etap 3: 3.3, 3.2, 3.1, 3.4, 3.5 (po D-3).
4. Fundament z planu przekrojowego, potem Etap 4.
5. Etap 5 na koniec.

Następny plan w serii: **Ćwiczenia**, potem **Skarbiec**, **Ustawienia i synchronizacja** oraz **powłoka** (`plan-dzialy-2026-10-22.md` §0, §11–13).

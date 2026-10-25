# Plan: dopracowanie, ulepszenie, rozbudowa i upiększenie działu „Skrzynka” (2026-10-25)

Drugi plan z serii „dział po dziale” (po `docs/plan-notatki-2026-10-25.md`), w tym samym układzie.

## Kontekst

**Co już jest zrobione** (nie powtarzamy):
- Widok `/skrzynka` jako reguła nad notatkami (`lib/inbox.ts` `isInboxNote`: bez folderu, bez etykiet, nie podnotatka, nie prywatna). Bez nowego pola w danych.
- `plan-dzialy-2026-10-22.md` §3 Poprawa 1–3: wieloliniowe pole (`InboxCapture.tsx`), Enter / Shift+Enter, nic nie ginie przy długiej pierwszej linii (`captureParts`), widoczny fokus (`focus-within`), „+” w Skrzynce ustawia kursor w polu (`Index.tsx:270`).
- §3 Rozbudowa 1: tryb porządkowania (`InboxTriage.tsx`, leniwy): notatka po notatce, chipy folderów i etykiet, skróty 1–9, Archiwizuj, Kosz, „Zostaw”, „Cofnij” (stos).
- Skrót `g i` (`goChord.ts`), wpis w palecie, licznik w pasku bocznym i w „Więcej”, „Zapisano w skrzynce” z „Cofnij”.
- Zaznaczanie wielu kafli: folder, etykieta, archiwum z „Cofnij” (`BulkActionBar.tsx`, `useBulkNoteOps.ts`) działa też w Skrzynce.
- Udostępnianie z innych aplikacji (tekst, obrazy, PDF) tworzy notatkę bez folderu, więc trafia do Skrzynki samo.

**Co zostało otwarte (sprawdzone w kodzie 2026-10-25):**

| Skąd | Punkt | Dowód |
|---|---|---|
| plan-dzialy §3 Dopr. 1 | Brak `enterKeyHint="send"` i widocznego „Zapisz” na telefonie; błysk nowej notatki szuka nieistniejącego `[data-add-note-bar]` (żaden komponent nie ma tego atrybutu) | `InboxCapture.tsx:24`, `Index.tsx:500` |
| §3 Dopr. 2 | Brak pieczątki „posortowane” przy zejściu licznika do 0 | — |
| §3 Rozb. 2 | Frazy `#etykieta @folder jutro 9:00` są w kompozytorze (`lib/quickCapture.ts`, `AddNoteBar.tsx`), ale nie w polu Skrzynki; brak dyktowania (jest `hooks/useDictation.ts`) | `InboxCapture.tsx` |
| §3 Wygląd 1 | Pole nie wygląda jak zwinięty kompozytor; przycisk „Porządkuj skrzynkę (N)” to zwykły tekst, licznik bez `stamp-tag` | `Index.tsx:676` |
| tryb porządkowania | Przy wielu folderach i etykietach chipy to ściana przycisków, bez filtra i bez tworzenia nowego folderu lub etykiety; nie da się otworzyć ani poprawić notatki; brak przypomnienia; pusty tytuł jako „Bez tytułu” | `InboxTriage.tsx:139,123` |
| tryb porządkowania | Test e2e tylko jeden (archiwizacja, kosz, cofnięcie); skróty 1–9 i chipy bez testu | `e2e/inbox-triage.spec.ts` |
| widok | Brak informacji o wieku notatki w skrzynce i kolejności „najstarsze najpierw”; sortowanie takie jak w Notatkach | `useFilteredNotes.ts:52` |
| opis.md | Pusty stan bez przycisku (decyzja „bez przycisków”, zmieniana w N-3 planu Notatek) | `EmptyState.tsx:25,46` |

**Powiązania:** fundament wyglądu i ruchu z `docs/plan-ui-ux-qol-2026-10-25.md` (Fazy 0–2). Puste stany zależą od decyzji N-3 z planu Notatek. Arkusz akcji notatki (Notatki 2.4) przyda się w trybie porządkowania.

**Ograniczenia:**
- **Paczka startowa** (próg 401 KB, zapas mały). `InboxCapture` jest w paczce startowej, więc frazy i dyktowanie ładować leniwie (`import()` po pierwszym `#`, `@` albo kliknięciu mikrofonu). Tryb porządkowania zostaje leniwy.
- **Dane:** Skrzynka nadal jest regułą. Jedyny punkt, który dokłada pole (`snoozedUntil`, 3.3), wymaga decyzji S-1; jeśli tak, to przez dopisanie z testem zgodności (`noteSchema*.test.ts`, `fullBackup.test.ts`).
- **Prywatność:** notatki `locked` poza skrzynką, poza trybem porządkowania i poza podpowiedziami.
- **7 motywów, redukcja ruchu, WCAG 2.2 AA.** Przed zmianą wyglądu skill `frontend-design`.
- **Kolejność w punkcie:** test → kod → `opis.md` → commit.

Legenda: W = wartość (1–3), N = nakład (S/M/L).

---

## Etap 1: zaległe drobiazgi (S, najpierw)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | **Telefon:** `enterKeyHint="send"`, przycisk „Zapisz” (ikona strzałki, 44 px) widoczny przy niepustym polu. Na dotyku Enter nadal zapisuje, nowa linia przez przycisk klawiatury „↵” tylko z Shift — zostawić, ale dopisać do podpowiedzi. | `InboxCapture.tsx` | 3 | S |
| 1.2 | **Błysk nowej notatki:** `handleAddNoteGlow` szuka `[data-add-note-bar]`, którego nie ma nigdzie. Dodać atrybut do paska kompozytora i do formularza Skrzynki (albo przekazać punkt startu z wywołującego). | `Index.tsx:500`, `AddNoteBar.tsx`, `InboxCapture.tsx` | 2 | S |
| 1.3 | **Pusty tytuł w trybie porządkowania:** zamiast „Bez tytułu” pierwsza linia treści (ten sam helper co kafel). | `InboxTriage.tsx:123` | 1 | S |
| 1.4 | **Testy e2e trybu porządkowania:** folder (chip i skrót 1), etykieta, „Zostaw”, „Gotowe”, cofnięcie po „Gotowe”. | `e2e/inbox-triage.spec.ts` | 2 | S |

## Etap 2: szybsze przechwytywanie

| # | Co | W | N |
|---|----|---|---|
| 2.1 | **Frazy w polu Skrzynki:** reużycie `lib/quickCapture.ts` (`#etykieta`, `@folder`, `!`, data na końcu). Chipy pod polem jak w kompozytorze, Backspace na chipie go odrzuca. Dymek mówi, dokąd trafiła notatka („Zapisano w #budowa · jutro 9:00”), z „Cofnij”. Notatka z etykietą lub folderem od razu wychodzi ze Skrzynki — to zamierzone. Parser ładowany leniwie. | 3 | M |
| 2.2 | **Dyktowanie:** mikrofon w polu (`useDictation`, ta sama zgoda co w kompozytorze), tekst dopisuje się do pola, zapis dopiero Enterem lub „Zapisz”. Brak API = brak przycisku. | 2 | S |
| 2.3 | **Przechwycenie z każdego miejsca:** skrót `Alt+K` (i polecenie w palecie „Do skrzynki…”) otwiera małe okno z polem Skrzynki bez zmiany widoku. Na telefonie skrót PWA „Do skrzynki” (`manifest` → `?skrzynka=1`; nie `?inbox=`, bo ten parametr ma już udostępnianie z plikami) obok „Nowa lista”. | 3 | M |
| 2.4 | **Wklejony link:** sam adres w polu → tytuł strony nie jest pobierany (brak serwera), ale tytuł notatki = domena + ścieżka, adres w treści, ikona linku na kaflu. Spójne z udostępnianiem (`parseShare`). | 1 | S |
| 2.5 | **Wklejony obraz lub upuszczony plik** do pola Skrzynki: obraz jako zdjęcie notatki, PDF jako załącznik (ta sama ścieżka co `importSharedFiles`). | 2 | M |

## Etap 3: lepsze porządkowanie

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **Filtr chipów:** pole „Folder lub etykieta…” nad chipami (pisanie filtruje, Enter wybiera pierwszy). Domyślnie widać 9 najczęściej używanych (liczone z notatek), reszta po „Więcej”. Na końcu listy „Nowy folder „…”” i „Nowa etykieta #…”. | 3 | M |
| 3.2 | **Edycja w miejscu:** tytuł i treść w trybie porządkowania jako pola edycji (zapis przy przejściu dalej), przycisk „Otwórz notatkę” (zamyka okno, otwiera edytor). | 2 | S |
| 3.3 | **„Odłóż”:** przycisk „Jutro” / „Za tydzień” — notatka znika ze Skrzynki do daty. Wymaga pola `snoozedUntil` w notatce i warunku w `isInboxNote`. **Decyzja S-1.** Bez niej „Zostaw” pozostaje jedyną opcją. | 2 | M |
| 3.4 | **Przypomnienie z trybu porządkowania:** „Przypomnij…” z szybkim wyborem (dziś wieczorem, jutro 9:00, data) przez istniejący `QuickReminderInput`. Notatka z samym przypomnieniem zostaje w Skrzynce (reguła się nie zmienia) — chyba że S-2 zdecyduje inaczej. | 2 | S |
| 3.5 | **Gesty na telefonie:** przesunięcie karty w prawo = Archiwizuj, w lewo = „Zostaw”; przyciski zostają jako dostępny odpowiednik. Zgodne z decyzją 4.1 z planu mobile (swipe) — jeśli tam „nie”, punkt odpada. | 1 | M |

## Etap 4: wygląd i informacja zwrotna (po fundamencie z planu przekrojowego)

| # | Co | W | N |
|---|----|---|---|
| 4.1 | **Pole jak zwinięty kompozytor:** ten sam kształt, cień i obrys co pasek „Zapisz notatkę…”, ikona skrzynki w kolorze akcentu, w Zeszycie linia kratki. | 2 | S |
| 4.2 | **Pasek nad listą:** „Do posortowania” + licznik jako `stamp-tag` + przycisk „Porządkuj” jako `Button` (nie goły tekst), na telefonie przyklejony pod polem. | 2 | S |
| 4.3 | **Wiek notatki:** na kaflu w Skrzynce „od 3 dni” zamiast daty zmiany; domyślne sortowanie w Skrzynce „najstarsze najpierw” (osobne `ViewPrefs` dla widoku, jeśli dziś są wspólne). Notatka starsza niż 14 dni z dyskretnym znacznikiem. | 2 | S |
| 4.4 | **Pieczątka „Posortowane”** przy zejściu licznika do 0 (w trybie porządkowania i w widoku), animacja odbicia pieczątki z tokenów ruchu, przy redukcji ruchu samo pojawienie się. | 1 | S |
| 4.5 | **Pusty stan z działaniem** (po N-3): „Skrzynka jest pusta” + przycisk „Zapisz pomysł” (fokus w polu) i podpowiedź `Alt+K`. | 1 | S |
| 4.6 | **Tryb porządkowania jako karta:** większa karta notatki z okładką (pierwszy obraz), pasek postępu „3 z 12” zamiast samego tekstu, przejście do następnej karty przesunięciem (`view-transition` albo `motion`, przy redukcji ruchu bez animacji). | 2 | M |

## Etap 5: Skrzynka w innych działach

| # | Co | W | N |
|---|----|---|---|
| 5.1 | **Dziś:** wiersz „Skrzynka: 5 do posortowania” z przyciskiem „Porządkuj”, tylko gdy licznik > 0 (w planie Dziś jako punkt). | 2 | S |
| 5.2 | **Przegląd tygodnia:** kategoria „Skrzynka starsza niż 7 dni” w `WeeklyReviewCard`. | 1 | S |
| 5.3 | **Odznaka aplikacji:** licznik Skrzynki dokładany do `navigator.setAppBadge`, jeśli użytkownik włączy (Ustawienia → Powiadomienia). | 1 | S |

## Etap 6: QA działu

- Zrzuty `@visual`: widok Skrzynki (pusty, z notatkami), tryb porządkowania (karta, „Gotowe”), pole z chipami fraz × 7 motywów × komputer i telefon.
- axe: pole przechwytywania, tryb porządkowania, okno `Alt+K`.
- Ręcznie na telefonie: Enter/„Zapisz”, dyktowanie, skrót PWA, gesty (jeśli 3.5).

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| S-1 | „Odłóż” (3.3) z nowym polem `snoozedUntil`, czy Skrzynka zostaje czystą regułą? | Tak, pole przez dopisanie. Bez tego notatki „na później” wracają przy każdym porządkowaniu i tryb traci sens przy dłuższej liście. |
| S-2 | Czy notatka z przypomnieniem (bez folderu i etykiety) ma wychodzić ze Skrzynki? | Nie. Przypomnienie to „kiedy”, a nie „gdzie”; zostaje do posortowania. |
| S-3 | Domyślne sortowanie Skrzynki „najstarsze najpierw” (4.3)? | Tak, tylko w Skrzynce. Kolejka do opróżnienia, nie lista bieżąca. |

## Kolejność wdrażania

1. Etap 1 (cały).
2. Etap 2: 2.1, 2.3, 2.2, 2.5, 2.4.
3. Etap 3: 3.1, 3.2, 3.4, 3.3 (po S-1), 3.5 (po decyzji o swipe).
4. Fundament z planu przekrojowego, potem Etap 4: 4.2, 4.1, 4.3 (po S-3), 4.6, 4.4, 4.5 (po N-3).
5. Etap 5 razem z planem Dziś.
6. Etap 6 na koniec.

Następny plan w serii: **Dziś** (kolejność działów z `plan-dzialy-2026-10-22.md`).

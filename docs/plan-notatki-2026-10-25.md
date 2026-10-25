# Plan: dopracowanie, ulepszenie, rozbudowa i upiększenie działu „Notatki” (2026-10-25)

Pierwszy z serii planów „dział po dziale”. Kolejne działy dostaną osobne pliki `docs/plan-<dział>-2026-10-xx.md` w tym samym układzie.

## Kontekst

**Co już jest zrobione** (nie powtarzamy):
- `docs/plan-notatki-2026-10-19.md`: fazy F0–F7 (tytuł, nagłówek, puste stany, pieczątka licznika, `rounded-card`).
- `docs/plan-dzialy-2026-10-22.md` §2: sekcja „Poprawa” i większość „Dopracowania” (Fale 1–5), w tym niemodalny podgląd i dolny pasek czytnika na telefonie.
- `docs/plan-rozbudowa-2026-10-23.md`: Fazy 0–4. Edytor CodeMirror 6 z podglądem na żywo, przekaźnik E2E, sieć wiedzy 3.1–3.9 (aliasy, etykiety zagnieżdżone, `![[…]]`, `^id`, lokalny graf, panel boczny, „Obok”, notatki okresowe, wyodrębnienie), MiniSearch z operatorami.
- Właściwości notatek 4b: typy `text`, `number`, `date`, `select` (`lib/noteProps.ts:7`), tabela, sortowanie i filtr po polu.

**Co zostało otwarte (sprawdzone w kodzie 2026-10-25):**

| Skąd | Punkt | Dowód |
|---|---|---|
| plan-dzialy §2 Dopr. 2 | Podgląd Markdown obok edytora zawsze w `grid-cols-2`, także przy 390 px; placeholder „Podgląd...” z trzema kropkami | `NoteEditor.tsx:172,175` |
| §2 Dopr. 1 | Przywrócenie wersji bez „Cofnij” | `VersionHistory*.tsx` (brak undo) |
| §2 Dopr. 4 | Brak galerii obrazów notatki (następny, poprzedni, „2/5”). Praca już ma `PhotoGalleryDialog` | `study/PhotoGallery.tsx:18` |
| §2 Rozb. 2–7 | Rysowanie na zdjęciu notatki, porównanie wersji, „Otwórz” załącznik (dziś tylko „Pobierz”), pola tak/nie i link, szablon folderu, nacisk rysika | `AttachmentsList.tsx:88`, `noteProps.ts:7` |
| §2 Wygląd 3–5, 7 | Arkusz „⋯” w grupach, płótno w stylu zeszytu, tryb skupienia, oś czasu wersji | — |
| rozbudowa F4 | Indeks w Workerze, zrzut do IndexedDB, trafienia w nagłówkach i blokach w palecie | `opis.md` (Wyszukiwanie) |
| rozbudowa F5–F8 | Bazy (formuły, relacje, zapisane widoki), bogate treści (KaTeX, Mermaid, kolorowanie kodu), folder `.md`, kanwa | brak w `src/` |
| rozbudowa F10 | `Index.tsx` ma 1145 linii, `yjsStore.ts` 1044 | `wc -l` |
| opis.md | Przeciąganie pozycji listy zadań odłożone; puste stany bez przycisku | `opis.md` (Notatki — stan aktualny) |

**Powiązanie z planem przekrojowym** (`docs/plan-ui-ux-qol-2026-10-25.md`): ten plan stosuje tamte techniki w Notatkach. Fundament (Faza 0–1 przekrojowego: zrzuty, promienie, cienie, warstwy) robimy raz dla całej aplikacji, przed Etapem 4 tego planu.

**Ograniczenia:**
- **Paczka startowa** (próg 401 KB, mały zapas). Wszystko nowe w leniwych chunkach (`viewPreload`, `import()` na żądanie). KaTeX, Mermaid i języki kodu tylko, gdy treść ich używa.
- **Dane:** nowe pola i mapy Yjs wyłącznie przez dopisanie (stare klienty ignorują nieznane klucze). Każda zmiana schematu ma test zgodności ze starą kopią (`noteSchema*.test.ts`, `fullBackup.test.ts`) i obsługę w eksporcie i imporcie (MD, ZIP).
- **Notatki prywatne** (`locked`) wyłączone z indeksów, osadzeń, formuł i folderu `.md`.
- **7 motywów, redukcja ruchu, WCAG 2.2 AA:** jak w planie przekrojowym.
- **Kolejność w punkcie:** test → kod → `opis.md` → commit. Przed zmianą wyglądu skill `frontend-design`.
- **Pułapki:** `NoteCard.tsx` ma CRLF i bajty zerowe (edycja przez Edit, nie `sed`). Reguły Zeszytu jako `html[data-skin="zeszyt"]`. W e2e szukać notatek przez `getByRole("heading")`.

Legenda: W = wartość (1–3), N = nakład (S/M/L).

---

## Etap 1: poprawki i zaległe drobiazgi (S, najpierw)

| # | Co | Gdzie | W | N |
|---|----|-------|---|---|
| 1.1 | **Podgląd na telefonie:** poniżej `sm` zakładki „Edycja/Podgląd” (Radix Tabs) zamiast dwóch kolumn. „Podgląd...” → „Podgląd…”. | `NoteEditor.tsx:172` | 3 | S |
| 1.2 | **Przywrócenie wersji z „Cofnij”:** przed przywróceniem zapis bieżącej treści jako wersji, toast z akcją (`lib/undoToast.ts`). Dodać `aria-expanded` przy rozwijaniu wersji. | `VersionHistory*.tsx`, `useNoteVersions.ts` | 2 | S |
| 1.3 | **Płótno nie gubi rysunku:** Esc i klik w tło przy niezapisanych kreskach pytają albo zapisują szkic. „Wyczyść” z „Cofnij”. Etykiety `aria-label` kolorów i narzędzi. | `DrawingCanvas.tsx:199` | 2 | S |
| 1.4 | **„Otwórz” załącznik:** PDF i obraz w nowej karcie (blob URL odwołany z opóźnieniem, wspólny helper z `downloadBlob.ts`). Na iOS PWA fallback na „Pobierz”. | `AttachmentsList.tsx:88` | 2 | S |
| 1.5 | **Galeria obrazów notatki:** reużycie `PhotoGalleryDialog` z Pracy (←/→, przesunięcie palcem, „2/5”, „Pobierz”), bez kopiowania kodu. Miniatury w kaflu jako `<button>`, w trybie zaznaczania nie otwierają galerii. | `NoteImage.tsx`, `NoteCardBody.tsx`, `study/PhotoGallery.tsx` | 2 | S |
| 1.6 | **Data na kaflu z rokiem**, gdy inny niż bieżący, w `<time dateTime title>`. | `NoteCardBody.tsx` | 1 | S |

## Etap 2: codzienna praca z notatką (największa wartość)

| # | Co | W | N |
|---|----|---|---|
| 2.1 | **Przeciąganie pozycji listy zadań** (`@dnd-kit/sortable` już jest w paczce, bez nowej zależności). Uchwyt 44 px na dotyku, Alt+↑/↓ i przyciski zostają jako dostępny odpowiednik. Ogłoszenie zmiany przez `aria-live`. | 3 | M |
| 2.2 | **Podzadania: dopracowanie.** Wcięcie o jeden poziom już jest (`indent: 1`, Tab/Shift+Tab, `ChecklistEditor.tsx:121`). Brakuje: odhaczenie rodzica odhacza podzadania (z „Cofnij”), zwijanie podzadań, przeciąganie rodzica razem z dziećmi (z 2.1), licznik postępu „3/5” z podzadaniami. | 2 | M |
| 2.3 | **Klawisze na siatce:** `gridKeyboardNav.ts` ma już Spację, Enter, Del, A, P, D, R, F. Dołożyć `M` (przenieś do folderu) i `L` (etykieta). Wszystkie klawisze pokazać w podpowiedziach przycisków kafla (`HoverTip` + `<kbd>`) i w `ShortcutsDialog`. | 2 | S |
| 2.4 | **Arkusz „⋯” w grupach** (otwarte z planu działów): Wygląd / Porządek / Udostępnij / Zaawansowane, nagłówki sekcji, „Usuń” czerwony także na dotyku. Na telefonie arkusz z punktami zatrzymania (`ViewSheet`). | 3 | M |
| 2.5 | **Paleta poleceń w kontekście notatki:** przy otwartej notatce na górze akcje tej notatki (przypnij, przenieś, eksport, historia, wyodrębnij, kopiuj link `[[…]]`). Trafienia w nagłówkach i blokach (`sectionHits.ts`) jako druga sekcja wyników. | 2 | M |
| 2.6 | **Wklejanie i przeciąganie plików do edytora:** upuszczony obraz lub PDF trafia do notatki (obraz w treści jako `![[…]]`, PDF jako załącznik), z paskiem postępu przy dużych plikach. | 2 | M |
| 2.7 | **Ostatnio otwierane notatki:** `lib/lastOpened.ts` już zapisuje otwarcia (sortowanie). Dołożyć sekcję „Ostatnie” w palecie i w pasku bocznym (limit 10) oraz Alt+← / Alt+→ po historii otwieranych notatek w czytniku. | 2 | S |
| 2.8 | **Domyślny szablon folderu:** w ustawieniach folderu wybór szablonu i domyślnych pól. Nowa notatka w folderze dostaje je od razu. Dane: `templateId` i `defaultProps` w mapie folderów. | 2 | M |

## Etap 3: wyszukiwanie i porządek (dokończenie Fazy 4 rozbudowy)

| # | Co | W | N |
|---|----|---|---|
| 3.1 | **Indeks w Workerze** (`workers/search.worker.ts`): wyszukiwanie async z `useTransition`, pole reaguje od razu. Najpierw przepiąć synchroniczne wywołania (lista miejsc w `opis.md`). | 2 | M |
| 3.2 | **Zrzut indeksu do IndexedDB** (`idb-keyval`, `MiniSearch.toJSON`), wersjonowany. Start nie przebudowuje 5000 notatek. | 1 | S |
| 3.3 | **Zapisane wyszukiwania jako widoki** w pasku bocznym (rozszerzenie `savedFilters.ts`): nazwa, ikona, licznik. Pierwszy krok do baz z Etapu 5. | 2 | S |
| 3.4 | **Porządki w etykietach:** zmiana nazwy i scalanie etykiet (z gałęziami `a/b`) z podglądem liczby notatek i „Cofnij”. | 2 | S |
| 3.5 | **Podpowiedź duplikatu** przy tworzeniu: notatka o prawie tym samym tytule (MiniSearch, `fuzzy`) → „Otwórz istniejącą / Utwórz mimo to”. | 1 | S |

## Etap 4: wygląd i ruch (po fundamencie z planu przekrojowego)

| # | Co | W | N |
|---|----|---|---|
| 4.1 | **Kafel → notatka jako jeden element:** `view-transition-name` na kaflu, tytule i okładce. Kafel rozrasta się w edytor i wraca na miejsce. Bez API zostaje `useOriginFromTile`. | 3 | M |
| 4.2 | **Kafel bardziej „papierowy”:** tytuł z `text-wrap: balance`, fragment treści z wygaszeniem (`mask-image`) zamiast ucięcia w pół linii, przy najechaniu obwódka akcentu zamiast uniesienia (masonry nie drga). Gęstości zostają w jednej tabeli. | 2 | M |
| 4.3 | **Czytnik do czytania:** szerokość tekstu 65–72 znaków (`max-inline-size: 70ch`), `text-wrap: pretty`, pasek postępu czytania (`animation-timeline: scroll()`), lista zadań w czytniku tym samym stylem co na kaflu (otwarte z planu działów). | 2 | S |
| 4.4 | **Płótno w stylu zeszytu** (otwarte): długopis, ołówek, zakreślacz z tokenów motywu, kratka w ciemnym motywie, jeden przewijany pasek narzędzi. Pointer Events z `pressure` i `getCoalescedEvents()` (gładsza linia rysikiem). | 2 | M |
| 4.5 | **Tryb skupienia** (otwarte): bez pulsowania co sekundę, cienki pierścień postępu (SVG), czas liczony z `performance.now()` (bez dryfu w tle), zapis szkicu. | 1 | S |
| 4.6 | **Puste stany z jednym działaniem:** zmiana decyzji z `opis.md` („bez przycisków”) na jeden główny przycisk (np. „Nowa notatka”, „Pokaż wszystkie”), bo to szybsze niż szukanie kompozytora. **Decyzja N-3.** | 2 | S |
| 4.7 | **Mikrointerakcje Notatek:** rysowanie ptaszka w checkboxie, „pyk” licznika grupy, krótkie wygaszenie kafla przy archiwizacji spójne z gestem. Czasy i krzywe z tokenów ruchu (plan przekrojowy 2.7). | 2 | S |
| 4.8 | **Oś czasu wersji:** wersje jako pionowa oś z datą względną, autorem urządzenia (jeśli znany z synchronizacji) i liczbą zmienionych słów. | 1 | S |

## Etap 5: rozbudowa treści (wszystko leniwie)

| # | Co | W | N |
|---|----|---|---|
| 5.1 | **Porównanie wersji:** diff słów (własny Myers/LCS na tokenach, bez biblioteki) widok „obok” i „w tekście”, z kolorami z tokenów. Z poziomu historii: „Przywróć tylko ten akapit”. | 2 | M |
| 5.2 | **Rysowanie na zdjęciu notatki:** „Opisz na zdjęciu” w galerii otwiera `DrawingCanvas` z `initialImage` (już obsługiwane, dziś tylko w Pracy). Wynik jako nowe zdjęcie, oryginał zostaje. | 2 | S |
| 5.3 | **Kolorowanie kodu:** w CM `@codemirror/language-data` (języki na żądanie), w czytniku ta sama gramatyka Lezer przez `highlightTree`, bez drugiej biblioteki. | 1 | M |
| 5.4 | **Wzory:** `remark-math` + `rehype-katex`, chunk ładowany tylko przy `$…$` w treści. | 1 | S |
| 5.5 | **Diagramy Mermaid:** blok ` ```mermaid `, chunk poza precache, motyw z tokenów, błąd składni jako `StatusPanel inline`. | 1 | M |
| 5.6 | **Podgląd PDF w czytniku** (`<iframe>` z blobem; na iOS „Otwórz”). | 2 | S |

## Etap 6: bazy (Faza 5 rozbudowy, w krokach)

| # | Co | W | N |
|---|----|---|---|
| 6.1 | **Nowe typy pól:** `checkbox` (tak/nie), `url`, `multi` (wiele wyborów), `created`/`updated` (tylko do odczytu). Walidacja w `cleanPropDef`/`cleanNoteProps`, eksport i import. | 2 | M |
| 6.2 | **Zapisane widoki** (mapa `views` w Y.Doc): źródło (folder, etykieta, zapytanie), układ (tabela, tablica, lista, galeria), filtry, sortowanie, grupowanie, widoczne kolumny. W pasku bocznym. | 3 | L |
| 6.3 | **Galeria** jako układ widoku: okładka z pierwszego obrazu, tytuł, 2–3 pola. | 2 | M |
| 6.4 | **Osadzony widok w notatce:** blok ` ```zapytanie etykieta:budowa sortuj:termin ``` ` z parserem wyszukiwarki, render w czytniku i jako widżet CM, edycja komórek w miejscu. | 2 | L |
| 6.5 | **Relacje i formuły** (`relation`, `formula`, `rollup`): własny parser Pratt bez `eval`, liczone w Workerze. Dopiero po 6.1–6.4 i decyzji N-2. | 1 | L |

## Etap 7: porządki w kodzie (równolegle)

- `Index.tsx` (1145 linii): wydzielić stan okien i obsługę widoków do hooków (`useIndexDialogs`, `useViewRouting`), zostawić kompozycję.
- `yjsStore.ts` (1044 linie): podział per mapa (`notes`, `folders`, `propDefs`, a od 6.2 `views`).
- Kafel: `<Activity>` dla ostatnio otwartego edytora (szybkie ponowne otwarcie) po pomiarze pamięci na `pixel-7`.
- Testy własnościowe scalania (`fast-check`) dla pozycji listy z 2.1–2.2 (kolejność i wcięcie z dwóch urządzeń).

## Etap 8: QA działu

- Zrzuty `@visual` Notatek (siatka, tablica, tabela, czytnik, edytor, puste stany) × 7 motywów × komputer i telefon.
- axe: siatka, czytnik, edytor, arkusz „⋯”, galeria, historia wersji.
- `perf.spec.ts`: 5000 notatek, wyszukiwanie < 50 ms, INP przy przełączaniu widoku < 200 ms.
- Ręcznie na telefonie: przeciąganie listy, galeria palcem, płótno rysikiem, przejście kafel → notatka.

---

## Decyzje do podjęcia

| # | Pytanie | Rekomendacja |
|---|---|---|
| N-2 | Formuły i relacje (6.5): robić czy zostać na widokach? | Zostać na 6.1–6.4. Wrócić, jeśli pojawi się konkretna potrzeba (np. suma kosztów z notatek budowy). |
| N-3 | Puste stany z przyciskiem (4.6), wbrew dotychczasowej decyzji „bez przycisków”? | Tak, jeden przycisk. Nowy użytkownik nie musi wiedzieć, gdzie jest kompozytor. |
| N-4 | Folder `.md` na dysku i kanwa (F7, F8 rozbudowy): w tym planie? | Nie. To osobne, duże tematy; wrócić po bazach. |

## Kolejność wdrażania

1. Etap 1 (cały, małe punkty, od razu odczuwalne).
2. Etap 2: 2.4, 2.1, 2.3, 2.7, 2.5, 2.6, 2.2, 2.8.
3. Fundament z planu przekrojowego (Faza 0–1), potem Etap 4: 4.1, 4.2, 4.3, 4.7, 4.6 (po N-3), 4.4, 4.5, 4.8.
4. Etap 3: 3.1, 3.2, 3.3, 3.4, 3.5.
5. Etap 5: 5.2, 5.6, 5.1, potem 5.3–5.5.
6. Etap 6: 6.1, 6.2, 6.3, 6.4 (6.5 po N-2).
7. Etap 7 równolegle, Etap 8 na koniec.

Następny plan w serii: **Skrzynka** albo **Dziś** (kolejność działów z `plan-dzialy-2026-10-22.md`).

# Plan rozbudowy Notatnika do poziomu Notion/Obsidian (2026-10-23)

## Context

Notatnik (NOTKI) to dojrzała aplikacja PWA typu local-first: React 19, Vite 8, Tailwind 4, Yjs (`y-indexeddb` lokalnie, `y-webrtc` P2P), ok. 850 commitów, 124 pliki e2e. Notatki mają już: wikilinki `[[tytuł#nagłówek]]`, linki zwrotne i niepowiązane wzmianki, graf (`lib/noteGraph.ts`, limit 150 węzłów), podstrony (`parentId`), właściwości (tekst/liczba/data/wybór, `propDefs`), widoki siatka/tablica/tabela, menu `/`, callouty i bloki zwijane, szablony ze zmiennymi, notatkę dzienną, wersje, skarbiec (AES-GCM), import Keep/MD/ZIP, eksport MD/ZIP/PDF, clipper, Share Target i paletę poleceń (cmdk).

Względem Notion i Obsidiana brakuje fundamentów, nie drobiazgów:

| Obszar | Notion / Obsidian | Notatnik dziś |
| --- | --- | --- |
| Edytor | bloki (Notion) / live preview na CodeMirror 6 (Obsidian) | `<textarea>` + osobny podgląd Markdown |
| Bazy | wiele widoków, relacje, formuły, osadzone widoki, Bases/Dataview | pola w tabeli, jeden widok na raz, filtry tylko w wyszukiwarce |
| Sieć wiedzy | osadzanie `![[...]]`, bloki `^id`, aliasy, etykiety `a/b`, lokalny graf | linki i nagłówki; graf globalny |
| Sync | serwer (Notion) / Obsidian Sync E2E | P2P bez TURN; oba urządzenia muszą być online jednocześnie |
| Szukanie | pełnotekstowe z indeksem, semantyczne (AI) | Fuse na wątku głównym, liczony od nowa przy zmianach |
| Treści | KaTeX, Mermaid, kolorowanie kodu | odrzucone (paczka) |
| Przestrzeń | Canvas, karty i podział okna, folder `.md` na dysku | brak |

Decyzje właściciela z 2026-10-23: **CodeMirror 6 live preview**, **własny przekaźnik synchronizacji E2E**, **lokalne AI w przeglądarce** (bez wysyłania danych), odblokowane: **KaTeX/Mermaid/kod**, **etykiety zagnieżdżone i aliasy**, **kanwa**, **folder `.md` na dysku**. Te decyzje unieważniają odpowiednie punkty listy „Świadomie NIE robimy” w `roadmap.md`. Trzeba ją zaktualizować w Fazie 0.

Cel: z MVP zrobić narzędzie wiedzy poziomu Obsidiana (lokalne, prywatne, szybkie) z bazami w stylu Notion. Działy Grafik, Praca, Długi i Ćwiczenia zostają bez zmian; korzystają tylko z nowego edytora, wyszukiwarki i synchronizacji.

---

## Zasady przekrojowe (obowiązują w każdej fazie)

1. **Paczka startowa się nie zwiększa.** Dziś ma 411,7 KB przy progu 410,6 KB (`e2e/bundle.spec.ts`), więc już jest ponad progiem. Każda nowa biblioteka trafia do leniwego chunka (`import()` jak w `lib/viewPreload.ts` i `lib/searchNotes.ts`). Każda faza kończy się pomiarem.
2. **Dane w Yjs zgodne wstecz.** Nowe pola dostają osobne klucze. Nowe mapy w korzeniu dokumentu powstają tak jak `propDefs`. Walidacja `clean*` przy odczycie, kopii i imporcie (wzorzec z `lib/noteProps.ts`). Starsza aplikacja ignoruje nieznane pola i ich nie kasuje. Przy zmianach niezgodnych obowiązuje decyzja z D5: wszystkie urządzenia na nowej wersji.
3. **Notatki prywatne** (szyfrogram w skarbcu, `PRIVATE_FIELDS`) nie trafiają do indeksów, AI, folderu na dysku ani przekaźnika w postaci jawnej. Każda funkcja ma test, który to sprawdza.
4. **Flagi funkcji.** Nowy moduł `src/lib/featureFlags.ts` (klucz `kaczy.features.v1`, w kopii ustawień) i karta „Funkcje w przygotowaniu” w Ustawieniach. Duże zmiany (edytor, przekaźnik, AI) wchodzą za flagą i stają się domyślne dopiero po pełnym e2e.
5. **Ciężka praca poza wątkiem UI.** Wspólna warstwa Web Workerów (`src/workers/`, małe RPC na `postMessage`, bez nowej zależności) dla indeksu, grafu, AI i formuł.
6. **Proces jak dotąd:** jeden krok = testy jednostkowe + e2e + commit + wpis w `opis.md` (CLAUDE.md). Czysta logika w `src/lib/*` z testem, UI w komponentach. Przed każdą nową biblioteką sprawdzenie aktualnej wersji i API przez context7. Wersja ma mieć co najmniej 2 tygodnie.
7. **Polski interfejs, dostępność WCAG 2.2 AA** (`e2e/a11y.spec.ts`), cele dotyku 44 px, ograniczony ruch, wszystkie style (`skins.css`).

---

## Faza 0 — Fundamenty (S/M, ok. 2 dni)

- Domknąć stan z 2026-10-22: Fala 3 (ToggleGroup w Ustawieniach i Długach, aria-live w kalendarzu, fokus w quizie, niemodalny podgląd notatki). Decyzja o progu paczki: odchudzić ścieżkę startową, nie podnosić progu. Kandydaci do przeniesienia do leniwych chunków: `yjsSync` (ładowany dopiero przy włączonym sync), Fuse, `date-fns/locale`.
- `src/lib/featureFlags.ts` + karta w Ustawieniach (`components/settings/`).
- `src/workers/rpc.ts` (wywołanie z id i odpowiedzią, przekazywanie błędów, `terminate` przy bezczynności) + test w Vitest.
- **Zestaw do pomiarów:** generator 1000/5000 notatek (`src/test/fixtures/bigVault.ts`) i e2e `perf.spec.ts`: czas startu, otwarcia notatki, wpisania znaku i wyszukiwania. Te liczby są punktem odniesienia dla kolejnych faz.
- `roadmap.md`: nowy rozdział „Plan rozbudowy 2026-10-23” z fazami i zaktualizowana lista „Świadomie NIE”.

## Faza 1 — Edytor CodeMirror 6 z podglądem na żywo (L, najważniejsza)

**Cel:** pisanie jak w Obsidianie. Markdown zostaje formatem zapisu, formatowanie widać w trakcie pisania, znaczniki pokazują się tylko w linii z kursorem.

- **Paczki** (leniwy chunk `editor-cm`, szacunkowo 120–160 KB gzip): `@codemirror/state`, `view`, `commands`, `language`, `lang-markdown`, `autocomplete`, `search`, `@lezer/markdown`; później `y-codemirror.next`.
- **Nowe moduły** w `src/components/editor/`:
  - `CmEditor.tsx`: komponent z API `value`/`onChange`/`onSelect`/`onKeyDown`/`onPaste`, zamiennik `<textarea>` w `NoteEditor.tsx` (linie 114 i 120) i `AddNoteBar.tsx`.
  - `livePreview.ts`: `ViewPlugin` z dekoracjami. Chowa `#`, `**`, `_`, `` ` ``, `[[ ]]` poza linią kursora. Widżety: pole zadania (klik odhacza), obraz, link wiki (klik otwiera, najechanie daje `WikiLinkPreview`), callout, pozioma linia, tabela renderowana poza kursorem.
  - `cmExtensions.ts`: skróty z `lib/editorKeys.ts` (Alt+↑/↓, Tab, listy), autouzupełnianie `[[`, `@`, `/` jako `CompletionSource` (przenieść logikę z `lib/slashMenu.ts`, `lib/mentions.ts` i `wikiQueryAt`/`suggestWikiTitles` z `lib/wikiLinks.ts`; same funkcje zostają i mają testy), szukaj i zamień (zamiast `FindReplaceBar` w CM), składanie nagłówków i list, zawijanie, sprawdzanie pisowni (`spellcheck` na `contentDOM`).
  - Motyw CM z tokenów CSS (`--app-font`, kolory `data-skin`, kratka Zeszytu), tryb budowa (większy tekst), `prefers-reduced-motion`.
- **Integracja z zapisem:**
  - **1a (za flagą):** CM jako kontrolowany zamiennik pola. `useNoteEditSession` (szkic, `commitDraft`, autozapis, `saveStatus`) i `useLiveNoteText` (`rebaseNoteTextEdit`) zostają bez zmian, więc ryzyko jest niskie, a notatki prywatne (bez `Y.Text`) działają tak samo.
  - **1b:** dla notatek jawnych wiązanie `yCollab` bezpośrednio z `Y.Text` z `yjsStore` (`content` jest już `Y.Text`, `yjsStore.ts:250`). Każda zmiana od razu w CRDT, `useLiveNoteText` niepotrzebny, „Zapisano” liczone z aktualizacji dokumentu. Wersje (`versionsStore`) zapisywane przy zamknięciu albo po przerwie, jak dziś. Notatki prywatne zostają przy 1a.
- **Telefon:** test IME i autokorekty Androida (Pixel 7 w Playwright i prawdziwy telefon), `--kb-inset`, pasek formatowania nad klawiaturą wołający komendy CM. To rozwiązuje też błąd z planu działów: „## wstawiane w miejscu karetki” (Notatki/Poprawa 5).
- **Czytnik** (`NoteReader`) zostaje na `MarkdownRenderer`. Kafel w siatce też (bez CM, żeby siatka była lekka); CM montuje się dopiero przy edycji.
- **Testy:** jednostkowe dla dekoracji (stan CM → zbiór zakresów), `cmExtensions.test.ts`. E2E: przeniesienie istniejących (`editing`, `editor-keys`, `slash-menu`, `mentions`, `wikilinks`, `live-text`, `checklist`, `find-replace`) na nowy edytor. Selektory `textarea` zamienić na wspólny helper `e2e/helpers/editor.ts`.
- **Usunięcie starego pola** dopiero po tygodniu z flagą włączoną domyślnie.

## Faza 1b — Motywy: animacje, mikrointerakcje i przejścia (po Fazie 1, prośba właściciela 2026-10-23)

Cel: każdy z 7 stylów (Zeszyt, Plan, Neon, Zorza, Miedź, Matryca, Hydraulika) ma własną sygnaturę ruchu i detali, a nie tę samą bazę z innymi kolorami. Ten sam wzorzec technicznego ruchu jak dotąd: tylko `transform` i `opacity`, ograniczony ruch wyłącza, tryb budowa wycisza dekoracje.

- **Sygnatury (propozycje, do zatwierdzenia przy realizacji):**
  - Zeszyt: długopis rysuje podkreślenie nagłówka, przy zmianie widoku kartka „przewraca się” z kątem, pieczątka przy odhaczeniu.
  - Plan: siatka kreślarska rysuje się przy otwarciu okna, wymiarowanie przy zaznaczeniu.
  - Neon: poświata obramowań przy fokusie, rozbłysk przy przypięciu, litery nagłówka mrugają przy pierwszym uruchomieniu dnia.
  - Zorza: poświata reaguje na przewijanie (paralaksa przez `transform`), przejście motywu jako fala barw.
  - Miedź: metaliczny połysk przesuwa się po przycisku, „para” z rury przy zapisie.
  - Matryca: znaki zbierają się w kursor przy najechaniu, przejście widoku jako kaskada kolumn.
  - Hydraulika: rura napełnia się falą przy zapisie, bąbelki przy sukcesie, przelewanie przy przejściu.
- **Przejścia:** każdy motyw ma własne krzywe w `src/lib/motion.ts` (tokeny per styl), zamiast wspólnych `spring`/`tween`.
- **Wymagania:** `prefers-reduced-motion` i przełącznik „Ruch i animacje” zerują nowe efekty; płótna ≤60 kl./s; nowe efekty tylko w `transform`/`opacity`.
- **Testy:** rozszerzyć `e2e/skin-motion.spec.ts` o sygnatury każdego stylu, `skinContrast.test.ts` dla nowych kolorów, `e2e/a11y.spec.ts` dla każdego stylu (jasny i ciemny).
- **Narzędzie:** przy realizacji ładować skill `frontend-design` (zgodnie z notatką w pamięci projektu).
- **Budżet:** efekty CSS i małe moduły; ciężkie elementy (płótno) tylko leniwie.

## Faza 2 — Przekaźnik synchronizacji E2E (M/L)

**Cel:** zmiany docierają, nawet gdy drugie urządzenie jest wyłączone. Serwer nie widzi treści.

- **Serwer `relay-server/`** (Node 22, `ws`, SQLite przez `better-sqlite3`, Dockerfile i README jak w `push-server/`; czysta logika w `core.js` z testami):
  - pokój = `roomId` (hash z kodu, jak `roomNameFor` w `lib/yjsSync.ts:174`); zapis wymaga tokenu HMAC z klucza pokoju;
  - log zaszyfrowanych aktualizacji z kolejnym numerem; `GET since=n`, `POST` aktualizacji, `PUT snapshot` (kompaktowanie przez klienta: zaszyfrowany `encodeStateAsUpdateV2` zastępuje wpisy ≤ n);
  - limity: rozmiar wpisu, pokoju, liczba zapytań; `GET /health`; bez kont i bez logowania treści.
- **Klient** `src/lib/sync/relayProvider.ts`:
  - klucz AES-GCM z kodu przez HKDF (istniejące `deriveKey…`/`encryptString` w `lib/vault.ts:118-142`, osobna etykieta `info`);
  - wysyła `doc.on("update")` w paczkach co ok. 1 s, przy schowaniu karty `keepalive`; pobiera przy starcie, po powrocie do karty i przez WebSocket na żywo;
  - kolejka offline w IndexedDB (zgodna z `OfflineQueuePanel`); kompaktowanie, gdy log ma ponad 500 wpisów albo 5 MB;
  - obrazy i załączniki: zaszyfrowane bloby po SHA-256 (rozszerzenie `lib/imageSync.ts`).
- P2P (`y-webrtc`) zostaje; przekaźnik jest drugim kanałem. `SyncSettings.tsx`: adres przekaźnika, stan („ostatnio wysłano/pobrano”), test połączenia; diagnoza w jednym zdaniu jak dziś.
- **Bezpieczeństwo:** model zagrożeń w `relay-server/README.md`; serwer zna tylko rozmiary i czasy. Przegląd przez `security-review`.
- **Testy:** `relay-server/core.test.js`, `relayProvider.test.ts` (dwa `Y.Doc` z atrapą serwera: rozjazd, kompaktowanie, zła wersja klucza), e2e z prawdziwym serwerem uruchamianym w `webServer` Playwrighta.

## Faza 3 — Sieć wiedzy (M)

- **Aliasy:** pole `aliases: string[]` na notatce (Yjs, schemat, frontmatter MD/ZIP). `resolveWikiTarget` i `buildWikiIndex` (`lib/wikiLinks.ts`) rozpoznają aliasy. Składnia `[[cel|wyświetlany tekst]]`.
- **Etykiety zagnieżdżone:** `#budowa/łazienka`. Drzewo w pasku bocznym (`sidebar/`), filtr po rodzicu obejmuje dzieci, zmiana nazwy gałęzi. Bez zmiany modelu (etykieta to dalej string); logika w `lib/labelTree.ts`.
- **Osadzanie:** `![[notatka]]`, `![[notatka#nagłówek]]`, `![[notatka#^id]]`. Wtyczka remark w `MarkdownRendererImpl.tsx` i widżet w CM. Limit głębokości 3 i ochrona przed cyklem.
- **Odnośniki do bloków:** `^id` na końcu akapitu, autouzupełnianie `[[notatka#^`, linki zwrotne na poziomie bloku.
- **Lokalny graf** w czytniku (sąsiedzi do głębokości 2) i filtry grafu (etykieta, folder). Układ liczony w Workerze. `GRAPH_NODE_LIMIT` podniesiony po pomiarze.
- **Panel boczny na komputerze** (od `xl`): Konspekt, Linki zwrotne, Niepowiązane wzmianki, Pola, Lokalny graf w zakładkach.
- **Karty i podział okna (komputer):** dwie notatki obok siebie, Ctrl+klik otwiera link w drugim panelu. Stan w `viewPrefs`.
- **Notatki okresowe:** tydzień i miesiąc obok dziennej (`lib/dailyNote.ts`), szablon z `templateVars`.
- **Wyodrębnij zaznaczenie do nowej notatki** z `[[linkiem]]` (otwarty punkt z planu działów) — zrobione (3.9): przycisk w pasku edytora, `lib/extractNote.ts`.

## Faza 4 — Wyszukiwanie z indeksem (M)

- `minisearch` w Workerze (`src/workers/search.worker.ts`) zamiast Fuse: BM25, prefiksy, literówki, pola z wagami (tytuł, aliasy, etykiety, treść, pola). Normalizacja polskich znaków przez `fold` z `lib/searchQuery.ts`.
- Indeks aktualizowany przyrostowo z aktualizacji Yjs (dodaj/usuń/zmień jedną notatkę). Zrzut indeksu w IndexedDB, żeby start nie przebudowywał wszystkiego.
- Operatory zostają (`parseSearchQuery`), dochodzą `alias:`, `ścieżka:`, `link:`, `pole>`/`pole<`, `zadanie:otwarte`.
- Paleta poleceń: szybki przełącznik notatek z trafieniami w nagłówkach i blokach.
- Test: wynik wyszukiwania zgodny z obecnym na zestawie z `searchNotes.test.ts`; `perf.spec.ts` dla 5000 notatek < 50 ms na zapytanie.

**Status (2026-10-24):** zrobione — MiniSearch zamiast Fuse (`fuse.js` usunięty), jeden indeks dokładany przyrostowo, wagi pól, prefiksy i literówki, `alias:`, `link:`, `zadanie:otwarte`, test 5000 notatek < 50 ms. Odłożone: indeks w Workerze (wyszukiwanie jest synchroniczne w kilku miejscach — przejście na async to osobny krok), zrzut do IndexedDB, `pole>`/`pole<` i `ścieżka:`, wyniki nagłówków i bloków w palecie poleceń.

## Faza 5 — Bazy w stylu Notion (L)

- **Nowe typy pól** (`lib/noteProps.ts`, `PropType`): `checkbox`, `url`, `multi`, `relation` (id notatek), `formula`, `rollup`, `created`, `updated`. Walidacja `cleanPropDef`/`cleanNoteProps`, eksport i import (`lib/import/commit.ts`, `inferPropType`).
- **Formuły:** własny parser i interpreter wyrażeń (`lib/formula/`: tokenizer, Pratt parser, funkcje `if`, `sum`, `dateDiff`, `contains`, `prop("…")`). Bez `eval`. Liczone w Workerze, wynik w pamięci podręcznej po `updatedAt`.
- **Zapisane widoki:** mapa `views` w korzeniu Y.Doc. Widok = źródło (folder, etykieta albo zapytanie), układ (tabela, tablica, lista, galeria, kalendarz, oś czasu), filtry, sortowanie, grupowanie, widoczne kolumny. Rozszerzenie `lib/savedFilters.ts` i `lib/viewPrefs.ts`. Widoki w pasku bocznym.
- **Osadzony widok w notatce:** blok ` ```baza id=… ``` ` albo zapytanie w stylu Dataview (` ```zapytanie etykieta:budowa sortuj:termin``` `) z tym samym parserem co wyszukiwarka. Render w czytniku i w CM (widżet), edycja komórek w miejscu.
- **Układ kalendarza i osi czasu** dla pól daty; korzysta z siatki z `components/calendar/`.
- **Szablon folderu i bazy:** nowa notatka w folderze dostaje domyślne pola i szablon (punkt „Domyślny szablon folderu” z planu działów).

## Faza 6 — Bogate treści (S/M, wszystko leniwie)

- **Matematyka:** `remark-math` + `rehype-katex` (chunk ładowany tylko, gdy treść zawiera `$`); w CM widżet z podglądem wzoru poza kursorem.
- **Mermaid:** blok ` ```mermaid ` renderowany leniwie (chunk ok. 600 KB, poza precache, cache `skin-fonts`-podobny), motyw z tokenów, błąd składni jako `StatusPanel inline`.
- **Kolorowanie kodu:** w CM z `@codemirror/language-data` (języki ładowane na żądanie); w czytniku ta sama gramatyka Lezer przez `highlightTree`, bez drugiej biblioteki.
- **Załączniki:** podgląd PDF w czytniku (`<iframe>` z blobem), „Otwórz” zamiast tylko „Pobierz”, galeria zdjęć z ←/→ i „2/5” (z planu działów).
- Precache: progi w `vite.config.ts` (`globIgnores`) dla nowych chunków.

## Faza 7 — Folder `.md` na dysku (M, Chrome/Edge na komputerze)

- `showDirectoryPicker`, uchwyt w IndexedDB (wzorzec z `lib/backupFileHandle.ts`), ponowna zgoda po restarcie przeglądarki.
- **Zapis:** zmieniona notatka → plik `Folder/Podfolder/Tytuł.md` z frontmatterem (serializer z `lib/noteMarkdown.ts`/`exportZip.ts`: id, etykiety, aliasy, pola, ikona). Obrazy do `_zalaczniki/` po hashu.
- **Odczyt:** skanowanie przy fokusie okna i co 30 s (porównanie `lastModified` i hasha), import zmienionego pliku parserem `lib/import/markdown.ts` do `Y.Text` jako różnica (`applyTextEdit`). Konflikt (zmiana w aplikacji i na dysku od ostatniej synchronizacji) → wersja w historii + toast, nic nie ginie.
- Manifest stanu `.notki/stan.json` (id ↔ ścieżka ↔ hash); zmiana nazwy pliku zachowuje id.
- Notatki prywatne i kosz pomijane. Na telefonie i w Safari karta pokazuje „niedostępne w tej przeglądarce”.
- Testy: czysta logika uzgadniania (`lib/folderSync/reconcile.ts`) z atrapą systemu plików; e2e z atrapą `FileSystemDirectoryHandle`.

## Faza 8 — Kanwa (L)

- Format **JSON Canvas 1.0** (zgodny z Obsidianem): węzły `text`, `file` (notatka), `link`, `group`; krawędzie ze stronami i strzałkami. Import i eksport `.canvas`.
- **Model:** mapa `canvases` w Y.Doc; węzły i krawędzie jako `Y.Map` (scalanie z dwóch urządzeń bez konfliktów).
- **Render:** własny, lekki (DOM dla kart + SVG dla krawędzi, `transform` do przesuwania i powiększania, Pointer Events z gestem dwóch palców). Bez tldraw (rozmiar, licencja). Karta notatki pokazuje `MarkdownRenderer` i otwiera czytnik.
- Funkcje: przeciąganie notatki z paska bocznego, grupy, kolory z tokenów, przyciąganie do kratki Zeszytu, minimapa, cofnij/ponów (`Y.UndoManager`), eksport PNG.
- Widok leniwy (`viewPreload`), trasa `/kanwa/:id`, pozycja w pasku bocznym.

## Faza 9 — Lokalne AI (M/L, za flagą, pobranie modelu na żądanie)

- `@huggingface/transformers` w Workerze, WebGPU z zapasem WASM. Wielojęzyczny model osadzeń (kandydaci: `multilingual-e5-small`, `paraphrase-multilingual-MiniLM-L12-v2`; wybór po pomiarze jakości na polskich notatkach i rozmiaru, ok. 30–120 MB). Pobranie tylko po zgodzie w Ustawieniach, z paskiem postępu, w Cache Storage, z przyciskiem „Usuń model”.
- Osadzenia per fragment (nagłówek/akapit) w IndexedDB, **nie w Yjs** (każde urządzenie liczy swoje). Liczone w tle przy bezczynności (`requestIdleCallback`), przyrostowo po `updatedAt`.
- **Funkcje:**
  - tryb wyszukiwania „Znaczeniowo” i łączenie z wynikami z MiniSearch (hybryda, RRF);
  - „Podobne notatki” w czytniku i w panelu bocznym;
  - propozycje `[[linków]]` dla niepowiązanych, ale podobnych notatek;
  - podpowiedź etykiety i folderu w Skrzynce (k najbliższych sąsiadów wśród opisanych notatek, bez LLM);
  - wykrywanie duplikatów przed scaleniem (`lib/mergeNotes.ts`).
- Notatki prywatne wykluczone; brak sieci po pobraniu modelu. Na słabym telefonie funkcja proponuje się wyłączyć (pomiar czasu pierwszego osadzenia).

## Faza 10 — Jakość, wydajność, porządki (stale, M)

- Pomiar `perf.spec.ts` przy 5000 notatek. Jeżeli siatka przekracza budżet, wirtualizacja listy i tabeli (`@tanstack/react-virtual`), wbrew dawnej decyzji, ale na podstawie liczb.
- `Index.tsx` (1090 linii) i `yjsStore.ts` (1013 linii): podział na moduły per mapa (`notes`, `folders`, `propDefs`, `views`, `canvases`).
- Testy własnościowe scalania CRDT (`fast-check`): dwa dokumenty, losowe operacje, ta sama zbieżność; dla właściwości, widoków, kanwy i folderu na dysku.
- CSP: przełączenie z `Report-Only` na egzekwowanie (decyzja z 2026-10-11), z uwzględnieniem Workerów i WASM (`wasm-unsafe-eval` tylko dla AI).
- Import z Notion (eksport Markdown+CSV) i z vaulta Obsidiana (folder `.md`, aliasy, `![[…]]`) w `lib/import/`, korzysta z Faz 3, 5 i 7.
- QA na prawdziwym telefonie (otwarty punkt 5.3) po Fazach 1 i 2.

---

## Kolejność i zależności

```
0 Fundamenty ─┬─ 1 Edytor CM6 ─┬─ 3 Sieć wiedzy ─┬─ 5 Bazy ── 8 Kanwa
              │                └─ 6 Treści       │
              ├─ 2 Przekaźnik E2E                ├─ 7 Folder .md
              └─ 4 Wyszukiwanie (Worker) ────────┴─ 9 Lokalne AI
10 Jakość — równolegle, po każdej fazie
```

Rekomendowana kolejność wykonania: **0 → 1 → 2 → 3 → 4 → 6 → 5 → 7 → 8 → 9**. Edytor i synchronizacja dają najwięcej codziennej wartości. Treści (6) są tanie po edytorze. Bazy (5) przed kanwą i folderem, bo korzystają z tych samych pól.

## Pliki kluczowe

- Edytor: `src/components/NoteEditor.tsx`, `src/hooks/useNoteEditSession.ts`, `src/hooks/useLiveNoteText.ts`, `src/components/AddNoteBar.tsx`, `src/lib/slashMenu.ts`, `src/lib/mentions.ts`, `src/lib/wikiLinks.ts`, `src/lib/editorKeys.ts`.
- Dane: `src/lib/yjsStore.ts`, `src/lib/noteSchema.ts`, `src/hooks/useNotes.ts`, `src/lib/noteProps.ts`, `src/lib/fullBackup*`.
- Sync: `src/lib/yjsSync.ts`, `src/lib/vault.ts` (HKDF/AES-GCM), `src/lib/imageSync.ts`, `src/components/SyncSettings.tsx`, nowy `relay-server/`.
- Render: `src/components/MarkdownRendererImpl.tsx`, `src/lib/markdownCallouts.ts`, `src/components/NoteReader.tsx`.
- Szukanie i graf: `src/lib/searchNotes.ts`, `src/lib/searchQuery.ts`, `src/lib/noteGraph.ts`, `src/components/NoteGraph.tsx`.
- Import/eksport: `src/lib/import/*`, `src/lib/noteMarkdown.ts`, `src/lib/exportZip.ts`, `src/lib/backupFileHandle.ts`.
- Budżet: `e2e/bundle.spec.ts`, `vite.config.ts`.

## Weryfikacja (po każdej fazie)

1. `npm run typecheck`, `npm run lint`, `npm test` — bez błędów.
2. `npm run test:e2e` (pełny) i `npm run test:e2e:mobile`. Nowe specyfikacje dla każdej funkcji. `e2e/a11y.spec.ts` bez nowych wyjątków w `KNOWN`.
3. `npm run build` i `e2e/bundle.spec.ts`: paczka startowa ≤ progu. Nowe chunki tylko leniwe; precache ≤ 3,2 MB.
4. `perf.spec.ts` na 1000/5000 notatkach: bez pogorszenia względem pomiaru z Fazy 0.
5. Zgodność danych: kopia zapasowa ze starszej wersji wczytuje się. Dokument z nowymi polami otwarty w poprzedniej wersji aplikacji niczego nie gubi (test na `Y.Doc`).
6. Ręcznie w przeglądarce (skill `run` / Playwright MCP): Zeszyt + jeden ciemny styl, 390 i 1440 px, tryb budowa.
7. Faza 2: dwa profile przeglądarki + lokalny `relay-server` w Dockerze. Zmiana offline na A, włączenie B później: zmiana dociera. Podgląd bazy serwera nie zawiera jawnego tekstu.
8. `opis.md` zaktualizowany (sekcje działów), commit z hashem, wpis w pamięci projektu.

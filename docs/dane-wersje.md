# Wersje danych i migracje

Zasady zmiany kształtu danych w Notatniku i dziennik formatów. Czytaj przed każdą zmianą, która dodaje, przenosi albo usuwa pole, mapę Yjs, klucz `localStorage`, bazę IndexedDB albo sekcję kopii. Decyzja: [ADR-11](adr.md#adr-11-jedna-wersja-formatu-wymaganie-w-dokumencie-rejestr-migracji). Plan źródłowy: `docs/plan-migracje-yjs-2026-11-15.md`.

## Zasady

1. **Najpierw dodawaj, potem przenoś, na końcu usuwaj** — w trzech osobnych wydaniach. Stare pole albo mapę usuwasz dopiero, gdy wszystkie urządzenia z rejestru (widziane w ostatnich 30 dniach) mają wersję czytającą nowe i minęło 90 dni.
2. **Migracja jest idempotentna i deterministyczna.** Dwa uruchomienia albo dwa urządzenia naraz dają po scaleniu ten sam stan. Identyfikatory wynikają z danych źródłowych (bez losowania), w przenoszonych danych nie ma `Date.now()`. O tym, czy migracja jest zrobiona, decyduje obecność znacznika, nie jego wartość.
3. **Migracja nie jest zmianą użytkownika.** Nie rusza `updatedAt`, ma własne `origin` transakcji (`migration:<id>`), nie trafia do historii wersji.
4. **Znacznik w tej samej transakcji co dane** (mapa `docMigrations` dla dokumentu). Znaczniki w `localStorage` tylko dla danych lokalnych.
5. **Nieznane przeżywa.** Kod, który przepisuje wpis, zachowuje pola, których nie zna (`mergeStored`, `toStored` w `src/lib/extraFields.ts`). Kod, który czyta mapę, ignoruje nieznane klucze.
6. **Nowsze dane = tylko odczyt.** Wymaganie w dokumencie (`docFormat`) wyższe niż `SCHEMA_VERSION` aplikacji — baner i prośba o aktualizację.
7. **Jedna wersja formatu, jeden rejestr.** `SCHEMA_VERSION` rośnie przy każdej zmianie, której stary klient nie przeżyje bez strat. Każda zmiana ma wpis w dzienniku niżej i wzorzec dokumentu w tym samym commicie.
8. **Przed migracją migawka** stanu (14 dni, najwyżej 3).
9. **Nie zmieniaj znaczenia pola.** Pole o nowym znaczeniu albo jednostce dostaje nową nazwę; stare dalej znaczy to samo. Wzorce: `src/lib/migrations/patterns.ts`.

### Limity pól nowszej wersji

Pole, które ma przeżyć zapis w starszej wersji, musi zmieścić się w limitach `pickExtra` (`src/lib/extraFields.ts`): najwyżej **8** nieznanych pól na wpis, klucz `[a-z][A-Za-z0-9]{0,23}`, wartości proste (napis do **200** znaków, liczba, wartość logiczna) albo płaska tablica do **16** takich wartości, razem do **512** bajtów JSON. Większe pole wymaga podniesienia `SCHEMA_VERSION` i wymagania w `docFormat` — nie licz, że przeżyje w starszym kliencie. Wpis, którego starsza wersja w ogóle nie powinna widzieć, dostaje `v` (minimalna wersja czytelnika, `tooNew`).

Wyjątki od zasady 5 są w `src/lib/docMapsInventory.test.ts` (`EXEMPT`) — każdy z uzasadnieniem. Nowa mapa bez kategorii zatrzymuje test.

## Dziennik formatów

| `SCHEMA_VERSION` | Od | Commit | Co się zmieniło | Zgodność do usunięcia |
|---|---|---|---|---|
| 1 | 2026-10-26 | `53decc7b` | Numer formatu ogłaszany w awareness, baner starszej wersji. Wcześniejsze dokumenty traktowane jak 0. | — |
| 2 | 2026-10-26 | `98706d2f` | Notatki prywatne w szyfrogramie v2 (metadane w treści), zapis za bramką wersji. | odczyt v1 skarbca: nie wcześniej niż 2027-10 (MG-1: 12 miesięcy) |
| 3 | 2026-11-18 | `ec8be170` | `clean*` zachowuje nieznane pola i zna `v`; wymaganie wersji w dokumencie (`docFormat`, `75487586`). | — |

Granica (D1.4): klienci sprzed **2026-11-18** nie znają `docFormat` ani zachowywania pól. Zmiana niszcząca dla nich wymaga rejestru urządzeń (od 2026-11-19, `069616d6`) — bramka `writeFormatAllowed` liczy urządzenia z ostatnich 30 dni.

### Kopia zapasowa i pliki wymiany

| Plik | Pole wersji | Wersje | Reguła |
|---|---|---|---|
| Pełna kopia JSON (`exportNotes.ts`) | `version` (koperta) i od 2026-11-23 `schema` (= `SCHEMA_VERSION`) | koperta 1–3 | nowsza koperta albo `schema` — odmowa przed czymkolwiek; starsza — wczytanie (wzorce `src/test/fixtures/backups/`) |
| Plik synchronizacji (`yjsFileSync.ts`) | `version` | 1–2 | nowsza — odmowa, starsza — wczytanie |
| Paczka budowy (`study/sitePackage.ts`) | `version` | 1 | nowsza — odmowa, starsza — wczytanie |

## Decyzje właściciela (2026-11-23)

- **MG-1:** kopie zapasowe wczytywane bezterminowo; migracje dokumentu usuwane po 12 miesiącach (`D7.3`, każda osobnym commitem ze wzorcem).
- **MG-2:** dokument z nowszej wersji — tylko odczyt.
- **MG-3:** urządzenie niewidziane 30 dni przestaje blokować nowy format.
- **MG-4 / QL-1:** migawki przed migracją i kopie OPFS bez szyfrowania kluczem skarbca (notatki prywatne są w nich i tak zaszyfrowane).

## Lista kontrolna: zmieniam kształt danych

1. Czy zmiana dodaje pole, które starsza wersja zgubi albo źle odczyta? Jeśli zmieści się w limitach wyżej i nie zmienia znaczenia istniejącego pola — wystarczy zasada 5 i test w spisie map.
2. Czy istniejące pole zaczyna znaczyć co innego? Wtedy nowa nazwa (zasada 9).
3. Czy starsza wersja nie powinna pisać do tych danych? Cecha w `docFormat` z wymaganą wersją i blokada w magazynie (`docWritable`).
4. Czy trzeba przepisać istniejące dane? Migracja w `src/lib/migrations/registry.ts` (`DOC_MIGRATIONS`), z `check`, testem na wzorcach (`src/test/fixtures/docs/registry.test.ts` przechodzi przez cały rejestr) i testem spóźnionego starego klienta (D3.4) oraz rozmiaru (D3.6).
5. `SCHEMA_VERSION` + 1, wiersz w dzienniku wyżej, nowy wzorzec dokumentu (`GEN_DOC_FIXTURE=1 npx vitest run src/test/fixtures/docs/generate.test.ts`).
6. Nowa sekcja kopii albo nowy klucz `localStorage`? Wpis w rejestrze sekcji kopii; wzorzec kopii (`GEN_BACKUP_FIXTURE=1 npx vitest run src/test/fixtures/backups`) przy zmianie koperty.
7. Opis w `docs/opis/dane.md`.

## Gdzie jest kod

- `src/lib/formatSchema.ts` — `SCHEMA_VERSION`, bramka zapisu nowego formatu (`writeFormatAllowed`, `canWriteSchema`).
- `src/lib/docFormat.ts` — wymagania cech w dokumencie, baner, „Ignoruj i pisz”.
- `src/lib/deviceRegistry.ts` — rejestr urządzeń (mapa `devices`).
- `src/lib/migrations/` — rejestr (`registry.ts`), wykonawca na kopii roboczej (`runner.ts`), wzorce zmian w CRDT (`patterns.ts`).
- `src/lib/extraFields.ts` — zachowanie nieznanych pól; spis map `src/lib/docMapsInventory.test.ts`.
- Wzorce: `src/test/fixtures/docs/` (dokument 1–3), `src/test/fixtures/backups/` (kopia v1–v3).
- `docs/dane-spisy.md` — spisy baz IndexedDB, kluczy `localStorage` i istniejących migracji (D0.2–D0.4).

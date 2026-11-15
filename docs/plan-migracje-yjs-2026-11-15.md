# Plan: wersjonowanie i migracje danych (Yjs, kopie, pamięć lokalna) (2026-11-15)

> **Status:** zapisany, realizacja nie zaczęta. Wykonawca: Opus (D1, D2, D4), Sonnet (D0, D3, D5–D7); `security-reviewer` przy D1.3 i D4.
>
> **Powiązane:** blokada jednej karty na czas migracji — Q1.1 w `plan-qol-platforma-2026-11-15.md` (tu używana, nie opisywana ponownie); migawki w OPFS — Q1.4; podział `yjsStore.ts` — F3 w `plan-fable-2026-11-15.md` (D2 robić po kroku 2 z F3 albo przed F3, nie w trakcie); `SCHEMA_VERSION` 3 dla załączników skarbca — `plan-skarbiec-krypto-2026-11-15.md`.

## 1. Stan

**Dane w dokumencie Yjs** — ok. 45 map najwyższego poziomu w jednym dokumencie: `notes`, `folders`, `labels`, `propDefs`, `vault`, `views`, `blobs`, `clients`, `debts`, `dietMeals`, `dietMeta`, `supplements`, `supplementLog`, `trainingLog`, `trainingPlans`, `trainingMeta`, `trainingExercises`, `weightEntries`, plany (`PLANS_MAP`), rejestr grafików i mapy na grafik (`shiftTypes`, `shiftDays`, `shiftPatterns`, `shiftBonuses`, `shiftMeta`, `shiftMigrations`), 20 map `study*` (w tym `studyMigrations`).

**Znaczniki wersji — każdy osobno, bez wspólnego rejestru:**

| Znacznik | Gdzie | Co wersjonuje |
|---|---|---|
| `SCHEMA_VERSION = 2` | `formatSchema.ts` | Format zapisu ogłaszany w awareness; bramka `canWriteSchema` |
| `MAX_BACKUP_VERSION = 3` | `exportNotes.ts` | Kopia JSON; nowsza jest odrzucana |
| `StudyDump.version: 2` | `study/` | Zrzut Pracy |
| `SYNC_FILE_VERSION = 2`, `SITE_PACKAGE_VERSION = 1`, `COMPRESSION_VERSION = 2` | pliki wymiany | Pliki synchronizacji, pakiet budowy, kompresja |
| `meta.v = 1`, żetony `v1`/`v2` | `vault.ts` | Skarbiec |
| `studyMigrations`, `shiftMigrations` | mapy w dokumencie | Znacznik migracji zapisywany **w tej samej transakcji** co dane — dobry wzór |
| `kaczy.yjs.migrated.v1.<baza>`, `kaczy.idb.migrated.v1`, `kaczy.effectsSettings.defaults2` | `localStorage` | Jednorazowe migracje lokalne |
| przyrostek `.v1` w ok. 110 kluczach `kaczy.*` | `localStorage` | Nic — żaden klucz nie przeszedł na `.v2`, nie ma mechanizmu |

**Braki:**

1. **Dokument nie niesie własnej wersji.** Wersję zna tylko urządzenie (awareness), więc bramka widzi wyłącznie urządzenia **obecne w tej chwili**. Stary telefon offline po powrocie zapisze stary format.
2. **Stary klient kasuje nowe pola.** Wiele map trzyma zwykłe obiekty (`doc.getMap<DebtEntry>("debts")` i podobne). Edycja wpisu zapisuje cały obiekt; klient, który nie zna nowego pola, zapisze wpis bez niego. Sprawdzić, które funkcje `clean*` i schematy `zod` odrzucają nieznane pola — to one decydują, czy dodanie pola jest bezpieczne.
3. **Nowy dokument w starej aplikacji** otwiera się bez ostrzeżenia (ostrzeżenie jest tylko dla kopii).
4. **Brak rejestru migracji:** każda napisana inaczej, w innym miejscu, uruchamiana z innego wyzwalacza; brak spisu, co i kiedy można usunąć.
5. **Brak dokumentów wzorcowych** ze starych wersji — migracje testowane tylko na danych tworzonych w teście bieżącym kodem.
6. **Migracja w CRDT ma własne pułapki** (dwa urządzenia migrują równolegle; stare urządzenie dopisuje po migracji) — nigdzie nieopisane jako zasady.
7. **Kopia i dokument wersjonowane niezależnie**; import starej kopii idzie inną ścieżką kodu niż migracja starego dokumentu.

## 2. Zasady (do `docs/dane-wersje.md` w D7)

1. **Najpierw dodawaj, potem przenoś, na końcu usuwaj** — w trzech osobnych wydaniach. Usunięcie starego pola lub mapy dopiero, gdy wszystkie znane urządzenia mają wersję czytającą nowe (D4) i minęło 90 dni.
2. **Migracja jest idempotentna i deterministyczna.** Uruchomiona dwa razy albo równolegle na dwóch urządzeniach daje ten sam stan po scaleniu. Stąd: żadnych losowych identyfikatorów (identyfikator wynika z danych źródłowych), żadnego `Date.now()` w danych, żadnego „jeśli puste, to wstaw domyślne” bez sprawdzenia, czy drugie urządzenie nie wstawiło czegoś innego.
3. **Migracja nie jest zmianą użytkownika:** nie rusza `updatedAt`, ma własne `origin` transakcji (wzór: `"study-migration"`, `"image-migration"`), nie trafia do historii wersji ani do „co się zmieniło”.
4. **Znacznik w tej samej transakcji co dane** (wzór `studyMigrations`). Znaczniki w `localStorage` tylko dla migracji danych lokalnych.
5. **Nieznane przeżywa.** Kod, który przepisuje wpis, zachowuje pola, których nie zna. Kod, który czyta mapę, ignoruje klucze, których nie zna.
6. **Nowsze dane = tylko odczyt.** Aplikacja, która widzi w dokumencie wymaganie wyższe niż własna wersja, nie zapisuje do objętych nim map i prosi o aktualizację.
7. **Jedna wersja formatu, jeden rejestr.** `SCHEMA_VERSION` rośnie przy każdej zmianie, której stary klient nie przeżyje bez strat; każda zmiana ma wpis w dzienniku formatów.
8. **Przed migracją migawka** stanu (`Y.encodeStateAsUpdate`) przechowywana 14 dni.

## Etap D0: spis (Sonnet, S)

| Nr | Punkt |
|---|---|
| D0.1 | `docs/dane-mapa.md`: każda mapa Yjs — nazwa, moduł, typ wartości (zwykły obiekt / `Y.Map` / `Y.Array` / `Y.Text`), klucz, czy wchodzi do kopii, czy ma funkcję `clean*`, **czy ta funkcja zachowuje nieznane pola**. Generowane skryptem z `getMap(` + ręczne uzupełnienie. |
| D0.2 | Spis baz IndexedDB (y-indexeddb, `imageStore`, wersje, przekaźnik, skrzynka udostępnień, inne `idb-keyval`) z nazwą, zawartością i tym, co się dzieje przy braku. |
| D0.3 | Spis kluczy `localStorage` (ok. 110): nazwa, moduł, kształt, czy w kopii, czy ma walidację przy odczycie. |
| D0.4 | Spis istniejących migracji (obrazy FNV→SHA-256, `localStorage`→Yjs, `migrateCardLists`, `shifts/model.ts: migrate`, `privateNotes: migrateToV2`, wersje): wyzwalacz, znacznik, czy idempotentna, od kiedy istnieje, czy można usunąć. |

## Etap D1: zgodność w przód (Opus) — najważniejszy, chroni przed utratą danych

| Nr | Punkt | Rozmiar |
|---|---|---|
| D1.1 | **Nieznane pola przeżywają edycję.** Dla każdej mapy ze zwykłymi obiektami (lista z D0.1): zapis wpisu scala z surową wartością z dokumentu (`{...surowy, ...znane}`), a `clean*` czyści tylko znane pola i przepuszcza resztę do zapisu (nie do interfejsu). Ograniczenia, żeby nie otworzyć drogi śmieciom: najwyżej 20 nieznanych pól, wartości proste albo płytkie, łączny rozmiar ≤ 4 KB, klucze bez `__proto__`/`constructor`. Wspólny pomocnik `preserveUnknown()`. | M |
| D1.2 | **Test dla każdej mapy:** wpis z polem `x_future` → edycja znanego pola → `x_future` nadal jest. Jeden test parametryzowany listą map; nowa mapa bez wpisu na liście nie przechodzi testu spisu. | S |
| D1.3 | **Wymaganie wersji w dokumencie:** mapa `docFormat`, klucz na cechę → minimalna wersja czytnika (np. `"vault-files": 3`). Cecha dopisuje się przy pierwszym użyciu, nigdy nie znika. Aplikacja liczy `max(wartości)`; gdy większe od `SCHEMA_VERSION` → mapy objęte cechą tylko do odczytu, baner „Te dane zapisała nowsza wersja — zaktualizuj aplikację”, zapis zablokowany w jednym miejscu (`writeFormatAllowed`). Wartości z dokumentu są niezaufane: `cleanSchemaClaim` (≤ 1000), a wpis podnoszący wymaganie ponad wszystko, co znają sparowane urządzenia, daje `logSecurity` — ktoś znający kod synchronizacji mógłby inaczej zablokować zapis wszystkim (odmowa usługi; dać ręczne „Ignoruj i pisz” w Ustawieniach → Diagnostyka). | M |
| D1.4 | **Granica:** klienci wydani przed D1.3 nie znają tej reguły. Dla nich jedyną ochroną jest D1.1 po ich stronie (której nie mają) i bramka awareness. Zapisać wprost w dzienniku formatów datę, od której D1 obowiązuje — zmiany niszczące dla starszych klientów dopiero po D4. | S |

## Etap D2: rejestr migracji (Opus)

| Nr | Punkt | Rozmiar |
|---|---|---|
| D2.1 | `src/lib/migrations/registry.ts`: `{ id, zakres: "dokument" \| "lokalne" \| "kopia", opis, od, uruchom(ctx), sprawdź(ctx) }`. `id` trwałe (`2026-11-nazwa`). Kolejność z listy, nie z dat. | M |
| D2.2 | **Wykonawca:** po `ready()`, pod `navigator.locks` (Q1.1), dla każdej migracji bez znacznika: migawka (D2.4) → `doc.transact(…, "migration:<id>")` z danymi i znacznikiem w mapie `docMigrations` → `sprawdź`. Błąd → transakcja nie zapisuje znacznika, dziennik diagnostyczny, aplikacja działa dalej na starych danych, ponowienie przy następnym starcie; po 3 porażkach baner z prośbą o kopię i zgłoszenie. | M |
| D2.3 | **Przeniesienie istniejących migracji** do rejestru bez zmiany logiki: znaczniki `studyMigrations`/`shiftMigrations` zostają tam, gdzie są (rejestr czyta je przez adapter — przenoszenie znaczników byłoby kolejną migracją). Migracje lokalne (`kaczy.yjs.migrated.v1.*`) — to samo. | M |
| D2.4 | **Migawka przed migracją:** `Y.encodeStateAsUpdate(doc)` do OPFS (zapas: osobna baza IndexedDB), nazwa z `id` i datą, 14 dni, najwyżej 3. „Przywróć stan sprzed aktualizacji” w Ustawieniach → Kopia i dane. Przywrócenie w CRDT to nie cofnięcie — stan z migawki ładuje się do **nowego** dokumentu i zastępuje lokalny; przy włączonej synchronizacji użytkownik dostaje ostrzeżenie, że pozostałe urządzenia scalą się z powrotem, i propozycję nowego kodu. | M |
| D2.5 | **Wzorce migracji w CRDT** jako funkcje pomocnicze z testami: zmiana nazwy pola (kopiuj, czytaj oba, nowe wygrywa); zwykły obiekt → `Y.Map` (identyfikatory z danych; znany wzór z Pracy: opcje A i B w `plan-dane-yjs-2026-10-25.md`); podział mapy; scalanie map; zmiana jednostki (nowe pole, nie zmiana znaczenia starego). | M |
| D2.6 | **Reguła „nie zmieniaj znaczenia pola”:** pole o nowym znaczeniu dostaje nową nazwę. Dopisać do zasad i do listy kontrolnej przeglądu. | S |

## Etap D3: dokumenty wzorcowe i testy (Sonnet)

| Nr | Punkt | Rozmiar |
|---|---|---|
| D3.1 | **Wzorce:** `src/test/fixtures/docs/<wersja>.update` — zakodowane stany Yjs z danymi syntetycznymi dla każdej wydanej wersji formatu od dziś wstecz, na ile da się odtworzyć (ze starych commitów: skrypt uruchamia stary kod zapisu). Od teraz: każde podniesienie `SCHEMA_VERSION` dodaje wzorzec w tym samym commicie (test sprawdza, że plik dla bieżącej wersji istnieje). | M |
| D3.2 | **Test „każda wersja → bieżąca”:** wczytaj wzorzec, uruchom rejestr, porównaj z migawką oczekiwanego rzutu (liczba notatek, pola, brak utraty). | S |
| D3.3 | **Test zbieżności:** dwa dokumenty z tego samego wzorca migrują niezależnie, wymieniają aktualizacje — stan identyczny, bez duplikatów. | S |
| D3.4 | **Test spóźnionego starego klienta:** po migracji dochodzi aktualizacja utworzona starym kodem (wzorzec + zmiana w starym kształcie) — dane czytelne, nic nie znika, migracja „dociąga” przy następnym starcie albo czytnik rozumie oba kształty. | M |
| D3.5 | **Wzorce kopii** JSON w wersjach 1, 2, 3 i test importu każdej. | S |
| D3.6 | **Test rozmiaru:** migracja dokumentu z 5000 notatek mieści się w 2 s na maszynie CI i nie podwaja rozmiaru dokumentu (migracje przepisujące całe mapy puchną w CRDT — mierzyć `encodeStateAsUpdate` przed i po). | S |

## Etap D4: bramka oparta na znanych urządzeniach (Opus)

| Nr | Punkt | Rozmiar |
|---|---|---|
| D4.1 | **Pamięć urządzeń:** `syncSeen` (jest: `kaczy.sync.seen.v1`) rozszerzyć o ostatnio widzianą wersję formatu każdego urządzenia i datę. Sprawdzić, co już zapisuje. | S |
| D4.2 | **`canWriteSchema` z pamięcią:** nowy format wolno pisać, gdy wszystkie urządzenia widziane w ostatnich 30 dniach miały wersję ≥ wymaganej — nie tylko te obecne teraz. Urządzenie niewidziane > 30 dni nie blokuje (inaczej stary tablet w szufladzie blokuje na zawsze), ale pojawia się na liście „może stracić dane — zaktualizuj przed użyciem”. | M |
| D4.3 | **Ręczne zarządzanie:** w Ustawieniach → Synchronizacja lista urządzeń z wersją i „Zapomnij urządzenie”. | S |
| D4.4 | **Przekaźnik:** urządzenia rozmawiające tylko przez przekaźnik nie widzą się w awareness — wersję niesie zaszyfrowany wpis stanu urządzenia w pokoju (mały, nadpisywany). Sprawdzić, czy awareness idzie już przez przekaźnik; jeśli nie — to jest warunek, żeby bramka działała bez WebRTC. | M |

## Etap D5: kopia i dokument jedną drogą (Sonnet)

| Nr | Punkt | Rozmiar |
|---|---|---|
| D5.1 | Kopia zapisuje `schema` (wersja formatu dokumentu) obok `version` (wersja koperty kopii). | S |
| D5.2 | Import starej kopii: wczytanie do tymczasowego dokumentu → rejestr migracji → scalenie albo zastąpienie. Jedna ścieżka zamiast osobnego kodu „stara kopia”. Robić razem z A3 (`lib/backup/`) z planu architektury. | M |
| D5.3 | Kopia z nowszym `schema` niż aplikacja: odmowa z komunikatem (jak dziś dla `version`), bez częściowego importu. | S |
| D5.4 | Pliki wymiany (`SYNC_FILE_VERSION`, `SITE_PACKAGE_VERSION`): ta sama reguła nowsze = odmowa, starsze = migracja; testy. | S |

## Etap D6: pamięć lokalna (Sonnet)

| Nr | Punkt | Rozmiar |
|---|---|---|
| D6.1 | **Rejestr kluczy** `src/lib/storage/keys.ts`: nazwa, walidator, wartość domyślna, czy w kopii, czy wrażliwy (nie do kopii ani raportu). Odczyt i zapis tylko przez `readKey`/`writeKey` z `try/catch` i walidacją — zły kształt daje wartość domyślną i wpis w diagnostyce, nie wyjątek przy starcie. | M |
| D6.2 | **Przejście modułami** (ok. 110 kluczy): Wygląd, Praca, Skarbiec, reszta. Strażnik: literał `"kaczy.` poza rejestrem zabroniony, lista wyjątków malejąca. | L |
| D6.3 | **`migrateKey(stary, nowy, przekształć)`** dla przyszłych `.v2`: czyta stary, zapisuje nowy, stary usuwa po jednym wydaniu. Dwie karty: pod blokadą z Q1.1. | S |
| D6.4 | **Bazy IndexedDB:** przy zmianie kształtu — nowa nazwa bazy i migracja kopiująca, nie `onupgradeneeded` w cudzej bibliotece; stara baza usuwana po potwierdzonym odczycie nowej. | S |
| D6.5 | **Lista sekcji kopii z rejestru:** rejestr sekcji kopii (jest od 3a4ff293) czyta flagę „w kopii” z rejestru kluczy — jedno źródło zamiast listy w `exportNotes.ts`. | S |

## Etap D7: zasady i utrzymanie (Sonnet)

| Nr | Punkt |
|---|---|
| D7.1 | `docs/dane-wersje.md`: zasady z §2, **dziennik formatów** (wersja, data, commit, co się zmieniło, od kiedy można usunąć zgodność), lista kontrolna „zmieniam kształt danych” (8 pytań: czy stary klient to przeżyje; czy pole jest nowe czy zmienia znaczenie; identyfikatory deterministyczne; znacznik w transakcji; wzorzec dodany; test zbieżności; kopia; `opis.md`). |
| D7.2 | **ADR-11:** jedna wersja formatu, wymaganie w dokumencie, rejestr migracji, zasada trzech wydań. |
| D7.3 | **Sprzątanie:** po D0.4 usunąć migracje starsze niż 12 miesięcy, których źródło nie może już istnieć (decyzja MG-1) — każda osobnym commitem, ze wzorcem dowodzącym, że nowy start bez niej działa. |
| D7.4 | Wpis w `CLAUDE.md`: przy zmianie kształtu danych przeczytać `docs/dane-wersje.md`. |

## Pułapki

- `Y.Map.set` całego obiektu to „ostatni wygrywa” na poziomie wpisu — dwa urządzenia zmieniające różne pola tego samego wpisu tracą jedną zmianę. D1.1 tego nie naprawia; naprawia to przejście na `Y.Map` pól (jak w Pracy). Nie robić hurtem — tylko tam, gdzie równoległa edycja jest realna.
- Usunięta mapa lub klucz w Yjs zostawia nagrobki; migracja „usuń i wstaw od nowa” puchnie dokument. Mierzyć (D3.6).
- `doc.getMap("x")` wywołane z innym typem niż istniejący rzuca albo zwraca śmieci — zmiana typu najwyższego poziomu wymaga **nowej nazwy** mapy.
- Dane skarbca migruje tylko odblokowana sesja (`migrateToV2`) — rejestr musi mieć zakres „po odblokowaniu”.
- Zegar: nigdy nie używać czasu do rozstrzygania, czy migracja jest potrzebna; tylko znacznik i kształt danych.
- Wersja awareness jest deklaracją urządzenia — można ją podrobić, znając kod. Bramka chroni przed pomyłką, nie przed atakiem; opisać w modelu zagrożeń.

## Decyzje właściciela

- **MG-1:** jak długo wspierać stare formaty i stare kopie (zalecane: kopie — bezterminowo, migracje dokumentu — 12 miesięcy).
- **MG-2:** przy dokumencie z nowszej wersji — tylko odczyt (zalecane) czy ostrzeżenie z możliwością pisania.
- **MG-3:** po ilu dniach niewidziane urządzenie przestaje blokować nowy format (zalecane 30).
- **MG-4:** czy migawka przed migracją ma być szyfrowana kluczem skarbca, gdy skarbiec istnieje (wspólna z QL-1).

## Kolejność

D0 → **D1.1, D1.2** → D1.3 → D3.1–D3.3 → D2.1–D2.4 → D4 → D2.5, D3.4–D3.6 → D5 → D6 → D7. D7.1 pisać równolegle od D1.

D1 i D4 muszą być wdrożone na wszystkich urządzeniach **przed** `SCHEMA_VERSION` 3 (załączniki skarbca).

## Weryfikacja

Vitest dla każdego punktu (dokumenty wzorcowe, zbieżność, nieznane pola); `npm run typecheck`; e2e dwóch kart dla D2.2; `security-reviewer` przy D1.3 i D4; wpis w `opis.md` (dział „Dane i synchronizacja”).

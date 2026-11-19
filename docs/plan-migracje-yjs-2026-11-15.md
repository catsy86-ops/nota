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
| `studyMigrations`, `shiftMigrations` | mapy w dokumencie | Znacznik zapisywany **w tej samej transakcji** co dane — dobry wzór; ale to znaczniki **na urządzenie** („stary zapis z `localStorage` tego urządzenia jest już w dokumencie”), nie wersja kształtu dokumentu (§1a) |
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

### 1a. Weryfikacja z kodem (2026-11-15, Fable)

Sprawdzone czytaniem kodu na `3cc066d6`, bez uruchamiania testów. Punkty D1, D2 i D4 niżej są już poprawione według tej tabeli.

| Dotyczy | Wynik | Dowód |
|---|---|---|
| Liczba map | 43 różne nazwy w `getMap(` plus mapy tworzone na grafik — „ok. 45” się zgadza. | wyszukiwanie `getMap(` w `src/` |
| Brak 2, D1.1 | **Potwierdzony.** `cleanDebt` buduje nowy obiekt ze znanych pól, więc nieznane giną przy każdej edycji. W `src/lib` są 93 eksportowane funkcje `clean*` i żadna nie przepuszcza nieznanych pól. Schematów `zod` w `src/` nie ma (pakiet jest w `package.json`, bez importów). To samo dotyczy treści notatki prywatnej: `parseContent` w `privateNotes.ts` gubi pola spoza listy. D1.1 to rozmiar **L**, nie M. | `debts/model.ts:52–65`, `privateNotes.ts` |
| Wzór znacznika | `studyMigrations` i `shiftMigrations` to **nie** znaczniki migracji kształtu dokumentu. Klucz to identyfikator urządzenia, a wpis znaczy „stary zapis z `localStorage` tego urządzenia jest już w dokumencie”. Wartość to `Date.now()` — sprzeczne z zasadą 2 w brzmieniu sprzed poprawki. Wzór „znacznik w tej samej transakcji” jest dobry; adapter z D2.3 musi jednak pytać „czy to urządzenie”, nie „czy ten dokument”. | `study/yStudy.ts:515–518`, `study/data.ts:45–57`, `shifts/yShifts.ts:316–318` |
| Zasada 3 | Potwierdzona: `"study-migration"`, `"shifts-migration"`, `"image-migration"`. | wyszukiwanie w `src/` |
| D1.3 | **`writeFormatAllowed` nie jest miejscem, w którym da się zablokować zapis.** Odpowiada na pytanie „czy wolno już pisać nowszy format” i ma 6 wywołań (`privateNotes.ts`, `yjsStore.ts:635`). Zapisy idą przez `transact` w ponad 40 modułach (25 w samym `yjsStore.ts`), bez wspólnego punktu. | wyszukiwanie `writeFormatAllowed(`, `.transact(` |
| D2.2 | **Yjs nie cofa transakcji.** Wyjątek w środku `doc.transact` zostawia zmiany zrobione do tego miejsca; „błąd → transakcja nie zapisuje znacznika” da dane w połowie zmigrowane bez znacznika. `navigator.locks` nie występuje w kodzie (jest tylko `BroadcastChannel` w `tabSync.ts` i `vaultAutoLock.ts`), więc Q1.1 trzeba zrobić przed D2.2. | wyszukiwanie w `src/` |
| D4.1 | `syncSeen` trzyma tylko `nazwa urządzenia → czas`, najwyżej 20 wpisów; wersji formatu nie zapisuje. Kluczem jest nazwa (do 40 znaków, wpisywana ręcznie) — dwa urządzenia o tej samej nazwie zlewają się, a zmiana nazwy zostawia wpis-widmo. W awareness nie ma stałego identyfikatora urządzenia. | `syncSeen.ts:8–36`, `yjsSync.ts` (`setLocalStateField("device", …)`) |
| D4.2 | Pamięć jest lokalna: urządzenie A wie tylko o tych, z którymi samo było połączone w tym samym czasie. Dwa urządzenia, które nigdy nie były online razem, nie wiedzą o sobie. | `yjsSync.ts:125`, `formatSchema.ts:33–41` |
| D4.4 | Potwierdzone: awareness idzie tylko przez `y-webrtc`; w `src/lib/sync/` (przekaźnik) nie ma ani awareness, ani wersji formatu. Synchronizacja plikiem też jej nie niesie. | wyszukiwanie w `src/lib/sync/` |

## 2. Zasady (do `docs/dane-wersje.md` w D7)

1. **Najpierw dodawaj, potem przenoś, na końcu usuwaj** — w trzech osobnych wydaniach. Usunięcie starego pola lub mapy dopiero, gdy wszystkie znane urządzenia mają wersję czytającą nowe (D4) i minęło 90 dni.
2. **Migracja jest idempotentna i deterministyczna.** Uruchomiona dwa razy albo równolegle na dwóch urządzeniach daje ten sam stan po scaleniu. Stąd: żadnych losowych identyfikatorów (identyfikator wynika z danych źródłowych), żadnego `Date.now()` w danych przenoszonych (wartość znacznika może być czasem — służy tylko do diagnostyki, a o tym, czy migracja jest zrobiona, decyduje sama obecność klucza), żadnego „jeśli puste, to wstaw domyślne” bez sprawdzenia, czy drugie urządzenie nie wstawiło czegoś innego.
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

**Stan 2026-11-18:** D1.1 częściowo (7 map przez `extraFields.ts`, Z-17.3); D1.2 jako spis z zapadką (`src/lib/docMapsInventory.test.ts`); po Ćwiczeniach i klasyfikacji Pracy 22 mapy do zrobienia; D1.3 bez blokady w magazynach (`src/lib/docFormat.ts`, baner, „Ignoruj i pisz”); D1.4 zapisane w `docFormat.ts` i `opis.md`. Zostaje D1.1 działami. **2026-11-19:** D4 całe zrobione (`src/lib/deviceRegistry.ts`, bramka w `writeFormatAllowed`, `DeviceRegistryList.tsx`, test przez prawdziwy przekaźnik). D3.1 zrobione (`src/test/fixtures/docs/`, `scripts/doc-fixture.ps1`; wzorce 1–3 tylko notatki/foldery/etykiety). D2.1–D2.4 zrobione (`src/lib/migrations/`; D2.4 przez katalog „przed przywróceniem”); test D3.3 w `runner.test.ts`. Zostają D2.5, D2.6, D3.2, D3.4–D3.6, D5–D7.

| Nr | Punkt | Rozmiar |
|---|---|---|
| D1.1 | **Nieznane pola przeżywają edycję.** Dla każdej mapy ze zwykłymi obiektami (lista z D0.1): zapis wpisu scala z surową wartością z dokumentu (`{...surowy, ...znane}`), a `clean*` czyści tylko znane pola i przepuszcza resztę do zapisu (nie do interfejsu). Ograniczenia, żeby nie otworzyć drogi śmieciom: najwyżej 20 nieznanych pól, wartości proste albo płytkie, łączny rozmiar ≤ 4 KB, klucze bez `__proto__`/`constructor`/`prototype`. Nadmiar jest odrzucany z wpisem w diagnostyce, nie po cichu — a limity trafiają do zasad (D7.1) jako ograniczenie dla każdego przyszłego pola: pole większe niż limit wymaga podniesienia `SCHEMA_VERSION`, nie liczy na przeżycie w starszym kliencie. Wspólny pomocnik `preserveUnknown()`. Zakres: 93 funkcje `clean*` — robić działami, zaczynając od map, do których planowane są nowe pola (Długi, Klienci, Ćwiczenia). Notatki są mapami pól, więc ich to nie dotyczy, **poza treścią notatki prywatnej** (`parseContent` w `privateNotes.ts` gubi nieznane pola w szyfrogramie) — to warunek załączników skarbca. Tę część wykonuje K0 pkt 2 w `plan-skarbiec-krypto-2026-11-15.md` (własny limit 64 KB, bo manifest plików jest większy niż 4 KB) — nie robić drugi raz, tylko dopisać do listy testu D1.2. | L |
| D1.2 | **Test dla każdej mapy:** wpis z polem `x_future` → edycja znanego pola → `x_future` nadal jest. Jeden test parametryzowany listą map; nowa mapa bez wpisu na liście nie przechodzi testu spisu. | S |
| D1.3 | **Wymaganie wersji w dokumencie:** mapa `docFormat`, klucz na cechę → minimalna wersja czytnika (np. `"vault-files": 3`). Cecha dopisuje się przy pierwszym użyciu i nigdy nie znika; zapis tylko wtedy, gdy nowa wartość jest większa od obecnej (dwa urządzenia dopisujące równolegle tę samą cechę dają ten sam wynik). Wymaganie liczy się **na cechę**, nie jako jedno `max` z całej mapy: gdy wartość cechy jest większa od `SCHEMA_VERSION` → mapy objęte tą cechą tylko do odczytu, baner „Te dane zapisała nowsza wersja — zaktualizuj aplikację”; cecha, której aplikacja nie zna z nazwy, daje sam baner (nie wiadomo, które mapy obejmuje). Blokada zapisu to **nowa** funkcja `docWritable(cecha)` — nie `writeFormatAllowed`, które odpowiada na odwrotne pytanie („czy wolno już pisać nowszy format”). Wspólnego punktu zapisu nie ma (ponad 40 modułów z własnym `transact`), więc pierwsze wydanie tylko **zapisuje i czyta** `docFormat` oraz pokazuje baner; blokadę dostaje każdy magazyn osobno, razem z cechą, która jej wymaga (pierwsza: `vault-files`). Wartości z dokumentu są niezaufane: `cleanSchemaClaim` (≤ 1000), a wpis podnoszący wymaganie ponad najwyższą wersję z rejestru urządzeń (D4.1; przed jego wdrożeniem — ponad własną `SCHEMA_VERSION` + 1) daje `logSecurity` — ktoś znający kod synchronizacji mógłby inaczej zablokować zapis wszystkim (odmowa usługi; dać ręczne „Ignoruj i pisz” w Ustawieniach → Diagnostyka). | M |
| D1.4 | **Granica:** klienci wydani przed D1.3 nie znają tej reguły. Dla nich jedyną ochroną jest D1.1 po ich stronie (której nie mają) i bramka awareness. Zapisać wprost w dzienniku formatów datę, od której D1 obowiązuje — zmiany niszczące dla starszych klientów dopiero po D4. | S |

## Etap D2: rejestr migracji (Opus)

| Nr | Punkt | Rozmiar |
|---|---|---|
| D2.1 | `src/lib/migrations/registry.ts`: `{ id, zakres: "dokument" \| "lokalne" \| "kopia", opis, od, uruchom(ctx), sprawdź(ctx) }`. `id` trwałe (`2026-11-nazwa`). Kolejność z listy, nie z dat. | M |
| D2.2 | **Wykonawca:** po `ready()`, pod `navigator.locks` (Q1.1), dla każdej migracji zakresu „dokument” bez znacznika. **Yjs nie cofa transakcji**, więc migracja nie działa na żywym dokumencie. Kroki: (1) migawka (D2.4); (2) kopia robocza: `new Y.Doc()` z **własnym, losowym** identyfikatorem klienta (nigdy skopiowanym z żywego dokumentu — dwa dokumenty z tym samym identyfikatorem i różną treścią psują scalanie) + `applyUpdate` stanu; (3) na kopii jedna transakcja z danymi i znacznikiem w mapie `docMigrations`; (4) `sprawdź` na kopii; (5) różnica (`encodeStateAsUpdate(kopia, wektorStanuOryginału)`) trafia do żywego dokumentu jednym `applyUpdate` z `origin` `"migration:<id>"`. Zmiany, które przyszły między krokami 2 i 5, scalają się jak z każdym innym urządzeniem — dlatego migracja musi spełniać zasadę 2, a `sprawdź` po kroku 5 jest tylko diagnostyką, nie warunkiem. Obserwatory, które reagują na zmianę jak na edycję użytkownika (`updatedAt`, historia wersji, status zapisu), muszą pomijać ten `origin` — spisać je przed pierwszą migracją. Błąd na kopii → nic nie zapisane, dziennik diagnostyczny, aplikacja działa dalej na starych danych, ponowienie przy następnym starcie; po 3 porażkach baner z prośbą o kopię i zgłoszenie. Migracje zakresu „lokalne” i „po odblokowaniu skarbca” nie używają kopii roboczej — mają własne znaczniki i własne wyzwalacze. | M |
| D2.3 | **Przeniesienie istniejących migracji** do rejestru bez zmiany logiki: znaczniki `studyMigrations`/`shiftMigrations` zostają tam, gdzie są (rejestr czyta je przez adapter — przenoszenie znaczników byłoby kolejną migracją). Te znaczniki są na urządzenie (klucz = identyfikator urządzenia), więc te migracje mają zakres „lokalne → dokument” i wykonują się na każdym urządzeniu osobno; `docMigrations` jest na dokument. Migracje lokalne (`kaczy.yjs.migrated.v1.*`) — to samo. | M |
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
| D4.1 | **Rejestr urządzeń w dokumencie** (zamiast rozszerzania `syncSeen`): mapa `devices`, klucz = losowy, stały identyfikator urządzenia (nowy klucz lokalny; nie nazwa), wartość `{ name, schema, version, at }`. Urządzenie zapisuje swój wpis tylko wtedy, gdy zmieniła się nazwa, `schema` albo `version`, albo gdy `at` ma ponad dobę — nie przy każdym starcie (każde nadpisanie zostawia ślad w dokumencie). Powód: `syncSeen` jest lokalne i kluczowane nazwą, więc urządzenia, które nie były online razem, nie wiedzą o sobie; wpis w dokumencie dochodzi każdą drogą — WebRTC, przekaźnikiem, plikiem i kopią. Wartości czyszczone jak deklaracje z awareness (`cleanSchemaClaim`, `cleanVersionClaim`); `at` z przyszłości (ponad dobę) liczone jak „teraz”; czytane jest najwyżej 50 wpisów o najnowszym `at`, a wpisy starsze niż 180 dni usuwa pierwsze urządzenie, które je zobaczy. Mapa `devices` **nie wchodzi do kopii JSON** — przywrócona kopia wniosłaby urządzenia, których już nie ma, i zablokowała bramkę na 30 dni. Identyfikator urządzenia nie wchodzi do kopii ustawień (dwie instalacje z tym samym identyfikatorem nadpisywałyby sobie wpis). | M |
| D4.2 | **`canWriteSchema` z rejestrem:** nowy format wolno pisać, gdy wszystkie urządzenia z rejestru widziane w ostatnich 30 dniach **oraz** obecne w awareness mają wersję ≥ wymaganej. Urządzenie niewidziane > 30 dni nie blokuje (inaczej stary tablet w szufladzie blokuje na zawsze), ale pojawia się na liście „może stracić dane — zaktualizuj przed użyciem”; gdy wróci ze starą wersją, zatrzymuje je już tylko `docFormat` (D1.3) — o ile ma wydanie z D1.3. Bez grupy synchronizacji (jedno urządzenie) bramka odpowiada „tak” — to poprawne, ale zapisać wprost. Urządzenie sprzed D4.1 nie wpisuje się do rejestru — widać je tylko w awareness, więc pierwsze 30 dni po wdrożeniu D4.1 liczyć jako okres, w którym nie podnosi się `SCHEMA_VERSION`. | M |
| D4.3 | **Ręczne zarządzanie:** w Ustawieniach → Synchronizacja lista urządzeń z wersją i „Zapomnij urządzenie” (usuwa wpis z mapy; urządzenie wpisze się ponownie przy następnym starcie). | S |
| D4.4 | **Przekaźnik i plik:** załatwia D4.1 — rejestr jest częścią dokumentu, więc osobny wpis stanu w pokoju nie jest potrzebny. Do zrobienia zostaje test: dwa urządzenia tylko przez przekaźnik widzą swoje wersje. | S |

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
- `doc.transact` nie jest transakcją bazy danych: wyjątek w środku nie cofa wcześniejszych zmian. „Wszystko albo nic” daje tylko praca na kopii dokumentu (D2.2).
- Wersja w awareness i w rejestrze urządzeń jest deklaracją urządzenia — można ją podrobić, znając kod. Bramka chroni przed pomyłką, nie przed atakiem; opisać w modelu zagrożeń.

## Decyzje właściciela

- **MG-1:** jak długo wspierać stare formaty i stare kopie (zalecane: kopie — bezterminowo, migracje dokumentu — 12 miesięcy).
- **MG-2:** przy dokumencie z nowszej wersji — tylko odczyt (zalecane) czy ostrzeżenie z możliwością pisania.
- **MG-3:** po ilu dniach niewidziane urządzenie przestaje blokować nowy format (zalecane 30).
- **MG-4:** czy migawka przed migracją ma być szyfrowana kluczem skarbca, gdy skarbiec istnieje (wspólna z QL-1).

## Kolejność

D0 → **D1.1, D1.2** → D1.3 → D4.1, D4.2 (im wcześniej urządzenia zaczną się wpisywać, tym wcześniej bramka jest wiarygodna) → D3.1 (wzorce nie zależą od rejestru) → Q1.1 (blokada kart, plan QoL) → D2.1–D2.4 → D3.2, D3.3 (uruchamiają rejestr, więc po D2.1) → D4.3, D4.4 → D2.5, D3.4–D3.6 → D5 → D6 → D7. D7.1 pisać równolegle od D1.

D1 i D4 muszą być wdrożone na wszystkich urządzeniach **przed** `SCHEMA_VERSION` 3 (załączniki skarbca), a od wdrożenia D4.1 musi minąć 30 dni. Te same warunki, razem z 30 dniami od wydania K0, są w §4.5 i §8 planu Skarbca — przy zmianie jednego pliku poprawić oba.

## Weryfikacja

Vitest dla każdego punktu (dokumenty wzorcowe, zbieżność, nieznane pola); `npm run typecheck`; e2e dwóch kart dla D2.2; `security-reviewer` przy D1.3 i D4; wpis w `opis.md` (dział „Dane i synchronizacja”).

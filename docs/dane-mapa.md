# Mapy dokumentu Yjs (D0.1)

Wygenerowane przez `node scripts/dane-mapa.mjs` z kodu (`getMap(…)`) i kategorii w `src/lib/docMapsInventory.test.ts`. Nie edytuj ręcznie — popraw kategorię w teście i wygeneruj plik od nowa. Test pilnuje, żeby każda mapa miała kategorię; ten plik ją tylko pokazuje.

- **zachowuje nieznane pola** — wpis to zwykły obiekt, zapis scala go z surową wartością (`mergeStored`, `toStored` w `src/lib/extraFields.ts`); obok jest test „nieznane pole przeżywa edycję”.
- **wyjęta** — mapa pól (`Y.Map` na wpis), wartości proste albo mapa sterująca; uzasadnienie w kolumnie.

Mapy Grafiku (`shift*`) istnieją dla każdego grafiku z prefiksem identyfikatora (`shiftsMapName`); główny grafik jest bez prefiksu. Które sekcje pełnej kopii JSON niosą które dane — `buildFullBackupWithReport` w `src/lib/backup/build.ts`. Bazy IndexedDB, klucze `localStorage` i migracje: `docs/dane-spisy.md`.

53 map.

| Mapa | Moduły | Kategoria | Test albo uzasadnienie |
|---|---|---|---|
| `blobs` | `lib/imageSync.ts` | wyjęta | bufor transportu obrazów w osobnym dokumencie w pamięci |
| `clients` | `lib/clients/yClients.ts` | wyjęta | pole na klucz (`f␁id␁pole`) — pole nowszej wersji to osobny klucz |
| `debtPlans` | `lib/debts/yDebts.ts` | zachowuje nieznane pola | test: `src/lib/debts/plans.test.ts` |
| `debtProofs` | `lib/debts/proofs.ts`, `lib/debts/yDebts.ts` | wyjęta | `{ ref, at }` zastępowane w całości przy zmianie zdjęcia; nic do edycji |
| `debts` | `lib/debts/proofs.ts`, `lib/debts/yDebts.ts` | zachowuje nieznane pola | test: `src/lib/debts/yDebts.extra.test.ts` |
| `devices` | `lib/deviceRegistry.ts` | wyjęta | rejestr urządzeń (D4.1); wpis zastępuje tylko jego urządzenie, wartości czyszczone przy odczycie |
| `dietMeals` | `lib/diet/yDiet.ts` | zachowuje nieznane pola | test: `src/lib/exerciseExtra.test.ts` |
| `dietMeta` | `lib/diet/yDiet.ts` | zachowuje nieznane pola | test: `src/lib/exerciseExtra.test.ts` |
| `dietFavorites` | `lib/diet/yDiet.ts` | zachowuje nieznane pola | ulubione posiłki (C4.1), klucz z opisu; test: `src/lib/exerciseExtra.test.ts` |
| `docFormat` | `lib/docFormat.ts` | wyjęta | wymagania wersji (D1.3), wartości to liczby |
| `docMigrations` | `lib/migrations/runner.ts` | wyjęta | znaczniki migracji dokumentu (D2.2), zapis tylko przez runner.ts |
| `folders` | `lib/yjs/docFile.ts`, `lib/yjsStore.ts` | zachowuje nieznane pola | test: `src/lib/extraD11rest.test.ts` |
| `labels` | `lib/yjsStore.ts` | wyjęta | wartości `true` |
| `notes` | `lib/yjs/docFile.ts`, `lib/yjsStore.ts` | wyjęta | Y.Map na notatkę — pole to osobny klucz |
| `plans` | `lib/plans/planRefs.ts`, `lib/plans/yPlans.ts` | zachowuje nieznane pola | test: `src/lib/extraD11plans.test.ts` |
| `propDefs` | `lib/yjs/docFile.ts`, `lib/yjsStore.ts` | zachowuje nieznane pola | test: `src/lib/extraD11rest.test.ts` |
| `shiftBonuses` | `lib/shifts/yShifts.ts` | zachowuje nieznane pola | test: `src/lib/extraD11rest.test.ts` |
| `shiftDays` | `lib/shifts/yShifts.ts` | zachowuje nieznane pola | test: `src/lib/extraD11rest.test.ts` |
| `shiftMeta` | `lib/shifts/yShifts.ts` | wyjęta | wartości proste pod osobnymi kluczami (stawki, ustawienia) |
| `shiftMigrations` | `lib/shifts/yShifts.ts` | wyjęta | znaczniki migracji Grafiku na urządzenie |
| `shiftPatterns` | `lib/shifts/yShifts.ts` | zachowuje nieznane pola | test: `src/lib/extraD11rest.test.ts` |
| `shiftSchedules` | `lib/shifts/schedules.ts` | zachowuje nieznane pola | test: `src/lib/extraD11rest.test.ts` |
| `shiftTypes` | `lib/shifts/yShifts.ts` | zachowuje nieznane pola | test: `src/lib/extraD11rest.test.ts` |
| `studyBilling` | `lib/study/yBilling.ts` | zachowuje nieznane pola | test: `src/lib/study/extra.test.ts` |
| `studyBoard` | `lib/study/yStudy.ts` | wyjęta | wartości to nazwy kolumn |
| `studyChecked` | `lib/study/yStudy.ts` | wyjęta | wartości `true` |
| `studyCustom` | `lib/study/yStudy.ts` | zachowuje nieznane pola | test: `src/lib/study/extraD11.test.ts` |
| `studyDays` | `lib/study/yStudy.ts` | wyjęta | wartości `true` |
| `studyEntryCheck` | `lib/study/yEntryCheck.ts` | wyjęta | `setRecord` scala pola obce (`foreign`) z nowymi |
| `studyExams` | `lib/study/yStudy.ts` | wyjęta | wynik zapisywany raz, bez edycji |
| `studyInvoices` | `lib/ksef/yInvoices.ts` | zachowuje nieznane pola | test: `src/lib/study/extra.test.ts` |
| `studyJobs` | `lib/study/yJobs.ts` | zachowuje nieznane pola | test: `src/lib/study/extra.test.ts` |
| `studyJournal` | `lib/study/journalRefs.ts`, `lib/study/yStudy.ts` | wyjęta | Y.Map na wpis; `writeEntry` zmienia tylko pola znane tej wersji |
| `studyKits` | `lib/study/yKits.ts` | zachowuje nieznane pola | test: `src/lib/study/extraD11.test.ts` |
| `studyMeta` | `lib/study/yStudy.ts` | zachowuje nieznane pola | test: `src/lib/study/extraD11.test.ts` |
| `studyMigrations` | `lib/study/yStudy.ts` | wyjęta | znaczniki migracji na urządzenie |
| `studyMissed` | `lib/study/yStudy.ts` | wyjęta | wartości `true` |
| `studyPoints` | `lib/study/yPoints.ts` | zachowuje nieznane pola | test: `src/lib/study/extraD11.test.ts` |
| `studyPricing` | `lib/study/yPricing.ts` | zachowuje nieznane pola | test: `src/lib/study/extraD11.test.ts` |
| `studyReview` | `lib/study/yStudy.ts` | zachowuje nieznane pola | test: `src/lib/study/extraD11.test.ts` |
| `studyRounds` | `lib/study/yStudy.ts` | zachowuje nieznane pola | test: `src/lib/study/extraD11.test.ts` |
| `studySiteItems` | `lib/study/journalRefs.ts`, `lib/study/yStudy.ts` | zachowuje nieznane pola | test: `src/lib/extraD11plans.test.ts` |
| `studySites` | `lib/study/journalRefs.ts`, `lib/study/yStudy.ts` | wyjęta | Y.Map na kartę; `writeCard` kasuje tylko pola z `SITE_CARD_KEYS` |
| `studyVan` | `lib/study/yVan.ts` | zachowuje nieznane pola | test: `src/lib/study/extraD11.test.ts` |
| `supplementLog` | `lib/supplements/ySupplements.ts` | wyjęta | wartości `true` (odhaczenie dnia) |
| `supplements` | `lib/supplements/ySupplements.ts` | zachowuje nieznane pola | test: `src/lib/supplements/extra.test.ts` |
| `syncControl` | `lib/sync/rekey.ts`, `lib/yjsSync.ts` | wyjęta | znaczniki wymiany kodu, zapis tylko przez rekey.ts |
| `trainingExercises` | `lib/training/yTraining.ts` | zachowuje nieznane pola | test: `src/lib/exerciseExtra.test.ts` |
| `trainingLog` | `lib/training/yTraining.ts` | zachowuje nieznane pola | test: `src/lib/training/extra.test.ts` |
| `trainingMeta` | `lib/training/yTraining.ts` | zachowuje nieznane pola | test: `src/lib/extraD11rest.test.ts` |
| `trainingPlans` | `lib/training/yTraining.ts` | zachowuje nieznane pola | test: `src/lib/exerciseExtra.test.ts` |
| `vault` | `lib/yjs/docFile.ts`, `lib/yjsStore.ts` | wyjęta | nagłówek kryptograficzny skarbca (`meta`), zapisywany tylko przy założeniu i zmianie hasła; scalanie nieznanych pól mogłoby zostawić niespójny nagłówek — przed przepisaniem nowszego formatu chroni wymaganie wersji (D1.3) |
| `views` | `lib/savedViews.ts` | zachowuje nieznane pola | test: `src/lib/extraD11rest.test.ts` |
| `weightEntries` | `lib/weight/yWeight.ts` | zachowuje nieznane pola | test: `src/lib/exerciseExtra.test.ts` |
| `bodyMeasures` | `lib/weight/yMeasures.ts` | zachowuje nieznane pola | obwody ciała (C3.4), klucz `partia:dzień`; test: `src/lib/exerciseExtra.test.ts` |

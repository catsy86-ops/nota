# Testing

## Test Strategy

- **Piramida:** Vitest dla logiki (`src/lib/**`, komponenty z Testing Library), Playwright dla ścieżek (`e2e/`, projekty `chromium`, `iphone-14`, `pixel-7` z `@mobile`), zrzuty (`test:visual`) i axe (`e2e/a11y.spec.ts`).
- **Zielone przed commitem:** `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, Vitest dotkniętych katalogów, celowane spec-e e2e. Pełne `test:e2e` na koniec fali i na prośbę.
- **e2e wymaga świeżego `npm run build`** (global-setup odrzuca stary `dist/`).
- **Punkty zbiegu danych Pracy (szkic efektów, 2026-10-29):** `createYStudy` w `yStudy.ts` (każdy zapis idzie przez `transact` i `writeEntry`/`writeCard`/`setSiteList`), `cleanEntryParts`/`cleanDump` (każde wejście: arkusz, kopia, peer, migracja), `getStudy`/`sanitizeStudy` (każdy widok), `journalRefsIn` (sprzątanie zdjęć, kopia, synchronizacja bajtów).
- **Rozmiar paczki startowej:** `e2e/bundle.spec.ts` ma próg 500 KB, więc małe wzrosty mierzyć ręcznie: suma gzip chunków JS z `dist/index.html` (punkt odniesienia 2026-10-29: 459 604 B).

## Safety Net Map

| Module | Pinned behaviors | Test files | Gaps |
|---|---|---|---|
| `src/lib/study/yStudy.ts` (+ `journalEntry.ts`, `studyDump.ts`) | Czyszczenie wpisu i zrzutu, scalanie dwóch dokumentów, kopia v2, migracja, jedna transakcja na zapis (wpis z budową, edycja, usunięcie własnego pytania, `replaceAll`, `mergeIn` z originem `study-migration`) | `yStudy.test.ts`, `recordings.test.ts`, `faults.test.ts`, `custom*.test.ts` | Pokrycie linii 99%; linie 607, 770 (rzadkie gałęzie) |
| `src/lib/study/store.ts` (fasada) → `studyProjection.ts`, `learnActions.ts`, `journalActions.ts`, `siteActions.ts` | Projekcja przez materiał, wpisy i edycja (z polami usterki), problemy, karty i listy, zamówienia z „Cofnij”, godziny, odbiorcy raportu, egzamin, własne pytania, odhaczenia | `study.test.ts`, `store.characterization.test.ts`, `order.test.ts`, `siteHours.test.ts`, `customStore.test.ts` | `data.ts` 59% linii (migracja z localStorage przy starcie) |
| `src/lib/study/journalRefs.ts` | Zdjęcia, zdjęcia po naprawie, oryginały rysunków, nagrania, dokumenty; próg 2 MB dla synchronizacji | `recordings.test.ts`, `siteDocs.test.ts` | — |
| Codzienna ścieżka Pracy | Wejście, zdjęcie, kształtki, brak, etap, godziny, raport — liczba stuknięć | `e2e/workday.spec.ts` | Bez prawdziwego telefonu |

## Characterization Backlog

- [ ] `src/lib/study/data.ts` — migracja `kaczy.study.v1` przy starcie i `legacyStudyMerged` (ryzyko: utrata danych przy migracji; priorytet średni)
- [ ] `src/lib/yjsStore.ts` — `referencedImages`/`syncableRefs` i sprzątanie (ryzyko: utrata zdjęć; priorytet wysoki przy następnym przebiegu)
- [ ] `src/pages/Index.tsx` — powłoka, największy churn (ryzyko: regresje widoków; priorytet średni)

## CI Gates

`.github/workflows/ci.yml` — do opisania przy Fazie 6.

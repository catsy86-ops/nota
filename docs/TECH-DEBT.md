# Technical Debt

## Debt Ledger

| Item | Location | Type | Risk | Effort | Priority | Status |
|---|---|---|---|---|---|---|
| Zdjęcia usterki po naprawie poza listą kluczy (sprzątanie po 7 dniach, brak w kopii) | `src/lib/study/journalRefs.ts` | błąd, utrata danych | wysokie | S | P0 | naprawione `399da86` (przed startem ścieżki) |
| Poprawka problemu w arkuszu kasowała odpowiedzialnego, termin i zdjęcia po naprawie | `updateJournalEntry` | błąd, utrata danych | wysokie | S | P0 | naprawione `399da86` (przed startem ścieżki) |
| Próg paczki startowej 500 KB w teście, a 394 KB w `CLAUDE.md` | `e2e/bundle.spec.ts:116`, `CLAUDE.md` | dokumentacja / strażnik | średnie | S | P2 | otwarte — decyzja właściciela: obniżyć próg w teście do ~450 KB czy poprawić `CLAUDE.md` |
| Wpis z kształtkami: 5 stuknięć (cel ≤ 3) | `JournalEntrySheet.tsx`, `FittingsFields.tsx` | UX | średnie | S | P1 | częściowo: 4 po H1.5 (pigułki od razu); do 3 trzeba by pigułek kształtek bez otwierania sekcji |
| Pomocnicze zapisy Yjs jako domknięcia w `createYStudy` | `src/lib/study/yStudy.ts` | struktura | niskie | M | P3 | odłożone (krok 3 planu H0.2, mały zysk) |
| Importy typu `JournalEntry` przez fasadę `yStudy.ts`; cykl typów `sites.ts` ↔ `yStudy.ts` | `sites.ts`, `entrySheet.ts`, reszta | struktura | niskie | M | P3 | otwarte (krok 6 planu H0.2) |
| Paczka startowa rośnie od podziału na małe chunki (`pipes`, `fittings` wydzielone przy H1.2: +791 B, 77 → 79 plików) | `vite.config.ts` (manualChunks) | wydajność | niskie | S | P3 | otwarte — rozważyć połączenie małych modułów Pracy z paczki startowej w jeden chunk |
| `touch-audit.spec.ts` (`@mobile`) uruchamia się też w projekcie `chromium` (komputer) i tam nie przechodzi (203 elementy, wszystkie strony) | `playwright.config.ts` (projekt `chromium` bez `grepInvert: /@mobile/`) | test | niskie | S | P3 | otwarte — wykluczyć `@mobile` z projektu komputerowego albo opisać |
| Migracja `data.ts` słabo pokryta (59%) | `src/lib/study/data.ts` | brak testów | średnie | S | P2 | w Characterization Backlog |

## Smell Inventory

| Smell | Location | Refactoring | Status |
|---|---|---|---|
| Duży moduł (873 linie): typy, czyszczenie, kopia i fabryka razem | `yStudy.ts` | Extract Module → `journalEntry.ts`, `studyDump.ts` | done `5af8473`, `4bb5de5` |
| Duży moduł (644 linie): projekcja i trzy obszary akcji | `store.ts` | Extract Module + fasada → `studyProjection.ts`, `learnActions.ts`, `journalActions.ts`, `siteActions.ts` | done `5b6ef3f` |
| JSDoc oderwany od funkcji (`recordRound`, `cleanCaptions`) | `store.ts`, `yStudy.ts` | Move comment | done (przy przenoszeniu) |

## Sprout / Wrap Register

Brak.

## Debt Budget & Broken-Windows Policy

Do ustalenia w Fazie 6.

## Adopted Conventions

- Nowe mapy Pracy (punkty, auto, zestawy, zlecenia) w osobnej warstwie na wzór `yEntryCheck.ts` + `entryCheckStore.ts`, ładowanej leniwie — nie w `createYStudy`. Klucze zdjęć z nowych map dopisywać do `journalRefs.ts`.
- Akcje Pracy importują `studyProjection.ts`, nie fasadę `store.ts`.
- Zmiana struktury i zmiana zachowania nigdy w jednym commicie.

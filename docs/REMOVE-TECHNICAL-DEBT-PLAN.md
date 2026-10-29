# Remove Technical Debt Plan

## Context

Rozpoczęte 2026-10-29. Projekt: NOTKI / „G” — PWA z notatkami, Grafikiem, Kalendarzem i działem Praca (dziennik budowy instalatora wod-kan). Właściciel używa Pracy codziennie na budowie.

- **System:** Vite + React + TypeScript, dane w Yjs (IndexedDB, WebRTC, lokalny przekaźnik E2E), PWA offline. Serwery tylko pomocnicze: `push-server/` i `relay-server/`. Ok. 5 tygodni, 1272 commity.
- **Testy:** 351 plików Vitest, 210 specyfikacji Playwright (e2e, zrzuty, axe), CI w `.github/workflows/ci.yml`. Zestaw jest zielony (Vitest 2655/2655 na `51c82d8`). Pełne e2e puszczane tylko na koniec fali.
- **Najgorszy skutek awarii:** **utrata danych** (wpisy, zdjęcia, godziny, karty budów). Priorytet: integralność danych, kopia, synchronizacja.
- **Moduł startowy (heurystyka trzech osi):** **dane Pracy** — `src/lib/study/yStudy.ts` (873 linie) i `src/lib/study/store.ts` (644). Zmieniane jako następne (H0.2 w `docs/plan-praca-hydraulik-2026-10-29.md`), 47 zmian `store.ts` w 90 dni, rdzeń domeny (codzienne dane z budowy).
- **Inne gorące punkty** (do kolejnych przebiegów): `src/pages/Index.tsx` (1125 linii, 171 zmian w 90 dni), `src/lib/yjsStore.ts` (1077), `src/components/study/JournalEntrySheet.tsx` (882), `src/components/AddNoteBar.tsx` (805).
- **Przepisanie od zera:** nikt nie proponuje. Spłata w miejscu.
- **Zakres teraz:** Fazy 1–4. Fazy 5–8 odroczone.
- **Ograniczenia:** paczka startowa ma ~1 KB zapasu do progu 394 KB (`e2e/bundle.spec.ts`), a `yStudy.ts` w niej jest. Precache 3,9 MiB na granicy.

## Phase Status
| Phase | Skill | Status | Artifact | Date |
|---|---|---|---|---|
| 1 | working-with-legacy-code | done (dane Pracy) | TESTING.md + TECH-DEBT.md | 2026-10-29 |
| 2 | refactoring-patterns | in-progress (H0.2 zrobione) | TECH-DEBT.md | 2026-10-29 |
| 3 | clean-code | pending | TECH-DEBT.md | |
| 4 | software-design-philosophy | pending | TECH-DEBT.md | |
| 5 | clean-architecture | deferred: zakres teraz to Fazy 1–4 | ARCHITECTURE.md | |
| 6 | pragmatic-programmer | deferred: zakres teraz to Fazy 1–4 | TECH-DEBT.md | |
| 7 | release-it | deferred: zakres teraz to Fazy 1–4; wrócić przy hostingu przekaźnika (H-6) | RELIABILITY.md | |
| 8 | domain-driven-design | deferred: zakres teraz to Fazy 1–4 | ARCHITECTURE.md | |
Statuses: pending · in-progress · awaiting-evidence · done · deferred: <reason> · skipped: <reason>

## Key Decisions
| Date | Phase | Decision | Rationale |
|---|---|---|---|
| 2026-10-29 | Intake | Start od danych Pracy (`yStudy.ts`, `store.ts`) | Następna zmiana (H0.2), duży churn, rdzeń domeny |
| 2026-10-29 | Intake | Najgorszy skutek: utrata danych | Codzienne dane z budowy bez drugiej kopii poza aplikacją |
| 2026-10-29 | Intake | Zakres: Fazy 1–4, reszta odroczona | Najszybciej zmienia pracę z kodem; granice i konteksty później |
| 2026-10-29 | 2 | Jedna fabryka `createYStudy`, krok „helpery Yjs” odłożony | Transakcje przecinają obszary; mały zysk (raport `architect`) |
| 2026-10-29 | Intake | Błędy z testów charakteryzujących: przypiąć i wpisać do rejestru, naprawa osobnym commitem po decyzji | Metoda; wywołujący mogą zależeć od dziwactwa |

## Next Actions
- [x] Faza 1: siatka dla danych Pracy (`8f98d53`, `39db0b9`), TESTING.md i TECH-DEBT.md
- [x] Faza 2 (część): podział `yStudy.ts`/`store.ts` (H0.2: `5af8473`, `4bb5de5`, `5b6ef3f`)
- [ ] Decyzja właściciela: próg paczki startowej w `e2e/bundle.spec.ts` (Debt Ledger)
- [ ] Faza 3 (clean-code) na nowych modułach Pracy przy pracy nad H1.1

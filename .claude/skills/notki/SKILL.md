---
name: notki
description: Jak pracować w projekcie NOTKI (PWA notatek, React + Vite + TS + Tailwind): uruchamianie, testy, podgląd w przeglądarce, ikony, konwencje i które skille wołać przy jakim zadaniu. Użyj na początku każdego zadania w tym repozytorium — zmiany UI, nowe działy (np. Grafik), testy, wydajność, przegląd przed commitem.
---

# NOTKI — praca w repozytorium

Aplikacja: PWA notatek po polsku. React 18 + Vite + TypeScript + Tailwind + shadcn/radix + framer-motion. Notatki w Yjs/IndexedDB, ustawienia i mniejsze działy w localStorage przez `createPersistedStore` (`src/lib/persistedStore.ts`). To **nie** jest Next.js — agentów `nextjs-*` nie używaj.

## Polecenia

| Cel | Polecenie |
|---|---|
| Dev | `npm run dev` |
| Typy | `npm run typecheck` |
| Testy jednostkowe | `npx vitest run` (lub pojedynczy plik) |
| Lint | `npx eslint .` |
| E2E | `npx playwright test e2e/<plik>.spec.ts` (sam buduje i stawia `vite preview` na :4173) |
| Zrzuty widoków | `node scripts/screenshots.mjs http://localhost:4173 shots/<nazwa>` |
| Ikony PWA / ekran startowy | `node scripts/generate-icons.mjs` (wordmark NOTKI, tło = `background_color` manifestu) |

W e2e i zrzutach ustaw `localStorage["kaczy.tour.seen.v1"]="1"`, inaczej samouczek zasłoni widok. Zrzuty robocze trzymaj w scratchpadzie, nie w repo.

## Architektura w skrócie

- Jeden `<Route path="/*">`; widok żyje w adresie — `src/lib/viewRoute.ts` (slug → `View`). Nowy dział = nowy `View` w `src/hooks/useFilteredNotes.ts`, slug w `SIMPLE`, wpis w `HEADINGS`/`DESCRIPTIONS` (`EmptyState.tsx`), tytuł w `AppHeader.tsx`, pozycja w `sidebarItems` (`Index.tsx`), kafel w arkuszu „Więcej” (`BottomNav.tsx`) i polecenie w `CommandPalette.tsx`. Widok ładuj przez `lazy()`.
- Logika czysta w `src/lib/*.ts` z testem obok (`*.test.ts`); komponenty tylko rysują i wołają akcje.
- Grafik zmian: `src/lib/shifts.ts` (obliczenia + store) i `src/components/shifts/`.

## Konwencje

- Teksty UI, komentarze i nazwy testów po polsku; tydzień od poniedziałku; daty przez `date-fns` z `locale: pl`; klucz dnia `dayKey()` z `src/lib/reminderOccurrences.ts` (czas lokalny).
- Odmiana liczebników: `pluralPl` z `src/lib/plural.ts`.
- Styl: font display Plus Jakarta Sans, logo Unbounded, primary pomarańcz, akcent róż, `rounded-xl/2xl`, klasa `.pressable` na przyciskach, `focus-visible:ring-2`. Szanuj `prefers-reduced-motion` i jasny/ciemny motyw.
- Nazwy dostępne (aria-label, teksty przycisków) są kontraktem testów e2e — zmieniaj je razem z testami.
- Commit dopiero na prośbę użytkownika; styl wiadomości: `feat(ui): ...`, `fix: ...` po polsku.

## Które skille wołać

| Zadanie | Skille |
|---|---|
| Wygląd interfejsu | `frontend-design:frontend-design` (zawsze przed zmianą wizualną), `refactoring-ui`, `microinteractions` |
| Dostępność i użyteczność | `design:accessibility-review`, `ux-heuristics` |
| Przed commitem | `code-review`, `simplify`, `security-review` |
| Uruchomienie i podgląd | `run`; w przeglądarce MCP `playwright` (lub `puppeteer`, `claude-in-chrome`) |
| Rozwój produktu (np. Grafik) | `improve-app`, `improve-retention` |
| Wydajność PWA | `high-perf-browser` |
| Dokumentacja bibliotek | MCP `context7` (radix, framer-motion, Yjs, date-fns) |

## Gotowe, gdy

`npm run typecheck`, `npx vitest run`, `npx eslint .` i e2e dotkniętego działu przechodzą, a zmiana UI jest obejrzana na zrzucie mobile (390 px) i desktop, w obu motywach.

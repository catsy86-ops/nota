# Notatnik (kaczy)

Lokalna aplikacja notatkowa (PWA) — React + TypeScript + Vite + shadcn/ui.

Wszystkie dane żyją wyłącznie w przeglądarce (IndexedDB, z jednorazową migracją z localStorage). Aplikacja nie ma backendu ani konta użytkownika — "synchronizacja" działa tylko między kartami/oknami tej samej przeglądarki (`BroadcastChannel`), nie między urządzeniami.

## Funkcje

Notatki tekstowe i checklisty, rysowanie odręczne, etykiety/foldery/kolory, wyszukiwanie pełnotekstowe i command palette, linki wiki między notatkami, przypomnienia z powiadomieniami, historia wersji i historia akcji (undo), eksport do PDF/Markdown/HTML/JSON, tryb offline z kolejką zmian, instalacja jako aplikacja (PWA), gamifikacja (osiągnięcia, statystyki), motyw sezonowy.

## Uruchomienie

```sh
npm install
npm run dev       # serwer deweloperski
npm run build     # build produkcyjny
npm run preview   # podgląd builda produkcyjnego
npm run lint       # ESLint
npm test           # testy jednostkowe (Vitest)
npm run test:watch # testy w trybie watch
```

Testy e2e (Playwright) uruchamiane są osobno przez konfigurację w `playwright.config.ts`.

## Zarządzanie pakietami

Projekt używa **npm** (`package-lock.json`). Nie dodawać `bun.lock`/`bun.lockb` ani `yarn.lock`, żeby uniknąć rozjazdu wersji zależności.

## Plan rozwoju

Zobacz [`roadmap.md`](./roadmap.md) — lista zrobionych zadań oraz audyt z planem porządków i rozbudowy.

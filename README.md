# Notatnik (kaczy)

Lokalna aplikacja notatkowa (PWA) — React + TypeScript + Vite + shadcn/ui.

Dane żyją przede wszystkim w przeglądarce (IndexedDB, przez Yjs). Aplikacja nie ma backendu ani konta użytkownika, ale **ma prawdziwą synchronizację między urządzeniami**: CRDT (Yjs) + transport P2P przez WebRTC (`y-webrtc`), opt-in i wyłączony domyślnie — włącza się parowaniem kodem/QR w Ustawienia → Sync. Obrazy synchronizują się osobnym kanałem tego samego transportu. Domyślnie używane są publiczne serwery sygnalizacyjne `y-webrtc`; gotowy do podpięcia własny serwer jest w `signaling-server/`.

## Funkcje

Notatki tekstowe i checklisty (z merge'em CRDT na poziomie pojedynczej pozycji), rysowanie odręczne, etykiety/foldery/kolory, ręczna kolejność notatek (drag & drop), wyszukiwanie pełnotekstowe i command palette, linki wiki między notatkami, przypomnienia (jednorazowe i cykliczne) z powiadomieniami przeglądarki, historia wersji i historia akcji (undo), eksport do PDF/Markdown/HTML/JSON, pełny backup/restore całej bazy (opcjonalnie do jednego, stale nadpisywanego pliku — File System Access API), instalacja jako aplikacja (PWA) ze skrótem „Nowa notatka" i odbieraniem udostępnionej treści z innych aplikacji (Web Share Target), gamifikacja (osiągnięcia, statystyki, passy), motyw sezonowy.

## Uruchomienie

```sh
npm install
npm run dev         # serwer deweloperski
npm run build       # build produkcyjny
npm run preview     # podgląd builda produkcyjnego
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # testy jednostkowe (Vitest)
npm run test:watch  # testy jednostkowe w trybie watch
npm run test:e2e    # testy e2e (Playwright) — buduje i odpala podgląd produkcyjny sam
```

`npm run test:e2e` wymaga pobranych przeglądarek Playwright — jednorazowo: `npx playwright install chromium`.

## Zarządzanie pakietami

Projekt używa **npm** (`package-lock.json`). Nie dodawać `bun.lock`/`bun.lockb` ani `yarn.lock`, żeby uniknąć rozjazdu wersji zależności.

## Plan rozwoju

Zobacz [`roadmap.md`](./roadmap.md) — lista zrobionych zadań oraz audyty z planami porządków i rozbudowy.

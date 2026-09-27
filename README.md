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

## Wdrożenie

Appka jest w 100% statyczna (brak backendu), więc wystarczy dowolny hosting plików + poprawne nagłówki cache. W repo są gotowe configi pod dwa hostingi — **żaden nie jest jeszcze wdrożony**, trzeba tylko połączyć repo z kontem:

| Hosting | Plik konfiguracyjny | Co trzeba zrobić |
| --- | --- | --- |
| Vercel | [`vercel.json`](./vercel.json) | Zaimportować repo na vercel.com — build i katalog wyjściowy są już w configu. |
| Netlify | [`netlify.toml`](./netlify.toml) | „Add new site → Import an existing project" na netlify.com. |

Oba configi robią dokładnie dwie rzeczy, których statyczny hosting sam z siebie nie zrobi poprawnie:

1. **SPA fallback** — każda ścieżka, która nie jest realnym plikiem, dostaje `index.html` (bez tego odświeżenie na pod-ścieżce albo wejście z linku daje 404 zamiast aplikacji).
2. **Nagłówki cache** — `/assets/*` ma nazwy z hashem, więc jest cache'owane na rok jako `immutable`; natomiast `sw.js` i `sw-notifications.js` (dociągany przez `importScripts()`, **bez** hasha w nazwie) mają `no-cache`. To nie jest kosmetyka: cache'owany service worker oznacza, że użytkownik, który raz zainstalował PWA, nigdy więcej nie dostanie aktualizacji.

### GitHub Pages — dlaczego nie od razu

GitHub Pages serwuje projekt pod ścieżką `/<nazwa-repo>/`, a nie pod rootem. Ta appka ma dziś zaszyty root w kilku miejscach: `base` w Vite nie jest ustawione, więc zostaje na domyślnym `/`; `start_url`/`id`/`scope` i ścieżki ikon w `public/manifest.webmanifest` są absolutne (`/`, `/pwa-192.png`, …); `navigateFallback: "/index.html"` w konfiguracji service workera (`vite.config.ts`); absolutne `href`/`src` w `index.html` (favicon, manifest, apple-touch-icon). Wdrożenie na Pages wymaga przestawienia ich wszystkich (albo własnej domeny podpiętej do Pages, która daje root) — **to nie jest zrobione**. Vercel i Netlify serwują pod rootem, więc nie potrzebują żadnej z tych zmian.

## Plan rozwoju

Zobacz [`roadmap.md`](./roadmap.md) — lista zrobionych zadań oraz audyty z planami porządków i rozbudowy.

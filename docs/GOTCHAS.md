# Pułapki w repozytorium

Rzeczy, które kosztowały czas i wracają, jeśli się o nich zapomni. Każda pozycja opisuje stan na dziś
i sprawdzenie, jak to zweryfikować. Historia decyzji: [`roadmap.md`](../roadmap.md), szczegóły wdrożeń: [`opis.md`](../opis.md).

## Pliki i edycja

- **Końce linii.** Indeks trzyma LF. Od `ef3e122` jest `.gitattributes` (`* text=auto eol=lf`), więc nowe
  commity są LF bez ostrzeżeń. Kopie robocze z dawnych operacji mogą jeszcze mieć CRLF — nie jest to błąd.
  Sprawdzenie: `git ls-files --eol <plik>`.
- **Duże skrypty Pythona przez heredoc w Bash.** Narzędzie zamienia `\n`, `\t`, `\u0000` na prawdziwe znaki,
  a polskie cudzysłowy `„”` potrafią zerwać parsowanie. Pliki z kodem składaj narzędziem `Write` albo
  skryptem zapisanym do pliku. W Pythonie sekwencje ucieczek buduj przez `chr(92)`.
- **Edycja przez `Edit` a bajty.** Narzędzie `Edit` wymaga wcześniejszego `Read` tego pliku w sesji.
  Pliki z mieszanymi końcami linii zmieniaj skryptem, który czyta i zapisuje bajty (`newline=''`).
- **Nie wszystkie pliki są UTF-8 LF.** Stan sprawdzaj przed edycją: `python -c "d=open(p,'rb').read(); print(d.count(b'\x00'), d.count(b'\r\n'))"`.

## Testy i e2e

- **Stary serwer na porcie 4173.** `playwright.config.ts` ma `reuseExistingServer` poza CI, więc e2e może
  trafić na stary build. Przed pełnym przebiegiem zamknij proces na 4173.
- **Nie zabijaj procesów po nazwie `playwright`.** Zabija też serwer MCP Playwright. Zamykaj po PID z portu.
- **Pełny e2e na słabym komputerze.** Przy małej ilości pamięci przeglądarka potrafi się wywrócić
  (`Target crashed`, `worker process exited unexpectedly`). Wtedy błędy nie mówią nic o aplikacji.
  Wynik ważny dopiero przy wolnej pamięci.
- **Lint i typecheck.** `npm run lint` jest zielony (tylko ostrzeżenia). `tsc -p .` nie obejmuje wszystkiego;
  właściwy typecheck to `tsc --noEmit -p tsconfig.app.json`.
- **Asercje tekstowe po polsku.** `getByText("własny")` trafia też w dłuższe słowa (np. „własnych”) i w ukryte
  zakładki Radixa. W testach używaj `{ exact: true }` albo ról.
- **Przypomnienia o raporcie w e2e.** `DailyReportNudge` sprawdza dziennik przy starcie i co minutę. Test bez
  `page.clock`, który tworzy wpisy w dzienniku, w piątek po 17:00 albo w weekend może dostać dymek „Raport … gotowy”.
  Testy z dymkami: ustaw stały zegar na dzień roboczy przed 17:00 (np. środa 14.10.2026, 12:00).
- **Budżet bundla.** `e2e/bundle.spec.ts` pilnuje wejściowego JS (gzip). Lazy-ładowane karty widoków
  nie wchodzą do budżetu; nowy kod dodawany statycznie do `Index.tsx` — tak.

## Agenci i worktree

- **Worktree agentów startują ze starych commitów.** Na początku pracy każ agentowi `git reset --hard master`
  (po sprawdzeniu, że w worktree nic nie ma do zachowania).
- **Nie każ agentom robić `npm ci` ani dowiązania do głównego `node_modules`.** Uszkodziło to `.bin` i `@dnd-kit`.
  Każdy worktree ma mieć własne zależności.

## Dane i synchronizacja

- **Yjs tylko przez dozwolone moduły.** `eslint.config.js` ma allowlistę (`no-restricted-imports`) importów
  `yjs`, `y-indexeddb`, `y-webrtc`. Nowy moduł dotykający Yjs trzeba tam dopisać albo używać istniejącego.
- **`yStudy.ts` nie importuje materiału Nauki** (`content.ts`). Walidacja tematów i pytań jest w `store.ts`.
  Import w drugą stronę wciągnąłby materiał do głównej paczki.
- **Klucze obrazów i załączników są content-addressed (SHA-256).** Nie zapisuj do Y.Doc bajtów ani data URL-i —
  tylko referencje; bajty idą do `imageStore`.
- **Kopie zapasowe bez nowych pól.** Każde nowe pole w `StudyDump` / `FullBackup` ma być opcjonalne
  (`cleanDump` traktuje brak jako pusty zbiór), żeby starsze kopie dalej się przywracały.
- **Tekst z drugiego urządzenia pojawia się po zapisie**, nie na żywo w otwartym edytorze (świadome ograniczenie).

## Service worker i PWA

- **Udostępnianie plików (POST /share) wymaga aktywnego SW.** Stara wersja SW nie przechwyci POST-a aż do
  aktualizacji; pierwsze udostępnienie po wdrożeniu może trafić na stronę błędu. Patrz `public/sw-share.js`.
- **Klucze wpisu udostępnienia w Cache Storage muszą zgadzać się w obu plikach:** `public/sw-share.js`
  i `src/lib/shareInbox.ts` (`share-inbox-v1`, `/share-inbox/<id>/meta`, `/share-inbox/<id>/f<i>`).
- **`importScripts` w `vite.config.ts`** dołącza dodatkowe skrypty do wygenerowanego SW. Nowy plik SW
  dopisz tam, inaczej nie trafi do `dist/sw.js`.

## Nie ma już aktualne

- NoteCard z bajtami NUL i CRLF — usunięte (sprawdzone: 0 NUL, sam LF). Stary wpis w pamięci jest nieaktualny.

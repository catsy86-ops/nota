# Roadmap

- [x] Panel kolejki offline: liczba oczekujących zmian, status, ręczna synchronizacja
- [x] Mobile UI: karta notatki i panel „Ostatnie akcje” dobrze mieszczą się na ekranie telefonu

## Audyt — 2026-09-22

### Stan obecny

Notatnik ("kaczy") to lokalna aplikacja PWA (React 18 + TypeScript + Vite + shadcn/ui), bez żadnego backendu — dane żyją wyłącznie w przeglądarce (IndexedDB przez `idb-keyval`, z jednorazową migracją z localStorage w `notesStore.ts`, plus offline queue w `offlineQueue.ts` gwarantująca brak utraty edycji przy zamknięciu karty). Synchronizacja "między kontekstami" (`noteSync.ts`) to wyłącznie `BroadcastChannel` między kartami/oknami *tej samej* przeglądarki na *tym samym* urządzeniu — nie ma sync między urządzeniami ani konta użytkownika. Funkcjonalnie apka jest bogata: checklisty, rysowanie odręczne, etykiety/foldery/kolory, wyszukiwanie + command palette, linki wiki, przypomnienia, historia wersji i akcji (undo), eksport PDF/MD/HTML/JSON, gamifikacja (osiągnięcia, konfetti), motyw sezonowy, statystyki, onboarding. Cała ta orkiestracja spina się w jednym pliku: `src/pages/Index.tsx` (ok. 1964 linie, 70+ importów).

### Do usunięcia / porządki

- [x] **Trzy lockfile jednocześnie** — na tej maszynie bun nie jest zainstalowany, więc wybrano **npm** jako jedyny menedżer pakietów; usunięto `bun.lock` i `bun.lockb`, zostawiono `package-lock.json`.
- [x] **`.lovable/plan.md`** — usunięty; `BottomNav.tsx` z planu już istnieje, pozostałe niedokończone punkty (sticky header, empty states, design tokens) przeniesione niżej do sekcji „Dokończenie UI polish”.
- [x] **`.claude/worktrees/`** — usunięty (był pusty).
- [x] **`README.md`** — zastąpiony realnym opisem apki, instrukcją uruchomienia i notatką o wybranym menedżerze pakietów.

### Dług techniczny do dopracowania

- [x] **`git init`** — repozytorium zainicjalizowane.
- **Rozbicie `src/pages/Index.tsx` (1964 linie)** — wydzielić np.: logikę widoków/nawigacji (`view`, `activeLabel`, `activeFolder`) do własnego hooka, obsługę drag&drop (`DndContext`, sensory, `DroppableNavItem`) do osobnego pliku/komponentu, akcje eksportu/importu do hooka `useNotesExport`, panel ustawień/komend już częściowo wydzielony (`SettingsDialog`, `CommandPalette`) — kontynuować ten kierunek dla reszty.
- [x] **Pokrycie testami** — dodano `offlineQueue.test.ts` (17 testów: kolejkowanie, potwierdzanie, replay, obcinanie obrazów przy quocie), `notesStore.test.ts` (5 testów: migracja LS→IDB, jednorazowość migracji, zapis/odczyt — wymagało dodania `fake-indexeddb` jako dev dependency), `noteSync.test.ts` (8 testów: `notesDiffer`/`describeDifference`). Wszystkie 42 testy (razem z istniejącymi) przechodzą (`npm test`). Zostaje: podstawowy e2e w Playwright na dodanie/edycję/usunięcie notatki.
- **`.env.example` nie jest potrzebny** — po przejrzeniu `noteSync.ts`/`notesStore.ts` potwierdzone, że apka nie ma żadnego zewnętrznego API/backendu (wcześniejsze przypuszczenie z pierwszego przeglądu było błędne — "sync" to lokalny `BroadcastChannel`, nie sieć).

### Wdrożenie

- **Brak CI** — dodać prosty workflow GitHub Actions (`lint` + `test` + `build`) uruchamiany na push/PR, żeby błędy łapać przed mergem; wymaga najpierw `git init` + repo na GitHub.
- **Brak `LICENSE`** — dodać, jeśli projekt ma być kiedykolwiek publiczny/udostępniany.
- **PWA/offline już działa** (`vite-plugin-pwa`, `offline.html`, manifest) — do wdrożenia produkcyjnego brakuje tylko hostingu statycznego (Vercel/Netlify/GitHub Pages) i `vite build` w CI.

### Propozycje rozbudowy funkcjonalnej

Spójne z tym, że apka jest **lokalna, bez konta i bez backendu** — dwa naturalne kierunki:

1. **Prawdziwa synchronizacja między urządzeniami** — obecny `noteSync.ts` działa tylko w obrębie jednej przeglądarki/urządzenia. Realne multi-device wymagałoby lekkiego backendu (np. sync przez plik w chmurze użytkownika — WebDAV/Google Drive/Dropbox API — zamiast pełnego serwera) lub rozwiązania end-to-end z biblioteką typu CRDT (Yjs/Automerge) synchronizowaną peer-to-peer.
2. **Import/eksport całej bazy jako kopia zapasowa** — `exportNotes.ts` już eksportuje pojedyncze formaty (PDF/MD/HTML/JSON); rozszerzyć o pełny eksport/import całego stanu (notatki + etykiety + foldery + ustawienia) jako jeden plik `.json`, żeby wspomóc migrację między przeglądarkami/urządzeniami skoro nie ma sync w chmurze — częściowo już zasugerowane przez `backupReminder.ts`, ale warto rozszerzyć o pełne przywracanie stanu.
3. **Przypomnienia cykliczne** — obecny `ReminderPicker`/`useReminderNotifications` wygląda na jednorazowe przypomnienia; dodać powtarzalność (codziennie/co tydzień) dla notatek typu "nawyki"/checklisty.
4. **Dokończenie UI polish z `.lovable/plan.md`** — sekcje 1 i 3 (layout/hierarchia, mikrointerakcje) nie są jeszcze w pełni potwierdzone jako wdrożone; `BottomNav` już istnieje, ale warto zweryfikować resztę (sticky blur header, empty states, design tokens `--elevation-*`) i dokończyć jako osobną iterację.
5. **Rozszerzenie statystyk/gamifikacji** (`StatsDialog`, `achievements.ts`) — np. passy (streaks) codziennego używania, wykresy aktywności (recharts już jest w zależnościach).

### Priorytetyzacja

1. **Najpierw (fundament, 1 dzień):** `git init` + pierwszy commit, wybór jednego menedżera pakietów i usunięcie zbędnych lockfile, uzupełnienie README, usunięcie `.lovable/plan.md`/`.claude/worktrees/` po przejrzeniu.
2. **Potem (dług techniczny, kolejne dni):** testy dla `offlineQueue`/`notesStore`/`noteSync`, rozbicie `Index.tsx`, CI (lint+test+build).
3. **Na końcu (rozbudowa):** pełny backup/restore całej bazy, przypomnienia cykliczne, dokończenie UI polish, docelowo realna synchronizacja między urządzeniami (największy nakład — osobny projekt).

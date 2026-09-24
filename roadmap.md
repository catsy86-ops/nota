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
- [x] **Rozbicie `src/pages/Index.tsx`** — z 1964 linii do 416; logika widoków/nawigacji, drag&drop, eksport/import i panele (`SettingsDialog`, `CommandPalette`) wydzielone do osobnych hooków/komponentów.
- [x] **Pokrycie testami** — dodano `offlineQueue.test.ts` (17 testów: kolejkowanie, potwierdzanie, replay, obcinanie obrazów przy quocie), `notesStore.test.ts` (5 testów: migracja LS→IDB, jednorazowość migracji, zapis/odczyt — wymagało dodania `fake-indexeddb` jako dev dependency), `noteSync.test.ts` (8 testów: `notesDiffer`/`describeDifference`). Wszystkie 42 testy (razem z istniejącymi) przechodzą (`npm test`). [x] Dodano też e2e w Playwright (`e2e/notes.spec.ts`): dodanie, edycja i usunięcie (kosz) notatki.
- **`.env.example` nie jest potrzebny** — po przejrzeniu `noteSync.ts`/`notesStore.ts` potwierdzone, że apka nie ma żadnego zewnętrznego API/backendu (wcześniejsze przypuszczenie z pierwszego przeglądu było błędne — "sync" to lokalny `BroadcastChannel`, nie sieć).

### Wdrożenie

- [x] **CI** — workflow GitHub Actions (`.github/workflows/ci.yml`): lint + typecheck + test (coverage) + build na push/PR do `master`/`main`.
- [x] **`LICENSE`** — dodany (MIT).
- **PWA/offline już działa** (`vite-plugin-pwa`, `offline.html`, manifest) — do wdrożenia produkcyjnego brakuje tylko hostingu statycznego (Vercel/Netlify/GitHub Pages) i `vite build` w CI.

### Propozycje rozbudowy funkcjonalnej

Spójne z tym, że apka jest **lokalna, bez konta i bez backendu** — dwa naturalne kierunki:

1. **Prawdziwa synchronizacja między urządzeniami** — wybrane podejście: CRDT peer-to-peer przez **Yjs**.
   - [x] **Faza 1 — wymiana warstwy danych na Yjs (bez sieci)**: `src/lib/yjsStore.ts` — `Y.Doc` z `notesMap`/`foldersMap`/`labelsMap`, `content` jako `Y.Text` (field-level merge zamiast whole-note LWW), persystencja przez `y-indexeddb` (baza `kaczy-yjs-v1`), jednorazowa migracja ze starego `notesStore.ts` (idb-keyval), `images` świadomie poza `Y.Doc` (osobny store urządzenie-lokalny, `kaczy.images.v1` — nie będą synchronizowane P2P w pierwszej wersji). `useNotes.ts` przepisany na projekcję z Yjs (`observeDeep`), publiczny kontrakt hooka bez zmian. Stary `BroadcastChannel` (`noteSync.ts`) i offline-queue (`offlineQueue.ts`) przestały być używane w ścieżce zapisu notatek (Yjs+IndexedDB sam daje trwałość i cross-tab sync) — oba pliki i ich testy zostają nietknięte, na wypadek przyszłego użycia gdzie indziej (np. store obrazów). Testy: `yjsStore.test.ts` (merge pól, merge tekstu, tombstone przy delete, migracja), `useNotes.test.ts` zaktualizowany pod nową architekturę. `exportFullBackup`/`importFullBackup` przepięte na projekcję Yjs.
   - [x] **Faza 2 — transport `y-webrtc` + UI parowania urządzeń**: `src/lib/yjsSync.ts` — cykl życia `WebrtcProvider` (opt-in, wyłączony domyślnie), publiczne serwery sygnalizacyjne domyślne z `y-webrtc` (bez własnej konfiguracji), kod parowania (8 znaków, bezpieczny alfabet) jako hasło + jako źródło zahaszowanej nazwy pokoju (kod nie trafia wprost do serwera sygnalizacyjnego). Nowa zakładka „Sync” w `SettingsDialog.tsx` (`src/components/SyncSettings.tsx`): przełącznik włącz/wyłącz, generowanie kodu, QR (`qrcode.react`) kodujący link `?pair=<kod>` do zeskanowania aparatem, dołączanie do istniejącej grupy ręcznie wpisanym kodem, „zapomnij i zacznij od nowa”. `initSync()` wpięty w `NotesProvider.tsx` po `yjsStore.ready()`, żeby wznawiać sync przy starcie appki niezależnie od tego, czy użytkownik otworzy Ustawienia. Testy: `yjsSync.test.ts` (generowanie kodu, hash nazwy pokoju, przejścia stanu) z zamockowanym `y-webrtc` — prawdziwe połączenie P2P zweryfikowane ręcznie (dwie karty przeglądarki, realne połączenie WebRTC z peerCount=1, brak błędów w konsoli).
   - Odłożone świadomie: sync obrazów między urządzeniami, item-level CRDT dla checklisty, self-hosted serwer sygnalizacyjny, kompresja/GC doc-a Yjs, testy integracyjne prawdziwego WebRTC między osobnymi urządzeniami (tylko manualne QA).
2. [x] **Import/eksport całej bazy jako kopia zapasowa** — `exportFullBackup`/`importFullBackup` w `exportNotes.ts` (z walidacją `fullBackupSchema`).
3. [x] **Przypomnienia cykliczne** — `reminderRepeat.ts` + testy, `QuickReminderInput`.
4. [x] **UI polish z `.lovable/plan.md`** — `BottomNav`, sticky blur header (`AppHeader.tsx`) i `EmptyState` wdrożone; design tokens `--elevation-*` pominięte jako nieistotny kosmetyczny detal.
5. [x] **Rozszerzenie statystyk/gamifikacji** (`StatsDialog`, `achievements.ts`) — dodano passy (streaki) codziennego używania, wykres aktywności z ostatnich 14 dni (recharts) i odznakę „Tydzień w ogniu”. Testy w `achievements.test.ts`.

## Porządki w kodzie — audyt 2026-09-24

Znaleziska z niezależnego audytu kodu (bez zmian w tej sesji — do zrobienia osobno):

- **Martwy kod do usunięcia**: `src/components/ui/sidebar.tsx` (637 linii, zupełnie nieużywany — `AppSidebar.tsx` to własna implementacja, nie korzysta z tego pliku), ok. 20 innych nieużywanych komponentów `shadcn/ui` (accordion, card, table, select, drawer, carousel, itd. — zweryfikować listę przed usunięciem), oraz komponenty bez triggera w UI: `FocusMode.tsx`, `NotePresentation.tsx` (prop `onPresent` zadeklarowany w `NoteCard` ale nigdy nie przekazany), `SeasonalBackdrop.tsx`, `NavLink.tsx`. **Uwaga:** `StatsDialog.tsx`/`chart.tsx` były na liście martwego kodu w pierwotnym audycie — to było nieaktualne, `StatsDialog` już podpięto do UI (sidebar + Command Palette) w tej sesji.
- **Duplikacja**: ~9 plików niezależnie reimplementuje ten sam wzorzec „localStorage-backed pub/sub store” (`confirmPrefs.ts`, `effectsSettings.ts`, `viewPrefs.ts`, `seasonTheme.ts`, `achievements.ts`, `actionHistory.ts`, `hourlyTicker.ts`, `useTheme.ts`, `useMotionPref.ts`) — kandydat do wspólnego `createPersistedStore<T>()`.
- **Braki w testach**: `noteSchema.ts`, `useNoteActions.ts` (najpierw — bezpieczeństwo danych), potem `searchNotes.ts`, `wikiLinks.ts`, `useNoteVersions.ts`, `useImportExport.ts`.
- **Realne ostrzeżenia lintera** (nie tylko `react-refresh` szum): `useGlobalShortcuts.ts` — 6× brak `handlers` w zależnościach `useEffect` (możliwe stale closures dla skrótów klawiszowych — do zbadania), `Index.tsx` — `allNotesForLinks` przeliczane co render zamiast `useMemo`.
- **Duże komponenty do ewentualnego podziału**: `SettingsDialog.tsx` (545 linii), `NoteCard.tsx` (510 linii, 20 propsów przy jednoczesnym korzystaniu z kontekstu — niespójny wzorzec przepływu danych).
- **Dormant po tej sesji**: `offlineQueue.ts`/`OfflineQueuePanel.tsx` (kolejka offline) przestały być zasilane po przejściu notatek na Yjs+IndexedDB — panel będzie zawsze pokazywał 0 oczekujących zmian. Plik i testy zostały celowo nietknięte; do decyzji: usunąć panel czy przepiąć go pod status Yjs.

### Priorytetyzacja

1. **Najpierw (fundament, 1 dzień):** `git init` + pierwszy commit, wybór jednego menedżera pakietów i usunięcie zbędnych lockfile, uzupełnienie README, usunięcie `.lovable/plan.md`/`.claude/worktrees/` po przejrzeniu.
2. **Potem (dług techniczny, kolejne dni):** testy dla `offlineQueue`/`notesStore`/`noteSync`, rozbicie `Index.tsx`, CI (lint+test+build).
3. **Na końcu (rozbudowa):** pełny backup/restore całej bazy, przypomnienia cykliczne, dokończenie UI polish, docelowo realna synchronizacja między urządzeniami (największy nakład — osobny projekt).

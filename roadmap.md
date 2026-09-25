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

Znaleziska z niezależnego audytu kodu. Zrealizowane w sesji porządkowej 2026-09-24:

- [x] **Martwy kod usunięty**: 24 nieużywane komponenty `shadcn/ui` (accordion, card, table, select, drawer, carousel, sidebar.tsx — 637 linii, itd.) + `NavLink.tsx`, wraz z 17 npm-owymi zależnościami potrzebnymi wyłącznie im (bundle CSS spadł z 91KB do 70KB). `FocusMode.tsx`/`NotePresentation.tsx` **nie były martwe** — były w pełni gotowe, tylko niepodpięte; podłączono je do UI (przycisk „Prezentacja” w menu notatki, „Tryb skupienia” w bocznym menu i Command Palette). `SeasonalBackdrop.tsx` pozostaje niepodpięty (nie sprawdzano w tej sesji).
- [x] **Duplikacja**: `confirmPrefs.ts`, `effectsSettings.ts`, `viewPrefs.ts`, `seasonTheme.ts`, `useMotionPref.ts` przepisane na wspólny `src/lib/persistedStore.ts` (`createPersistedStore<T>`). `achievements.ts`, `actionHistory.ts`, `hourlyTicker.ts`, `useTheme.ts` świadomie pominięte — inny kształt (logika unlocku, lokalny `useState`, side-effecty), wymuszanie tej samej abstrakcji byłoby na siłę.
- [x] **Braki w testach uzupełnione**: `noteSchema.test.ts` (folderSchema/fullBackupSchema — noteSchema sam już był pokryty w `exportNotes.test.ts`), `useNoteActions.test.ts`, `searchNotes.test.ts`, `wikiLinks.test.ts`, `useNoteVersions.test.ts`, `useImportExport.test.ts`, plus `persistedStore.test.ts` dla nowego modułu współdzielonego. 181/181 testów zielonych.
- [x] **Realne ostrzeżenia lintera naprawione**: `useGlobalShortcuts.ts` (6 efektów), `allNotesForLinks` w `Index.tsx` (`useMemo`), stale closure w `AddNoteBar.tsx` (`handleClose` pomijał `checklist`/`priority` w zależnościach — realny bug), analogicznie `DrawingCanvas.tsx`. Lint: 41 → 9 ostrzeżeń (reszta to nieszkodliwy szum `react-refresh`/wendorowany `use-toast.ts`).
- **Duże komponenty do ewentualnego podziału (nie zrobione)**: `SettingsDialog.tsx` (~600 linii po dodaniu zakładki Sync), `NoteCard.tsx` (510 linii, 20 propsów przy jednoczesnym korzystaniu z kontekstu — niespójny wzorzec przepływu danych). Odłożone — wyższe ryzyko/koszt niż pozostałe punkty, do osobnej sesji jeśli będzie potrzeba.
- [x] **Dormant panel naprawiony** — `OfflineQueuePanel.tsx`/`OfflineStatus.tsx` przepięte z martwej kolejki (`offlineQueue.ts`, nieużywanej do zapisu notatek od Fazy 1 Yjs) na realny status: połączenie sieciowe, potwierdzenie że IndexedDB zapisuje natychmiast (bez kolejki) oraz status P2P sync (`yjsSync.ts` — status/liczba urządzeń). `offlineQueue.ts` i jego testy zostają nietknięte (moduł nieużywany, do ew. usunięcia w osobnej sesji).

## Audyt agentowy — 2026-09-25 (architektura + UX)

### Architektura / kod

- [x] **Usunąć `offlineQueue.ts`** (+ test) — usunięty razem z jedynym żywym konsumentem (`QUEUE_DATA_LOST_EVENT` listener w `src/main.tsx`, sam nigdy nie wystrzeliwał bo queue nie było zasilane). Typecheck/lint/156 testów zielone.
- [x] **Usunąć `noteSync.ts`** (BroadcastChannel cross-tab sync) — usunięty razem z własnym testem; był martwy poza tym testem.
- [x] **`NoteCard.tsx` (20 propsów) — zredukowane do 5**: `note`, `index`, `dragAttributes`, `dragListeners`, `selected`. Reszta (`onUpdate`/`onDelete`/`onTogglePin`/`onArchive`/`onUnarchive`/`onDuplicate`/`onMoveToFolder`/`getVersions`/`onSaveVersion`/`onRestoreVersion`/`onPresent`/`knownTitles`/`onWikiClick`/`selectionMode`/`onToggleSelect`) przeniesione do nowego `NoteViewActionsContext` (`src/hooks/NoteViewActionsContext.tsx`), dostarczanego raz przez `NoteGrid.tsx` zamiast przewlekanego przez `NoteGrid → SortableNoteCard → NoteCard`. **Nie** wpięte wprost pod globalny `useNotesContext()` — te mutatory różnią się per widok (Notatki/Archiwum/Kosz mają inne `onDelete`/`onArchive`/`onUnarchive`, część owinięta w potwierdzenie+undo z `useNoteActions`), więc `Index.tsx` nadal przekazuje te same funkcje do `NoteGrid` co wcześniej — zmienił się tylko kanał dostawy do `NoteCard`, zachowanie 1:1. Zweryfikowano: typecheck, lint, 156/156 testów, `npm run build`.
- [ ] **`SettingsDialog.tsx` (571 linii)** — podzielić na zakładki jako osobne pliki, kontynuując wzorzec z `SyncSettings.tsx`.
- [x] **`SeasonalBackdrop.tsx`** — był w pełni gotowy (self-gating na `seasonalTheme`+`snow` z `effectsSettings.ts`), tylko niepodpięty. Zamontowany globalnie w `App.tsx` obok `OfflineStatus`, analogicznie do wcześniejszego FocusMode/NotePresentation.
- [x] **Widoczny sygnał, że obrazy nie synchronizują się P2P** — `SyncSettings.tsx` już to wspominał w sekcji „Jak to działa”; dodano dodatkowo odznakę z tooltipem (`CloudOff`) na pierwszej miniaturze w `NoteCard.tsx`, widoczną tylko gdy sync jest aktywny.
- Niżej priorytetowe: test integracyjny merge'a Yjs bez mocka WebRTC; jeden kanał na błędy sync/persist zamiast rozproszonych `console.error`/toastów; ESLint import-boundary żeby żaden komponent UI nie importował `yjs`/`y-indexeddb` bezpośrednio poza `useNotes`/`NotesProvider`.

### UX / funkcjonalność

- [x] **`aria-label` na przyciskach-ikonach** — naprawiono najgłośniejsze luki: wspólny `ActionBtn` w `NoteCard.tsx` (Pin/Kolor/Archiwizuj/Usuń/Więcej/Rysuj/Duplikuj/Prezentacja — 8+ użyć jednym miejscem), przyciski usuwania obrazka w `NoteCard.tsx`/`AddNoteBar.tsx`, przycisk usuwania przypomnienia w `AddNoteBar.tsx`. Reszta apki (inne komponenty) nietknięta — do ew. kolejnej sesji jeśli znajdą się kolejne luki.
- [x] **Silent failure przy obrazach >2MB naprawiony** — w `NoteCard.tsx` i `AddNoteBar.tsx` pominięte pliki (za duże) teraz zgłaszają `toast.error` z liczbą pominiętych obrazków, zamiast cichego `continue`.
- [x] **`aria-live` dla zmian stanu — zweryfikowane, już pokryte**: `Toaster` z `sonner` renderuje kontener z `aria-live="polite"` globalnie (potwierdzone w źródle `node_modules/sonner`), więc każdy `toast()` (trash/archive/błędy importu/sync) jest już ogłaszany czytnikom ekranu. Ciche zapisy (edycja notatki) celowo bez toastu — nie każda zmiana stanu powinna przerywać czytnik ekranu.
- [x] **Toast „Cofnij” — już istniał (`toastWithUndo` w `undoToast.ts`), ale odkryto i naprawiono realny bug**: usuwanie notatki poza widokiem kosza pokazywało **podwójne potwierdzenie** — własny `AlertDialog` w `NoteCard.tsx` z mylącym tekstem „zostanie trwale usunięta, nie można cofnąć”, a zaraz po nim drugi dialog z `useConfirmAction` (który i tak kończy się toastem z Cofnij). Naprawione: przycisk usuwania woła `onDelete` bezpośrednio gdy `!note.trashed` (soft-trash z własnym potwierdzeniem+undo), a lokalny `AlertDialog` z „nie można cofnąć” pokazuje się tylko w widoku kosza (`note.trashed`, faktycznie permanentne usunięcie).
- [x] **Walidacja dat przeszłych w przypomnieniach** — `ReminderPicker.tsx`: kalendarz już blokował przeszłe dni, ale nie godzinę tego samego dnia; dodano sprawdzenie `date+time < now`, blokadę przycisku „Zapisz” i komunikat ostrzegawczy.
- [x] **„Brak wyników” w Command Palette z CTA** — `CommandPalette.tsx`: `CommandEmpty` pokazuje teraz „Utwórz notatkę „…”” (otwiera pasek dodawania notatki), gdy wpisane wyszukiwanie nic nie znajdzie. (Sam `SearchBar.tsx` nie ma tej luki w tym samym stopniu — filtrowanie listy notatek, nie paleta poleceń — pominięty.)
- [x] **Jaśniejsza komunikacja P2P sync w UI** — `SyncSettings.tsx`: doprecyzowano, że oba urządzenia muszą być online jednocześnie i co się dzieje gdy jedno jest offline.
- Niżej priorytetowe: alternatywa dla drag&drop na mobile (menu „Przenieś w górę/dół”), widoczna lista skrótów klawiszowych (cheat-sheet), rozróżnienie pustego stanu „brak notatek” vs „brak wyników filtra” (zweryfikować czy już jest), focus trap/return w custom fullscreen (`DrawingCanvas`, `NotePresentation`).

### Priorytetyzacja

1. **Najpierw (fundament, 1 dzień):** `git init` + pierwszy commit, wybór jednego menedżera pakietów i usunięcie zbędnych lockfile, uzupełnienie README, usunięcie `.lovable/plan.md`/`.claude/worktrees/` po przejrzeniu.
2. **Potem (dług techniczny, kolejne dni):** testy dla `offlineQueue`/`notesStore`/`noteSync`, rozbicie `Index.tsx`, CI (lint+test+build).
3. **Na końcu (rozbudowa):** pełny backup/restore całej bazy, przypomnienia cykliczne, dokończenie UI polish, docelowo realna synchronizacja między urządzeniami (największy nakład — osobny projekt).

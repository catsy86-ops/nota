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
- [x] **`vite build` w CI** — dodany razem z resztą workflow (`.github/workflows/ci.yml` robi lint + typecheck + test + build + e2e).
- [x] **Configi hostingu przygotowane (2026-09-27)** — `vercel.json` i `netlify.toml` w repo, opisane w README (sekcja „Wdrożenie"). Oba dają SPA fallback (bez niego wejście z linku na pod-ścieżkę daje 404) i nagłówki cache: `/assets/*` na rok jako `immutable` (nazwy z hashem), ale `sw.js` **i** `sw-notifications.js` na `no-cache` — ten drugi jest dociągany przez `importScripts()` i nie ma hasha w nazwie, więc scache'owany zablokowałby wszystkie przyszłe aktualizacje u kogoś, kto raz zainstalował PWA. Składnia obu plików zwalidowana (parser JSON / TOML).
- **Samo wdrożenie: świadomie nie zrobione** — wymaga połączenia repo z kontem Vercel/Netlify, do czego nie ma dostępu z sesji; decyzja o hostingu po stronie użytkownika. **GitHub Pages celowo odrzucony na teraz**: serwuje pod `/<nazwa-repo>/`, a appka ma root zaszyty w `manifest.webmanifest` (`start_url`/`id`/`scope`/ikony), `navigateFallback` w `vite.config.ts` i absolutnych ścieżkach w `index.html` — powód i pełna lista miejsc do zmiany opisane w README.

### Propozycje rozbudowy funkcjonalnej

Spójne z tym, że apka jest **lokalna, bez konta i bez backendu** — dwa naturalne kierunki:

1. **Prawdziwa synchronizacja między urządzeniami** — wybrane podejście: CRDT peer-to-peer przez **Yjs**.
   - [x] **Faza 1 — wymiana warstwy danych na Yjs (bez sieci)**: `src/lib/yjsStore.ts` — `Y.Doc` z `notesMap`/`foldersMap`/`labelsMap`, `content` jako `Y.Text` (field-level merge zamiast whole-note LWW), persystencja przez `y-indexeddb` (baza `kaczy-yjs-v1`), jednorazowa migracja ze starego `notesStore.ts` (idb-keyval), `images` świadomie poza `Y.Doc` (osobny store urządzenie-lokalny, `kaczy.images.v1` — nie będą synchronizowane P2P w pierwszej wersji). `useNotes.ts` przepisany na projekcję z Yjs (`observeDeep`), publiczny kontrakt hooka bez zmian. Stary `BroadcastChannel` (`noteSync.ts`) i offline-queue (`offlineQueue.ts`) przestały być używane w ścieżce zapisu notatek (Yjs+IndexedDB sam daje trwałość i cross-tab sync) — oba pliki i ich testy zostają nietknięte, na wypadek przyszłego użycia gdzie indziej (np. store obrazów). Testy: `yjsStore.test.ts` (merge pól, merge tekstu, tombstone przy delete, migracja), `useNotes.test.ts` zaktualizowany pod nową architekturę. `exportFullBackup`/`importFullBackup` przepięte na projekcję Yjs.
   - [x] **Faza 2 — transport `y-webrtc` + UI parowania urządzeń**: `src/lib/yjsSync.ts` — cykl życia `WebrtcProvider` (opt-in, wyłączony domyślnie), publiczne serwery sygnalizacyjne domyślne z `y-webrtc` (bez własnej konfiguracji), kod parowania (8 znaków, bezpieczny alfabet) jako hasło + jako źródło zahaszowanej nazwy pokoju (kod nie trafia wprost do serwera sygnalizacyjnego). Nowa zakładka „Sync” w `SettingsDialog.tsx` (`src/components/SyncSettings.tsx`): przełącznik włącz/wyłącz, generowanie kodu, QR (`qrcode.react`) kodujący link `?pair=<kod>` do zeskanowania aparatem, dołączanie do istniejącej grupy ręcznie wpisanym kodem, „zapomnij i zacznij od nowa”. `initSync()` wpięty w `NotesProvider.tsx` po `yjsStore.ready()`, żeby wznawiać sync przy starcie appki niezależnie od tego, czy użytkownik otworzy Ustawienia. Testy: `yjsSync.test.ts` (generowanie kodu, hash nazwy pokoju, przejścia stanu) z zamockowanym `y-webrtc` — prawdziwe połączenie P2P zweryfikowane ręcznie (dwie karty przeglądarki, realne połączenie WebRTC z peerCount=1, brak błędów w konsoli).
   - [x] **Item-level CRDT dla checklisty (2026-09-25, kolejna sesja)** — wcześniej checklist był pojedynczym polem `y.set("checklist", plainArray)`: dowolna zmiana (odhaczenie jednej pozycji) nadpisywała całą listę, więc równoczesna edycja dwóch różnych pozycji checklisty na dwóch urządzeniach kończyła się whole-record last-write-wins (tak jak reszta notatki przed Fazą 1). Przepisane w `yjsStore.ts` na `Y.Map` kluczowaną po `id` pozycji (wzorem `notesMap`/`foldersMap`), każda pozycja to własny `Y.Map` z polami `text`/`checked`/`order` (kolejność pozycji jako pole, nie fizyczny index — ten sam wzorzec co ręczna kolejność notatek). `applyChecklistDiff()` reconciluje przychodzącą płaską tablicę (UI nadal wysyła całą listę przez `onUpdate`) do minimalnych operacji na `Y.Map`, więc merge dzieje się na poziomie pojedynczej pozycji mimo że publiczne API (`ChecklistItem[]`) się nie zmieniło. Wsteczna kompatybilność: stare notatki z checklistą zapisaną jako zwykła tablica są czytane poprawnie (`plainChecklistFromY` rozpoznaje oba kształty) i samoczynnie migrują się na `Y.Map` przy pierwszej edycji. Testy: `yjsStore.test.ts` (+3 — merge równoczesnych odhaczeń różnych pozycji, merge dodania nowej pozycji z odhaczeniem starej, usunięcie pozycji wygrywa nad nieaktualną edycją tej samej pozycji na drugim urządzeniu). Typecheck/lint/161 testów/build zielone.
   - [x] **Sync obrazów między urządzeniami (2026-09-25, kolejna sesja)** — nowy `src/lib/imageSync.ts`: osobny, TYLKO-w-pamięci `Y.Doc` (nie zapisywany do IndexedDB, żeby nie spuchnąć lokalnego storage u wszystkich użytkowników — patrz duży komentarz w `yjsStore.ts` o tym, czemu obrazy pierwotnie zostały wyłączone z głównego doc-a), z własnym `WebrtcProvider` na tej samej parze kod/hasło co główny transport, pokój `${roomNameFor(code)}-img`. Główny doc dostał tani, zawsze-synchronizowany „manifest": każda notatka ma teraz pole `imageHashes` (hash treści z `src/lib/imageHash.ts` — szybki, synchroniczny, nie-kryptograficzny FNV-1a, świadomie nie SHA-256, żeby nie robić z synchronicznych metod `yjsStore.ts` funkcji async). Gdy urządzenie ma obraz lokalnie, `imageSync` sam wrzuca go (base64) do transportowego `Y.Map` pod kluczem = hash; gdy widzi u siebie brakujący hash z manifestu notatki i ten hash pojawi się w transportowym mapie (od peera), dogrywa obraz lokalnie przez `yjsStore.setImagesLocal()` (który też „szturcha" `Y.Map` notatki, żeby zadziałał istniejący `observeDeep` i UI się przerenderowało). Usunięto mylącą odznakę „obrazy nie synchronizują się” z `NoteCard.tsx` i zaktualizowano opis w `SyncSettings.tsx`. Testy (bez mockowania realnego WebRTC, ten sam sprawdzony wzorzec co `yjsStore.test.ts` — merge na realnym `Y.Doc`, mock tylko na `y-webrtc`): `imageHash.test.ts` (+4), `imageSync.test.ts` (+4 — mirror własnego obrazu, dogranie brakującego obrazu od „peera”, brak zbędnych zapisów gdy nic nie brakuje, poprawne odłączenie). `yjsSync.test.ts` zaktualizowany pod dodatkowy transport (+1 test). Typecheck/lint (dodano `imageSync.ts`/`imageSync.test.ts` do ESLint import-boundary z poprzedniej sesji)/170 testów/build zielone.
   - **Wymaga manualnego QA na dwóch realnych urządzeniach/kartach przeglądarki** — nie dało się przetestować prawdziwego połączenia WebRTC w tej sesji (rozszerzenie Chrome niedostępne), tak jak przy Fazie 2 sync tekstu. Znane ograniczenie v1: backfill dotyczy tylko obrazów całkowicie brakujących na końcu listy (device offline w chwili dodania) — rozjazd pozycji przy współbieżnej edycji tej samej notatki na dwóch urządzeniach jednocześnie nie jest obsłużony (rzadki przypadek, self-heals przy następnej edycji obrazów tej notatki).
   - [x] **Self-hosted serwer sygnalizacyjny (2026-09-25, kolejna sesja)** — nowy folder `signaling-server/` z gotowym do uruchomienia serwerem (oficjalna implementacja z pakietu `y-webrtc`, `bin/server.js`, wydzielona jako samodzielny `package.json` + `Dockerfile` + `README.md`). **Świadomie NIEwpięty jako domyślny w apce** — użytkownik nie ma obecnie własnego hostingu; kod jest gotowy, dokumentacja opisuje dokładnie jedną linijkę zmiany (`signaling: [...]` w opcjach `WebrtcProvider` w `yjsSync.ts`/`imageSync.ts`), żeby podpiąć własny serwer, gdy pojawi się miejsce do wdrożenia. Zweryfikowano: `npm install && npm start` faktycznie uruchamia serwer nasłuchujący na porcie 4444.
   - [x] **Kompresja/GC doc-a Yjs — zweryfikowane empirycznie, nie był to realny problem** (2026-09-25, kolejna sesja): `createYjsStore` nigdzie nie wyłącza domyślnego `gc: true` na `Y.Doc`, a `y-indexeddb` kompaktuje zapisany log update'ów co 500 wpisów (`PREFERRED_TRIM_SIZE` w bibliotece). Eksperyment: 200 notatek po 2000 znaków → usunięcie 190 z nich zmniejszyło zakodowany stan dokumentu z ~1MB do ~54KB (ponad 18×), także po zmergowaniu tego stanu do zupełnie świeżego urządzenia (nie ma "widmowych" danych czekających na przyszłe czyszczenie). Historia wersji (`useNoteVersions.ts`) żyje całkowicie osobno w `localStorage`, więc niczego w Yjs nie przytrzymuje przy życiu. Utrwalone jako test regresyjny: `yjsStore.test.ts` (+1 — "garbage collection"). Nie zbudowano żadnej dodatkowej abstrakcji/rutyny kompaktującej — rozwiązywałoby to problem, który empirycznie nie istnieje.
   - **Testy integracyjne prawdziwego WebRTC między osobnymi urządzeniami — pozostają tylko manualne QA, świadomie**: symulacja realnego połączenia P2P (dwa fizycznie osobne urządzenia/przeglądarki, prawdziwe STUN/sygnalizacja) nie da się wiarygodnie zautomatyzować w środowisku sandboxowym tej sesji ani w typowym CI — brak dostępu do dwóch realnych przeglądarek z siecią, a testy przez prawdziwe publiczne serwery sygnalizacyjne byłyby niedeterministyczne (zależne od zewnętrznej infrastruktury, flaky). Logika merge'a CRDT (to, co faktycznie może się zepsuć) jest już w pełni pokryta testami bez mocka WebRTC (`yjsStore.test.ts`, `imageSync.test.ts` — merge na prawdziwym `Y.Doc`); to, czego te testy nie łapią — sama nawiązywalność połączenia WebRTC między przeglądarkami — wymaga ręcznej weryfikacji, tak jak przy Fazie 2 sync tekstu i sync obrazów.
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
- [x] **Duże komponenty do podziału — zrobione w kolejnej sesji (audyt 2026-09-25)**: `NoteCard.tsx` (20 propsów → 5, reszta przez `NoteViewActionsContext`) i `SettingsDialog.tsx` (571 → 92 linie, zakładki jako osobne pliki) — zobacz sekcję niżej.
- [x] **Dormant panel naprawiony** — `OfflineQueuePanel.tsx`/`OfflineStatus.tsx` przepięte z martwej kolejki (`offlineQueue.ts`, nieużywanej do zapisu notatek od Fazy 1 Yjs) na realny status: połączenie sieciowe, potwierdzenie że IndexedDB zapisuje natychmiast (bez kolejki) oraz status P2P sync (`yjsSync.ts` — status/liczba urządzeń). `offlineQueue.ts` i jego testy zostają nietknięte (moduł nieużywany, do ew. usunięcia w osobnej sesji).

## Audyt agentowy — 2026-09-25 (architektura + UX)

### Architektura / kod

- [x] **Usunąć `offlineQueue.ts`** (+ test) — usunięty razem z jedynym żywym konsumentem (`QUEUE_DATA_LOST_EVENT` listener w `src/main.tsx`, sam nigdy nie wystrzeliwał bo queue nie było zasilane). Typecheck/lint/156 testów zielone.
- [x] **Usunąć `noteSync.ts`** (BroadcastChannel cross-tab sync) — usunięty razem z własnym testem; był martwy poza tym testem.
- [x] **`NoteCard.tsx` (20 propsów) — zredukowane do 5**: `note`, `index`, `dragAttributes`, `dragListeners`, `selected`. Reszta (`onUpdate`/`onDelete`/`onTogglePin`/`onArchive`/`onUnarchive`/`onDuplicate`/`onMoveToFolder`/`getVersions`/`onSaveVersion`/`onRestoreVersion`/`onPresent`/`knownTitles`/`onWikiClick`/`selectionMode`/`onToggleSelect`) przeniesione do nowego `NoteViewActionsContext` (`src/hooks/NoteViewActionsContext.tsx`), dostarczanego raz przez `NoteGrid.tsx` zamiast przewlekanego przez `NoteGrid → SortableNoteCard → NoteCard`. **Nie** wpięte wprost pod globalny `useNotesContext()` — te mutatory różnią się per widok (Notatki/Archiwum/Kosz mają inne `onDelete`/`onArchive`/`onUnarchive`, część owinięta w potwierdzenie+undo z `useNoteActions`), więc `Index.tsx` nadal przekazuje te same funkcje do `NoteGrid` co wcześniej — zmienił się tylko kanał dostawy do `NoteCard`, zachowanie 1:1. Zweryfikowano: typecheck, lint, 156/156 testów, `npm run build`.
- [x] **`SettingsDialog.tsx` (571 → 92 linie)** — podzielony na zakładki jako osobne pliki w `src/components/settings/`: `AppearanceSettings.tsx` (motyw/ruch/pora roku/układ siatki), `GeneralSettings.tsx` (kolor domyślny/autosave/efekty/skróty), `BackupSettings.tsx` (auto-backup/przypomnienia/eksport-import), plus współdzielone `Section`/`ToggleRow` w `SettingsShared.tsx`. Każda zakładka sama woła swoje hooki (store'y globalne przez `persistedStore`) — bez prop-threadingu z dialogu. `SettingsDialog.tsx` jest teraz czystym kontenerem `Dialog`+`Tabs`. Zweryfikowano: typecheck, lint, 156/156 testów, `npm run build`.
- [x] **`SeasonalBackdrop.tsx`** — był w pełni gotowy (self-gating na `seasonalTheme`+`snow` z `effectsSettings.ts`), tylko niepodpięty. Zamontowany globalnie w `App.tsx` obok `OfflineStatus`, analogicznie do wcześniejszego FocusMode/NotePresentation.
- [x] **Widoczny sygnał, że obrazy nie synchronizują się P2P** — `SyncSettings.tsx` już to wspominał w sekcji „Jak to działa”; dodano dodatkowo odznakę z tooltipem (`CloudOff`) na pierwszej miniaturze w `NoteCard.tsx`, widoczną tylko gdy sync jest aktywny.
- [x] **ESLint import-boundary** — `eslint.config.js`: `no-restricted-imports` blokuje bezpośredni import `yjs`/`y-indexeddb`/`y-webrtc` we wszystkich plikach poza `src/lib/yjsStore.ts`, `src/lib/yjsSync.ts`, `src/hooks/useNotes.ts` (i ich testami). Zweryfikowano że reguła realnie łapie naruszenie (`no-restricted-imports` error na testowym pliku), `npm run lint` dalej 0 błędów/10 tych samych ostrzeżeń co wcześniej.
- [x] **Test integracyjny merge'a Yjs bez mocka WebRTC — zweryfikowane, już istniał**: `yjsStore.test.ts` testuje realny merge dwóch `Y.Doc` przez `Y.applyUpdate`/`Y.encodeStateAsUpdate` (field-level merge, merge `Y.Text`, tombstone po delete) — bez żadnego mocka `y-webrtc`, bo logika mergowania CRDT jest niezależna od transportu. Mock `y-webrtc` w `yjsSync.test.ts` dotyczy tylko cyklu życia połączenia (generowanie kodu, przejścia stanu) — słusznie zamockowany, bo prawdziwego WebRTC nie da się uruchomić w środowisku testowym (jsdom/vitest).
- [x] **Jeden kanał na błędy sync/persist — zweryfikowane, nie było realnego problemu do naprawienia**: przegląd wszystkich `catch`/`console.error` w kodzie pokazał, że nie ma rozproszonych `console.error` w ścieżce sync/persist (jedyne dwa `console.error` w całym repo to `ErrorBoundary.tsx` i `NotFound.tsx` — nie dotyczą sync/persist). Zapisy do `localStorage`/IndexedDB są świadomie "best-effort" i ciche (np. `persistedStore.ts`, `notesStore.ts`, `yjsStore.ts` — IndexedDB jako źródło prawdy, localStorage tylko jako cache/flaga), a błędy widoczne dla użytkownika (import/eksport, parowanie sync) już konsekwentnie idą przez `toast.error` z `sonner` (`useImportExport.ts`, `SyncSettings.tsx`). Nie tworzono nowej abstrakcji "kanału błędów" dla problemu, który w praktyce nie istnieje.

### UX / funkcjonalność

- [x] **`aria-label` na przyciskach-ikonach** — naprawiono najgłośniejsze luki: wspólny `ActionBtn` w `NoteCard.tsx` (Pin/Kolor/Archiwizuj/Usuń/Więcej/Rysuj/Duplikuj/Prezentacja — 8+ użyć jednym miejscem), przyciski usuwania obrazka w `NoteCard.tsx`/`AddNoteBar.tsx`, przycisk usuwania przypomnienia w `AddNoteBar.tsx`. Reszta apki (inne komponenty) nietknięta — do ew. kolejnej sesji jeśli znajdą się kolejne luki.
- [x] **Silent failure przy obrazach >2MB naprawiony** — w `NoteCard.tsx` i `AddNoteBar.tsx` pominięte pliki (za duże) teraz zgłaszają `toast.error` z liczbą pominiętych obrazków, zamiast cichego `continue`.
- [x] **`aria-live` dla zmian stanu — zweryfikowane, już pokryte**: `Toaster` z `sonner` renderuje kontener z `aria-live="polite"` globalnie (potwierdzone w źródle `node_modules/sonner`), więc każdy `toast()` (trash/archive/błędy importu/sync) jest już ogłaszany czytnikom ekranu. Ciche zapisy (edycja notatki) celowo bez toastu — nie każda zmiana stanu powinna przerywać czytnik ekranu.
- [x] **Toast „Cofnij” — już istniał (`toastWithUndo` w `undoToast.ts`), ale odkryto i naprawiono realny bug**: usuwanie notatki poza widokiem kosza pokazywało **podwójne potwierdzenie** — własny `AlertDialog` w `NoteCard.tsx` z mylącym tekstem „zostanie trwale usunięta, nie można cofnąć”, a zaraz po nim drugi dialog z `useConfirmAction` (który i tak kończy się toastem z Cofnij). Naprawione: przycisk usuwania woła `onDelete` bezpośrednio gdy `!note.trashed` (soft-trash z własnym potwierdzeniem+undo), a lokalny `AlertDialog` z „nie można cofnąć” pokazuje się tylko w widoku kosza (`note.trashed`, faktycznie permanentne usunięcie).
- [x] **Walidacja dat przeszłych w przypomnieniach** — `ReminderPicker.tsx`: kalendarz już blokował przeszłe dni, ale nie godzinę tego samego dnia; dodano sprawdzenie `date+time < now`, blokadę przycisku „Zapisz” i komunikat ostrzegawczy.
- [x] **„Brak wyników” w Command Palette z CTA** — `CommandPalette.tsx`: `CommandEmpty` pokazuje teraz „Utwórz notatkę „…”” (otwiera pasek dodawania notatki), gdy wpisane wyszukiwanie nic nie znajdzie. (Sam `SearchBar.tsx` nie ma tej luki w tym samym stopniu — filtrowanie listy notatek, nie paleta poleceń — pominięty.)
- [x] **Jaśniejsza komunikacja P2P sync w UI** — `SyncSettings.tsx`: doprecyzowano, że oba urządzenia muszą być online jednocześnie i co się dzieje gdy jedno jest offline.
- [x] **Widoczna lista skrótów klawiszowych (cheat-sheet)** — nowy `ShortcutsDialog.tsx`, otwierany z Command Palette („Skróty klawiszowe”) i skrótem `?` (globalny, `useGlobalShortcuts.ts`). Zebrano tam wszystkie istniejące skróty (globalne, nawigacja po siatce notatek, szybki podgląd) — sam mechanizm skrótów bez zmian, dodano tylko widoczność.
- [x] **Rozróżnienie pustego stanu „brak notatek” vs „brak wyników filtra” — zweryfikowane, już było zrobione**: `EmptyState.tsx` renderuje osobny komunikat „Brak wyników” gdy `search` jest niepuste, inaczej widok-specyficzny nagłówek/opis (kosz/archiwum/dziś/tydzień/etykieta/folder).
- [x] **Focus trap/return w custom fullscreen — zweryfikowane, już było zrobione**: `DrawingCanvas.tsx` i `NotePresentation.tsx` używają Radix `Dialog`/`DialogContent`, który sam zapewnia focus trap i powrót fokusa po zamknięciu — nie były to „custom” fullscreeny bez tego mechanizmu.
- [x] **Ręczna kolejność notatek dokończona (2026-09-25, kolejna sesja)** — wcześniej odkryto, że `reorderNotes`/przeciąganie w obrębie siatki było de facto martwe: `activeNotes` w `useNotes.ts` zawsze sortowało po `pinned`+`updatedAt`, więc przeciągnięcie notatki nie zmieniało widocznej kolejności (`order` był zapisywany, ale nigdy nie czytany). Dokończone: nowy `SortKey` `"manual"` w `viewPrefs.ts`, obsłużony w `useFilteredNotes.ts` (`sortNotes`: sortuje po `order` rosnąco, kierunek asc/desc celowo nieistotny dla ręcznej kolejności — ukryty w UI dla tego trybu w `ViewControls.tsx`), dostępny jako opcja „Ręcznie (przeciągnij)” w menu sortowania. `useNoteDnd.ts`: po realnym przeciągnięciu notatki (nie drop na folder) automatyczne przełączenie `sortKey` na `"manual"` z toastem informującym — inaczej efekt przeciągania byłby niewidoczny przy innym aktywnym sortowaniu. Testy: `useFilteredNotes.test.ts` (+2, sortowanie manual, brak wpływu `sortDir`). Typecheck/lint/158 testów/`npm run build` zielone. Alternatywa mobilna „przenieś w górę/dół” pozostaje pominięta — skoro drag&drop i tak jest jedynym sposobem ustawienia kolejności, dodanie przycisków byłoby osobnym zadaniem UX, nie blokerem.

### Priorytetyzacja

1. **Najpierw (fundament, 1 dzień):** `git init` + pierwszy commit, wybór jednego menedżera pakietów i usunięcie zbędnych lockfile, uzupełnienie README, usunięcie `.lovable/plan.md`/`.claude/worktrees/` po przejrzeniu.
2. **Potem (dług techniczny, kolejne dni):** testy dla `offlineQueue`/`notesStore`/`noteSync`, rozbicie `Index.tsx`, CI (lint+test+build).
3. **Na końcu (rozbudowa):** pełny backup/restore całej bazy, przypomnienia cykliczne, dokończenie UI polish, docelowo realna synchronizacja między urządzeniami (największy nakład — osobny projekt).

## Audyt „gotowość do codziennego użytku + PWA offline" — 2026-09-25 (kolejna sesja)

Audyt na żywo: przegląd kodu/konfiguracji PWA, `npm run typecheck`/`lint`/`test`/`build`, oraz realny test w przeglądarce na zbudowanej paczce (`vite preview` + service worker) — rejestracja SW, zawartość cache, manifest, `navigator.storage`, dodanie notatki i przetrwanie reloadu, sprawdzenie realnych wymiarów ikon. Poniżej wyłącznie znaleziska — nic z tej listy nie zostało jeszcze wdrożone.

### P0 — naprawić przed dalszą pracą (realne bugi, zweryfikowane) — ✅ wszystkie zrobione 2026-09-25

- [x] **`npm run typecheck` był czerwony (2 błędy) — naprawione.** `src/vite-env.d.ts` dostał augmentację `interface NotificationOptions { renotify?: boolean }` (lib.dom.d.ts bundlowany z TS 5.8.3 nie zna tej realnej właściwości Notifications API); `notesStore.test.ts` — fixture `makeNote()` dostał brakujące pole `priority: "none"`. `npm run typecheck`/`lint`/`test` zielone (171/171).
- [x] **„Wyczyść dane lokalne i odśwież” w `ErrorBoundary.tsx` teraz realnie czyści bazę.** Dodane `indexedDB.deleteDatabase("kaczy-yjs-v1")` (Yjs) i `indexedDB.deleteDatabase("keyval-store")` (domyślna baza idb-keyval, tam żyją obrazy) obok istniejącego czyszczenia `localStorage`, więc przycisk teraz robi dokładnie to, co obiecuje komunikat potwierdzenia.
- [x] **`public/pwa-512.png` przeskalowany do realnych 512×512 px** (był 816×816) — przy okazji plik spadł z 568 KB do 226 KB. `pwa-192.png` już był poprawny.

### P1 — dopracowanie pod „używam tego codziennie” — ✅ zrobione 2026-09-25 (poza ikonami)

- [x] **`navigator.storage.persist()` dodane** — `src/lib/storagePersistence.ts`, wywoływane przy starcie appki (`main.tsx`) i jako widoczny status + przycisk „Poproś przeglądarkę o trwały storage” w Ustawienia → Dane (`BackupSettings.tsx`, pokazuje też zajęte miejsce/limit).
- [x] **Mylący komentarz o przypomnieniach w tle poprawiony**, plus uczciwa notka w UI. `useReminderNotifications.ts` ma teraz dokładny opis dlaczego `setInterval` nie działa przy zamkniętej karcie; `ReminderPicker.tsx` pokazuje użytkownikowi krótkie ostrzeżenie o tym ograniczeniu przy ustawianiu przypomnienia. (Prawdziwe powiadomienia w tle przez Web Push zostają jako osobny, większy projekt — wymaga serwera push.)
- [x] **`<html lang="pl">`** — poprawione w `index.html`.
- [x] **`shortcuts` i `share_target` dodane do `manifest.webmanifest`.** Skrót „Nowa notatka” (`/?new=1`) i Web Share Target (`?share-title=/-text=/-url=`) — obsłużone w `Index.tsx` (otwiera composer albo od razu tworzy notatkę z udostępnionej treści, czyści URL przez `history.replaceState`). Przetestowane ręcznie na zbudowanej paczce: oba działają, bez duplikatów przy zwykłym reloadzie.
- [x] **Code-splitting trzech najcięższych, rzadko klikanych ekranów.** `exportToPDF`/jsPDF wydzielone do `src/lib/exportPdf.ts`, ładowane przez dynamic `import()` w `AppHeader.tsx`; `StatsDialog` (recharts) i `SyncSettings` (qrcode.react) na `React.lazy()` + `Suspense`. Efekt: główny eagerly-loaded chunk spadł z **1,27 MB → 879 KB (371 KB → 261 KB gzip)**, precache z 3203 KiB → 2871 KiB — bez utraty żadnej funkcji, każda dogrywa się (i trafia do cache offline) przy pierwszym użyciu.
- [x] **`useFilteredNotes` zmemoizowany** (`useMemo`, klucz: notes/archivedNotes/trashedNotes/folders/view/activeLabel/activeFolder/search/prefs) — filtr/sort/indeks Fuse.js nie przelicza się już na każdy niezwiązany render. Testy (`useFilteredNotes.test.ts`) przepisane na `renderHook`, bo funkcja stała się prawdziwym hookiem.
- [x] **Ikony PWA („any”) — białe tło usunięte, zrobione (2026-09-25, kolejna sesja).** Wcześniej odłożone jako "wymaga ręcznej edycji w Figmie" — ostatecznie zrobione bezpiecznie automatycznie: flood-fill od czterech rogów (BFS, próg "biało-podobne" na R/G/B/A) zamienia zewnętrzne białe tło na przezroczyste, zatrzymując się na pomarańczowej obwódce ikony — nie dotyka białej "kartki" wewnątrz ikony, bo jest odgrodzona od rogów kolorem obwódki (brak połączonej ścieżki). Zweryfikowane wizualnie na fioletowym/białym tle testowym — czyste krawędzie, zero artefaktów. `pwa-192.png`/`pwa-512.png` (purpose "any") mają teraz przezroczyste tło; oryginalna, nieprzezroczysta wersja 512px zachowana jako osobny `pwa-512-maskable.png` (purpose "maskable" — adaptive icons na Androidzie oczekują pełnego tła, nie przezroczystości). Manifest i `vite.config.ts` (`includeAssets`) zaktualizowane. Regresja pokryta przez `e2e/pwa.spec.ts` (sprawdza każdą ikonę z manifestu pod kątem zgodności zadeklarowanego i faktycznego rozmiaru — złapałoby też ewentualny przyszły rozjazd wymiarów).

### P2 — do rozważenia (rozbudowa / mniejszy priorytet)

- [x] **Backup do jednego, nadpisywanego pliku — zrobione (2026-09-25, kolejna sesja).** Nowy `src/lib/backupFileHandle.ts` (File System Access API, desktop Chrome/Edge — feature-detected, TS nie zna jeszcze `showSaveFilePicker`/`queryPermission`/`requestPermission`, więc dodana lokalna augmentacja typów). Nowa sekcja „Miejsce zapisu backupu” w Ustawienia → Dane: „Wybierz jeden plik do nadpisywania” zapamiętuje uchwyt pliku w IndexedDB (idb-keyval), każdy kolejny backup (auto-backup, przypomnienie, ręczny „Pobierz pełny backup teraz”) go nadpisuje zamiast pobierać nowy plik — z cichym fallbackiem do zwykłego pobrania, gdy przeglądarka nie wspiera API albo cofnęła uprawnienie do zapisu. Przy okazji: auto-backup i przypomnienie przełączone z `exportToJSON` (same notatki) na `exportFullBackup` (notatki + etykiety + foldery) — ujednolicone z ręcznym „Pobierz pełny backup teraz”, które już tego używało.
- [x] **E2E naprawione i rozszerzone o scenariusze PWA — zrobione (2026-09-25, kolejna sesja).** Odkryto po drodze coś poważniejszego niż brak scenariuszy: **cały pakiet E2E był niedziałający** — `playwright.config.ts` importował pakiet `lovable-agent-playwright-config`, którego nie ma ani w `node_modules`, ani w `package.json` (błąd `Cannot find package`), a w `package.json` nie było w ogóle skryptu do uruchamiania e2e — nikt (żadna sesja, żadne CI) nie mógł tego odpalić. Naprawione: `playwright.config.ts` przepisany na samodzielną konfigurację (buduje i odpala `vite preview`, `workers: 1` — równoległe workery przeciw jednej instancji preview okazały się fizyczne niestabilne), usunięty martwy `playwright-fixture.ts` (odwoływał się do tego samego brakującego pakietu, nieużywany przez żaden spec), dodany skrypt `npm run test:e2e`, dopisany krok w `.github/workflows/ci.yml`. Przy tej okazji odkryto, że same testy w `e2e/notes.spec.ts` też były nieaktualne względem UI (selektor zakładał niezwinięty pasek dodawania notatki i brak onboardingu, `page.getByDisplayValue` nie istnieje w Playwright, usuwanie notatki nie pokazuje już dialogu z przyciskiem „Usuń/Potwierdź” tylko „Przenieś do kosza”) — przepisane i zielone. Nowy `e2e/pwa.spec.ts` (3 testy): service worker dochodzi do stanu `activated`; `manifest.webmanifest` ma poprawny kształt **i każda zadeklarowana ikona faktycznie ma deklarowany rozmiar** (regresja na dokładnie ten bug z pwa-512.png sprzed paru godzin); realny offline reload przez `context.setOffline(true)` (prawdziwe cięcie sieci na poziomie CDP, nie mock) — dodanie notatki, przejście offline, reload, i sprawdzenie że powłoka appki ORAZ notatka nadal są widoczne. Wszystkie 6 testów (3+3) zielone, powtórzone dwukrotnie bez flakingu.
- [x] **Martwe znaczniki OG/Twitter po szablonie Lovable** — naprawione w `index.html`: `og:image`/`twitter:image` wskazują teraz na własną ikonę appki (`/pwa-512.png`) zamiast `lovable.dev`, usunięty `twitter:site: @Lovable`.

### Priorytetyzacja

1. ~~**Najpierw:** P0 (3 punkty)~~ — ✅ zrobione.
2. ~~**Potem:** `storage.persist()` i uczciwe udokumentowanie/naprawa przypomnień w tle~~ — ✅ zrobione.
3. ~~**Przy najbliższej okazji:** `lang="pl"`, `shortcuts`/`share_target`, code-splitting ciężkich ekranów, ikony bez białego tła~~ — ✅ zrobione.
4. ~~**P2:** backup do jednego pliku, rozszerzenie E2E, porządki OG/Twitter~~ — ✅ zrobione (2026-09-25).

**Cały audyt „gotowość do codziennego użytku + PWA offline” — zamknięty.** Wszystkie znaleziska (P0/P1/P2) zaadresowane; `typecheck`/`lint`/171 testów jednostkowych/6 testów e2e/`build` zielone.

## Ostatnie szlify — 2026-09-25 (kolejna sesja)

Krótki przegląd niezwiązany z audytem PWA — martwy kod i dokumentacja, które się nazbierały.

- [x] **Usunięte martwe zależności (zweryfikowane grepem, zero użyć w kodzie):** `@tanstack/react-query` (pusty `QueryClientProvider` w `App.tsx`, appka nie ma backendu więc nigdy nie będzie potrzebny), `@radix-ui/react-scroll-area`/`react-separator`/`react-toggle` (pliki `ui/` istniały, nic ich nie importowało — ocalały przy czyszczeniu 24 komponentów w sesji 2026-09-24). `npm install` po zmianie `package.json` usunął 7 pakietów z `node_modules`/lockfile.
- [x] **Zunifikowane toasty na Sonner + naprawiony bug z motywem.** Sonner był już używany wszędzie poza jednym miejscem (`InstallAppButton.tsx`, przez `@/hooks/use-toast` — radix-owy system toastów). Przy okazji odkryty realny bug: `ui/sonner.tsx` czytał motyw z `next-themes`, ale appka **nie ma** providera `next-themes` (własny `useTheme` w `hooks/useTheme.ts`) — sonner zawsze dostawał `theme="system"`, ignorując ręczny wybór Jasny/Ciemny w Ustawieniach (toasty miały wtedy zły motyw względem reszty UI). Naprawione: `ui/sonner.tsx` czyta teraz `dark` z własnego `useTheme()`. Usunięte: `src/hooks/use-toast.ts`, `src/components/ui/{toast,toaster,use-toast}.tsx/ts`, zależności `@radix-ui/react-toast` i `next-themes`.
- [x] **README zaktualizowany — wcześniej aktywnie wprowadzał w błąd.** Twierdził, że synchronizacja działa „tylko między kartami tej samej przeglądarki (`BroadcastChannel`), nie między urządzeniami” i wymieniał „tryb offline z kolejką zmian” — oba mechanizmy (`noteSync.ts`, `offlineQueue.ts`) zostały usunięte w audycie architektonicznym 2026-09-25 na rzecz pełnego P2P sync (Yjs + WebRTC, z obrazami). Zaktualizowane też: lista funkcji (share target, skrót „Nowa notatka”, backup do jednego pliku, przypomnienia cykliczne — brakowało ich), lista skryptów npm (brakowało `typecheck`, `test:e2e`).
- [x] **Manifest: dodane `id`, `categories`, `screenshots`.** `id: "/"` (stabilna tożsamość PWA niezależna od przyszłych zmian `start_url`), `categories: ["productivity", "utilities"]`. `screenshots` — jeden prawdziwy zrzut ekranu (`public/screenshot-wide.png`, 1241×698, `form_factor: "wide"`) z realnie działającej appki (nie placeholder) dla bogatszego okna instalacji na Androidzie/desktopie; świadomie bez wariantu „narrow” (mobile) — `resize_window` w tym środowisku automatyzacji przeglądarki nie zmienia faktycznego viewportu renderowania (potwierdzone też wcześniej w sesji audytu), więc nie dało się uczciwie złapać zrzutu w układzie mobilnym zamiast fałszować go z przyciętego widoku desktopowego. Zrzut wykluczony z precache service workera (`globIgnores` w `vite.config.ts`) — to plik dla natywnego UI instalacji przeglądarki, appka sama go nigdy nie renderuje, więc nie ma sensu w offline-krytycznym precache.

Zweryfikowane: `typecheck`/`lint` (0 błędów, 8 ostrzeżeń — spadek z 10, zniknęło ostrzeżenie z usuniętego `use-toast.ts`)/171 testów jednostkowych/6 testów e2e/`build` (główny chunk dodatkowo spadł do 838 KB / 247,64 KB gzip, precache 2963,66 KiB) — wszystko zielone.

## Dalszy code-splitting — 2026-09-25 (kolejna sesja, w toku)

- [x] **`y-webrtc` (transport P2P) wydzielony z eagerly-loaded bundla — największy pojedynczy zysk tej rundy.** `yjsSync.ts`/`imageSync.ts` importowały `WebrtcProvider` statycznie, a `NotesProvider.tsx` (mount w App root) importuje `yjsSync.ts` bezwarunkowo — więc `y-webrtc` (~112 KB / 34,5 KB gzip) ładował się **dla każdego użytkownika**, mimo że sync jest opt-in i domyślnie wyłączony. Przepisane na `import type` + dynamiczny `import("y-webrtc")` wewnątrz `connect()`/`startImageSync()`, z tokenem generacji (`connectToken`/`startToken`) chroniącym przed wyścigiem, gdyby `disconnectProvider()`/`stopImageSync()` przyszło zanim dynamiczny import się rozwiąże. Testy (`yjsSync.test.ts`, `imageSync.test.ts`) zaktualizowane na `vi.waitFor(...)` zamiast synchronicznych asercji zaraz po wywołaniu — mock `y-webrtc` nadal działa przy dynamicznym imporcie, tylko dochodzi jeden realny tick Promise.
- [x] **CommandPalette, NotePresentation, FocusMode na `React.lazy()`+`Suspense`** (ten sam wzorzec co StatsDialog/SyncSettings/PDF z poprzedniej sesji). Przy okazji naprawiony realny problem architektoniczny: `CommandPalette.tsx` samo rejestrowało globalny listener na Ctrl/Cmd+K — gdyby zostało tylko owinięte w `{paletteOpen && <Suspense>...}`, skrót nigdy by nie zadziałał (komponent, który go nasłuchuje, nie byłby jeszcze zamontowany — problem jajka i kury). Listener przeniesiony do `useGlobalShortcuts.ts` (spójnie z resztą globalnych skrótów), `CommandPalette` woła teraz `onTogglePalette()` przekazane z `Index.tsx`. Zweryfikowane ręcznie na żywo (zbudowana paczka) — Ctrl+K nadal otwiera paletę.

Efekt łączny: główny chunk **838 KB → 702 KB (247,64 KB → 206,32 KB gzip)**. `y-webrtc` (112 KB), `CommandPalette` (17 KB), `SyncSettings` (21 KB), `NotePresentation` (4,4 KB), `FocusMode` (3,9 KB) — osobne, leniwie ładowane chunki. `typecheck`/`lint`/171 testów/6 testów e2e (dwukrotnie — jeden przejściowy fail na znanej, już udokumentowanej niestabilności testu aktywacji SW przy pierwszym reloadzie, nie związany z tą zmianą)/`build` zielone.

**Zostało do zrobienia w tym wątku (świadomie odłożone, niższy priorytet — diminishing returns):** `DrawingCanvas` sprawdzony i pominięty (montowany raz na kartę notatki w gridzie, nie ciągnie żadnej ciężkiej biblioteki — lazy-loading dodałby złożoność za małą realną oszczędność). Główny chunk nadal >500 KB (próg ostrzeżenia Vite) — to już głównie kod właściwy appki (Yjs core, Fuse.js, date-fns, dnd-kit już osobno) plus `index.es-*.js` (150 KB, pochodzenie niezweryfikowane w tej sesji, prawdopodobnie wspólny chunk wygenerowany przez Rollup dla nakładających się zależności).

## Code-splitting: domknięcie wątku — 2026-09-27

Kontynuacja poprzedniej sesji. Wzięty na cel ostatni otwarty punkt („`index.es-*.js` — 150 KB, pochodzenie niezweryfikowane") i przy tej okazji znaleziony **realny bug, który częściowo unieważniał całe wcześniejsze code-splitting jsPDF**.

- [x] **`index.es-*.js` zidentyfikowany — to `canvg`**, opcjonalna zależność jsPDF (renderowanie SVG w PDF). Ładowana przez `import()` *wewnątrz samego jsPDF*, więc już była leniwa — obok `html2canvas.esm-*.js` (201 KB) i `purify.es-*.js` (29 KB), tej samej rodziny. Nic do zrobienia, punkt zamknięty jako „nie jest problemem".
- [x] **Naprawiony eager-load 391 KB jsPDF — najważniejsze znalezisko tej sesji.** Mimo że `exportPdf.ts` jest ładowany przez dynamiczny `import()`, `vendor-pdf` (391 KB, cały jsPDF) figurował w `<link rel="modulepreload">` w zbudowanym `index.html`, a główny chunk importował go **statycznie**. Przyczyna: wpis `"vendor-pdf": ["jspdf"]` w `manualChunks` wymuszał osobny chunk, do którego Rollup wrzucił też współdzielony, ~1 KB helper `__vitePreload` (Vite generuje go dla każdego dynamicznego `import()`). Główny chunk potrzebował helpera → dostał statyczną krawędź do `vendor-pdf` → przeglądarka pobierała i wykonywała cały jsPDF przy **każdym** wejściu na stronę, mimo że eksport PDF jest rzadko klikany. Zweryfikowane w zbudowanym artefakcie: `import{_ as mr}from"./vendor-pdf-*.js"` w głównym chunku, gdzie `_` to właśnie `__vitePreload`, i nic więcej. **Poprawka: usunięty wpis `"vendor-pdf"` z `manualChunks`** — jspdf jest osiągalny wyłącznie przez dynamiczny `import()`, więc Rollup sam izoluje go w chunku `exportPdf-*.js` (391,70 KB), a helper ląduje w głównym chunku i żadna statyczna krawędź nie powstaje. Efekt: **eager JS 1529 KB → 1137 KB (ok. 129 KB mniej gzip) na pierwszym wejściu**, bez utraty funkcji. Główny chunk bez zmian (703 KB) — zysk jest w tym, czego przeglądarka *dodatkowo* nie musi już ściągać i parsować.
- [x] **Nowy `e2e/bundle.spec.ts` (2 testy) — regresja na dokładnie ten kształt buga.** Test 1 przechodzi *statyczny* graf importów zbudowanej paczki (entry `<script type="module">` + wszystkie `modulepreload`, świadomie **nie** wchodząc w krawędzie `import()`) i sprawdza, że w tym eager-zbiorze nie ma jsPDF, html2canvas ani recharts — a jednocześnie, że jsPDF **jest** w którymś leniwym chunku (inaczej test przechodziłby też, gdyby eksport PDF po prostu wypadł z builda). Test 2 klika „Eksportuj jako PDF" w żywej appce i sprawdza, że dogrywa chunk i faktycznie zjeżdża plik `.pdf`. Sprawdzone, że test **realnie łapie bug**: po tymczasowym przywróceniu wpisu `"vendor-pdf"` test 1 pada z nazwą winnego chunku.
- [x] **Usunięte martwe wpisy `@tanstack/react-query`/`@tanstack/query-core` z `resolve.dedupe`** w `vite.config.ts` — obie zależności zniknęły z projektu w sesji 2026-09-25, wpisy zostały.

Zweryfikowane: `typecheck` (0 błędów) / `lint` (0 błędów, 8 ostrzeżeń — bez zmian) / 171 testów jednostkowych / **8 testów e2e** (6 poprzednich + 2 nowe, wszystkie zielone w jednym przebiegu, bez flakingu) / `build`.

**Wątek code-splittingu zamknięty.** Główny chunk (703 KB) to już kod właściwy appki plus jej rdzeniowe zależności (Yjs, Fuse.js, date-fns) — dalsze dzielenie to czysty diminishing returns.

## Plan rozbudowy — 2026-09-27

Roadmapa była w tym momencie cała odhaczona, więc ten plan powstał od zera: dwa równoległe audyty agentowe (architektura/kod oraz funkcje/UX), a potem **własna weryfikacja każdej najmocniejszej tezy bezpośrednio w kodzie**. Sprawdzono 14 twierdzeń — wszystkie się potwierdziły, z podanymi niżej lokalizacjami. Nic z tej sekcji nie jest jeszcze wdrożone.

### P0 — zweryfikowane błędy i martwy kod (to nie są propozycje, to znaleziska)

- [x] **`applyTextDiff` kasuje tekst peera — field-level merge z Fazy 1 jest obchodzony przez UI.** `src/lib/yjsStore.ts:41` liczy diff prefix/suffix względem `ytext.toString()` (aktualnego stanu CRDT), a `NoteCard.tsx` podaje mu całą treść ze snapshotu zrobionego w `useState` w momencie kliknięcia karty. Gdy w trakcie edycji peer dopisał zdanie, skan wspólnego sufiksu je mija i `ytext.delete()` je usuwa. Efekt: cała inwestycja w merge na poziomie pola działa tylko dla edycji rozłącznych **w czasie** — a nie dla współbieżnych, czyli dokładnie tych, dla których ją budowano. — ✅ 2026-09-27: nowy `src/lib/yTextEdit.ts`. Przy otwarciu edytora `beginTextEdit` zapamiętuje treść **i tożsamości znaków Yjs** (`client`/`clock`), które widzi użytkownik; zapis liczy diff od tej bazy i nakłada go po tożsamościach — kasuje tylko znaki, które użytkownik widział i usunął, wstawia obok znaku, za którym pisał. Wstawki peera (także w środku lokalnie usuwanego zakresu) zostają; kolejne autosave'y w sesji nie dublują tekstu, bo baza przechodzi w linię lokalną. `applyTextDiff` zostaje tylko dla zapisów bez sesji (import, szablony). 6 testów modułu + test regresji w `yjsStore.test.ts`. Ograniczenie: w trakcie edycji pole nie pokazuje na żywo tekstu peera — pojawia się po zapisie (edytor na żywo na `Y.Text` z pozycją karetki to dalej pozycja „Edytor na `Y.Text`” niżej, teraz już jako ulepszenie UX, nie naprawa utraty danych). `RecentActionsPanel` ma własny mini-edytor bez sesji.
- [x] **Brak jakiegokolwiek autosave — edycje giną, a ustawienie kłamie.** `NoteCard.tsx` zapisuje wyłącznie przez `handleSave()` pod przyciskiem „Zapisz": brak `onBlur`, brak zapisu przy unmount. Ścieżka utraty: otwórz kafel, dopisz akapit, wpisz cokolwiek w wyszukiwanie → kafel wypada z filtra, odmontowuje się, akapit przepada bez słowa. Równocześnie `prefs.autosaveSeconds` (suwak „Autosave co Xs" w Ustawienia → Ogólne, z opisem „Edycja będzie zapisywana automatycznie po przerwie w pisaniu") **nie jest czytany w żadnym miejscu logiki** — grep daje tylko `viewPrefs.ts` (typ + domyślne `0`), `GeneralSettings.tsx` (sam suwak) i fixture testowy. Suwak nie robi nic niezależnie od ustawionej wartości. — ✅ zrobione wcześniej (`ddf513c`): `useDraftAutosave` + zapis przy odmontowaniu, suwak działa.
- [x] **Nawigacja klawiaturą po siatce wykonuje każdą akcję dwa razy, gdy cokolwiek jest przypięte.** `Index.tsx:370` i `Index.tsx:385` renderują **dwa** `NoteGrid` („Przypięte" i „Inne"), a `NoteGrid.tsx:168` rejestruje `window.addEventListener("keydown", …)` z własnym, lokalnym `focusedIdx`. Każda instancja reaguje na ten sam klawisz, a `NoteGrid.tsx:111` (`const cur = focusedIdx < 0 ? 0 : focusedIdx`) sprawia, że obie startują od indeksu 0. Strzałka podświetla dwie notatki, Enter otwiera dwa edytory, `Delete` wyrzuca do kosza **dwie** notatki. Funkcja jest udokumentowana w `ShortcutsDialog`. — ✅ zrobione wcześniej (`ddf513c`): jeden właściciel nawigacji.
- [x] **`prefs.showBacklinks` to drugie martwe ustawienie.** Przełącznik „Pokaż backlinki" w `AppearanceSettings.tsx:193` — grep pokazuje wyłącznie ten przełącznik, typ i domyślną wartość w `viewPrefs.ts:31/55` oraz fixture testowy. Backlinki są renderowane tylko w `NotePresentation.tsx` i nie pytają o tę preferencję. — ✅ 2026-09-27: `NotePresentation` respektuje przełącznik (backlinki w karcie — dalej w planie wikilinków).
- [x] **Command Palette nie otwiera notatek.** `Index.tsx:420`: `onOpenNote={() => { setView("notes"); }}` — parametr `id` jest ignorowany, wybór notatki z palety tylko przełącza widok. — ✅ 2026-09-27: nowe `openNote(id)` w `Index.tsx` — przełącza na Notatki/Archiwum/Kosz, zdejmuje filtry, przewija i podświetla kartę. Wikilinki używają tego samego.
- [x] **Command Palette widzi tylko 30 najnowszych notatek.** `CommandPalette.tsx:108` robi `notes.slice(0, 30).map(...)`, a `cmdk` filtruje po tym, co wyrenderowane — przy 200 notatkach 170 jest dla palety nieosiągalnych i nic tego nie komunikuje. Poprawka: filtrować przez `searchNotes` i **potem** ciąć, z podpisem „pokazano 30 z N trafień". — ✅ 2026-09-27: filtr przez `searchNotes`, potem cięcie, nagłówek „pokazano 30 z N”.
- [x] **Treść checklist jest niewyszukiwalna.** `searchNotes.ts:47` indeksuje w Fuse tylko `title`/`content`/`labels`. Zadanie zapisane jako pozycja checklisty nie da się znaleźć — mimo że `NoteGrid` już podświetla pozycje checklisty w szybkim podglądzie, więc UI jest gotowe. — ✅ 2026-09-27: `checklist.text` w kluczach Fuse (+test).
- [x] **Wersje notatek można bezpowrotnie stracić i nie ma ich w backupie.** `useNoteVersions.ts:24` (`saveVersions`) serializuje **całą tablicę wszystkich wersji wszystkich notatek** do `localStorage` przy każdej zmianie, **bez `try/catch`** — `QuotaExceededError` leci z `useEffect` prosto do `ErrorBoundary`. `versions` nie występuje ani w `exportNotes.ts`, ani w `noteSchema.ts`, więc „pełny backup" ich nie zawiera. A `deleteVersions` nie jest wołane z żadnego miejsca produkcyjnego kodu (grep: tylko własny test), więc wersje usuniętych notatek zostają na zawsze. Do tego przycisk „Wyczyść dane lokalne" w `ErrorBoundary.tsx` czyści `localStorage` — czyli funkcja reklamowana jako historia wersji ginie przy pierwszym problemie i nie ma jej z czego odzyskać. — ✅ częściowo 2026-09-27: zapis bez rzucania (przy braku miejsca zrzuca najstarsze wersje + toast, 2 testy), `deleteVersions` przy trwałym usunięciu i opróżnianiu kosza. Zostaje: auto-czyszczenie kosza po 30 dniach nie zdejmuje wersji; przeniesienie do IndexedDB i wersje w backupie (pozycja „Wersje notatek z `localStorage` do `idb-keyval`”).
- [x] **Nowa notatka ignoruje kontekst — foldery są przez to nieużywalne w praktyce.** `useNotes.ts:116` ustawia `folderId: null` na sztywno, a `addNote` (`useNotes.ts:114`) nie przyjmuje `folderId` w ogóle. Notatka utworzona w folderze „Praca" ląduje w korzeniu; każda wymaga drugiego ruchu (przeciągnięcia). — ✅ 2026-09-27: `addNote` przyjmuje `folderId`; notatka z paska/szablonu w folderze trafia do folderu, w widoku etykiety dostaje etykietę.
- [x] **`_imgSyncTick` zaśmieca synchronizowany dokument.** `yjsStore.ts:346`: `doc.transact(() => { y.set("_imgSyncTick", Date.now()); })` — pole istnieje wyłącznie po to, żeby „szturchnąć" lokalny `observeDeep` i przerenderować React, ale jest częścią `Y.Doc`, więc leci po WebRTC do wszystkich peerów i rośnie w historii dokumentu przy każdym dogranym obrazku. Wyciek warstwy transportowej do modelu domenowego. — ✅ 2026-09-27: `setImagesLocal` nie pisze już do `Y.Doc`; UI dostaje sygnał przez lokalne `yjsStore.onLocalChange`, subskrybowane w `useNotes`. Test: zero aktualizacji dokumentu. Stare wpisy `_imgSyncTick` w istniejących dokumentach zostają (projekcja je ignoruje; kasowanie byłoby kolejnym zapisem synchronizowanym).
- [x] **`persistImagesCache` przepisuje cały store obrazów przy każdej zmianie jednego.** `yjsStore.ts:221`: `idbSet(IMAGES_KEY, imagesCache)` — cały słownik obrazów wszystkich notatek, przy każdym dodaniu obrazka i każdym `setImagesLocal()` z `imageSync.ts`. Przy limicie 2 MB na obraz i kilkudziesięciu zdjęciach to dziesiątki MB structured-clone na jedno kliknięcie. Do tego base64 (+33% narzutu) zamiast `Blob`. — ✅ 2026-09-27 (część P0): obrazy każdej notatki pod własnym kluczem `kaczy.images.v2:<id>`, zapis tylko notatek oznaczonych jako zmienione, kolejne zapisy szeregowane. Migracja ze starego `kaczy.images.v1` przy starcie; stary klucz kasowany dopiero po udanym zapisie nowych. 2 testy. **Zostaje** base64 zamiast `Blob` i adresowanie treścią — pozycja „Content-addressed store obrazów” (L).
- [x] **Systemowy prompt o powiadomienia wyskakuje na mount, przed jakąkolwiek intencją użytkownika.** `useReminderNotifications.ts:27-29` woła `Notification.requestPermission()` w `useEffect` przy starcie. To najpewniejszy sposób na trwałe „Zablokuj" — po którym appka nigdzie o tym nie informuje. Prośba powinna wyjść przy ustawianiu pierwszego przypomnienia, a stan „zablokowane" być widoczny w Ustawieniach. — ✅ 2026-09-27: `lib/notificationPermission.ts` — prośba przy zapisie przypomnienia (picker, pasek dodawania, kalendarz); stan (włączone/zablokowane/nieobsługiwane) w Ustawienia → Ogólne.
- [x] **Leftover „Dash Notes" po szablonie.** `useReminderNotifications.ts:60` — fallbackowy tytuł powiadomienia to `"Dash Notes — Przypomnienie"`, a klucz `localStorage` to `dash-notes-fired-reminders` (`:6`). (`ErrorBoundary.tsx:36` czyści oba prefiksy, więc tam jest w porządku — do zmiany są tylko te dwa miejsca, ostrożnie, bo zmiana klucza zgubi stan „już wystrzelone".) — ✅ 2026-09-27: tytuł „Notatnik — Przypomnienie”; klucz `localStorage` celowo bez zmian.
- [x] **Domyślnie włączony nudge co 6 godzin.** `viewPrefs.ts:50`: `todayReminderHours: 6` — świeża instalacja sama z siebie pokazuje toast „Masz N notatek z dzisiaj" co 6 h, o treści bez wartości informacyjnej. Domyślnie powinno być `0` (wyłączone). — ✅ 2026-09-27: domyślnie `0`.

### Kierunki rozbudowy — architektura

- [x] **Edytor na `Y.Text` zamiast bufora w `useState`** — nowy `src/hooks/useNoteText.ts` (do whitelisty `no-restricted-imports` w `eslint.config.js`), subskrypcja `ytext.observe`, lokalne zmiany debounce'owane przez istniejące `applyTextDiff`, zdalne wlewane z zachowaniem karetki przez `Y.createRelativePositionFromTypeIndex`. Rozwiązuje P0 #1 u źródła; `Y.UndoManager` scope'owany na `notesMap` daje przy okazji realne Ctrl+Z w edytorze (dziś `actionHistory.ts` cofa tylko trash/archive). Nakład **M**. Uwaga: `applyPatch` ustawia `updatedAt: Date.now()` przy każdym patchu, więc autosave co 300 ms przy `sortKey: "updated"` będzie przestawiał kolejność kart w trakcie pisania (nie dotykać `updatedAt` dla samego diffu treści albo throttle do ~10 s). — ✅ 2026-09-28 (bez Undo): zamiast przepisywać edytor na `ytext.observe` z `RelativePosition` rozbudowano działającą sesję z tożsamościami znaków (`yTextEdit.ts`). Nowe `yjsStore.onRemoteTextChange` (tylko `!transaction.local`, więc WebRTC i „Scal z pliku”) + `rebaseTextEdit`: niezapisany szkic jest scalany przez `applyTextEdit` **bez** dotykania `updatedAt` (karty się nie przestawiają), a zaznaczenie przenoszone po tożsamościach znaków (`mapOffset` — karetka zostaje za tym samym znakiem, a gdy peer go skasował, cofa się do najbliższego ocalałego). Hook `src/hooks/useLiveNoteText.ts` (bez importu Yjs, więc bez zmian w whiteliście ESLint) podpięty w `NoteCard`, działa w kaflu i w pełnym ekranie. 4 testy store'a + e2e `live-text.spec.ts` (dwa konteksty, zmiana „zdalna” przez plik synchronizacji w trakcie pisania). **Nie zrobione:** `Y.UndoManager` — natywne Ctrl+Z pola tekstowego nadal działa przy zwykłym pisaniu, ale przeglądarka czyści jego historię, gdy wlewa się tekst peera; do osobnej decyzji, bo przechwycenie Ctrl+Z zmienia zachowanie, do którego użytkownik jest przyzwyczajony. Na żywo tylko treść — tytuł i checklista nadal po zapisie.
- [x] **Sync „sneakernet" — merge przez plik, bez wymogu jednoczesnego online.** Najmocniejszy ruch możliwy **bez serwera**: `Y.encodeStateAsUpdateV2` → plik → `Y.applyUpdateV2` na drugim urządzeniu to merge, nie nadpisanie. Dziś jedyna droga przeniesienia danych (`importFullBackup` → `yjsStore.replaceAll`) jest **destrukcyjna**, więc nie da się nią pogodzić dwóch urządzeń, które nigdy nie były online razem — a `SyncSettings.tsx` uczciwie pisze, że P2P tego wymaga. Nowy `src/lib/yjsFileSync.ts` + „Scal z pliku" obok destrukcyjnego „Przywróć z backupu". Nakład **S–M**, w 100% testowalne automatycznie. Ryzyko do udokumentowania: bardzo stary plik może wskrzesić notatkę usuniętą po GC tombstone'a. — ✅ 2026-09-28: `yjsStore.encodeSyncState`/`mergeSyncState` (`Y.applyUpdateV2`, obrazy dopasowywane po hashach z manifestu) + `src/lib/yjsFileSync.ts` (format `kaczy-sync` v1: update V2 w base64 + lokalne obrazy, walidacja, odrzuca pełny backup i pliki z nowszej wersji, błąd scalenia do diagnostyki). Ustawienia → Dane → „Synchronizacja przez plik”: „Zapisz plik synchronizacji” / „Scal z pliku”, z ostrzeżeniem o starych plikach. 7 testów jednostkowych (dwa urządzenia offline, idempotencja, brak wskrzeszenia po usunięciu po eksporcie, obrazy, uszkodzony plik) + e2e na dwóch kontekstach przeglądarki. Znalezione przy okazji: e2e `reminders-calendar.spec.ts:171` („seria pokazuje prognozy…”) pada deterministycznie także na czystym `master` (timeout na kliknięciu, 2026-09-28) — prawdopodobnie zależność od daty, do zbadania osobno.
- [x] **Inkrementalna projekcja Yjs → React.** `useNotes.ts:81` (`project()`) przy **każdym** zdarzeniu `observeDeep` przelicza wszystkie notatki, foldery i etykiety → wszystkie obiekty `Note` dostają nowe identyczności → `memo(NoteCard)` nie ma czego porównywać, cała siatka się renderuje, a `useFilteredNotes` (choć zmemoizowany) pudłuje i Fuse buduje indeks od nowa. Dziś nie boli, bo zapis jest rzadki — **zaboli natychmiast po wdrożeniu autosave**, więc to zależność kolejności, nie osobny kaprys. Rozwiązanie: `notesCache: Map<string, Note>` + `subscribe(changedIds)` czytające `event.path`/`event.changes.keys`, stabilne referencje dla nietkniętych notatek, `useNotes` na `useSyncExternalStore` (wzorzec już jest w `actionHistory.ts` i `yjsSync.ts`). Przy okazji ginie `_imgSyncTick` (P0 #10). Nakład **M**. **Wirtualizacji siatki świadomie nie**: masonry `columns-*` + dnd-kit + `framer-motion layout` + nawigacja po `data-note-idx` — cztery mechanizmy zakładające pełny DOM, koszt nieproporcjonalny do realnej skali. — ✅ 2026-09-28: `yjsStore.projectNotes` jest inkrementalny — obserwator zarejestrowany przy tworzeniu store'a zbiera brudne id z `event.changes.keys`/`event.path[0]` (także zmiany zdalne i zagnieżdżone: treść, checklisty), nietknięte notatki zachowują tożsamość obiektu, notatka odświeża się też przy zmianie samych lokalnych obrazów (wspólne `NO_IMAGES` dla pustych). `useNotes`: osobny obserwator na mapę (notatki/foldery/etykiety), tablica notatek zmienia tożsamość tylko przy realnej zmianie, `useMemo` na aktywne/archiwum/kosz i na zwracany obiekt. Żeby `memo(NoteCard)` faktycznie działało: `NoteCard` czyta nowy `useNotesMeta()` (foldery, etykiety, `addLabel`) zamiast całego kontekstu z listą notatek, `NoteGrid` memoizuje wartość `NoteViewActions`, `Index` memoizuje `knownTitles`. Świadomie bez `useSyncExternalStore` — przy stabilnych referencjach nic by nie dodał. 5 nowych testów (store i hook). `_imgSyncTick` zniknął już wcześniej. Nie mierzone profilerem na dużej bazie.
- [x] **Content-addressed store obrazów** — nowy `src/lib/imageStore.ts`: własny store `idb-keyval`, klucz = hash treści, wartość = `Blob`; `Note.images` w projekcji staje się listą hashy, render przez `useImageUrl(hash)` z `URL.createObjectURL` + revoke. Rozwiązuje P0 #11. Manifest `imageHashes` jest już gotowy (dobra decyzja z sesji 2026-09-25). Przy okazji: `imageHash.ts` próbkuje co 7. znak i daje 64 bity — OK dla manifestu, ale jako klucz store'a kolizja = trwale zły obrazek; `imageStore` jest async, więc można tam użyć `crypto.subtle.digest("SHA-256")` (powód wyboru FNV — synchroniczność `yjsStore` — tam nie obowiązuje). Nakład **L**, najszerszy dotyk i **największe ryzyko utraty danych** w całym planie: osobna sesja, własna migracja, własne e2e, nigdy razem z inną zmianą schematu. — ✅ 2026-10-04: `src/lib/imageStore.ts` (własna baza `kaczy-images-v1`, klucz SHA-256, wartość `{bytes: ArrayBuffer, type, addedAt}` — `ArrayBuffer` zamiast `Blob`, bo Blob w IndexedDB bywał zawodny w Safari). Manifest `imageHashes` w Y.Doc jest teraz jedynym źródłem `Note.images` (zniknął lokalny `imagesCache`, więc usunięcie obrazu u peera wreszcie dociera); `yjsStore` odrzuca data URL-e z logiem. Render przez `useImageUrl` + `NoteImage` (współdzielone object URL-e z licznikiem, kafel „Obraz jeszcze nie dotarł na to urządzenie”, sam się podmienia, gdy bajty dotrą). Granice: upload i rysunek → store; import JSON i przywracanie backupu → `ingest` **przed** destrukcyjnym `replaceAll` (błąd zapisu przerywa); eksport JSON/backup → data URL-e w pliku; MD/HTML/PDF osadzają tylko obrazy obecne na urządzeniu. Plik sync v2: `blobs` (hash → data URL, każdy obraz raz), v1 dalej czytany (FNV → SHA po merge’u). P2P: pokój `-img2`, bajty binarnie, hash weryfikowany przed zapisem. Migracja przy starcie: `kaczy.images.v1`/`v2:*` → store, manifesty FNV → SHA (bez ruszania `updatedAt`), nieznane FNV zostają, stare klucze kasowane dopiero po udanym zapisie wszystkich. GC 10 s po starcie: nieużywane i starsze niż 7 dni. `ErrorBoundary` czyści nową bazę. Testy: `imageStore.test.ts` (8), `yjsStore` (+5), `yjsFileSync` (+3), `imageSync` (przepisane, 4), `fullBackup` (+2), eksporty; e2e `images.spec.ts` (3: przeładowanie + plik sync na drugie urządzenie, pełny backup na czyste urządzenie, migracja ze starego klucza). **Ograniczenie:** urządzenie na starej wersji (przed aktualizacją SW) zapisuje manifesty FNV — nowe pokaże kafel zastępczy, dopóki tamto się nie zaktualizuje i nie zmigruje.
- [x] **Wersje notatek z `localStorage` do `idb-keyval`, klucz per notatka** + `versions` w `fullBackupSchema` v2 (z czytaniem v1) + wołanie `deleteVersions` przy usuwaniu notatki. Rozwiązuje P0 #8. Świadomie **nie** wkładać wersji do `Y.Doc` — trwale rozdęłoby dokument idący przez WebRTC (ten sam argument, który raz już prawidłowo podjęto dla obrazów). Nakład **S**. Uwaga: `NoteCard` woła `getVersions?.(note.id)` synchronicznie w ciele komponentu, więc trzeba to przestawić na lazy-load przy otwarciu menu. — ✅ 2026-09-28: `src/lib/versionsStore.ts` — klucz `kaczy.versions.<noteId>`, odczyt synchroniczny z pamięci (więc `NoteCard` bez zmian, zamiast lazy-load), zapisy w tle po kolei, błędy do diagnostyki; jednorazowa migracja z `kaczy-notes-versions` (stary klucz kasowany po zapisie). `useNoteVersions` na `useSyncExternalStore`. Usuwanie wersji dopięte też do automatycznego czyszczenia Kosza po 30 dniach (wcześniej zostawały). 6 testów.
- [x] **Diagnostyka bez serwera.** Audyt 2026-09-25 zamknął punkt „jeden kanał na błędy" wnioskiem, że rozproszonych `console.error` nie ma — to prawda, ale cena jest odwrotna: prawie wszystko jest **ciche** (`catch { /* ignore */ }` w `yjsStore.ts`, `persistedStore.ts`, `actionHistory.ts`, `yjsSync.ts`). Przy P2P bez logów serwerowych pytanie „dlaczego się nie zsynchronizowało" jest nierozstrzygalne: `yjsSync.ts` daje tylko `status` i `peerCount`, bez `lastSyncedAt` i bez ostatniego błędu. Nowy `src/lib/diagnostics.ts` (ring buffer 200 wpisów w pamięci) + „Pobierz raport diagnostyczny" (wersja builda, stan SW, `navigator.storage.estimate()`, liczniki, rozmiar `encodeStateVector`, status sync, ostatnie wpisy). Zero telemetrii, zero sieci. Nakład **S**. Raport nie może zawierać treści notatek ani kodu parowania — pokryć to testem. — ✅ 2026-09-27: `src/lib/diagnostics.ts` (bufor 200 wpisów w pamięci, `logDiag`, globalne `error`/`unhandledrejection`, czysta `buildDiagReport` z wycinaniem kodu parowania) + `diagnosticsReport.ts` (SW, `storage.estimate`, liczniki i wektor stanu przez `yjsStore.diagStats()` — Yjs zostaje za granicą `no-restricted-imports`). Build ID (`__APP_BUILD__` = commit + data) z `vite.config.ts`. Podpięte ciche `catch`: zapis obrazów, `persistedStore`, `actionHistory`, prefs sync. `SyncState` ma `lastSyncedAt` (zmiany z pokoju y-webrtc, throttle 5 s) i `lastError` (m.in. nieudany import `y-webrtc`, wcześniej bez `.catch`) — widoczne w Ustawienia → Sync. Przycisk w Ustawienia → Ogólne → Diagnostyka. Testy: bufor, `DOMException` (nie zawsze `instanceof Error` — naprawione w trakcie), prywatność raportu na prawdziwym `yjsStore` + e2e pobrania. Świadomie bez zapisu dziennika na dysk (restart go czyści).
- [x] **`roomNameFor` na SHA-256 + dłuższy kod parowania.** `yjsSync.ts` hashuje kod dwoma 32-bitowymi FNV (64 bity). Komentarz „not a security boundary" jest prawdziwy co do poufności, ale pomija drugi skutek: **kolizja nazwy pokoju** → `WebrtcProvider` nie odszyfruje ruchu → stan utyka w `"connecting"` na zawsze, bez komunikatu (patrz punkt o diagnostyce). Kod ma 8 znaków z alfabetu 31 ≈ 40 bitów, a skoro w praktyce skanuje się QR z `?pair=`, długość nic nie kosztuje → 12 znaków. `connect()`/`startImageSync()` są już async (dynamiczny import `y-webrtc`), więc `await crypto.subtle.digest` wchodzi bez przebudowy. **Okres przejściowy z dołączaniem do obu pokojów jest obowiązkowy**, inaczej urządzenia na różnych wersjach cicho przestaną się widzieć. — ✅ 2026-09-28: `roomNameV2For` (SHA-256 z `kaczy-room:<kod>`, 128 bitów w nazwie `kaczy2-…`), `roomNamesFor` zwraca nowy pokój i — dopóki `JOIN_LEGACY_ROOM = true` — stary FNV. `yjsSync` i `imageSync` trzymają po providerze na pokój na tym samym dokumencie; status „połączono”, gdy którykolwiek pokój jest połączony, liczba urządzeń to **maksimum** po pokojach (nowe urządzenia są w obu, stare tylko w starym — suma liczyłaby je podwójnie). Nowe kody mają 12 znaków (≈59 bitów), stare 8-znakowe działają dalej. Kod w Ustawieniach wyświetlany w grupach po 4, `normalizeCode` zdejmuje spacje/myślniki, pole przyjmuje do 16 znaków; raport diagnostyczny wycina też postać pogrupowaną. Uwaga do okresu przejściowego: stara wersja ma w polu kodu `maxLength={8}`, więc 12-znakowy kod może dostać tylko przez QR/link `?pair=` — wtedy trafia do starego pokoju, w którym nowa wersja też jest. **Do zrobienia później:** wyłączyć `JOIN_LEGACY_ROOM`, gdy wszystkie urządzenia będą na tej wersji (osobny release). Testy: `yjsSync.test.ts` (12, w tym nowe: nazwa v2, normalizacja/grupowanie, oba pokoje, status i maksimum urządzeń), `diagnostics.test.ts` (+1 asercja). Realne połączenie WebRTC na dwóch urządzeniach — nadal tylko manualne QA.
- [x] **Konfigurowalna lista serwerów sygnalizacyjnych** (pole w `SyncSettings.tsx` → `persistedStore.ts` → `signaling: [...]` dla obu providerów w `yjsSync.ts` i `imageSync.ts` — muszą dostać tę samą listę, inaczej tekst i obrazy rozjadą się na różne serwery; puste = zachowanie jak dziś). Publiczne serwery `y-webrtc` to infrastruktura osób trzecich i gdy znikną, sync **cicho przestanie działać**. `signaling-server/` jest gotowy od 2026-09-25. Nakład **S** w kodzie, opcjonalny w ops. Świadomie **nie** hardcode'ować własnego serwera jako domyślnego. — ✅ 2026-09-28: `signaling` w prefs sync (`kaczy.sync.v1`, więc poza backupem jak kod parowania; „Zapomnij” go nie kasuje — to konfiguracja, nie parowanie). `providerOptions(code)` w `yjsSync.ts` daje **te same** opcje providerom tekstu i obrazów (`imageSync.ts`); pusta lista = brak opcji `signaling`, czyli domyślne serwery `y-webrtc`. `parseSignalingList`: po jednym w linii lub po przecinku, tylko `ws://`/`wss://`, bez duplikatów, złe wpisy pokazane przed zapisem. Zapis przy włączonym sync łączy od nowa. UI: zwijana sekcja „Serwery sygnalizacyjne” w zakładce Sync (rozwinięta, gdy są własne), z uwagą, że wszystkie urządzenia muszą mieć tę samą listę. Lista w raporcie diagnostycznym. Testy: `yjsSync.test.ts` (+4: parsowanie, domyślnie bez opcji, oba providery + ponowne połączenie, przetrwanie „Zapomnij”), `diagnostics.test.ts` (+1 asercja). Realne połączenie przez własny serwer (`signaling-server/`) — nadal tylko manualne QA.

### Kierunki rozbudowy — funkcje i UX

Diagnoza: appka ma imponującą **szerokość** (rysowanie, gamifikacja, P2P CRDT, prezentacja, fokus), ale brakuje jej **głębi w jednej ścieżce używanej 50 razy dziennie: napisz → znajdź → otwórz → dopisz**.

- [x] **Pełnoekranowy edytor notatki.** Dziś jedyny edytor to `textarea` o `min-h-[60px]` w kaflu masonry szerokim na ~300 px, w środku kolumn CSS, obok kafli przeliczających się przy każdym znaku; podgląd Markdown „obok" dzieli te 300 px na dwie kolumny po 150. Nie da się tym napisać notatki ze spotkania. Nowy `NoteEditorDialog.tsx` (`max-w-3xl`, `h-[85vh]`), kafel zostaje tym, w czym jest dobry — podglądem z szybkimi akcjami. **Połowa tej pracy już istnieje**: `FocusMode.tsx` przyjmuje `initialTitle`/`initialContent`/`onSave`, ale `Index.tsx` podaje tylko `onSave: addNote`, więc propsy do edycji istniejącej notatki są martwe. Nakład **M**. — ✅ 2026-09-27: przycisk „Pełny ekran” w edytorze kafla otwiera ten sam edytor w oknie `max-w-3xl`/`h-[85vh]` (`renderEditor(full)` w `NoteCard.tsx`) — wspólny stan szkicu, autosave i sesja Yjs, więc brak drugiej ścieżki zapisu. Esc/X/„Zapisz” zapisują i zamykają. Test e2e. Zostaje: martwe propsy edycji w `FocusMode` (świadomie nie użyte — tryb skupienia to osobny produkt) i scalenie ścieżek czytania.
- [x] **Stan widoku w URL, deep-link do notatki, działający „wstecz".** `BrowserRouter` ma jedną trasę `/`, a cały stan (`view`/`activeLabel`/`activeFolder`/`search`) siedzi w `useState` w `Index.tsx`. Skutki: odświeżenie zawsze wyrzuca do „Notatki" (nie utrzymasz otwartego folderu); systemowy „wstecz" w zainstalowanej PWA na Androidzie **zamyka aplikację** zamiast wracać z folderu; nie da się otworzyć konkretnej notatki linkiem; `public/sw-notifications.js` na klik w powiadomienie tylko fokusuje kartę, bo nie ma czego otworzyć. Trasy `/folder/:id`, `/label/:name`, `/kosz`, `/notatka/:id` + `?q=`. `navigateFallback: "/index.html"` już jest, więc offline zadziała bez zmian w konfiguracji. Nakład **M** — uwaga na `?share=`/`?new=1`/share-target, które już żyją na `/`. To **warunek wstępny** dla naprawy palety, wikilinków i powiadomień: wszystkie potrzebują „otwórz tę konkretną notatkę". — ✅ 2026-09-28: `src/lib/viewRoute.ts` (czyste parse/format z testami) — trasy `/`, `/dzis`, `/tydzien`, `/archiwum`, `/przypomnienia`, `/kalendarz`, `/widget`, `/kosz`, `/folder/:id`, `/etykieta/:nazwa`, `/notatka/:id`, zapytanie w `?q=` z zachowaniem `?pair=`/`?share=`/`?new=`. `useViewRoute` w `Index.tsx` zamiast trzech `useState`: przejście do widoku to nowy wpis historii (systemowe „wstecz” wraca z folderu), wyszukiwanie podmienia bieżący wpis; pole wyszukiwania ma własny stan (karetka) i wlewa się z adresu przy „wstecz/dalej”. **Jedna trasa `/*`** zamiast osobnych `<Route>` — inaczej Index przemontowywałby się przy każdym przejściu i gubił otwarty edytor; nieznana ścieżka = Notatki, więc `NotFound.tsx` usunięty. `/notatka/:id` otwiera notatkę dopiero po `whenNotesReady()` i podmienia adres na widok, w którym notatka jest; nieistniejąca → toast + powrót na `/`. Konfiguracja hostingu (Netlify/Vercel SPA fallback, `navigateFallback`) bez zmian. e2e `routes.spec.ts`.
- [x] **Dokończyć przerwane ścieżki otwierania notatki** — paleta (P0 #5, #6), powiadomienie, oraz **wikilink, który cicho nie działa**: `handleWikiClick` robi `setView("notes")` + `scrollIntoView` po `data-note-id`; jeśli cel jest zarchiwizowany, w koszu albo odfiltrowany, `querySelector` zwraca `null` i **nie dzieje się nic**, bez toasta. Gorzej: `knownTitles` liczy się z `notes + archivedNotes`, więc link do zarchiwizowanej notatki wygląda jak istniejący (kolor primary) i nie działa. Wszystko wpada w jedno `openNote(id)` z toastem-wyjaśnieniem dla Archiwum/Kosza. `wikiLinks.ts` ma już `resolveWikiTarget` (używane tylko w `NotePresentation`). Nakład **S** po URL-ach. — ✅ paleta i wikilinki przez `openNote` (z toastem dla Archiwum/Kosza) już w `c0e8bca`; 2026-09-28 dochodzi powiadomienie: `data.url = /notatka/:id`, `sw-notifications.js` przy otwartej karcie wysyła `postMessage` do routera (bez przeładowania), bez karty otwiera okno pod tym adresem; ścieżka bez SW ma `onclick`. Niesprawdzone na prawdziwym powiadomieniu systemowym (brak QA na urządzeniu).
- [x] **Wyszukiwanie globalne.** Dziś `useFilteredNotes` przeszukuje tylko pulę bieżącego widoku (`notes` XOR `archivedNotes`), a w Koszu `search` jest **całkowicie ignorowane** (`view === "trash" ? trashedNotes : …` pomija `filterNotes`). Plus checklisty poza indeksem (P0 #7). Do tego operatory `label:`/`color:`/`has:` istnieją i są niezłe, ale użytkownik dowiaduje się o nich wyłącznie z placeholdera rotującego co 3,2 s — nie ma ich nawet w `ShortcutsDialog`. Rozwiązanie: checklisty w indeksie Fuse, „Brak wyników w Notatkach — **3 w Archiwum, 1 w Koszu**" jako klikalne przejścia w `EmptyState`, search działa w Koszu, ściągawka operatorów w `ShortcutsDialog`. Nakład **M**. — ✅ 2026-09-28: checklisty były już w indeksie Fuse (`checklist.text`, test dopisany). Kosz przeszukiwany jak inne widoki. `useFilteredNotes` zwraca `elsewhere` (liczba trafień w Notatkach/Archiwum/Koszu poza bieżącym widokiem), a `EmptyState` pokazuje „Brak wyników w Notatkach” + klikalne „1 w Archiwum” — przejście zachowuje `?q=`. Ściągawka operatorów (`label:`, `color:`, `has:reminder|checklist|image`) jako sekcja „Wyszukiwanie” w `ShortcutsDialog`. Świadomie tylko w pustym stanie — przy częściowych wynikach bez podpowiedzi.
- [x] **Uczciwy pełny backup.** Poza plikiem zostają dziś: historia wersji, **wszystkie ustawienia** (`viewPrefs`, motyw, efekty, `confirmPrefs`), **osiągnięcia i passy** oraz historia akcji. Scenariusz: odtwarzam „pełny backup" na nowym laptopie i dostaję notatki bez ani jednej wersji, z wyzerowanymi odznakami i domyślnymi ustawieniami. `FullBackup` v2 z opcjonalnymi sekcjami `versions`/`prefs`/`achievements` i checkboxami przy imporcie (walidacja zod w `noteSchema.ts` to naturalne miejsce). Osobno: **auto-backup mówi nieprawdę** — domyślnie co 7 dni, a bez uchwytu z File System Access robi programowe `a.click()` bez gestu użytkownika (przeglądarki to blokują lub pytają), po czym `useBackupReminders` i tak pokazuje `toast.success("📦 Auto-backup pobrany w tle")`. Toast musi zależeć od realnego wyniku. Nakład **M**. — ✅ 2026-09-28: `FullBackup` v2 (czyta v1) z opcjonalnymi sekcjami `versions`, `settings` (biała lista kluczy localStorage: widok, motyw, ruch, potwierdzenia, efekty, pora roku — **bez** `kaczy.sync.v1`, czyli bez kodu parowania; nieznane klucze z pliku ignorowane) i `achievements`; uszkodzona sekcja = brak sekcji, nie odrzucenie pliku. Przywracanie dwuetapowe: plik jest najpierw tylko czytany (`pickFullBackup`), okno pokazuje datę, liczby i checkboxy sekcji (nieobecne wyszarzone), dopiero potem `restoreFullBackup`. Historia akcji świadomie poza backupem (efemeryczna). Auto-backup: bez wybranego pliku nie klika już pobrania bez gestu — toast „Czas na backup” z przyciskiem „Pobierz”, a `markBackup` dopiero po realnym zapisie/kliknięciu; opis w Ustawieniach poprawiony. 5 testów `fullBackup.test.ts` + e2e eksport→przywrócenie.
- [x] **Agenda przypomnień + porządki w powiadomieniach.** Widok „Przypomnienia" filtruje `n.reminder !== null`, ale sortuje **tym samym `sortKey` co wszystko inne** (domyślnie `updatedAt desc`) — czyli lista terminów nie jest uporządkowana po terminach: przypomnienie na jutro ląduje pod takim z zeszłego miesiąca, bo tamtą notatkę ostatnio tknąłem. Grupy Zaległe/Dziś/Ten tydzień/Później, sortowanie po `reminder`, ukryte przełączniki sortowania dla tego widoku (dokładnie jak już zrobiono dla `sortKey: "manual"`). Plus P0 #12, #13, #14 i „Odłóż 10 min / jutro 9:00" w toaście (mechanika drzemki istnieje w `ReminderToast.tsx`, tylko nie w tym miejscu, gdzie jest najbardziej potrzebna). Nakład **M** + **S**. — ✅ 2026-09-28: `src/lib/reminderAgenda.ts` (`groupReminders`: Zaległe/Dziś/Najbliższe 7 dni/Później, po terminie rosnąco; `snoozeTimes`) z testami. Widok Przypomnień bez podziału na przypięte, sekcje z licznikiem (Zaległe na czerwono), menu sortowania ukryte (`ViewControls sortable`). Toast przypomnienia: `ReminderDueToast` z „Odłóż 10 min / Jutro 9:00 / Gotowe / Otwórz” (drzemka tylko dla jednorazowych — w serii kolejny termin jest już ustawiony; „Otwórz” przez `openNote`). P0 #12–14 były już zrobione. Przy okazji: ikony w `ViewControls` dostały `aria-label` (były bez nazwy dostępnej). e2e `reminders-agenda.spec.ts`.
- [x] **Notatka utworzona w kontekście dziedziczy folder i etykietę** (P0 #9) — `addNote` dostaje opcjonalne `folderId`/`labels`, chip „→ Praca" w rozwiniętym `AddNoteBar` (`FolderPicker` już istnieje), szablony dziedziczą to samo. Uwaga na `useImportExport.ts` i share-target, które też wołają `addNote`. Nakład **S**. — ✅ dziedziczenie było już w `handleAddNoteGlow` (`c0e8bca`), ale pasek dodawania istniał tylko w widoku Notatki, więc w folderze nie było czym tworzyć. 2026-09-28: `AddNoteBar` (i szablony) także w widoku folderu i etykiety, z informacją „trafi do: Praca” / „#etykieta”; skrót nowej notatki nie wyrzuca już z folderu. e2e w `routes.spec.ts`.
- [x] **„Notatka dnia" zamiast szablonu generującego duplikaty.** Szablon „Dziennik" tworzy **nową notatkę za każdym kliknięciem** z tytułem = dzisiejsza data, więc szybko są trzy notatki o identycznym tytule — co dodatkowo psuje wikilinki, bo `resolveWikiTarget` dopasowuje po tytule. Widok „Dziś" też nie jest notatką dnia, tylko filtrem po `createdAt`/`updatedAt` (notatka sprzed roku tknięta dziś pokazuje się jako „z dzisiaj"). Jedna akcja `getOrCreateDailyNote`: istnieje → otwórz i dopisz znacznik godziny; nie istnieje → utwórz. Rozpoznanie po nowym polu skalarnym `dailyDate` (sync-safe, wzorzec jak `priority`; `undefined` = zwykła notatka), **nie po tytule**. Nakład **M**, wymaga pełnoekranowego edytora. — ✅ 2026-09-28 (typecheck, lint 0 błędów, 290 testów jednostkowych, 33/33 e2e): `Note.dailyDate` (`YYYY-MM-DD`, lokalna data) w `yjsStore` (pole skalarne, pomijane w projekcji zwykłych notatek), `noteSchema` (opcjonalne, walidowane) i usuwane przy duplikowaniu. `src/lib/dailyNote.ts`: `dailyKey`, `findDailyNote` (Kosz się nie liczy, Archiwum tak; przy dwóch utworzonych offline wygrywa starsza — wszystkie urządzenia wskazują tę samą), `appendTimestamp` (`**HH:MM** ` na końcu, bez dublowania w tej samej minucie). `Index.openDailyNote`: jest → dopisz godzinę (chyba że edytor tej notatki jest już otwarty — nowe `isNoteTextEditOpen`) i otwórz w edytorze; nie ma → utwórz z szablonem dziennika i etykietą `dziennik`. `openNote` dostał tryb „otwórz w edytorze” (ta sama ścieżka co klik w kartę). Szablon „Dziennik” zastąpiony chipem „Notatka dnia”, akcja także w palecie poleceń. Widok „Dziś” świadomie bez zmian (nadal filtr po dacie). Testy: `dailyNote.test.ts` (7), `yjsStore.test.ts` (+1), e2e `daily-note.spec.ts`.
- [x] **Wikilinki dostępne w praktyce: autouzupełnianie `[[` + backlinki w karcie.** Warstwa danych jest dobra (`wikiLinks.ts` z testami, `findBacklinks`, rozróżnienie istniejący/nieistniejący), ale żeby wstawić link trzeba pamiętać tytuł co do znaku — jest tylko przycisk `[[ ]]` wklejający puste nawiasy. Backlinki widać **wyłącznie** w trybie Prezentacji. Naprawia też P0 #4 (martwy `showBacklinks`). Nakład **M** (pozycjonowanie karetki w `textarea` to najbardziej dłubaniasta część). — ✅ 2026-09-28: `wikiLinks.ts` dostał `buildWikiIndex` (tytuły od najświeższych + mapa backlinków, liczone raz w `Index` zamiast `findBacklinks` w każdej karcie), `backlinksOf`, `wikiQueryAt` (otwarte `[[` przed karetką), `suggestWikiTitles` (od początku → od początku słowa → gdziekolwiek, bez tytułu edytowanej notatki) i `completeWikiLink` (wchłania `]]` wstawione przyciskiem paska). Hook `useWikiAutocomplete` + `lib/textareaCaret.ts` (lustrzany div): lista przy karetce, nad nią, gdy pod spodem brak miejsca; strzałki, Enter/Tab, Esc (w pełnym ekranie Esc chowa listę zamiast zamykać edytor), `onMouseDown` bez utraty fokusu, więc `onBlur` nie zapisuje w pół słowa. Karta pokazuje „Linkują tu:” z maks. 3 notatkami (+N), klik otwiera notatkę po id (działa też dla linkujących bez tytułu); ukryte przy wyłączonym `showBacklinks`. `NoteViewActions` ma `wikiIndex` i `onOpenNote`. Testy: `wikiLinks.test.ts` (+9), e2e `wikilinks.spec.ts` (2). Sprawdzone zrzutami w jasnym i ciemnym motywie. Świadomie nie: podpowiedzi w `AddNoteBar` (nowa notatka) i tworzenie notatki z nieistniejącego linku.
- [x] **Ergonomia checklist (niższy priorytet).** Warstwa danych jest świetna (item-level CRDT, `order` jako pole), UI skromne: nie da się zmienić kolejności pozycji, wklejenie 10 linii daje jedną pozycję z 10 liniami, nie ma konwersji tekst ↔ lista. Wklejanie i konwersja: **S**; reordering drag&drop: **M** i prawdopodobnie najsłabszy zwrot z całego planu. Przy okazji: `ChecklistEditor.tsx` **redeklaruje własny interfejs `ChecklistItem`** zamiast importować go z `useNotes.ts` — dwa typy o tej samej nazwie, do scalenia. — ✅ (bez drag&drop): wklejanie wielu linii w `src/lib/checklistPaste.ts` (`983b573`). 2026-10-09 dołączona konwersja z gałęzi `feat/checklist-wklejanie-konwersja`: `parseChecklistLines`, `contentToChecklist`, `checklistToContent` w `checklistPaste.ts`, przyciski `ChecklistConvertButtons` („Zamień na listę” / „Zamień na tekst”) obok przełącznika listy w edytorze kafla i pod treścią w pasku nowej notatki (`- [ ] tekst` / `- [x] tekst`, dopisywane do istniejących pozycji/treści). Testy w `checklistPaste.test.ts`, e2e `checklist.spec.ts`. **Nie zrobione:** zmiana kolejności przeciąganiem (M).

### Do uproszczenia, nie rozbudowy

- [x] **Cztery nachodzące mechanizmy „historii".** `undoToast` + `actionHistory` + `RecentActionsPanel` (248 linii, z własnym wyszukiwaniem, filtrami i **własnym mini-edytorem notatki** — piątym edytorem w appce) + `useNoteVersions`/`VersionHistory`. Użytkownik musi wiedzieć, że „co skasowałem" jest w trzech miejscach (toast / panel / Kosz), a „co napisałem wcześniej" w czwartym. Kosz zostaje miejscem prawdy dla usuwania, toast „Cofnij" natychmiastową siatką bezpieczeństwa, `RecentActionsPanel` traci własny edytor. Mniej kodu, mniej pojęć, zero utraconej funkcji. — ✅ 2026-09-28: `RecentActionsPanel` bez mini-edytora (248 → 189 linii); klik we wpis albo „Pokaż notatkę” zamyka panel i woła `openNote` — notatka pokazuje się tam, gdzie jest (Notatki / Archiwum / Kosz), z podświetleniem, a edycja dzieje się w karcie jak wszędzie.
- [x] **Trzy ścieżki „czytania" tej samej notatki** — `NotePresentation` (zoom, backlinki, nawigacja wikilinkami), szybki podgląd w `NoteGrid` (snippety, podświetlenia), inline w kaflu. Każda dobra i każda niepełna. Po pełnoekranowym edytorze scalić w jeden widok z trybami czytanie/edycja/prezentacja. — ✅ 2026-09-28: `NoteReader` (jedna instancja w `Index`) zastąpił szybki podgląd z `NoteGrid` i `NotePresentation` (usunięte). Tryby `preview` (Spacja na kaflu, klawisze nadal w `gridKeyboardNav`) i `present` (zoom, własne klawisze, `data-state="open"` blokuje nawigację siatki), przełączane przyciskiem w miejscu. Oba tryby mają teraz to, co wcześniej miał tylko jeden: obrazy, „Linkują tutaj”, dopasowania wyszukiwania, wikilinki nawigujące w czytniku i przycisk „Edytuj” (Enter), który prowadzi do edycji w karcie — edytor został jeden. Inline w kaflu bez zmian (to skrót, nie widok czytania). `findBacklinks` usunięte (zostało tylko w testach; `backlinksOf` na indeksie robi to samo). e2e `reader.spec.ts` (2). Pełny e2e: 37/37.
- [x] **Tilt 3D na każdym kaflu** (`useSpring` ×2 na *każdej* karcie) — realny koszt renderu przy zerowej wartości informacyjnej; za flagę w `effectsSettings`, domyślnie off. Reszta efektów (`celebrate.ts`, `glowTrail.ts`, backdropy, easter eggi) zostaje — to część charakteru appki. — ✅ 2026-09-28: efekt `cardTilt` („Przechył kafli”) w `effectsSettings`, domyślnie wyłączony. Wyłączony = brak `onMouseMove`, brak `rotateX/Y`, brak `perspective`/`preserve-3d` (hooki sprężyn zostają — nie mogą być warunkowe — ale bez zdarzeń stoją w miejscu).
- [x] **`QuickTemplates` zawsze widoczne** — sześć pigułek zajmuje stałe miejsce na górze każdego wejścia w „Notatki"; schować pod rozwinięty composer, a „Dziennik" zamienić na notatkę dnia. — ✅ 2026-09-28: szablony (z „Notatką dnia”) renderuje `AddNoteBar` przez prop `templates`, tylko w rozwiniętym i pustym szkicu; wybór zwija composer. „Notatka dnia” jest też w palecie poleceń. e2e `daily-note.spec.ts` najpierw rozwija composer.
- [x] **Niespójność eksportów** — PDF eksportuje `notes`, a MD/HTML/JSON `notes + archivedNotes`. — ✅ 2026-09-28: PDF też dostaje `notes + archivedNotes`.

### Stan Rundy 8 (przerwana 2026-09-28 — do dokończenia)

- [x] Agenda przypomnień + drzemka w toaście (commit z 2026-09-28).
- [x] Naprawiony zależny od daty e2e `reminders-calendar.spec.ts` („seria pokazuje prognozy…”): seria startowała „dziś”, pod koniec miesiąca mieściło się jedno wystąpienie — `seedWeeklySeries` ustawia teraz `page.clock.setFixedTime` na 10. dzień miesiąca.
- [x] Notatka dnia (`openDailyNote`, pole `dailyDate`) — patrz pozycja w „Kierunki — funkcje i UX”.
- [x] Wikilinki: autouzupełnianie `[[` + backlinki w karcie.
- [x] Hardening parowania: `roomNameFor` na SHA-256 + 12-znakowy kod, z okresem przejściowym (oba pokoje).
- **Runda 8 zamknięta 2026-09-28.** Pełny e2e po hardeningu: 35/35 (także `live-text.spec.ts`, wcześniej niestabilny).
- Przy upraszczaniu (2026-09-28): `live-text.spec.ts` padał już deterministycznie — drugie scalenie pokazywało toast „Scalono…”, gdy pierwszy jeszcze wisiał, i `getByText(/^Scalono/)` łamał strict mode. To była przyczyna wcześniejszej „niestabilności”. `mergeSync` czeka teraz, aż stary toast zniknie. Pełny e2e: 35/35.
- ~~Otwarte bez decyzji: seria `monthly` 31. dnia~~ — ✅ rozstrzygnięte 2026-09-29 (`68ecfc1`): pole `reminderDay` zapamiętuje dzień zakotwiczenia, w krótszym miesiącu termin spada na ostatni dzień (31 sty → 28 lut → 31 mar), a `.ics` eksportuje to samo przez `BYMONTHDAY=28,29,30,31;BYSETPOS=-1`.
- Pełny zestaw e2e puszczony 2026-09-28 po notatce dnia: 33/33 zielone. Po wikilinkach: 34/35 — `live-text.spec.ts` pada niedeterministycznie (2 z 5 powtórzeń, potem 3/3 i 1/1 zielone), błąd w kroku `mergeSync` (Ustawienia → „Scal z pliku”), nie w asercji tekstu. Nie sprawdzone jeszcze, czy pada tak samo bez zmian z wikilinków — do rozstrzygnięcia: `npx playwright test e2e/live-text.spec.ts --repeat-each=8` na poprzednim commicie.

### Rekomendowana kolejność

1. **Runda 1 — „przestań kłamać i przestań tracić dane".** Autosave (P0 #2), potem pełnoekranowy edytor (bo to on jest miejscem, w którym autosave ma żyć), potem podwójna nawigacja klawiaturą (P0 #3 — izolowane S, a psuje udokumentowaną funkcję). Bogata funkcjonalność bez zaufania do zapisu jest nieużywalna.
2. **Runda 2 — diagnostyka (S), przed każdą zmianą ryzykowną.** Wszystkie następne zmiany (CRDT w edytorze, nowy store obrazów, nowy hash pokoju) będą się psuć **cicho**, bo appka konsekwentnie łyka wyjątki. Wejście w nie bez logów = debugowanie P2P na ślepo.
3. **Runda 3 — sync przez plik (S–M).** Najlepszy stosunek wartości do nakładu: znosi najdotkliwsze ograniczenie produktu („oba urządzenia jednocześnie online") **bez serwera**, w pełni testowalny automatycznie, i po drodze naprawia to, że dziś jedyna droga przeniesienia danych jest destrukcyjna. Daje też bezpieczną drogę odzyskania danych na czas dalszych zmian.
4. **Runda 4 — inkrementalna projekcja (M), świadomie PRZED CRDT w edytorze.** Autosave co ~300 ms przy dzisiejszej pełnej reprojekcji i przebudowie indeksu Fuse zamieni pisanie w slideshow, a diagnoza „autosave czy projekcja" będzie trudniejsza niż zrobienie tego w dobrej kolejności.
5. **Runda 5 — CRDT w edytorze (M).** Największa wartość merytoryczna: dopiero to sprawia, że field-level merge i item-level checklist z poprzednich sesji działają w rękach użytkownika, a nie tylko w testach.
6. **Runda 6 — „daj się dostać do notatki".** URL/deep-linki, potem (trywialne już) paleta + wikilinki + powiadomienia, potem create-in-context.
7. **Runda 7 — „znajdź i zaufaj".** Wyszukiwanie globalne + checklisty w indeksie, uczciwy backup v2 (razem z przeniesieniem wersji do IndexedDB, żeby nie bumpować wersji backupu dwa razy). Brak jednego i drugiego boli proporcjonalnie do liczby notatek, czyli rośnie w czasie.
8. **Runda 8 — rutyna.** Agenda przypomnień + porządki w powiadomieniach, notatka dnia, wikilinki `[[`, hardening parowania.
9. **Na końcu — content-addressed store obrazów (L) i upraszczanie.** Największy nakład, największe ryzyko utraty danych, najwęższa korzyść (boli tylko przy dużej liczbie zdjęć). Osobna sesja.

**Hosting:** oba audyty stawiały hosting statyczny wysoko (bez adresu HTTPS nie zainstalujesz PWA na telefonie i nie sprawdzisz P2P na dwóch realnych urządzeniach — dług „wymaga manualnego QA" odnotowany już trzy razy). Decyzją użytkownika z 2026-09-27 configi są przygotowane, ale wdrożenie odłożone — patrz sekcja „Wdrożenie". Dopóki go nie ma, wszystko wymagające QA na dwóch urządzeniach zostaje niesprawdzalne.

### Świadomie NIE robimy

- **Web Push / powiadomienia przy zamkniętej appce** — wymaga serwera push i kluczy VAPID utrzymywanych bezterminowo, dla appki bez konta i bez backendu. Notification Triggers nie są wspierane. `ReminderPicker` i `useReminderNotifications` już uczciwie informują o ograniczeniu — to właściwa odpowiedź.
- **Konto użytkownika / sync przez chmurę** — sprzeczne z tożsamością projektu; P2P + sync przez plik pokrywają realną potrzebę „mam to na telefonie i na laptopie".
- **Wirtualizacja siatki notatek** — cztery mechanizmy w `NoteGrid.tsx` zakładają pełny DOM, korzyść iluzoryczna przy realnej skali.
- **Własny serwer sygnalizacyjny jako domyślny** — uzależnia działanie od utrzymywania infrastruktury; konfigurowalna lista jest lepsza.
- **Wersje notatek ani bajty obrazów w głównym `Y.Doc`** — ten argument został raz przemyślany prawidłowo (2026-09-25) i nie ma powodu go odwracać.
- **Real-time współedycja z kursorami** — Yjs by to udźwignął (`y-protocols/awareness`), ale to appka jednoosobowa; sync służy urządzeniom tej samej osoby.
- **Automatyczne testy realnego WebRTC** — zamknięte z uzasadnieniem 2026-09-25, nie wracamy.
- **Dalszy code-splitting** — wątek zamknięty 2026-09-27; 703 KB to już kod właściwy appki.
- **Tabele/GFM, podświetlanie składni, edytor szablonów w UI, hierarchia etykiet, ładniejszy PDF, szyfrowanie IndexedDB** — kolejno: ciągną zależności do bundla dla funkcji bez miejsca w kaflu; CRUD dla sześciu presetów edytowanych i tak w kodzie; foldery są już zagnieżdżone (`parentId`), drugi system taksonomii to dublowanie pojęć; godziny za funkcję używaną raz na kwartał; bez konta i serwera klucz leżałby obok danych, czyli teatr bezpieczeństwa (hasło pokoju w P2P to inna sprawa i już jest).

## Kalendarz przypomnień — plan (2026-09-27)

Zamówiony przez użytkownika widok kalendarza, w którym da się **dodać, edytować i usunąć** przypomnienie. Plan powstał z audytu agentowego zweryfikowanego w kodzie; poniżej tylko rozstrzygnięcia, nie streszczenie.

### Rozstrzygnięcia projektowe

- [x] **Bez nowej encji — `reminder` zostaje polem notatki, kalendarz to widok projekcyjny.** Osobny „event" oznaczałby nowy `Y.Map` top-level, nowy observer, `FullBackup` v2 z migracją oraz integralność referencyjną event→notatka bez transakcji cross-map — czyli klasę błędów „event osierocony po usunięciu notatki", której dziś w ogóle nie ma. Eksporty (`exportNotes.ts:87,140`, `exportPdf.ts:77`) już drukują przypomnienie z notatki. Cena przyjęta świadomie: **jedna notatka = najwyżej jeden termin**; gdyby to kiedyś nie wystarczyło, właściwym krokiem jest `reminders: Reminder[]` w istniejącym `Y.Map`, nie osobna kolekcja.
- [x] **Własna siatka miesiąca na `date-fns`, nie `react-day-picker`.** v8 ma `components.DayContent`, ale komórka to sztywny `h-9 w-9` `<button>` (`ui/calendar.tsx:293`) — chipy byłyby klikalnymi elementami wewnątrz przycisku (niepoprawny HTML, zepsuta obsługa klawiaturą), a drop na dzień wymaga własnego `useDroppable` na kontenerze. `ui/calendar.tsx` zostaje nietknięte i dalej obsługuje pickery.
- [x] **Zakres: miesiąc + panel listy wybranego dnia. Widok tygodnia i dnia z osią godzin odpada.** Przypomnienia mają godzinę, ale **nie mają czasu trwania** — oś godzinowa rysowałaby punkty, nie bloki, czyli byłaby gorszą listą.

### Serie (`reminderRepeat`) — najtrudniejszy punkt

Fakt z kodu, który rozstrzyga wszystko: model trzyma **jeden** timestamp, a `getNextReminderTime` (`reminderRepeat.ts:11`) jest wołane dopiero w chwili odpalenia (`useReminderNotifications.ts:112`). Nie ma `dtstart`, `until`, ani listy wyjątków. **Jedyne wystąpienie, które naprawdę istnieje, to najbliższe**; cała reszta to prognoza liczona w locie.

- [x] Chip najbliższego wystąpienia: pełna interaktywność. Chipy dalszych wystąpień: **read-only**, wizualnie odmienne (przerywane obramowanie, ikona `Repeat`), klik prowadzi do najbliższego. Asymetria jest dziwna dopiero, dopóki nie zrozumie się modelu — alternatywa (udawanie, że wszystkie wystąpienia są równe) obiecuje operacje niemożliwe do zapisania.
- [x] „Usuń" na najbliższym wystąpieniu ma dwie opcje: **to wystąpienie** → `reminder = getNextReminderTime(at, repeat)` (seria trwa, pomija jeden termin; zwykły LWW, zero nowych pól), **cała seria** → `reminder = null, reminderRepeat = "none"`. Obie z Cofnij.
- [x] **Świadomie NIE `reminderSkips: number[]`.** Kuszące, ale pole trafiłoby do `NOTE_SCALAR_FIELDS` (`yjsStore.ts:30`), a te są LWW na całej wartości: dwa urządzenia offline pomijające różne terminy → jedna lista wygrywa, druga zmiana znika bez śladu. Poprawnie wymagałoby `Y.Array` i rozszerzenia projekcji — nakład L i nowy wektor błędów sync dla funkcji, której wartość jest wątpliwa przy nieskończonej serii.
- [x] ✅ 2026-10-09: `reminderRepeatUntil` (koniec dnia, jedna liczba, LWW) — `nextInSeries` w powiadomieniach, kalendarzu i „pomiń”, `UNTIL` w .ics, pole „Do kiedy” w oknie przypomnienia. Było: Brak „do kiedy" akceptowany w MVP (kalendarz przewinięty na 2030 dalej pokazuje chipy). Jeśli zaboli: **jedno** pole skalarne `reminderRepeatUntil`, bezpieczne dla LWW, bo to jedna liczba.

### Znalezione przy okazji błędy (poza samym kalendarzem)

- [x] **`FIRED_KEY` nie jest czyszczony przy zmianie terminu** (`useReminderNotifications.ts:34-46`). Przesunięcie już odpalonego, jednorazowego przypomnienia na przyszłość **nie wystrzeli ponownie**, bo `note.id` zostaje w localStorage na zawsze. Dziś rzadkie, po kalendarzu z przeciąganiem — codzienne. Do tego zbiór rośnie w nieskończoność, bo nic nie usuwa wpisów po skasowanych notatkach. — ✅ już zrobione wcześniej (`lib/firedReminders.ts`, `reconcileFired` z testami); tylko nieodhaczone.
- [x] **`monthly` 31. dnia miesiąca przeskakuje na 3 marca** — `d.setMonth(d.getMonth() + 1)` (`reminderRepeat.ts:21`) i przepełnienie `Date`. Istniejące zachowanie; najpierw udokumentować testem, potem decydować, czy to bug. — ✅ już zrobione wcześniej (commit `68ecfc1`: `anchorDay`/`reminderDay`, przycięcie do ostatniego dnia miesiąca, testy w `reminderRepeat.test.ts`); tylko nieodhaczone.

### Etapy

| # | Zakres | Nakład |
|---|---|---|
| ~~1~~ | ~~`reminderOccurrences.ts` + testy; `composeReminderTimestamp` wyciągnięte z `ReminderPicker`; uzdrowienie `FIRED_KEY`~~ — **zrobione 2026-09-27**, patrz niżej | **S** |
| ~~2~~ | ~~`View: "calendar"` + wpisy nawigacji + pusty widok pod `lazy()`~~ — **zrobione 2026-09-27**, patrz niżej | **S** |
| ~~3~~ | ~~`MonthGrid` + `DayCell` + `ReminderChip` + panel dnia, read-only, obsługa klawiaturą~~ — **zrobione 2026-09-27**, patrz niżej | **M** |
| ~~4~~ | ~~`ReminderQuickAddDialog`: dodawanie + edycja + usunięcie~~ — **zrobione 2026-09-27**, patrz niżej | **M** |
| 5 | Semantyka serii: chipy read-only, „usuń wystąpienie vs serię" | **M** |
| ~~6~~ | ~~E2E + mobile (kropki zamiast chipów poniżej ~380 px, safe-area)~~ — **zrobione 2026-09-27**, patrz niżej | **S** |
| ~~7~~ | ~~Drag&drop terminu + **obowiązkowy** `Shift+←/→` (WCAG 2.5.7) + Cofnij~~ — **zrobione 2026-09-27**, patrz niżej | **S** |

Etapy 1–4 to wysyłalny produkt. **Etap 5 jest obowiązkowy** przed pokazaniem go komukolwiek, kto używa powtarzania.

Uwagi wykonawcze: `expandOccurrences` memoizować po `[notes, archivedNotes, visibleMonth]`; zbiór to `[...notes, ...archivedNotes]` bez kosza (tak samo jak `Index.tsx:104` karmi powiadomienia); przy drag&drop obsługa `day-drop-*` musi mieć `return` **przed** fallbackiem reorderu w `useNoteDnd.ts:476`, inaczej przeciągnięcie przestawi globalny `sortKey` na `"manual"` za plecami użytkownika.

### Etap 1 — wykonany (2026-09-27)

- `src/lib/reminderOccurrences.ts` — `expandOccurrences` (jednorazowe + serie, tylko w przód od zapisanego terminu, limit 400 wystąpień na notatkę, kosz pominięty, archiwum nie), `groupByDay` i `dayKey` w czasie lokalnym. 16 testów, w tym utrwalone przeskakiwanie `monthly` z 31 stycznia na 3 marca i zachowanie godziny przy zmianie czasu na letni.
- `src/lib/reminderTime.ts` — `composeReminderTimestamp` wyciągnięte z `ReminderPicker` i podpięte **w obu** pickerach (`ReminderPicker`, zduplikowany inline w `AddNoteBar`). Przy okazji naprawiony cichy błąd: wyczyszczone pole `type="time"` dawało `setHours(NaN)` i zapisywało `NaN` jako termin — teraz `null` blokuje przycisk zapisu. 11 testów.
- `src/lib/firedReminders.ts` — `reconcileFired` zdejmuje z rejestru wpisy po notatkach, których termin wrócił w przyszłość albo został wyczyszczony, oraz po notatkach nieistniejących. Naprawia to, że przesunięty termin **nigdy nie wystrzeliwał ponownie**, i zatrzymuje nieskończony wzrost zbioru. 10 testów. Nazwa klucza `dash-notes-fired-reminders` celowo bez zmian — zmiana zgubiłaby stan „już wystrzelone”.
- Przy okazji: „KACZY” w tekście `ReminderPicker` zamienione na „aplikacja” (zaszłość sprzed rebrandingu).

Zweryfikowane: `typecheck` / `lint` (0 błędów, 8 ostrzeżeń — bez zmian) / **227 testów jednostkowych** (190 + 37 nowych) / 10 e2e / `build`.

### Etap 2 — wykonany (2026-09-27)

- `View` poszerzony o `"calendar"` w `useFilteredNotes.ts`; `useFilteredNotes` zwraca dla niego puste listy i **nie buduje indeksu Fuse** — kalendarz rysuje własną projekcję.
- `BottomNav` przestał duplikować union `View` i importuje go z `useFilteredNotes` (rozjazd typów był kwestią czasu). Wpis „Kalendarz" trafił do arkusza „Więcej", obok „Przypomnień": pasek ma sztywne 5 kolumn, a **świadomie nie degradowałem** „Archiwum" do arkusza, żeby zrobić miejsce — plan agenta to sugerował, ale to usunięcie istniejącej funkcji z paska w zamian za nową. `isMoreActive` obejmuje teraz `calendar`.
- Wpisy w `Index.tsx` (sidebar), `AppHeader` (tytuł z ikoną), `CommandPalette` (union + pozycja nawigacji), `EmptyState` (dwa rekordy po `View`).
- `ReminderCalendarView` pod `lazy()` — osobny chunk **3,19 kB**, pierwsze wejście w Notatki go nie pobiera. Na razie: nawigacja po miesiącach, „Dziś" (z `aria-label="Wróć do bieżącego miesiąca"`, bo „Dziś" koliduje z pozycją paska bocznego) i policzone wystąpienia z `expandOccurrences`. Widok mówi wprost, że siatka dojdzie w kolejnym kroku, zamiast udawać gotowy kalendarz.
- Poprawka przy okazji: nagłówek pokazywał w kalendarzu „0 notatki", bo licznik liczy siatkę. Licznik jest tam teraz ukryty.

Zweryfikowane: `typecheck` / `lint` (0 błędów, 8 ostrzeżeń — bez zmian) / 227 testów jednostkowych / **12 e2e** (10 + 2 nowe: wejście z paska bocznego z nawigacją po miesiącach oraz wejście z palety poleceń) / `build`.

### Etap 3 — wykonany (2026-09-27)

Siatka miesiąca, komórka dnia, chip terminu i panel dnia — na razie **tylko do czytania**.

- `MonthGrid.tsx` — własna siatka na `date-fns`, tydzień od poniedziałku. Obsługa klawiaturą odtworzona świadomie (to cena rezygnacji z `react-day-picker`): `role="grid"`/`row`/`columnheader`/`gridcell`, **roving tabindex** (cała siatka to jeden przystanek tabulatora), strzałki po dniach, `Home`/`End` po tygodniu, `PageUp`/`PageDown` po miesiącach. Wyjście strzałką poza miesiąc przewija kalendarz zamiast blokować ruch. Fokus przenosi się dopiero po ruchu klawiaturą — inaczej samo wejście w widok przeskakiwałoby stronę do siatki.
- `DayCell.tsx` — do 3 chipów i „+N więcej"; **poniżej `sm` same kropki**, bo chip z tekstem nie mieści się w 1/7 szerokości telefonu. Treść terminów siedzi w `aria-label` komórki (`„14 marca 2026, 2 terminy"`), a wizualna warstwa jest `aria-hidden` — czytnik ekranu nie czyta tych samych danych dwa razy.
- `ReminderChip.tsx` — godzina, tytuł, ikona `Repeat`. **Wystąpienie serii, które nie jest najbliższe, rysuje się przerywanym obramowaniem i bez wypełnienia.** To wizualna zapowiedź semantyki z etapu 5: tylko `isNext` da się edytować.
- `DayPanel.tsx` — pełne tytuły, których komórka nie pomieści, plus zdanie „Prognoza serii — zapisany jest tylko najbliższy termin" przy wystąpieniach dalszych.
- Zakres liczenia wystąpień jest o tydzień szerszy z każdej strony miesiąca, bo siatka pokazuje też wiodące i zamykające dni sąsiednich miesięcy — inaczej skrajne komórki byłyby zawsze puste. Potwierdzone testem e2e: termin ustawiony na 3 października widać w siatce września.
- Poprawka: `capitalize` na dacie podnosiło każde słowo („29 **W**rześnia") — zamienione na `first-letter:uppercase`.

Chunk kalendarza: **8,78 kB** (gzip 3,61 kB), dalej poza pierwszym wejściem.

Zweryfikowane: `typecheck` / `lint` (0 błędów, 8 ostrzeżeń — bez zmian) / 227 testów jednostkowych / **14 e2e** (12 + 2 nowe: termin w komórce i w panelu dnia oraz chodzenie strzałkami z `PageDown`) / `build` / zrzuty w układzie desktop i mobile.

### Etap 4 — wykonany (2026-09-27)

Kalendarz robi wreszcie to, o co był proszony: **dodaj, edytuj, usuń termin**.

- `ReminderQuickAddDialog.tsx` — dwie drogi bez trybów do przełączania: wpisany tekst tworzy nową notatkę z terminem (najczęstszy przypadek), a lista pod spodem przypina termin do notatki, która już istnieje. Notatki bez terminu są na górze listy, te z terminem oznaczone „ma już termin".
- Język naturalny z **początku** wpisu: „jutro odebrać paczkę" → termin na jutro, tytuł „odebrać paczkę". Prefiks szukany od najkrótszego, bo `parseNaturalDate` znajduje datę także w dłuższym zdaniu — szukanie od najdłuższego zjadało cały wpis jako datę i zostawiało notatkę bez tytułu (złapane na zrzucie, nie w testach).
- Akcje siedzą w panelu dnia, nie w komórkach siatki: siatka zostaje jednym przystankiem tabulatora z nawigacją strzałkami, a przyciski w komórkach rozbiłyby ten model. `Enter`/`Spacja` na dniu otwiera dodawanie — klawiaturowy odpowiednik „Dodaj termin".
- Zmiana i usunięcie terminu idą z **Cofnij** (`toastWithUndo`), przywracającym poprzedni termin **i** poprzednie powtarzanie.
- `addNote` zwraca teraz id utworzonej notatki. Bez tego ustawienie serii tuż po utworzeniu wymagałoby sięgnięcia z warstwy strony do `yjsStore` — czyli obejścia własnej warstwy danych.
- Usunięcie na serii jest jawnie podpisane „Usuń serię". Opcja „usuń tylko to wystąpienie" należy do etapu 5 i **nie jest** tu udawana.

**Naprawiony przy okazji realny błąd produkcyjny (nie testowy):** `registerSW.ts` przeładowywał stronę przy każdym `controllerchange`, a `clientsClaim: true` sprawia, że świeżo aktywowany worker przejmuje niekontrolowaną kartę — więc **każde pierwsze wejście do aplikacji kończyło się przeładowaniem sekundę po starcie**. Reload dzieje się teraz tylko wtedy, gdy worker już nas kontrolował, czyli przy prawdziwej aktualizacji. Objawiało się to jako „flaky" test palety poleceń: DOM znikał pod klikiem. Warto pamiętać, że to samo tłumaczy wcześniejsze losowe pady `e2e/pwa.spec.ts`.

Zweryfikowane: `typecheck` / `lint` (0 błędów, 8 ostrzeżeń — bez zmian) / 227 testów jednostkowych / **16 e2e** (14 + 2 nowe: pełna ścieżka dodaj → edytuj → usuń oraz przypięcie do istniejącej notatki; test palety przepuszczony 3× pod rząd po naprawie) / `build`.

### Etap 5 — wykonany (2026-09-27)

Najtrudniejszy etap planu: UI przestaje obiecywać operacje, których model nie potrafi zapisać.

- **„Pomiń to wystąpienie"** przesuwa zapisany termin na kolejny w serii (`getNextReminderTime`). Zero nowych pól i zero nowych struktur — dokładnie ta sama operacja, którą robi `useReminderNotifications` po odpaleniu przypomnienia. **„Usuń całą serię"** zeruje termin i powtarzanie. Obie z „Cofnij" przywracającym termin **i** powtarzanie.
- Edycja najbliższego terminu serii mówi wprost, co robi: „Zmiana godziny lub dnia przesuwa całą serię — model zapisuje jeden termin, a kolejne wylicza od niego". Bez tego zdania użytkownik nie ma skąd wiedzieć, dlaczego przesunięcie jednego wystąpienia rusza wszystkie.
- **Prognozy serii przestały być ślepym zaułkiem.** Dalsze wystąpienia nadal są read-only (nie istnieją w danych), ale klik przenosi kalendarz na najbliższy **zapisany** termin, otwiera go do edycji i tłumaczy to toastem. Wcześniej klik nie robił nic.
- Trzy nowe testy e2e pokrywają dokładnie te trzy ścieżki: że edytowalne jest tylko najbliższe wystąpienie, że pominięcie zdejmuje jedno wystąpienie a seria trwa, i że usunięcie serii czyści wszystkie jej wystąpienia.

Chunk kalendarza: **17,19 kB** (gzip 6,11 kB).

Zweryfikowane: `typecheck` / `lint` (0 błędów, 8 ostrzeżeń — bez zmian) / 227 testów jednostkowych / **19 e2e** (16 + 3 nowe) / `build`.

**Kalendarz przypomnień jest funkcjonalnie kompletny** — został etap 7 (przeciąganie terminów), **S** i opcjonalny.

### Etap 6 — wykonany (2026-09-27)

Kalendarz przeszedł test najwęższego ekranu, jaki warto obsługiwać (320 px).

- **Dialog terminu przewija się** (`max-h-[85dvh]` + `overflow-y-auto` + `env(safe-area-inset-bottom)`). Wcześniej okno modalne nie przewijało się wcale, więc na niskim ekranie z otwartą klawiaturą „Zapisz termin" i „Usuń termin" zostawały poza widokiem — funkcji po prostu nie dało się dokończyć. `dvh`, nie `vh`, bo pasek adresu przeglądarki mobilnej zmienia wysokość widoku.
- „Pomiń to wystąpienie" i „Usuń całą serię" **stają w kolumnie poniżej `sm`** — obok siebie w 288 px dostępnej szerokości nie mieściły się w czytelnej formie.
- Nagłówek miesiąca: `min-w-[11ch]` tylko od `sm`, `truncate`, mniejszy stopień pisma na telefonie, przyciski `shrink-0`. Sztywna szerokość plus „Dziś" przy dłuższej nazwie miesiąca rozpychała stronę w poziomie.
- **`ViewControls` zniknęły z nagłówka w widoku kalendarza** — układ, sortowanie i filtry notatek nie robią tam nic (kalendarz rysuje własną projekcję), a przy okazji to one dawały na 320 px **96 px przewijania w bok**. Kontrolki, które nie działają, i tak nie powinny tam stać.
- Kropki na wąskim ekranie mają własny limit (`MAX_DOTS = 4` wobec `MAX_CHIPS = 3`): kropka zajmuje ułamek szerokości chipa, więc zwijanie w „+N" po trzech było przedwczesne.
- Naprawiony wyścig w teście etapu 5: `count()` **nie czeka**, więc licznik wystąpień potrafił złapać jeszcze pustą siatkę (chunk kalendarza dochodzi przez `lazy()`) i porównanie „o jedno mniej" wychodziło z zera. Objawiało się losowym padem „pominięcie wystąpienia".

Nowy test e2e chodzi całą ścieżką w 320×568: wejście przez arkusz „Więcej", brak przewijania w poziomie, dodanie terminu z przyciskiem zapisu w widoku, kropki bez godziny w komórce (godzina zostaje w panelu dnia i w `aria-label`), edycja i usunięcie.

Zweryfikowane: `typecheck` / `lint` (0 błędów, 8 ostrzeżeń — bez zmian) / 227 testów jednostkowych / **20 e2e** (19 + 1 nowy) / `build` (chunk kalendarza 17,42 kB, gzip 6,20 kB).

### Etap 7 — wykonany (2026-09-27)

- Chip terminu (widok od `sm`) da się przeciągnąć na inną komórkę; godzina zostaje, zmienia się dzień. Przeciągać można tylko termin zapisany w modelu — prognozy serii są `disabled`. Seria przesuwa się cała (liczy się od nowego terminu), toast to mówi.
- **Własny, zagnieżdżony `DndContext`** w `ReminderCalendarView` zamiast obsługi `day-drop-*` w `useNoteDnd.ts`: przeciągnięcia chipów w ogóle nie docierają do globalnego handlera, więc ryzyko przestawienia `sortKey` na `"manual"` znika u źródła, a `useNoteDnd` zostaje nietknięty.
- Alternatywa klawiaturowa (WCAG 2.5.7): `Shift+←/→` na terminie w panelu dnia przesuwa go o dzień (`aria-keyshortcuts`). Na telefonie (same kropki) alternatywą jednym palcem jest edycja w dialogu.
- Każde przesunięcie ma „Cofnij” przez `toastWithUndo`.

Zweryfikowane: `typecheck` / `lint` (0 błędów, 8 ostrzeżeń — bez zmian) / 227 testów jednostkowych / **21 e2e** (20 + 1 nowy: przeciągnięcie myszą, Shift+←, Cofnij) / `build` (chunk kalendarza 19,01 kB, gzip 6,85 kB).

**Kalendarz przypomnień jest skończony (etapy 1–7).**

## Audyt funkcji — 2026-09-27

Propozycje **spoza** istniejącego planu. Przed nimi nadal idą otwarte P0: autosave (#2), podwójna nawigacja klawiaturą (#3), wersje w `localStorage` bez `try/catch` (#8), paleta poleceń (#5, #6), checklisty w wyszukiwarce (#7), nowa notatka w bieżącym folderze (#9).

| # | Funkcja | Nakład | Wartość | Gdzie się wpina |
|---|---|---|---|---|
| ~~F1~~ ✅ | Eksport terminów do `.ics` (`VALARM` + `RRULE`) — kalendarz systemowy dostarcza powiadomienia przy zamkniętej aplikacji | S | wysoka | nowy `lib/icsExport.ts`, `DayPanel`, `ReminderCalendarView` |
| F2 | Import z Google Keep (Takeout) i folderu Markdown z frontmatterem | M | wysoka | `lib/importers/{keep,markdown}.ts`, `BackupSettings.tsx`, `noteSchema.ts` |
| F3 | Przypomnienie „zrobione” (`reminderDoneAt`, w serii = przesunięcie na kolejne) | S–M | średnia | `yjsStore.ts` (pole skalarne), `DayPanel`, `ReminderToast.tsx`, `achievements.ts` |
| F4 | Plakietka z liczbą zaległych terminów (`navigator.setAppBadge`) | S | średnia | `useReminderNotifications.ts` |
| F5 | Zapisane wyszukiwania w pasku bocznym | S | średnia | `persistedStore.ts`, pasek boczny, `searchNotes.ts` |
| F6 | Dyktowanie (Web Speech API, opt-in — w Chrome to serwery Google) | S | średnia | `AddNoteBar.tsx`, `useDictation.ts` |
| F7 | Scalanie zaznaczonych notatek z „Cofnij” | S | średnia | `BulkActionBar.tsx`, `lib/mergeNotes.ts` |
| F8 | Zmiana tytułu przepina `[[linki]]` | S | średnia | `lib/wikiLinks.ts` (`renameLinkTargets`) |
| F9 | Udostępnianie notatki linkiem (treść skompresowana w `#fragmencie`) | M | średnia | `ShareNote.tsx`, parametry URL w `Index.tsx` |
| F10 | Tygodniowy przegląd zamiast nudge'a co 6 h | M | średnia | `useDailyWeeklyNudges.tsx`, `dateRanges.ts` |
| F11 | Graf powiązań wikilinków | M | niska–średnia | nowy widok pod `lazy()`, `wikiLinks.ts` |
| F12 | Wklejanie obrazu ze schowka + aparat (`capture`) ze skalowaniem do 2 MB | S | średnia | `AddNoteBar.tsx`, `NoteCard.tsx` |

**Fala 1 — szybkie wygrane:** F1 (a: `icsExport.ts` + testy RRULE/DST; b: przycisk w panelu dnia; c: eksport miesiąca; d: e2e z pobraniem) → F12 (wklejanie → `capture` → skalowanie) → F4 → F7 (czysta `mergeNotes` z testami → akcja w pasku zaznaczenia). Równolegle P0 #3, #5, #6, #7, #9.

**Fala 2 — główne (po autosave i edytorze):** F2 (parser Keep z testami → podgląd importu z wykrywaniem duplikatów, bez `replaceAll` → Markdown → folder i obrazy), F3 (pole + schemat/backup → akcje → statystyki), F8 (po edytorze na `Y.Text`), F5 (po wyszukiwaniu globalnym), F6.

**Fala 3 — później:** F9 (po stanie widoku w URL), F10 (domyślnie wyłączony), F11 (gdy po autouzupełnianiu `[[` przybędzie linków).

Świadomie pominięte: szyfrowanie/blokada notatek, wiele terminów na notatkę, notatki audio i OCR, web clipper (wymaga serwera), edytor szablonów.

### F1 — eksport `.ics` wykonany (2026-09-27)

- `src/lib/icsExport.ts`: `buildIcs` (RFC 5545: CRLF, zawijanie linii po 75 bajtach UTF-8 bez cięcia znaków, ucieczka `\ ; ,` i nowych linii), `UID = <id notatki>@notatnik` — ponowny import aktualizuje wpis zamiast dublować. `VALARM` w chwili terminu, zdarzenie 15 min. Czas „pływający” (bez `Z`/`TZID`) — ta sama godzina ścienna co w aplikacji, także po zmianie czasu. Serie → `RRULE:FREQ=DAILY|WEEKLY|MONTHLY`. `exportableReminders`: przyszłe terminy + serie, bez kosza. 10 testów.
- UI: przycisk pobrania przy każdym zapisanym terminie w panelu dnia; „.ics” w nagłówku kalendarza eksportuje wszystkie nadchodzące. Test e2e sprawdza oba pobrania i treść pliku.
- ~~Znana różnica: seria `monthly` od 31. dnia~~ — ✅ usunięta 2026-09-29 (`68ecfc1`): aplikacja i `RRULE` zgodnie dają ostatni dzień krótszego miesiąca.

## Audyt UI/UX i layoutu — plan upiększenia (2026-09-27)

Audyt agentowy: kod + zrzuty Playwright 1440/768/375, jasny i ciemny motyw (Ustawień nie udało się sfotografować — do ręcznego przeglądu). Sprawdzone w kodzie: siatka to `grid-cols-*` (nie masonry), 79 użyć `text-[9–11px]`, `--muted-foreground` 50%/55%.

**Główne problemy:** (1) za dużo efektów tła naraz — aurora + 3 blooms + glow + shine + sezonowe; (2) 94 `whileHover`/`whileTap`, m.in. skalowanie każdej ikony akcji karty; (3) zbyt mała typografia (`text-[9–11px]`) i `muted-foreground` ~4.3:1 — poniżej AA; (4) hierarchia Notatek: cytat dnia nad paskiem dodawania, szablony z ikoną **i** emoji, dwa konkurujące nagłówki; (5) przeładowany sidebar (statystyki + 6 widoków + foldery + 7 akcji, niespójny rytm, podwójny stan aktywny); (6) karty: zawsze widoczny pasek 6 akcji, dziury w siatce, ~170 px na jedną linijkę na mobile; (7) pusty stan z uciętym wordmarkiem i podpowiedzią Konami, ciemny `--destructive` o słabym kontraście, `--sidebar-*` z domyślnego shadcn.

**Faza 1 — fundament (tokeny, typografia, spacing)** — ✅ zrobione 2026-09-27. Kontrast policzony wzorem WCAG: `muted-foreground` ≥4.6:1 na tle/karcie/muted/kolorowych notatkach w jasnym, ≥5.4:1 na neutralnych tłach w ciemnym (na ciemnych kolorowych notatkach ~3.7:1 — do Fazy 2). `destructive` 0 72% 51% w obu motywach (biały tekst 4.8:1). `shadow-sm/md/lg/xl/2xl` zmapowane w `tailwind.config.ts` na `--elevation-1..3`, więc także komponenty shadcn używają jednego systemu; kolorowa poświata FAB zostaje celowo. `text-[9/10px]` → `text-2xs` (11/16), `text-[11px]` → `text-xs`; `leading-relaxed` w treści, `leading-tight` w tytułach kart. Pozycje nawigacji `h-9 rounded-lg`, jeden rytm w obu grupach. Axe nie był uruchamiany — kontrast liczony skryptem, test 320 px bez przewijania w bok zielony. **Otwarte i poza fazą:** biały tekst na `--primary` (pomarańcz 25 95% 53%) ma tylko 2.8:1 — to kolor marki, decyzja do właściciela (ciemniejszy odcień przycisków albo ciemny tekst).

- [x] `--muted-foreground` 42% (jasny) / 64% (ciemny); ciemny `--destructive: 0 72% 51%`; `--sidebar-*` z tokenów aplikacji. **S**
- [x] Skala tekstu: zakaz `text-[9px]`, `text-[10/11px]` → `text-xs`; token `2xs` (11/16) tylko dla badge; `leading-relaxed` treść, `leading-tight` tytuły. **M**
- [x] `--radius: 0.75rem` + reguła: karty `rounded-xl`, kontrolki `rounded-lg`, `rounded-full` tylko badge/FAB/avatar. **M**
- [x] Przywrócić `--elevation-1/2/3` zamiast `.note-shadow*`, `.header-glow` i arbitralnych `shadow-[...]` (zmiana decyzji z 2026-09-25 — dziś cienie są niespójne). **S**
- [x] Spacing 4/8, jedna wysokość pozycji nawigacji (`h-9`); weryfikacja AA (axe) w obu motywach. **S**

**Faza 2 — komponenty** — ✅ w większości zrobione 2026-09-27
- [x] `NoteCard`: akcje ukryte do najechania/fokusu tylko na urządzeniach z hoverem (`@media (hover: hover)` w klasie `.card-actions`; wcześniej `md:opacity-0` było martwe, bo `animate={{opacity:1}}` framer-motion wstawiał styl inline). Na dotyku widoczne, cele 44 px (`.card-action`, `pointer: coarse`). Akcje zostają widoczne przy otwartym kolorze/„więcej” (`data-open`). Bez skalowania ikon przy hoverze (też w `ReminderPicker`/`PriorityPicker`). Meta bez `/60`. Karta `rounded-xl`. W ciemnym motywie na kolorowych notatkach `--muted-foreground: 220 10% 74%` (atrybut `data-note-color`).
- [x] **Na dotyku menu „⋯” zamiast paska ikon** — ✅ 2026-09-28: przy `pointer: coarse` stopka kafla ma sam „⋯” (`aria-expanded`); dotknięcie odsłania główne akcje i rząd dodatkowych. Główne akcje w `.card-primary` (`display: contents`, na dotyku ukryte bez `data-more`), więc pickery przypomnienia/priorytetu/etykiet działają bez zmian. Z myszą bez zmian. e2e w `mobile.spec.ts`.
- [x] ✅ 2026-10-09: mozaika na siatce CSS z wierszami po 4 px i `grid-row-end: span N` (`useMasonrySpans`, jeden ResizeObserver) — jeden rodzic, kolejność w DOM = kolejność notatek, więc dnd-kit, `layout` i strzałki działają; e2e `masonry.spec.ts`. Było: `NoteGrid` masonry — **świadomie odłożone**: `columns-*` łamie dnd-kit (reorder), `framer-motion layout` i nawigację po `data-note-idx`. Wymaga osobnego spike'u z przeciąganiem.
- [x] `AppSidebar`: bez kafli statystyk (propsy `totalNotes`/`remindersCount` usunięte), jeden styl aktywnej pozycji (sama pigułka `bg-primary/10`, bez paska z lewej), bez `whileHover`; akcje drugorzędne (Ostatnie akcje, Statystyki, Tryb skupienia, Samouczek) w zwijanej grupie „Narzędzia” (nie „Więcej” — kolidowało z przyciskiem „Więcej” dolnej nawigacji w e2e); usunięta zdublowana podpowiedź skrótów.
- [x] `AppHeader`: tytuł jednokolorowy; przełącznik motywu ukryty poniżej `sm` i przeniesiony do arkusza „Więcej” w `BottomNav` (nowe propsy `dark`/`onToggleTheme`); bez skalowania przycisków.
- [x] `DailyQuote`: z banera nad polem dodawania na cichy dopisek pod siatką (tylko widok Notatki, gdy są notatki i nie ma wyszukiwania). `QuickTemplates`: sama ikona (emoji zdjęte z etykiety), `rounded-lg`, fade na prawej krawędzi poniżej `sm`, bez skalowania.
- [x] `EmptyState`: bez `gradient-text` i ✨, bez podpowiedzi Konami. **„Ucięty wordmark” z audytu to nie błąd** — zrzuty robione po 2,5 s, a animacja pisania trwa 3,1 s.
- [x] Kalendarz: dni spoza miesiąca `text-muted-foreground/70` (bez dodatkowego `opacity-60`), w ciemnym motywie komórki bez obramowań (`dark:bg-card/60`), ściągawka skrótów jako ikona z `title` + `sr-only`.
- [x] Ręczny przegląd dialogu Ustawień — ✅ 2026-09-28: zrzuty wszystkich zakładek, desktop w obu motywach i telefon. Poprawione: „MOŻE” wersalikami, opis auto-backupu wskazywał plik „niżej” (wybór jest wyżej), przycięty pierścień zaznaczenia koloru przy lewej krawędzi. Reszta z audytu na zrzutach (wysokość, dotyk, Sync) zrobiona wcześniej tego dnia.
- Zweryfikowane: typecheck, lint (0 błędów), 250 testów jednostkowych, 22/22 e2e, build. Jeden przebieg e2e dał losowy pad (przy ponownym uruchomieniu zielono) — warto obserwować.

**Uwaga do dalszej pracy nad UI (życzenie właściciela, 2026-09-27):** kolejne zmiany wizualne (reszta Fazy 2, Faza 3, decyzja o kolorze `--primary`) robić z użyciem skilla **`frontend-design`**.

**Decyzja (2026-09-27):** ciemny tekst na `--primary` — `--primary-foreground: 220 25% 10%`, kontrast szacunkowo ok. 5:1 (niebieski, róż) do ok. 7:1 (pomarańcz), czyli AA.

**Faza 3 — dopieszczenie i ruch, ~1 dzień**
- [x] Budżet ruchu: `whileHover` tylko FAB/CTA (maks. `scale: 1.03`), wejścia kart fade 150–200 ms, stagger ≤ 30 ms. **S**
- [x] Aurora/blooms domyślnie statyczne i przygaszone (opacity ~0.35 / 0.25), animacja jako opcja; usunąć `card-shine`. **S**
- [x] Jednolite `focus-visible:ring-2 ring-ring ring-offset-2` na przyciskach-ikonach. **S**
- [x] Wyciszyć gamifikację w głównym widoku (emoji w nagłówkach, niespodzianki) — do Statystyk. **S**
- [x] Zrzuty przed/po tym samym skryptem (`node scripts/screenshots.mjs <url> <katalog>`). **S**

## Audyt UI/UX na zrzutach — 2026-09-28

Zrzuty wszystkich widoków: telefon 390 px (dotyk) i desktop 1440 px, jasny i ciemny, na danych testowych (10 notatek: lista, przypomnienia, seria, etykiety, archiwum, kosz). Naprawione od razu:

- [x] **Ustawienia nie otwierały się na telefonie.** `SettingsDialog` był zamontowany wewnątrz `AppSidebar`, a pasek istnieje tylko gdy jest otwarty — kafel „Ustawienia” w „Więcej” i akcja z palety przy zwiniętym pasku nie robiły nic. Okno przeniesione do `Index`. e2e `mobile.spec.ts`.
- [x] **Zakładki Ustawień na telefonie były same ikony** (bez nazwy dostępnej). Teraz na telefonie same nazwy, ikony od `sm`.
- [x] **„Czas na backup” na pustej appce** — toast 3,5 s po pierwszym uruchomieniu, bez żadnej notatki. Pomijany przy pustej bazie.

Do zrobienia (od najważniejszych):

- [x] **Edycja w kaflu pokazuje 1–2 linie tekstu.** Textarea ma stałe `min-h` bez auto-wysokości — przy dłuższej notatce edytuje się „przez szparę” (desktop i telefon). Auto-grow do rozsądnego maksimum. **S** — ✅ 2026-09-28: `useLayoutEffect` w `NoteCard` dopasowuje wysokość do treści, maks. 60% ekranu.
- [x] **Pełnoekranowy edytor na telefonie nie jest pełnoekranowy** — marginesy, pod spodem widać dolną nawigację i kafle. Na `< sm` edge-to-edge (`100dvh`), z uwzględnieniem klawiatury ekranowej. **S** — ✅ 2026-09-28: na `< sm` `100dvh`, bez ramki i zaokrągleń, `safe-area-inset-top`. Klawiatura ekranowa nie sprawdzona na realnym telefonie.
- [x] **Toasty na telefonie zasłaniają dolną nawigację i FAB** (także odznaki i „Czas na backup”). Offset nad `nav` + safe-area. **S** — ✅ 2026-09-28: `index.css`, `bottom: 88px + safe-area` do 767 px (`mobileOffset` Sonnera działa tylko do 600 px). Przycisk akcji w toaście w kolorze marki (wcześniej czarny).
- [x] **Checkbox w podglądzie listy na kaflu** — zaznaczony wygląda jak radio (kropka zamiast ✓), cel 14 px na dotyku, brak `role="checkbox"`/`aria-checked`/etykiety, przekreślony tekst `/40` prawie niewidoczny. **S** — ✅ 2026-09-28: wspólny `CheckMark` (✓ na wypełnionym polu) w podglądzie i edytorze listy; w podglądzie cały wiersz jest `role="checkbox"` z `aria-checked`, w edytorze etykiety „Odhacz/Odznacz: …”; przekreślony tekst `text-muted-foreground`.
- [x] **Odznaki jako toasty w trakcie pracy** („Pierwszy krok”, „Porządkowicz” — po imporcie kilka naraz, stosem). Zgodnie z fazą 3 audytu: odznaki tylko w Statystykach, ewentualnie jeden dyskretny toast dla rzadkich. **S** — ✅ 2026-09-28: jeden toast na paczkę (`id: "achievements"`, podmieniany zamiast piętrzenia), „Nowe odznaki: N” z listą i akcją „Zobacz” → Statystyki, 4 s.
- [x] **Akcent palety poleceń jest różowy** (`--accent`?) zamiast pomarańczu marki — jedyne miejsce w tym kolorze. **S** — ✅ 2026-09-28: to był `bg-accent` w komponentach shadcn, a `--accent` jest tu dekoracyjnym różem. `button` (ghost/outline), `dropdown-menu`, `command`, `calendar`, `dialog` → `bg-muted`/`text-foreground`. Róż zostaje w tłach i gradientach.
- [x] **Kropka przypięcia na kaflu** — dubluje sekcję „Przypięte” i wypełnioną pinezkę; wygląda jak „nieprzeczytane”. Usunąć. **S** — ✅ 2026-09-28: usunięta.
- [x] **„· 28 wrz” z wiszącą kropką** w stopce kafla, gdy nie ma liczby słów (notatka-lista). **S** — ✅ 2026-09-28: separator tylko, gdy przed datą coś stoi.
- [x] **Composer na telefonie** — kolory łamią się w dwa rzędy, „Zamknij” wisi w połowie wysokości, ikony pod spodem. Kolory w jednym przewijanym rzędzie, akcje w jednym pasku. **S–M** — ✅ 2026-09-28: kolory w jednym rzędzie (przewijanym na wąskim ekranie), pod nimi narzędzia z „Zamknij” po prawej — dwa rzędy także na desktopie, bo w jednym się nie mieściły. Kolory mają `aria-label`/`aria-pressed`.
- [x] **Przełącznik paska bocznego to strzałka `<`/`>`** — wygląda jak „wstecz”. Ikona panelu (`PanelLeft`) z etykietą. **S** — ✅ 2026-09-28: `PanelLeftClose`/`PanelLeftOpen` w `AppHeader`; etykieta i tooltip „Schowaj/Pokaż panel” były już wcześniej.
- [x] **Kalendarz na telefonie: dwie ikony obok tytułu** (logo + ikona kalendarza); inne widoki mają jedną. **S** — ✅ 2026-09-28: ikony zdjęte z tytułów „Dziś”, „Ten tydzień” i „Kalendarz” (nazwa widoku wystarcza); folder i etykieta zostają z ikoną, bo mówi o typie.
- [x] **Plakietka „1” na Archiwum w dolnej nawigacji** — wygląda jak powiadomienie, a to licznik archiwum. Liczniki tylko tam, gdzie wymagają uwagi (Kosz ma sens w „Więcej”, Archiwum nie). **S** — ✅ 2026-09-28: licznik Archiwum usunięty z dolnej nawigacji (prop `archiveCount` wyrzucony); Kosz w „Więcej” zostaje z licznikiem.
- [x] **„⌘K” przy palecie w pasku na Windowsie** — lista skrótów w Ustawieniach pokazuje „Ctrl/⌘”, pasek sam „⌘K”. Zależnie od platformy. **S** — ✅ 2026-09-28: `lib/platform.ts` (`MOD_KEY`, `modShortcut`) — „⌘K” na Macu/iOS, „Ctrl+K” gdzie indziej; podpięte w pasku, pustym stanie, palecie, oknie skrótów i Ustawienia → Ogólne. Obsługa klawiszy bez zmian (Ctrl i ⌘ działały już wszędzie).
- [x] **Ustawienia na telefonie:** okno zmienia wysokość przy każdej zakładce (skacze), lista skrótów klawiszowych i „Przechył kafli… za kursorem” pokazywane na dotyku, placeholder kodu w Sync ucięty (monospace z szerokim trackingiem), blok „Jak to działa” to ściana tekstu. Na telefonie pełnowysokościowy arkusz; skróty i tilt ukryte przy `pointer: coarse`. **M** — częściowo 2026-09-28: okno ma stałą wysokość (na telefonie cały ekran `100dvh` z safe-area, na desktopie `min(88vh, 44rem)`), więc już nie skacze; e2e w `mobile.spec.ts`. Reszta też zrobiona: lista skrótów i „Przechył kafli” ukryte przy `pointer: coarse`, placeholder kodu bez monospace i rozstrzelenia, „Jak to działa” jako 4 krótkie punkty.
- [x] **Teksty:** „Poproś przeglądarkę o trwały storage” (→ „o trwałe przechowywanie”), „Jeszcze nie zrobiłeś backupu” (forma męska → „Nie ma jeszcze backupu”), „Masonry” (→ „Kafelki”/„Mozaika”). Przypomnienie na dziś jako „dziś, 19:10” zamiast „28 wrz, 19:10”. **S** — ✅ 2026-09-28: „trwałe przechowywanie”, „Nie ma jeszcze backupu.”, „Mozaika” (Ustawienia i menu widoku). `formatReminderShort` w `reminderTime.ts` — „dziś/jutro/wczoraj, HH:mm”, dalej data; w podpisie przypomnienia na kaflu i w pasku dodawania. Test jednostkowy.
- [x] **Niespójny wybór w Ustawieniach → Wygląd** — „Motyw” zaznacza białą kartą, pozostałe grupy pomarańczową ramką. Jeden styl. **S** — ✅ 2026-09-28: „Motyw” ma teraz ten sam styl co reszta (ramka `border-primary`, tło `primary/10`), bez przesuwanej pigułki.
- [x] **Uchwyt przeciągania nachodzi na tytuł w trybie edycji kafla** (kropki „⠿” na pierwszej literze). **S** — ✅ 2026-09-28: na zrzucie nachodził też przy zwykłym najechaniu. Uchwyt jest teraz poziomy (3×2 kropki) na środku górnej krawędzi, z etykietą „Przeciągnij, aby zmienić kolejność”, i schowany w trybie edycji.
- [x] **Dwa toasty o backupie w pierwszej sesji** (auto-backup i przypomnienie) i tekst „Minęło 7 dni od ostatniego”, gdy backupu nigdy nie było. — ✅ 2026-09-28: przypomnienie pomijane, gdy auto-backup już poprosił w tej sesji; tekst „Nie masz jeszcze kopii zapasowej” przy braku backupu.

## Plan upiększenia: menu, przyciski, animacje — 2026-10-04

Kierunek „notes przy barze”: sygnaturą jest **dociśnięcie zamiast skalowania** (wciśnięty przycisk zjeżdża o 1 px, ciemnieje ~5% i dostaje wewnętrzny cień, jak klawisz kasy). Ruch krótki, „osiada” bez odbić (ease-out-quint). Aktywna pozycja nawigacji to pomarańczowa pigułka, reszta cicha.

Znaleziska, które to uzasadniają: brak tokenów ruchu (ok. 10 różnych sprężyn, sheet 500 ms wobec dialogu 200 ms), 46 ręcznych `whileTap` ze skalą 0.85–0.98, ok. 120 surowych `<button>` z własnymi klasami, cele dotykowe 16–32 px (nagłówek, `AddNoteBar`, akcje folderów), ikony w 5 rozmiarach, podwójny stan aktywny folderów/etykiet (pigułka + cień + ramka), wiersze folderów/etykiet `role="button"` bez klawiatury, nieskończony puls FAB (mruga też przy reduced-motion), `transition-all` na `NoteCard`.

- [x] **Runda 1 — tokeny** (✅ 2026-10-04) (`index.css`, `tailwind.config.ts`, `src/lib/motion.ts`): czasy `--dur-press 90ms / --dur-fast 150ms / --dur-base 220ms / --dur-slow 320ms`, krzywe `--ease-out cubic-bezier(.22,1,.36,1)`, `--ease-in`, `--ease-std`; `spring.snap {500,38}`, `spring.soft {320,30}`, `tween.enter`; `--elevation-up`, `--glow-primary`. Bez widocznych zmian.
- [x] **Runda 2 — komponenty `ui`** (✅ 2026-10-04): button (stan wciśnięcia, rozmiary `icon-sm` 32 / `icon` 36, min. 44 px przy `pointer: coarse`), dropdown/popover/command `rounded-xl` + pozycje `rounded-sm`, dialog/sheet (220/165 ms, overlay `bg-foreground/30`, dialog fade + scale .97 zamiast wjazdu od 48%, „Zamknij” zamiast „Close”, `focus-visible`), sonner.
- [x] **Runda 3 — `IconButton` + `.pressable`** (✅ 2026-10-04; cele w nagłówku na dotyku 36 px, nie 44 — inaczej 320 px wystaje o 8 px): migracja `AppHeader`, `ViewControls`, `AddNoteBar`, `BulkActionBar`; usunięcie `whileTap` (framer tylko na FAB). Ryzyko: selektory e2e.
- [x] **Runda 4 — pasek boczny** (✅ 2026-10-04; e2e 43/43): `SidebarRow` zamiast 8 skopiowanych wierszy, jeden stan aktywny, klawiatura + `group-focus-within`, bez kaskady wejścia, szerokość animowana przy otwieraniu i zamykaniu.
  - Zrobione: `sidebar/SidebarRow.tsx` (wiersz = prawdziwy `<button>`, wspólna pigułka `layoutId` dla widoków/etykiet/folderów, `coarse:h-11`), nawigacja/etykiety/foldery/stopka na nim, bez kaskady wejścia, overlay bez blur, desktop animuje `width`, telefon `x`; akcje folderu/etykiety w menu „⋯” (`SidebarRowMenu`, 5 ikon nie mieściło się — nazwy ucinało do „Pr…”), „Nowy folder” na `IconButton`. Lint/tsc/vitest zielone (przed menu „⋯”).
  - Na później: zrzuty z otwartym menu „⋯”, `InstallAppButton` (wariant `row`) pod `SidebarRow`.
- [x] **Runda 5 — BottomNav i „Więcej”** (✅ 2026-10-04; e2e 43/43, bez zrzutów): `aria-current`, bez pulsu FAB, mocniejsza aktywna pozycja, arkusz w grupach „Przejdź do” / „Narzędzia”, uchwyt.
- [x] **Runda 6 — kafle** (✅ 2026-10-04; e2e 43/43; „fade przy zmianie widoku” = zmiana układu lista/siatka/mozaika): `transition-[box-shadow,border-color]` zamiast `transition-all`, spójne promienie (wrapper, tła przesunięcia, `.note-flash`), „uniesienie” przy przeciąganiu (bez skali — transform należy do dnd-kit), fade przy zmianie widoku.

Nie robimy: masonry, skali przy przeciąganiu, `backdrop-blur` na overlayach, View Transitions API, powrotu `whileHover` na ikonach, animowania `width`/`height` list kafli, drugiego mechanizmu reduced-motion (obecny działa), zmiany `--primary`.

## Plan dopracowania UI — 2026-10-09

Zrzuty wszystkich widoków (390/1440 px, jasny/ciemny, realistyczne dane). Robione po kolei, z `frontend-design`.

**Faza 0 — błędy widoczne gołym okiem**
- [x] 1. Ściśnięte spacje w kroju tytułów (Plus Jakarta Sans: spacja 0,17 em → „Spotkanie zzespołem”). `word-spacing` dla `.font-display`/h1–h6. **S**
- [x] 2. Stopka kafla na telefonie łamie się na 3 linie („9 / słów · ~1 / min”) obok „⋯”. **S** — ✅ liczba słów tylko w czytniku, stopka w jednej linii.
- [x] 3. „Przypomnie…” ucięte w dolnej nawigacji przy 390 px. **S** — ✅ nazwa bez zmian, podpis bez ucinania (obok wąskie „Więcej” i FAB).
- [x] 4. Dwa kafle z pomarańczową obwódką naraz (zaznaczenie + fokus klawiatury?). **S** — ✅ to był link zwrotny: fokus siatki zostawał na kaflu z linkiem; `revealNote` przenosi go na cel.
- [x] 5. Święto spoza miesiąca w Grafiku nieczytelne w ciemnym motywie. **S**

**Faza 1 — lżejsze Notatki**
- [x] 6. Na kaflu tylko data; liczba słów i „Linkują tu” do czytnika. **S** — ✅ linki zwrotne w jednej linii (1 + „+N”), etykieta tylko dla czytników ekranu.
- [x] 7. Przypomnienie i priorytet w jednym rzędzie na telefonie. **S**
- [x] 8. Ciemny motyw: kolory notatek jako delikatny odcień + kolorowy pasek zamiast „brudnych” teł. **M** — ✅ `--note-ink`, próbki koloru (`data-swatch`) w kolorze paska.
- [x] 9. Telefon: ~380 px nad pierwszą notatką. **S** — ✅ ikona w nagłówku to Import/Eksport, nie instalacja (błąd audytu). Zamiast tego na telefonie schowany zwinięty pasek „Zapisz notatkę…” — dublował „+” z dolnej nawigacji.
- [x] 10. Composer: 5 rzędów kontrolek → stopniowe odsłanianie (kolory pod ikoną palety, szablony w pustym polu, ikony formatowania). **M** — ✅ formatowanie ikonami (też w edytorze kafla), lista i paleta w rzędzie narzędzi, kolor barwi edytor, podpowiedź „Treść notatki...”.

**Faza 2 — Grafik**
- [x] 11. Ustawienia z podsumowania do okna „Ustawienia grafiku”. **M** — ✅ `ShiftSettingsDialog`, w podsumowaniu jedna linia z bieżącymi ustawieniami i „Zmień”; fokus na okno (bez klawiatury na telefonie).
- [x] 12. Tekst prawny jako zwijane „Jak liczymy?” w punktach. **S** — ✅ w oknie ustawień.
- [x] 13. Natywne `<select>` → komponent aplikacji. **M** — ✅ zamiast nowego komponentu: pola jedno pod drugim (etykieta nad polem) i `color-scheme: dark`, więc natywne listy są ciemne w ciemnym motywie.
- [x] 14. „Kliknij” na komputerze, urlop pełnym tłem zamiast przerywanej ramki, nadgodziny w kolorze marki zamiast różu. **S**
- [x] 15. Pasek pędzli na telefonie mieści 1,5 rodzaju — kompaktowe pędzle. **M** — ✅ poniżej 640 px sam skrót (nazwa `sr-only`), ołówek tylko przy wybranym; mieści się ok. 3,5 rodzaju. Przy okazji: `sr-only` bez `relative` poszerzało stronę do 581 px.

**Faza 3 — spójność**
- [x] 16. Jeden wygląd siatki miesiąca (Kalendarz i Grafik). **M** — ✅ `calendar/dayCellStyles.ts`; Kalendarz dostał weekendy w kolorze marki i święta (nazwa od `sm`, kropka na telefonie, w `aria-label`).
- [x] 17. Stały układ nagłówka między widokami. **S** — ✅ wyszukiwarka schowana też w Kalendarzu (nic tam nie filtrowała); podpis z liczbą tylko przy listach notatek.
- [x] 18. Rola kolorów: pomarańcz = akcja, czerwony = pilne, róż tylko dekoracja; plama poświaty na pustych widokach. **S** — ✅ róż został tylko w tłach/gradientach (nadgodziny przeszły na pomarańcz w pkt 14); środkowa poświata wyłączona w trybie statycznym.

**Faza 4 — opcjonalnie**
- [x] 19. Podsumowanie Grafiku jako rachunek z baru (kropki prowadzące, cyfry o stałej szerokości, „Razem brutto”). **M** — ✅ `Receipt` w `ShiftSummary`: pozycje rodzajów z kwotą (stawka rodzaju albo domyślna), urlop „—”, „Dodatek za nadgodziny” = zarobek − podstawa, „Razem brutto” pod podwójną kreską, ząbkowana krawędź (maska `.receipt`). Bez stawki same godziny. Zarobek zniknął z nagłówka podsumowania (jest w rachunku).

## Animacje i przejścia — 2026-10-09

Wszystko na istniejących tokenach (`--dur-*`, `--ease-*`, `lib/motion.ts`), tylko `transform`/`opacity` (wyjątek opisany przy odhaczaniu), bez pętli, reduced motion przez `html[data-motion]` / MotionConfig.

- [x] Przejście między widokami (także folder/etykieta): treść osiada fade'em z 6 px, 220 ms ease-out-quint, przez Web Animations API bez przemontowania — szkic w pasku nowej notatki zostaje, pole wyszukiwania stoi (`playEnter` w `lib/motion.ts`). Wejście Kalendarza i paska nowej notatki na tych samych wartościach.
- [x] Zmiana miesiąca w Kalendarzu i Grafiku: siatka wjeżdża 12 px od strony nawigacji (dalej z prawej, wstecz z lewej), 220 ms (`useMonthDirection`, `.month-in-*`).
- [x] Czytnik notatki rośnie z kafla i do niego wraca (origin transformacji w środku kafla, skala 0.94 → 1); sprężyna z przestrzeleniem zastąpiona tokenami 220/150 ms.
- [x] Odhaczanie: ptaszek się rysuje, kreska przesuwa się przez tekst (każda linia osobno). Świadomy wyjątek: `stroke-dashoffset` i `background-size` jednego wiersza — malowanie małego prostokąta, gra tylko przy zmianie.
- [x] Kafle: wyjście gaśnie z dociśnięciem o 2 px zamiast `scale 0.98`; stagger wejścia ≤ 6 kroków po 30 ms; opóźnienie staggeru nie obejmuje już `layout` (wcześniej po dodaniu/usunięciu notatki kafle dojeżdżały falą do 360 ms).
- [x] AlertDialog z tym samym ruchem co Dialog (220/150 ms, skala 0.97).

Odrzucone:
- Rozwijanie paska nowej notatki „bez skoku” — `layout` framer-motion skaluje zawartość podczas zmiany wysokości, a poprawka wymaga animowania wysokości albo przebudowy edytora; zysk mały wobec ryzyka dla szkicu i fokusu.
- Wspólny `layoutId` kafel ↔ czytnik — gryzie się z transformami dnd-kit i mierzy kartę przy każdym otwarciu; origin od kafla daje kierunek za ułamek kosztu.
- Crossfade starego i nowego widoku — wymagałby trzymania starej treści (150 kart) w DOM przez czas wyjścia.
- Osobne animacje BottomNav/paska bocznego/toastów — już spójne (spring.snap/soft, sonner), dokładanie efektów rozproszyłoby uwagę.
- Kolor tła AlertDialog (`bg-black/80` vs `bg-foreground/30` w Dialog) — to zmiana wyglądu, nie ruchu; do decyzji.

## Upiększenie kafli notatek — 2026-10-09

- [x] Zwartsze kafle: treść 4 linie (telefon 3), etykiety/termin/priorytet w jednym rzędzie, 4 pozycje listy. Suma wysokości 8 kart −12% (komputer), −17% (telefon).
- [x] Jasne notatki jak ciemne: lekki odcień + kolorowy pasek u góry (`--note-ink` w obu motywach); próbki koloru w kolorze paska.
- [x] Etykiety na kaflu jako cichy `#dom` (pigułki z usuwaniem zostają w edytorze).
- [x] Postęp listy „2/5” obok tytułu zamiast paska pod listą (bez tytułu — pasek zostaje).
- [x] Pasek akcji po najechaniu wtapia się w kartę (maska zamiast cienia), przezroczysta część nie łapie kliknięć.
- [x] Zdjęcia: poza edycją jedna miniatura 16:9 i „+N”.
- [x] Kolumny liczone od szerokości 13 rem (CSS `columns`/`auto-fill`), na telefonie zawsze 2. Treść ma `max-width`, więc na 1920 px dalej 5 kolumn.
- [ ] Hierarchia tytuł/treść — po zagęszczeniu czytelna, bez zmian.

**Decyzja (2026-10-09):** okna potwierdzeń (AlertDialog) zostają z mocno przyciemnionym tłem (`bg-black/80`), zwykłe okna z lżejszym (`bg-foreground/30`) — świadoma różnica, potwierdzenie ma się wyróżniać.

## Kierunek „zeszyt w kratkę przy barze” — 2026-10-09

- [x] Krok 1 (`6bce5ec`): tło w kratkę (`PaperBackdrop`, `--grid`) zamiast poświat, nagłówek i dolny pasek bez rozmycia, czerwony margines przy pasku bocznym (`--margin`), bursztyn zamiast orange-500, niebieski długopis zamiast różu (linki), ciepły ciemny motyw, pełne tło powierzchni. Porównania: `shots/zeszyt/porownanie-*.png` (lokalnie, `shots/` w .gitignore).
- [x] Krok 2 (`0ed08cf`): Plus Jakarta Sans w całej aplikacji (bez Inter), JetBrains Mono do cyfr w rachunku, treść do 88 rem, pole dodawania wyrównane do siatki.
- [x] Krok 3: liczniki w pasku bocznym tylko przy zaległych przypomnieniach i Koszu, papierowy (ciepły) cień kart, puste stany bez poświaty za odręcznym napisem.
- [x] Dalsze kroki (2026-10-09): Import i eksport w „Więcej” na telefonie (`ImportExportMenu`, ikona pliku zamiast strzałki jak „Zainstaluj”), pełne tło zaznaczonego dnia w Kalendarzu, puste widoki z rysunkiem długopisem (Notatki zostają przy napisie), sezony zmieniają tylko akcent — bursztyn marki przez cały rok.

## Przegląd na zrzutach — 2026-10-09 (po „zeszycie”)

- [x] Edycja notatki na telefonie od razu na pełnym ekranie (w wąskim kaflu ucinała tytuł, ikony w kolumnie); bez przycisku powrotu do kafla poniżej `sm`.
- [x] Edycja w kaflu na komputerze: formatowanie w jednym przewijanym rzędzie, licznik same słowa.
- [x] Okno dnia w Grafiku: „piątek, 9 października” tylko z wielką pierwszą literą (`first-letter:uppercase` zamiast `capitalize`).
- [x] Opis motywu sezonowego bez „tła”; czerwony licznik zaległych przypomnień.
- [x] Na prośbę: Grafik — „Budowa” 07–17 (10 h) i „Dniówka” 08–16 (skrót 8) jako rodzaje startowe, dokładane raz do istniejącego grafiku; pora nocna i doba niedzieli w zwiniętej sekcji „Opcjonalne”.

## Przegląd UX na zrzutach — 2026-10-09 (wieczór)

Zrzuty z realistycznymi danymi (12 notatek, grafik, zaległe przypomnienie), 1440 i 390 px, oba motywy — `shots/ux*` (lokalnie).

- [x] 1. Tytuł w edytorze ucięty od lewej (kafel, telefon), na telefonie pod ✕ — `TitleField` (zawijana textarea, Enter → treść). `635d275`
- [x] 2. Notatka z listą na pełnym ekranie: lista zaraz pod treścią, wypełnia okno. `98dabda`
- [x] 3. Mniej komunikatów na starcie: backup liczony od najstarszej notatki i 20 s zamiast „na zawsze”, bez dymka „działają offline”, baner instalacji od 3 notatek. `750dbf3`
- [x] 4. Przypomnienie w jednym rzędzie (Gotowe · Odłóż ▾ · Otwórz, termin zamiast „Czas na tę notatkę!”), na telefonie u góry. Przy okazji: dymki nad otwartym oknem były nieklikalne (także „Cofnij”) — naprawione w `index.css` i `ui/dialog.tsx`. `6d8d180`
- [x] Zrzuty po punktach 2–4 (`shots/ux2`) obejrzane — bez uwag.
- [x] 5. „+” na telefonie otwiera edytor na pełnym ekranie (portal w `AddNoteBar`).
- [x] 6. Edycja w kaflu na komputerze: kafel w edycji zajmuje dwie kolumny (`sm:has-[[data-tile-editing]]:col-span-2` w `NoteGrid`), poza układem listy i jedną kolumną.
- [x] 7. Kalendarz na telefonie: wysokie komórki z samą kropką, plan dnia pod zgięciem — niższe komórki.
- [x] 8. Pasek rodzajów zmian w Grafiku ucięty bez sygnału — zanikająca krawędź, na komputerze zawijanie.
- [x] 9. Drobne (czas czytania od 2 min, przewodnik „Zapisz notatkę…”; zostały samotny „Średni” i odznaka nad edytorem): „~1 min” na każdej krótkiej notatce (pokazywać od 2 min), samotny „Średni” w osobnym rzędzie, przewodnik mówi „pole Nowa notatka”, a pole to „Zapisz notatkę...”; odznaka „Pierwszy krok” też wyskakuje nad edytorem.
- [x] Resztki z 9: filtr priorytetu w siatce 3 kolumn (bez samotnego „Średni”), odznaka czeka, aż zamknie się otwarte okno.
- [x] Zmiany z Grafiku w Kalendarzu: skrót zmiany (kolor rodzaju) w komórce dnia, pełna zmiana z godzinami nad terminami w panelu dnia, w `aria-label` komórki. Bez osobnego widoku „Jutro”.

## Ruch, efekty i QoL — 2026-10-10

Zrobione przez agentów w osobnych worktree, scalone do master (445 testów jednostkowych, 86 e2e).

- [x] Mikrointerakcje: jedna reguła `.pressable`, przełączniki i checkbox z „rysowanym” ptaszkiem, obrót „+” w FAB, pasek czasu w toaście „Cofnij”.
- [x] Karty: kaskada wejścia (6 kart), wyjście do kosza/archiwum, pinezka, przeciąganie z uniesieniem, hover tylko myszą, pieczątka „gotowe” (`lib/cardMotion.ts`).
- [x] Grafik/Kalendarz: pieczątka zmiany, liczniki podsumowania, pasek „trwa teraz”, stagger kart dnia, odbicie po upuszczeniu terminu, „oddech” dnia dziś.
- [x] Efekty: pieczątka odznaki, rysowane puste stany, płynna zmiana motywu (View Transitions), nagroda za zamknięty dzień (klucze `badgeStamp`, `themeFade`, `doneReward`).
- [x] QoL: skróty `g` + litera, tytuł z domeny po wklejeniu URL, „Ostatnio szukane” w palecie.
- [x] Funkcje: „Dziś i jutro” w Kalendarzu, wieczorne przypomnienie o zmianie (ustawienie na urządzeniu), dni grafiku w palecie poleceń.

## Grafik i import — 2026-10-10 (druga runda agentów)

Scalone do master (519 testów jednostkowych, 103 e2e).

- [x] Licznik urlopu: roczny wymiar (domyślnie 20/26), wykorzystany/planowany/pozostały, rodzaj nieobecności (`absenceKind`), podsumowanie roku (`YearSummaryDialog`). ✅ 2026-10-10: licznik i podsumowanie roku liczą każdy dzień urlopu, także w weekend i święto (grafik zmianowy sam wyznacza dni pracy); wcześniej liczone jak norma (`isNormDay`).
- [x] Widok tygodnia w Grafiku (z terminami z Kalendarza), przenoszenie/kopiowanie zmian (mysz, Alt, dotyk, klawiatura), „skopiuj tydzień na następny”, pasek tygodnia w Kalendarzu.
- [x] Import z Google Keep (JSON/HTML/ZIP) i Markdown/Obsidian z podsumowaniem i „Cofnij”.
- [x] Poprawki z przeglądu na żywo: CLS od paska bocznego, zawijanie akcji kafla w wąskim oknie, skróty `g` po kliknięciu notatki.
- Nie przetestowane na żywo: ścieżka dotykowa przenoszenia zmian, import na prawdziwym Takeout.


## Dział Notatki — 2026-10-10 (trzecia runda agentów)

- [x] **Szybkie wprowadzanie** (`lib/quickCapture.ts`, `AddNoteBar`): `#etykieta`, `@folder`, `!`/`!!` (priorytet), fraza daty na końcu jako przypomnienie; wszystko jako chipy „Rozpoznane w tekście” z możliwością zignorowania. `Ctrl+Shift+L` zamienia zaznaczone linie na listę zadań. Tytuł będący samą frazą daty („Jutro”) ustawia przypomnienie — świadomie.
- [x] **Zapisane filtry** (`lib/searchQuery.ts`, `savedFilters.ts`): operatory `etykieta:`, `folder:`, `ma:`, `brak:przypomnienia`, `przypięte`, `lista:otwarte`, `starsze:`/`nowsze:`; sekcja „Filtry” w pasku bocznym, „Więcej” i palecie; podpowiedzi w SearchBar.
- [x] **Powiązania:** podgląd `[[linku]]` po najechaniu/fokusie/przytrzymaniu, „Niepołączone wzmianki” z przyciskiem „Połącz” (tylko czytnik), graf powiązań (Statystyki i paleta, limit 150 węzłów).
- [x] **Grupowanie:** wg daty/etykiety/folderu, zwijane sekcje, zwijane Przypięte (>3), sortowanie „Ostatnio otwierane” (`lastOpenedAt` w localStorage), `Ctrl+A`, przeciąganie zaznaczonych na folder.
- [x] **Przegląd tygodnia** w „Dziś” (`lib/weeklyReview.ts`): zaległe przypomnienia, listy do dokończenia, nietknięte ≥30 dni, do posegregowania; tryb „po kolei” (K/A/D).
- ✅ Przegląd wizualny 2026-10-10 (desktop 1440 i telefon 390): poprawione podpisy i szerokość wierszy karty przeglądu, zwarty graf dla małych zbiorów, pieczątka odznaki czeka na zamknięcie edytora (`data-composer-open`).
- Do sprawdzenia na żywo: glow przy przenoszeniu wielu notatek naraz, „Niepołączone wzmianki” tylko w czytniku (nie w rozwiniętej karcie), motyw ciemny nowych elementów.

## Załączniki i QoL — 2026-10-10 (czwarta runda agentów)

- [x] **Załączniki plików** (`lib/attachments.ts`, `AttachmentsPanel/List`): wspólny magazyn z obrazami (hash treści), `Note.attachments`, limity 10 MB / 100 MB / 20 plików, backup v3 (budżet 40 MB), P2P do 2 MB (większe lokalne, z adnotacją), eksport Markdown/HTML tylko z adnotacją. HTML/SVG/JS pobierane jako octet-stream. Punkty wpięcia dla szyfrowania: `addAttachmentFiles`, `readAttachment`, `syncableRefs()`, `collectAttachmentBlobs()`, `referencedImages()`.
- [x] **Edytor** (`lib/editorKeys.ts`): `Ctrl+B/I/K`, `Ctrl+Enter`, kontynuacja listy, `Tab`/`Shift+Tab`, `Alt+↑/↓`, `Shift+Alt+↓`; licznik słów/znaków/czasu czytania i zaznaczenia; haptyka (`lib/haptics.ts`, przełącznik w efektach). `Ctrl+K` w polu treści = link (zamiast palety).
- [x] **PWA i czas:** znaczek aplikacji + „(N) NOTKI” z liczbą zaległych, odświeżanie „dziś” po północy i po wznowieniu (`lib/dayClock.ts`), skróty ikony, Web Share Target (tekst i linki), Wake Lock w skupieniu i prezentacji, „Kopiuj jako Markdown/tekst” (czytnik, paleta).
- Do zrobienia: Share Target dla plików/obrazów (POST multipart), akcja „Kopiuj” w menu „⋯” kafla, refaktor `exportToMarkdown` na `noteToMarkdown`, prywatne notatki (blokada hasłem).

## Prywatne notatki — 2026-10-10

- [x] **Skarbiec** (`lib/vault.ts`, `lib/privateNotes.ts`): jedno hasło; PBKDF2-SHA-256 600 000 iteracji + sól 16 B → klucz opakowujący losowy klucz danych (AES-256-GCM, IV 12 B na zapis, AAD = id notatki, format `v1.<iv>.<ct>`). Kod awaryjny (opcjonalny, pokazywany raz). Klucz tylko w pamięci (`extractable: false`).
- [x] **Model**: `Note.locked` + `Note.vault`; w dokumencie zostają kolor, przypięcie, folder, daty, termin przypomnienia; tytuł/treść/lista/etykiety w szyfrogramie. Projekcja zablokowanej notatki jest pusta z konstrukcji — wyszukiwanie, graf, przegląd, eksport i backup nie mają czego wyciec. Jeden blok (LWW), bez Y.Text.
- [x] **UI**: kafel z kłódką (`LockedNoteTile`), `PrivateNoteGate` (jedyne miejsce z jawną treścią), dialogi ustawienia/odblokowania/zmiany hasła/kodu awaryjnego, Ustawienia → Ogólne → „Prywatne notatki” (z opisem, czego NIE chroni), paleta: „Zablokuj prywatne notatki teraz”.
- [x] **Auto-blokada**: 1/5/15/30 min lub nigdy, ukrycie karty > 1 min, ręczna (także we wszystkich kartach — BroadcastChannel).
- Decyzje: notatki z obrazami/załącznikami nie da się zablokować (pliki nie są szyfrowane); prywatne notatki nie biorą udziału w wyszukiwaniu/grafie/przeglądzie nawet po odblokowaniu; wersje (`versionsStore`) wyłączone dla prywatnych; po zablokowaniu dziennik y-indexeddb jest zagęszczany (jawny tekst sprzed blokady znika z IndexedDB tej przeglądarki).
- Do zrobienia: szyfrowanie bajtów załączników; czytnik/prezentacja odblokowanej notatki; wyszukiwanie po odblokowaniu (w pamięci); powiadomienie push bez treści.

## Audyt i rozszerzenia — 2026-10-10 (piąta runda)

- [x] **Grafik:** własne godziny pędzla (`BrushHours`), „Skończyłem teraz” w karcie bieżącej zmiany, karta czasu `.csv` (`lib/shifts/timesheet.ts`), alarm per rodzaj zmiany w `.ics` (`ShiftType.alarmMin`), komunikat dla czytnika po stuknięciu pędzlem.
- [x] **Powiadomienia:** wspólny helper `lib/systemNotification.ts`, przyciski „Odłóż 10 min” / „Gotowe” (SW → karta), wibracja, `requireInteraction`. Prawdziwy Web Push przy zamkniętej aplikacji nadal wymaga serwera VAPID.
- [x] **Wydajność:** indeks Fuse cache'owany per tablica notatek, stabilne sprawdzanie przypomnień i nudge'ów, timeout IndexedDB (8 s), leniwy renderer Markdown i rzadkie panele (główny pakiet 239 → 198 KB gzip).
- [x] **Bezpieczeństwo:** `npm audit fix`, nagłówki + CSP Report-Only (`netlify.toml`), walidacja URL w SW i `useViewRoute`, losowanie kodu parowania bez obciążenia, pominięcie notatek prywatnych w akcji „Gotowe”.
- [x] **Notatki:** wklejanie obrazu ze schowka w `AddNoteBar`, dyktowanie (Web Speech, zgoda przy pierwszym użyciu).
- Do zrobienia (z audytów): react-router 7 (podatności runtime), CSP w trybie egzekwowania po tygodniu bez zgłoszeń, walidacja metadanych skarbca i hasło ≥ 12 znaków, limity w schemacie backupu, ZIP z nakładającymi się wpisami, a11y Kalendarza (cele dotykowe, radiogroup w dialogach, „Cofnij” przy usuwaniu cyklu), wydzielenie hooków tła z `Index.tsx`.
- Do zrobienia (z porównania z konkurencją): Share Target dla plików, podzadania w listach, „znajdź i zamień”, eksport bazy do `.md`, udostępnienie grafiku jako obraz, premie w rachunku, wiele grafików.

## Dział Notatki — fala 1 i 2 (2026-10-10, szósta runda)

- [x] Zaznaczanie myszą/dotykiem, pasek zbiorczy zależny od widoku (Kosz: przywróć/usuń trwale; Archiwum: przywróć), obrazy w edycji bez limitu 4 z „Cofnij”.
- [x] Wyszukiwanie: bez ogonków, wiele słów (AND), operatory `priorytet:`, `ma:zalacznik`, `brak:etykiety|folderu`, negacja `-`; podświetlanie w czytniku wg parsera zapytania; liczniki „gdzie indziej” tylko przy pustym wyniku.
- [x] Podgląd listy: otwarte najpierw; „Cofnij” przy usuwaniu etykiety; etykiety w kreatorze jako przyciski; przepinanie `[[linków]]` po zmianie tytułu; trwały szkic nowej notatki.
- [x] Grafik: szybkie −/+ 15 min przy godzinach dnia i pędzla (przytrzymanie powtarza).
- Zostaje z planu: skalowanie obrazów >2 MB + wklejanie w edytorze istniejącej notatki (#8), edytor listy (#11), interaktywny czytnik (#12), dostępność kafla (#9), eksport zaznaczonych do ZIP z `.md` (#16), trafienia w kaflach (#17). Powiadomienia Android — odłożone do decyzji (Capacitor vs Web Push).

## Dział Notatki — fala 2 i 3 (2026-10-10, siódma runda) — STAN NA KONIEC SESJI

- [x] Obrazy: skalowanie >2 MB do JPEG (`lib/imagePrepare.ts`), wklejanie w edytorze istniejącej notatki.
- [x] Edytor listy: Enter/Backspace, „Usuń ukończone” z „Cofnij”, widoczne usuwanie na dotyku; kliknięcie dymka nie zamyka edytora nowej notatki.
- [x] Czytnik: odhaczanie pozycji listy, wcięcia podzadań.
- [x] Eksport ZIP z osobnymi `.md` (`lib/exportZip.ts`): pasek zbiorczy + menu eksportu.
- [x] Dostępność: kafel `role="article"` z nazwą, `alt` obrazów, ogłaszanie liczby wyników, `QuickAdd` (cele dotykowe, „zastąpi termin”).
- **Nie zweryfikowane:** pełny `npm run test:e2e` po ostatnim commicie (`9b400a8`) — przebieg został przerwany przez system (brak pamięci). Uruchomić lokalnie przed dalszą pracą.
- **Zostaje:** wyróżnianie trafień w kaflach (#17), nawigacja ←/→ między notatkami w czytniku, Android push (decyzja Capacitor vs Web Push), react-router 7, CSP w trybie egzekwowania, walidacja metadanych skarbca, a11y: radiogroup w ShiftTypeDialog, Szczegóły QuickAdd.

## Funkcje w stylu Notiona — 2026-10-11

Plan wdrożenia po kolei (każdy krok osobno, z testami i commitem):

- [x] **1. Menu „/” w edytorze** — `lib/slashMenu.ts`, `hooks/useSlashMenu.tsx`, podpięte w `NoteCard.tsx` i `AddNoteBar.tsx`; e2e `e2e/slash-menu.spec.ts`. Callout, blok zwijany i tabela dodane w pakiecie 1 + 2 (niżej).
- [x] **2. Ikony, okładki, ulubione** — zrobione: `lib/noteLook.ts`, `components/NoteLookPicker.tsx`, sekcja „Ulubione” w `AppSidebar.tsx`, e2e `e2e/note-look.spec.ts`. Okładka to gotowy wzór (nie obraz), więc nie dotyka sync plików ani skarbca. Eksport Markdown/ZIP jeszcze nie zapisuje ikony we frontmatterze. Plan: pola opcjonalne `icon`, `cover`, `favorite` w `Note`: `hooks/useNotes.ts`, `lib/noteSchema.ts`, `NOTE_SCALAR_FIELDS` + `yNoteFromPlain` + `plainFromYNote` w `lib/yjsStore.ts` (okładka do `PRIVATE_FIELDS`); sekcja „Ulubione” w `AppSidebar.tsx` (`SidebarRow`).
- [x] **3. Widok tablicy i tabeli** (2026-10-11: `lib/boardColumns.ts`, `BoardColumn.tsx`, `NoteTable.tsx`, e2e `board-table.spec.ts`; tablica = kolumny wg podziału, domyślnie etykiet, przeciągnięcie zmienia etykietę/folder/przypięcie z „Cofnij”; tabela z sortowaniem po nagłówkach, bez paska zbiorczego) — — `board`/`table` w `Layout` (`lib/viewPrefs.ts`), kolumny z `groupNotes` (`lib/groupNotes.ts`), przeciąganie w `hooks/useNoteDnd.ts`, przełącznik w `ViewControls.tsx`.
- [x] **4a. Podstrony** (2026-10-11) — `parentId` w `Note`/Yjs/schemacie; `lib/subpages.ts` (przodkowie, potomkowie, `canSetParent` — ochrona przed cyklem, rodzic nieistniejący = poziom główny), `lib/subpageActions.ts`; kosz bierze całą gałąź (podstrona wcześniej w koszu zachowuje swój `trashedAt`), przywrócenie cofa tylko to, co poszło razem; kafel: „↳ rodzic” i „N podstron” (`WikiIndex.tree`), akcja „Dodaj podstronę”; czytnik: okruszki, lista podstron, wybór notatki nadrzędnej. Testy: `subpages.test.ts`, `useNotes.test.ts`, e2e `subpages.spec.ts`. Nie zrobione: przeciąganie kafla na rodzica, drzewo w pasku bocznym, kopia zapasowa/eksport Markdown z hierarchią (pole `parentId` jest już w `FullBackup` przez schemat notatki).
- [ ] **4b. Właściwości notatek** — właściwości jako `Y.Map` na klucz (tekst, liczba, data, wybór), kolumny w widoku tabeli, schemat właściwości w `FullBackup`.

### Pakiet 1 + 2 — tabele, callouty, bloki zwijane (zrobione 2026-10-11)

- [x] **Tabele i GFM** — `remark-gfm` w `MarkdownRendererImpl.tsx` (tabele, `~~skreślenie~~`, pola zadań, autolinki); komenda „Tabela” w menu „/”.
- [x] **Callouty i bloki zwijane** — własna wtyczka `lib/markdownCallouts.ts` (składnia Obsidiana: `> [!info|tip|warning|danger|toggle]±`, polskie aliasy), bez `rehype-raw`; komendy „Callout” i „Blok zwijany”. Testy: `MarkdownRenderer.blocks.test.tsx`, `e2e/slash-menu.spec.ts`.

### Dalsze pomysły z Notiona (audyt 2026-10-11, od najtańszego)

- [x] Blokada edycji per notatka (`readOnly`, kłódka w „⋯”, ikona na kaflu, toast „Odblokuj”; e2e `read-only-note.spec.ts`). Nie blokuje odhaczania listy ani usuwania. Pełna szerokość (`wide`, dwie kolumny od `sm`) i większy tekst (`largeText`) per notatka — przyciski w „⋯”, e2e `note-wide-large.spec.ts`.
- [x] Rozszerzony pasek zbiorczy: przenieś do folderu, dodaj etykietę, przypnij (z „Cofnij”; `BulkActionBar.tsx`, e2e `templates-bulk.spec.ts`).
- [x] @-wzmianki w edytorze (2026-10-11): `@` na początku słowa podpowiada daty (Dziś/Jutro/Wczoraj, format `{{data}}`) i notatki od ostatnio edytowanych (wstawia `[[tytuł]]`); `lib/mentions.ts`, rozszerzony `useWikiAutocomplete`, e2e `mentions.spec.ts`. Osobnej sekcji „Ostatnio edytowane” nie ma — lista po `@` jest właśnie tak uporządkowana.
- [x] Własne szablony ze zmiennymi: `{{data}}`, `{{data_iso}}`, `{{dzień}}`, `{{godzina}}`, `{{jutro}}`, `{{wczoraj}}`, `{{tydzień}}`, `{{rok}}` (`lib/templateVars.ts`, `lib/customTemplates.ts`, `CustomTemplateDialog.tsx`; w backupie ustawień). Bez `{{tytuł}}` — nie ma jak go podać przy jednym kliknięciu.
- [x] Spis treści w czytniku (od 3 nagłówków, `ReaderToc.tsx`, e2e w `reader.spec.ts`). Linki `[[tytuł#nagłówek]]` (2026-10-11): klik otwiera notatkę w czytniku i przewija do nagłówka (`lib/wikiHeading.ts`, `splitWikiTarget`); backlinki i zmiana tytułu zachowują nagłówek; e2e `wiki-heading.spec.ts`.
- [x] Web clipper jako zakładka (2026-10-11): Ustawienia → Ogólne, `lib/clipperBookmarklet.ts` otwiera `/share` z tytułem, adresem i zaznaczeniem; e2e `clipper.spec.ts`. Share Target dla plików/obrazów nie zrobiony (wymaga POST + service workera, groziłoby regresją udostępniania tekstu).
- [x] Ikona (`icon:`) i ulubiona (`favorite: true`) we frontmatterze eksportu ZIP i w imporcie Markdown.
- Odrzucone: LaTeX, mermaid, embedy wideo/iframe, synchronizowane bloki; wszystko, co wymaga serwera lub konta (uprawnienia, publikacja, formularze, API, agenci AI).

### Wskaznik zapisu i ochrona przed utrata zmian (2026-10-11)

Zrobione: `lib/saveStatus.ts` (zapis do IndexedDB: Zapisywanie… / Zapisano / lepki błąd „Nie zapisano”), `hooks/useDraftAutosave.ts` (szkic zatwierdzany przy `pagehide`/ukryciu karty, licznik niezatwierdzonych szkiców), `OfflineStatus.tsx` (pastylka statusu + `beforeunload`). Testy: `saveStatus.test.ts`. Do zrobienia: fragment notatki → zadanie; widok tablicy/tabeli (#3).

### Kalendarz + Grafik: godziny dnia i QoL (2026-10-11)

- [x] Panel dnia w Kalendarzu: „Zmień godziny” / „Dodaj zmianę” otwiera okno dnia z Grafiku (rodzaj zmiany, godziny ręcznie, −/+15 min); klawisz **Z** na siatce robi to samo; „Jak poprzedni dzień” wpisuje zmianę z poprzedniego dnia z „Cofnij”. e2e `calendar-shift-edit.spec.ts`.
- [x] Postęp folderu jako „projektu” (2026-10-11): w pasku bocznym pasek i licznik `zrobione/wszystkie` zadań (lista kontrolna + pola `- [ ]` w treści, razem z podfolderami; bez archiwum, kosza i notatek prywatnych). `lib/folderProgress.ts`, e2e `folder-progress.spec.ts`.

### Dział „Nauka” (2026-10-11)

- [x] Osobny widok `/nauka` (pasek boczny, „Więcej” w dolnej nawigacji, paleta poleceń) z materiałami G-HEAT: poradnik „Woda użytkowa” oraz listy kontrolne instalacji wodnej i kanalizacji (PDF-y od użytkownika). Treść statyczna w `lib/study/content.ts` (18 tematów, 35 punktów listy, 29 pytań, tabela wysokości).
  - **Quiz**: runda 10 pytań, najpierw tematy spoza „Umiem”, wymieszane odpowiedzi, klawisze A–D/1–4 i Enter, wyjaśnienie po każdej odpowiedzi; błąd cofa temat z „Umiem” do „W trakcie”.
  - **Tablica**: Do nauki → W trakcie → Umiem (przyciski ‹ ›, animowane przejście), pasek opanowania u góry.
  - **Lista do nauki**: punkty z materiałów pogrupowane w moduły i tematy, ⚠ punkty krytyczne z ryzykiem, filtr „tylko krytyczne”, ściąga wysokości.
  - Postęp w `localStorage` (`kaczy.study.v1`, `lib/study/store.ts`) — **jeszcze nie w pełnej kopii zapasowej ani w synchronizacji Yjs**. Testy: `lib/study/study.test.ts`, e2e `study.spec.ts`.
  - Rozbudowa (2026-10-11): **Powtórka błędów** (store pamięta błędne pytania, dobra odpowiedź je czyści), **„Ćwicz”** na karcie tematu (runda tylko z jego pytań), **„Zrób notatkę”** (`lib/study/toNote.ts`: notatka z etykietą `nauka`, listą kontrolną punktów i sekcją „Na co uważać”); runda w toku nie ginie przy zmianie zakładki.

## Plan dopracowania działów — krok po kroku (2026-10-11)

**Zasada pracy.** Jeden dział naraz, w stałej kolejności. Każdy dział przechodzi te same pięć kroków i nie zaczynamy następnego, dopóki poprzedni nie jest domknięty:

1. **Audyt** — przejście działu w aplikacji (pulpit + telefon, jasny/ciemny motyw), przegląd kodu, lista usterek i luk z priorytetem (krytyczne / ważne / drobne) i nakładem S/M/L.
2. **Fala 1 — usterki i tarcie** (S): to, co psuje codzienne użycie. Bez nowych funkcji.
3. **Fala 2 — brakujące podstawy** (M): funkcje, których użytkownik się spodziewa w tym dziale.
4. **Fala 3 — dopieszczenie** (S–M): ruch, puste stany, skróty klawiaturowe, dostępność.
5. **Domknięcie** — testy jednostkowe + e2e dla każdej zmiany, pełny `playwright test`, wpis w roadmapie i w pamięci sesji, commit per fala.

**Kryterium „dział gotowy”:** brak otwartych punktów krytycznych i ważnych z audytu, zielone testy, brak regresji w pełnym e2e, krótka notatka „co zostało świadomie na później”.

**Przekrojowo (sprawdzane w każdym dziale):** telefon (cele dotykowe ≥ 44 px, okna mieszczą się w ekranie), klawiatura i czytnik ekranu, tryb ciemny i motywy sezonowe, `prefers-reduced-motion`, stan pusty i błędy, „Cofnij” przy operacjach destrukcyjnych.

### Kolejność działów

| # | Dział | Dlaczego w tym miejscu | Główne tematy do sprawdzenia |
|---|-------|------------------------|------------------------------|
| 0 | **Dodaj notatkę** (w toku) | Wejście do całej aplikacji | Fala 1 i 2 zrobione; zostaje fala 3: wklejony link/HTML, menu „Więcej” na wąskim ekranie, kompozytor jako arkusz na telefonie, wiele szkiców |
| 1 | **Notatki: siatka, kafel, edytor** | Rdzeń; wszystko inne na nim stoi | Podstrony (4a zrobione): przeciąganie na rodzica, drzewo w pasku bocznym, hierarchia w eksporcie; **4b właściwości** + kolumny w tabeli; zmiana kolejności pozycji listy przeciąganiem; zaznaczanie i akcje zbiorcze; gęstość kafli |
| 2 | **Czytnik i prezentacja** | Blisko edytora, małe domknięcie | Nawigacja ←/→ między notatkami, wyróżnianie trafień w kaflach, spis treści, a11y okna |
| 3 | **Wyszukiwanie i paleta poleceń** | Szybkość dotarcia do treści | Zapisane filtry, operatory (`w:folder`, daty), podgląd trafień, historia, skróty |
| 4 | **Foldery, etykiety, filtry** | Porządek w danych | Drzewo folderów, kolory/ikony, scalanie i zmiana nazw etykiet z „Cofnij”, puste foldery, postęp projektu |
| 5 | **Dziś i Ten tydzień** | Codzienny punkt wejścia | Co pokazuje „Dziś” (terminy, zaległe, notatka dnia), szybkie odhaczanie, przegląd tygodnia |
| 6 | **Przypomnienia** | Zależy od Dziś/Kalendarza | Odkładanie (preset-y), agenda, powtarzanie z końcem serii, **decyzja Android push** (Capacitor vs Web Push), dźwięk/wibracja |
| 7 | **Kalendarz** | Widok czasu | Przeciąganie terminów, widok tygodnia, integracja z Grafikiem, święta, eksport .ics |
| 8 | **Grafik zmian** | Osobna domena, wcześniej audytowana | Statystyki okresu i etatu, szablony tygodni, eksport/druk, zgodność ze zmianami z Kalendarza |
| 9 | **Nauka** | Nowy dział, rośnie z materiałami | Więcej materiałów (import własnych PDF/tekstu → tematy i pytania), powtórki rozłożone w czasie, postęp w Yjs/synchronizacji |
| 10 | **Archiwum i Kosz** | Proste, szybkie domknięcie | Wyszukiwanie w koszu, odliczanie, akcje zbiorcze, przywracanie gałęzi podstron |
| 11 | **Prywatne notatki (skarbiec)** | Wrażliwe, wymaga ostrożności | Metadane skarbca (walidacja), zmiana hasła, blokada po bezczynności, ostrzeżenia przed utratą hasła |
| 12 | **Ustawienia, kopia zapasowa, synchronizacja** | Spina całość | Nauka w backupie/sync, przywracanie wybiórcze, status sync, diagnostyka, eksport ZIP z hierarchią |
| 13 | **Wygląd i ruch** | Na końcu, bo dotyka wszystkiego | Spójność motywów, animacje, ikony, puste stany, hierarchia tytuł/treść (otwarty punkt) |
| 14 | **PWA, wydajność, dostępność** | Przekrojowe domknięcie | Instalacja, offline, rozmiar paczki, czas pierwszego renderu, audyt a11y, CSP, react-router 7 |

### Jak będziemy pracować na co dzień

- Na początku działu robię **audyt i pokazuję listę** (bez zmian w kodzie) — Ty wybierasz, co wchodzi do fal.
- Każda fala to osobny commit z testami; po każdej podsumowanie „zrobione / nie zrobione / ryzyka”.
- Rzeczy wymagające decyzji (np. Android push, Share Target dla plików, nowe zależności) zgłaszam **przed** pracą, nie po.
- Otwarte punkty z wcześniejszych audytów trafiają do właściwego działu, zamiast wisieć osobno.

### Dodaj notatkę — fale 1 i 2 (2026-10-11)

- [x] **Fala 1:** przycisk „Zapisz” (pusty szkic: „Zamknij”), Ctrl+Enter zapisuje, **Ctrl+Shift+Enter / „Zapisz i dodaj kolejną”** zostawia pusty szkic; toast „Dodano notatkę” z „Cofnij” (jeden dymek, `id` zastępuje poprzedni); szkic pamięta kolor, etykiety, przypomnienie z serią i priorytet, a chip „Szkic przywrócony” ma „Odrzuć”.
- [x] **Fala 2:** `[[` i `@` w nowej notatce (`@nazwa` zgodna z folderem zostaje tokenem przechwytywania); ten sam `ReminderPicker` co na kaflu (szybkie terminy „Dziś wieczorem / Jutro rano / Za tydzień”, powtarzanie, koniec serii; okno przewija się, gdy jest wyższe niż ekran); „Podstrona w…” przy tworzeniu (`parentId`). Testy: `quick-capture.spec.ts`, `composer.spec.ts`.
- Zostaje (fala 3): wklejony link/HTML, menu „Więcej” na wąskim ekranie, kompozytor jako arkusz na telefonie, wiele szkiców. Szablony w kompozytorze już były (pokazują się w pustym szkicu), więc osobny przycisk „Z szablonu” odpadł.

## Plan po audycie skilli (2026-10-11) — fale przekrojowe przed kolejnymi działami

Źródło: siedem równoległych przeglądów (wygląd, dostępność/UX, jakość kodu, testy/odporność, dane/sync/bezpieczeństwo, produkt, dokumentacja). Wnioski pochodzą z lektury kodu, bez uruchamiania aplikacji; liczby kontrastu są szacunkami do zweryfikowania narzędziem.

**Zrobione od razu (fala 0):** lint bez błędów, skróty `@`/`[[#]]`/Ctrl+Shift+Enter w Ustawieniach, wygasanie żądania nagłówka (`wikiHeading`, 3 s), „duchy” w postępie Nauki odfiltrowane, kosz nie zeruje przypięcia/archiwum u podstron, `aria-haspopup` zdjęte z „+”, okna jako arkusz od dołu tylko opt-in (`DialogContent sheet`) i dla potwierdzeń.

**Fala A — dostępność i kontrast (S–M).** Token `--primary-ink` (ciemniejszy bursztyn) do tekstu na jasnym papierze; waga nagłówków h1–h6 (Nauka ma 400); fokus kafla w pełnym kolorze; pola ≥16 px na telefonie (iOS zoom); usuwanie obrazka widoczne na dotyku; cele dotyku ≥44 px (zamknięcia okien, czytnik, tablica Nauki, „×” przypomnienia); kompozytor pełnoekranowy jako `role="dialog"` z Esc i pułapką fokusu; etykiety `htmlFor` w ReminderPicker; `aria-label` pozycji listy w czytniku bez „Odhacz”; widoczna alternatywa dla długiego przytrzymania „+” (pozycja „Nowa…” w „Więcej”); spójne promienie (`rounded-2xl`); słownik tekstów (Zapisz / Zamknij / Dodaj zdjęcie / Dodaj rysunek).

**Fala B — bezpieczeństwo danych (M).** Auto-czyszczenie kosza dopiero po wczytaniu i pierwszej synchronizacji + ochrona przed zegarem z przeszłości/przyszłości; dziecko żywe pod rodzicem z kosza traktować jak poziom główny; timeout w `whenFlushed` (zablokowane IndexedDB nie zostawia „Zapisywanie…” bez końca); szkic pamięta rodzica; CSP w trybie egzekwowania (Netlify) i nagłówki dla Vercel; ostrzeżenie przed „zastąp” przy przywracaniu kopii; etykiety/obrazy jako Y.Map zamiast całych tablic (przed 4b); skarbiec: `epoch` w AAD i ikona/termin/`parentId` do szyfrogramu (L).

**Fala C — struktura kodu (L, etapami).** `Index.tsx` (1020 l.) → hooki `useSelection`/`useReader`/`useComposerAdd`, potem komponenty widoków; `NoteCard.tsx` (881 l., CRLF+NUL) dopiero po teście charakteryzującym i zapisie nowego pliku jako UTF-8 LF; `addNote` z obiektem zamiast 10 parametrów; jedna fabryka `makeNote()`; `.gitattributes` + `.editorconfig`.

**Fala D — testy (S–M).** Helper toastów (`last()`), `reducedMotion` w Playwright, ochrona przed starym serwerem na porcie 4173, seedowanie przez import kopii zamiast klikania, `workers=2–3`, podział na smoke (<2 min) i pełny, nowe: `resilience.spec.ts` (quota, uszkodzony localStorage, zablokowane IDB, dwie karty), e2e kosza gałęzi podstron i powtórki błędów Nauki.

**Fala E — produkt (decyzje użytkownika).** „Dziś” jako jedno wejście (zmiana + zaległe + terminy + notatka dnia); Nauka v2 faza 1 (powtórki SM-2 lite + postęp w kopii i Yjs, bez importu); uczciwa decyzja o push (test na telefonie → Capacitor albo ukryć obietnicę); Skrzynka (przechwyć bez pytań); alert okresu rozliczeniowego w Grafiku.

**Dokumentacja (S).** `docs/GOTCHAS.md` (CRLF+NUL, heredoc, port 4173), `DATA-MODEL.md`, `BACKUP-RESTORE.md`, `ARCHITECTURE.md`; README do ~80 linii; `noti.md` do archiwum (opisuje konta, których aplikacja nie ma).

**Do rozstrzygnięcia z użytkownikiem:** (1) 4b Właściwości — robić czy porzucić (raport produktu radzi porzucić, model danych jest gotowy); (2) Android push; (3) import własnych materiałów do Nauki (L) czy zostaje G-HEAT + pytania ręczne; (4) czy ostrzeżenie CSP wolno egzekwować (przenieść inline-skrypt z `offline.html`).

### Fale A i B po audycie — wykonane (2026-10-11)

- [x] **A (dostępność/kontrast/UI):** token `text-primary-ink` (bursztyn przyciemniony do ~5,5:1 na papierze; w ciemnym motywie bez zmian — kontrast zmierzony, było 2,65:1) w 120 miejscach; waga nagłówków h1–h6 = 600; fokus kafla `ring-ring`; pola ≥16 px na telefonie; usuwanie obrazka widoczne na dotyku; cele dotyku ≥44 px (tablica Nauki, „×” przypomnienia, szybkie terminy); kompozytor pełnoekranowy jako `role="dialog"` z Esc (zwija, szkic zostaje); etykiety `htmlFor`/`useId` w ReminderPicker; „Dodaj…” w arkuszu „Więcej” (alternatywa dla przytrzymania „+”); zakładka koloru i większy promień kafli; okna potwierdzeń jako arkusz od dołu na telefonie (`DialogContent sheet` jako opt-in); menu/popovery z większym promieniem. Świadomie bez zmian: etykiety „Odhacz: …” (spójna konwencja w edytorze i testach).
- [x] **B (bezpieczeństwo danych):** czyszczenie kosza z karencją 3 s i bez znaczników z przyszłości; timeout 15 s zapisu do IndexedDB (zamiast wiecznego „Zapisywanie…”); żywa podstrona pod rodzicem z kosza wraca na poziom główny; szkic pamięta rodzica; nagłówki bezpieczeństwa na Vercel (CSP wciąż Report-Only); ostrzeżenie przy przywracaniu kopii przy sparowanych urządzeniach.
- Zostaje z B: CSP w trybie egzekwowania (wymaga decyzji — inline-skrypt w `offline.html`), etykiety/obrazy jako Y.Map, `epoch` w AAD skarbca, ikona/termin w szyfrogramie.

### Fala D — testy (2026-10-11)

- [x] `e2e/global-setup.ts`: przerywa przebieg, gdy `dist/` jest starszy niż źródła (koniec cichego testowania starego buildu; obejście `PW_ALLOW_STALE=1`).
- [x] `npm run test:e2e:smoke` — 22 testy `@smoke`, ok. 1,6 min zamiast ~9; `PW_WORKERS=3` przyspiesza pełny przebieg (do sprawdzenia pod kątem stabilności).
- [x] `e2e/helpers.ts` (`lastToast`, `undoIn`, `addNote`, `seedNotes`) i `e2e/resilience.spec.ts`: uszkodzony localStorage, błąd zapisu IndexedDB (widoczne „Nie zapisano”), dwie karty.
- Zostaje: przeniesienie logiki czysto-funkcyjnej z e2e do vitest (editor-keys, slash-menu), seedowanie przez import kopii w pozostałych specach.

### Nauka: Dziennik z budowy (2026-10-11)

- [x] Zakładka **Dziennik** w `/nauka`: wpis w trakcie pracy (Zrobione / Problem / Notatka) z inwestycją (zapamiętywana), tematem z materiału i jego **listą kontrolną pod ręką** (⚠ punkty krytyczne z ryzykiem; zaznaczone punkty zapisują się we wpisie). Wpisy pogrupowane dniami, z godziną, Cofnij przy usuwaniu, podsumowanie 7 dni.
- Połączenie teorii z praktyką: **problem cofa temat z „Umiem” do „W trakcie”** (wraca do powtórki), karta tematu na tablicy pokazuje „budowa N×, problemów M”, z karty jest skrót „wpis z budowy”, a z wpisu — „Ćwicz pytania”. Dane w `kaczy.study.v1` (są w kopii zapasowej). `lib/study/store.ts` (`addJournalEntry`, `practiceByTopic`), `StudyJournal.tsx`; testy `study.test.ts`, e2e `study.spec.ts`.
- Zostaje: zdjęcia we wpisach, dyktowanie, lokalizacja GPS, eksport dziennika do notatki/PDF, synchronizacja przez Yjs (razem z postępem Nauki).

## Plan dopracowania UI/UX na telefonie — 2026-10-11

Źródło: cztery audyty **na żywo** (Playwright, dotyk, 360/390/430 px, jasny/ciemny, CPU 4× + Slow 4G, 20 i 300 notatek): rdzeń notatek, widoki dodatkowe, interakcje i przepływy, wydajność i PWA. Skille użyte: frontend-design, refactoring-ui, design-critique, accessibility-review, web-typography, ios-hig-design, microinteractions, design-everyday-things, ux-heuristics, jobs-to-be-done. Nie zweryfikowano na prawdziwym telefonie: klawiatura ekranowa (K2), haptyka, wydajność urządzenia. Nakład: S < pół dnia, M ok. dnia, L kilka dni.

**Praca, do której telefon jest „wynajmowany”:** złap myśl w 2 sekundy i miej pewność, że wróci. Priorytet: szybki zapis → odnalezienie → zaufanie (nic nie ginie, „wstecz” nie wyrzuca z aplikacji).

### Faza 0 — zrobione (commity f70bd0c, 37ea24e)
- [x] Pasek zbiorczy mieści się w ekranie (framer zjadał `translate`), przewija się, safe-area, krótkie podpisy.
- [x] Swipe kafla (archiwum/kosz) bez okna potwierdzenia — zostaje „Cofnij” (`runWithoutConfirm`).
- [x] Wyszukiwarka 16 px (iOS nie powiększa), `enterkeyhint`, bez autokorekty; `overscroll-behavior-y: contain`.
- [x] Długi tytuł bez spacji zawija się; chipy Ctrl+K/N ukryte na dotyku; samouczek i baner instalacji pod telefon (baner 1 linia); dymek `HoverTip` nie wisi po dotyku.

### Faza 1 — usterki i tarcie (S, po kolei)
- [x] 1.1 Okno „Cykl zmian” w Grafiku: poziomy overflow (`min-w-0`, kolumna poniżej 400 px), CTA „Nałóż cykl” sticky na dole.
- [x] 1.2 Dialog „Nowy termin” (Kalendarz): domyślnie najbliższa pełna godzina, błąd „w przeszłości” dopiero po ręcznej zmianie; lista „przypnij do notatki” bez archiwum.
- [x] 1.3 Kosz: przycisk „Przywróć” obcięty, „Usunięcie za 27 dni” łamie się — układ zawijany.
- [x] 1.4 Cele dotyku ≥44 px: przyciski nagłówka (36), kółko zaznaczenia kafla (24, hit-area `::after`, rezerwa w tytule), wiersze listy w kaflu (24 → ≥40), etykiety (28), „×” banera.
- [x] 1.5 Uchwyt przeciągania kafla widoczny i trafialny na `pointer: coarse` (dziś `opacity: 0`, 37×10) — K3.
- [x] 1.6 Ramka fokusu po stuknięciu (kafel po zamknięciu edytora, przycisk „Widok”) — `:focus-visible` tylko po klawiaturze.
- [x] 1.7 Hierarchia w kaflu: `h1–h3` w treści nie większe niż tytuł; odstęp listy ~4 px → spójny `gap`.
- [x] 1.8 Kompozytor: „Zapisz” po prawej w jednej linii z narzędziami (jeden rząd przewijany, nie 3 rzędy ~180 px); osierocona flaga priorytetu do rzędu metadanych.
- [x] 1.9 Drobne: Ustawienia (tytuł vs podtytuł wyrównanie), „Dodaj…” w „Więcej” (osierocony kafel), jedna nazwa marki (NOTKI/Notatnik), niebieska kreska po „NOTKI” i czerwona linia drawera (sprawdzić artefakt), 11 px → 12 px (data kafla, podpisy nawigacji), `aria-label` wyszukiwarki + brak `DialogTitle` (ostrzeżenie Radix), wiersze `DayPanel` na 360. **Zrobione:** `aria-label` wyszukiwarki, nagłówek Ustawień. **Świadomie nie:** „Dodaj…” w „Więcej” (alternatywa dla przytrzymania „+”), 11 → 12 px globalnie (ryzyko przepełnień w nawigacji), jedna nazwa marki (decyzja), kreska po „NOTKI” i czerwona linia drawera (nie odtworzone — sprawdzić na zrzucie), gap listy (niezweryfikowane).
- [x] 1.10 PWA/head: `theme-color` jasny/ciemny (`media`), `apple-mobile-web-app-status-bar-style`, manifest `orientation`/`display_override`, `background_color` zgodny z motywem, okresowe `registration.update()` na `visibilitychange`, rejestracja SW w idle.

### Faza 2 — wzorce mobilne (M)
- [x] 2.1 **Przycisk „wstecz”** (K1): `useOverlayHistory(open, close)` — `pushState` przy otwarciu warstwy, `popstate` ją zamyka; podpiąć pod Sheet, Dialog, edytor kafla, czytnik, kompozytor. Dziś „wstecz” zmienia widok pod otwartą warstwą, a z pierwszego wpisu wychodzi z PWA.
- [x] 2.2 **Klawiatura ekranowa** (K2): `interactive-widget=resizes-content` + `useKeyboardInset` (visualViewport), pasek narzędzi/„Zapisz” nad klawiaturą. Wymaga testu na telefonie.
- [x] 2.3 **Arkusz akcji notatki** zamiast siatki ~18 ikon po „⋯” (W6): grupy Szybkie / Wygląd / Organizacja, podpisy, „Usuń” na dole; ta sama ścieżka dla długiego przytrzymania kafla, który wchodzi w zaznaczanie (W5) z haptyką. ✅ `351f7a4`: arkusz z kolorami i podpisami (podpis z `aria-label`, CSS `.note-sheet-grid`), przytrzymanie 450 ms zaznacza.
- [x] 2.4 **Arkusze przeciągane w dół** (W2): drag-to-dismiss w `ui/sheet.tsx` (uchwyt dziś kłamie); okna Grafiku (nowy rodzaj, cykl) jako arkusze z sticky stopką, jak potwierdzenia. ✅ uchwyt w `ui/sheet.tsx` (próg 110 px / szybki ruch). Okna Grafiku jako arkusze — ✅ (DialogContent `sheet`, `grid-cols-[minmax(0,1fr)]`).
- [x] 2.5 **Toasty zaległych przypomnień**: jeden zbiorczy „3 zaległe · Zobacz” zamiast stosu zasłaniającego nagłówek; nie nakładać z odznaką i banerem (kolejka). ✅ ≥ 2 zaległe → jeden dymek „N przypomnienia czekają · Zobacz”. Kolejka z odznaką/banerem — jeszcze nie.
- [x] 2.6 **Poziomo i tablet**: układ desktopowy wymaga `min-height: 500px` (844×390 dziś = pasek 280 px + okno 560×320); panel zwinięty domyślnie przy niskiej wysokości. ✅ wariant `desk:` i `MOBILE_QUERY` (`use-mobile.tsx`): w poziomie dolna nawigacja i wysuwany panel.
- [x] 2.7 **Wyszukiwanie w zasięgu kciuka** (W4): ikona szukania w dolnym pasku lub pull-down na liście; pole u góry zostaje na desktopie. ✅ wariant bez zmiany paska: ponowne stuknięcie „Notatki” i „Więcej → Szukaj” (grupa „Szybko”). Ikona szukania w pasku / pull-down — do decyzji.
- [x] 2.8 **Grafik**: ~700 px „chrome” przed siatką — podpowiedzi zwijane po pierwszym użyciu, „Własne godziny” do menu pędzla, pasek pędzli sticky, `NowCard` bez ucinania nazwy. ✅ częściowo: podpowiedź o przenoszeniu z „Rozumiem”, nazwa w `NowCard` na 2 linie. „Własne godziny” w menu pędzla i sticky pasek — nie.
- [x] 2.9 **Kalendarz**: pasek tygodnia i kafle Dziś/Jutro duplikują tydzień z siatki — zwinąć na wąskim ekranie. ✅ pasek tygodnia schowany < sm, Dziś/Jutro w 2 kolumnach.
- [ ] 2.10 **Dziennik Nauki**: lista wpisów nad formularzem lub formularz w arkuszu z FAB „+ Wpis”, CTA pełnej szerokości, bez „Ctrl+Enter” na dotyku. → przeniesione do planu Nauki, D2 (sekcja na końcu).
- [x] 2.11 **Przypomnienia**: szybkie „Gotowe / Odłóż” na karcie listy (nie tylko w toaście); lista zaległych jako zwykła kolumna, nie masonry. ✅ „Gotowe / Jutro rano” na kaflu zaległego terminu (z Cofnij). Lista bez masonry — nie.
- [x] 2.12 **Pierwsze uruchomienie**: jedna karta „Dziś: 2 zaległe, 1 termin” zamiast stosu; baner instalacji dopiero po pierwszej notatce (jest `ready`). ✅ przez 2.5 (zbiorczy dymek) i istniejące `ready` banera; odznaka już czeka na zamknięcie okien.

- [x] **Marka (poza planem, 2026-10-11):** ikony PWA z logo N (192/512/maskable/apple/favicon/monochrome), animacja startowa w `index.html` (tylko zainstalowana aplikacja albo `?splash`, znika po wczytaniu danych, `src/lib/bootSplash.ts`), logo N w nagłówku telefonu i na stronie offline (zamiast kufla). Generator ikon: skrypt Playwright rysujący `M6 19V5l12 14V5`.

### Etap 2b — Notatki i kolumny: dopracowanie i naprawa UI/UX (dopisane 2026-10-11 na prośbę użytkownika)

Zasada jak w działach: najpierw **audyt na żywo** (telefon 360/390/430 i desktop 1440, jasny/ciemny, wszystkie układy: lista, siatka, mozaika, tablica, tabela; 5, 25 i 300 notatek), lista usterek do akceptacji, potem fale z testami. Znane już z audytów 2026-10-11:
- [x] 2b.1 Audyt widoku Notatki i kolumn (z zrzutami) — lista krytyczne/ważne/drobne. ✅ 2026-10-11: 360/390/430/1440, jasny/ciemny, 5 układów, 5/25/300 notatek, warianty kolumn/gęstości/grupowania + pomiary DOM. Wyniki (zaakceptowane; fala 1 — K1–K3, W1–W6, W8 i błąd migracji — zrobiona tego samego dnia, e2e 211/211; fala 2 — D1–D4 — też):
  - **Krytyczne**
    - K1 Ręczne kolumny 2/3/4 na telefonie dają **1** kolumnę (gorzej niż „Auto” = 2) — `NoteGrid.tsx` klasy `grid-cols-1 sm:…`. → 2b.3
 ✅ ręczne 2+ = 2 kolumny na telefonie (3/4 dopiero od `lg`/`xl`)
    - K2 Lista i Tablica: kafle **sklejone (0 px)** — `space-y-*` kontenera nie działa (pomiar); w Siatce/Mozaice 10 px. → 2b.4, 2b.5
 ✅ `listGap` osobno od `gap` (było `gap.split(" ")[1]` = `sm:gap-3`)
    - K3 Kółko zaznaczenia **nachodzi na tytuł** we wszystkich układach (tytuł 18 px pod kółkiem, np. „Plan tygodnia 1̶6”) i ma 24×24 px na dotyku. → 2b.7
 ✅ `pr-5` tytułu przy polu zaznaczenia; cel dotyku i tak ma 44 px (`coarse:after:-inset-2.5`)
  - **Ważne**
    - W1 Siatka: `auto-rows-fr`, ale kafel nie wypełnia wiersza → dziury do ~220 px między rzędami na telefonie.
 ✅ bez `auto-rows-fr` (wiersz = najwyższy kafel w wierszu), kafel wypełnia wiersz, data przy dolnej krawędzi (`.note-grid-fill`)
    - W2 Tabela na telefonie otwiera się, ale ma 41 px przewijania poziomego, daty ucięte („11 paź 20…”), brak przyklejonej pierwszej kolumny; na wąskim ekranie wystarczy krótka data. → 2b.6
 ✅ tytuł bierze resztę szerokości (`w-full max-w-0`), krótka data `d MMM` poniżej `sm`, wiersz 44+ px na dotyku — bez przewijania w bok, więc przyklejona kolumna zbędna
    - W3 Popover „Widok i kolumny”: cele „1 2 3 4” 28×24 px; „Kompakt” na telefonie wizualnie prawie bez różnicy. → 2b.2
 ✅ cele 32/44 px, na telefonie tylko Auto/1/2, `aria-pressed`; „Kompakt” — zostaje do 2b.2
    - W4 Uchwyt „⋮⋮” (61×26 px) na każdym kaflu także na dotyku — szum na każdym kaflu (do decyzji: ukryć na `coarse`, przeciąganie przytrzymaniem).
 ✅ na dotyku uchwyt tylko przy sortowaniu „Ręcznie”
    - W5 Pusta notatka (bez tytułu i treści) = pusty kafel z samą datą (w Tabeli „Bez tytułu”) — brak spójnego zastępnika.
 ✅ kursywą „Bez tytułu”, jak w Tabeli
    - W6 Lista na desktopie: kolumna `max-w-2xl` wyśrodkowana, a nagłówki „Przypięte / Inne” przy lewej krawędzi. → 2b.8
 ✅ lista przy lewej krawędzi (bez `mx-auto`)
    - W7 Tablica: nagłówki kolumn nie są przyklejone (scroll-snap już jest, kolumna 258/366 px — OK). → 2b.5 ✅ przyklejony pasek z kopią nagłówków nad kolumnami (`NoteBoard`), przesuwany razem z przewijaniem w poziomie
    - W8 Przy starcie dwa dymki naraz (przypomnienia u góry, odznaki u dołu) zasłaniają nagłówek i ostatni kafel.
 ✅ dymek odznak czeka, aż znikną inne dymki (jak na otwarte okno)
  - **Drobne**
    - D1 Nagłówek `##` z treści na kaflu (pogrubiony, 16 px) konkuruje z tytułem. → 2b.7 ✅ nagłówki z treści na kaflu w rozmiarze treści (`!text-[1em]`)
    - D2 Metadane 11 px (data, chipy). → 2b.7 ✅ data na kaflu 12 px (`text-xs`); chipy zostają 11 px
    - D3 W wąskiej kolumnie „Gotowe / Jutro rano” łamią się w pionie i wydłużają kafel. ✅ na telefonie „Jutro” (aria-label „Jutro rano”), węższe chipy — oba w jednym rzędzie przy 360 px
    - D4 ~50 px pustego miejsca między banerem instalacji a „Przypięte”. ✅ pusty pojemnik zwiniętego paska „Zapisz notatkę” schowany pod `md`
  - **Poza zakresem (znalezione przy okazji)**: notatki w `kaczy-notes-data` bez pola `checklist` wywracają migrację (`yjsStore.ts` `yChecklistFromPlain` → `forEach` na `undefined`) — pusta aplikacja. Dotyczy starych kopii/importów. ✅ osłona `items ?? []` + test w `yjsStore.test.ts`.
- [x] 2b.2 Popover „Widok i kolumny”: niewyrównany, siatka „Auto 1 2 3 4” nieczytelna i z małymi celami; na telefonie 3–4 kolumny nie mają sensu → arkusz od dołu z opisanymi opcjami (układ, kolumny, gęstość, grupowanie). ✅ 2026-10-11: na telefonie (`useIsMobile`) przycisk otwiera `ViewSheet` — układ z jednozdaniowym opisem, kolumny Auto/1/2 tylko w Mozaice i Siatce, gęstość i grupowanie jako przełączniki segmentowe 44 px, „wstecz” zamyka arkusz; desktop bez zmian (popover). Gęstość nadal zmienia tylko odstępy (8/10/20 px) — mocniejszy „Kompakt” to osobna decyzja.
- [x] 2b.3 Kolumny na telefonie: zawsze 2 przy „Auto”; sprawdzić 1 kolumnę (pełna szerokość kafla) i szerokie kafle (`wide`) w 2 kolumnach.
- [x] 2b.4 Lista: kafle prawie się stykają (~4 px) — spójny odstęp z siatką i gęstością.
- [x] 2b.5 Tablica (kolumny etykiet/folderów): szerokość kolumn na telefonie, przewijanie poziome z przyciąganiem (scroll-snap), nagłówki kolumn przyklejone, przenoszenie kafla między kolumnami dotykiem. ✅ 2026-10-11: szerokość (280/288 px) i scroll-snap były OK. Nagłówki: kontener `overflow-x-auto` przejmuje oś Y, więc `sticky` w kolumnie nie działa — `NoteBoard` ma nad kolumnami przyklejony pasek z kopią nagłówków (etykieta + licznik), przesuwany razem z przewijaniem w poziomie; pojawia się, gdy nagłówki w kolumnach zjadą pod nagłówek aplikacji, i idzie za jego chowaniem (`--app-header-h`, klasa `header-hidden` z `AppHeader`). Dotyk: uchwyt przeciągania w tablicy widoczny zawsze (wcześniej tylko przy sortowaniu ręcznym). Naprawiony błąd: ruch w bok zaczęty na uchwycie uruchamiał też gest przesunięcia kafla i **archiwizował notatkę** — gest startuje teraz ręcznie (`useDragControls`) i pomija uchwyt, przytrzymanie uchwytu nie zaznacza kafla. Testy w `e2e/board-table.spec.ts` (pasek, przeniesienie dotykiem, przesunięcie nadal archiwizuje).
- [x] 2b.6 Tabela: czy się otwiera i czy jest czytelna na telefonie (audyt nie zdołał jej otworzyć), przewijanie poziome z przyklejoną pierwszą kolumną.
- [x] 2b.7 Hierarchia kafla: tytuł vs treść vs metadane (rozmiary 11 px → 12 px tam, gdzie się mieści), zakładka koloru, długie tytuły i kółko zaznaczenia.
- [x] 2b.8 Grupy (Przypięte / Inne / etykiety): nagłówki, zwijanie, puste sekcje; „Inne” mieszane z przypiętymi w Dziś. ✅ 2026-10-11: jeden wygląd nagłówka sekcji (`NoteGroupSection` — wersaliki, licznik, kreska) także dla „Inne” i grup agendy Przypomnień (Zaległe na czerwono); puste grupy były już pomijane; Archiwum bez podziału na przypięte (przypięta zarchiwizowana notatka ze starej kopii znikała z widoku). W „Dziś” przypięte z dzisiejszą zmianą są w „Przypięte”, reszta w „Inne” — tak samo jak w Notatkach.
- [x] 2b.9 Zmiana układu i kolumn bez skoku (płynne przejście, zachowane przewinięcie i fokus). ✅ 2026-10-11: `lib/viewChange.ts` — układ, kolumny, gęstość i grupowanie (menu, arkusz „Widok”, Ustawienia) idą przez `changeView`: kafel u góry ekranu zostaje w tym samym miejscu (też tabela ↔ siatka; siatka montowana od nowa renderuje od razu do niego), przenikanie przez View Transitions (bez przy ograniczonym ruchu), fokus wraca na tę samą notatkę. Siatka nie jest już remontowana przy zmianie układu (bez `key`), mozaika liczy rozpiętości w `useLayoutEffect` (bez mignięcia). Menu „Widok” oddaje fokus bez przewijania (wcześniej cofało stronę do nagłówka). Test `e2e/view-change.spec.ts` (komputer i telefon).

### Faza 3 — wydajność przy 300 notatkach (M/L; razem, bo dotyka `NoteCard`/`NoteGrid`)
Pomiar (CPU 4×, Slow 4G): lista widoczna 7–11 s, 24 tys. węzłów DOM, otwarcie kafla 2,3–3 s, Kalendarz → Notatki 7–10 s, klawisz w wyszukiwarce 400–740 ms. Przy 20 notatkach OK (przewijanie 60 fps).
- [x] 3.1 `content-visibility: auto` + `contain-intrinsic-size` na opakowaniu kafla (S, najtańszy zysk); potem okienkowanie siatki (M/L) z zachowaniem kolejności dnd-kit. ✅ częściowo 2026-10-11: `content-visibility: auto` na opakowaniu kafla w liście, siatce i tablicy (`data-cv` w `NoteGrid`, reguła w `index.css`) — przeliczenie stylów przy 300 notatkach (zmiana motywu) ~1000 → 80–140 ms przy CPU 4×, start −5–10%. Mozaika (domyślna) bez zmian: rozpiętości potrzebują prawdziwych wysokości. Paint containment przycinał cień przy najechaniu — `overflow-clip-margin: 40px` (zrzut piksel w piksel jak bez zmiany), więc tylko przy `@supports` (Safari bez zmian); wyłączone w edycji w kaflu i w trakcie przeciągania (`data-note-dragging` z `useNoteDnd`, przy okazji `onDragCancel` czyści stan) oraz na dwie klatki zmiany widoku (`data-view-changing` z `changeView` — kotwica liczona na prawdziwych wysokościach; `contain-intrinsic-size: auto` zostaje zawsze, bo rozmiar zapamiętuje się tylko przy nim). Okienkowanie — czeka na decyzję o wirtualizacji.
- [x] 3.2 Powyżej progu (np. 40 kafli) zwykły `div` zamiast `motion.div` (`drag`, `layout`, `initial/animate`); swipe podpinany przy pierwszym dotknięciu. `NoteCard.tsx` ma CRLF + 2 bajty NUL — edytować bajtowo albo po teście charakteryzującym. ✅ częściowo (`0454038`): tła swipe tylko w trakcie gestu, ukryte akcje stopki bez renderu na dotyku (DOM 24 tys. → 11 tys.). Zwykły `div` zamiast `motion.div` — nie (swipe/wyjścia).
- [x] 3.3 Wyszukiwanie: `memo(NoteGrid)`, pasek jako izolowany komponent z debounce 150–200 ms, bez animacji wyjścia przy filtrowaniu. ✅ `1ab4614`: własny stan pola + 150 ms, bez `layout` na polu (klawisz 350–500 → 30–170 ms).
- [x] 3.4 Start: pierwszy render ~12 kart, reszta w idle; nie blokować `images.load()`/migracji przed listą (`yjsStore.ts` ~440–455). ✅ `0454038`: render progresywny (24 + paczki po 48 w idle) — lista 5,35 → 2,1 s, LCP 7,2 → 3,0 s, najdłuższe zadanie 3,9 → 0,6 s. Łańcuch `images.load()`/migracje — nie ruszony.
- [x] 3.5 Markdown: tekst prosty bez `lazy` dla treści bez składni; `useMasonrySpans.place()` z `borderBoxSize`; nie remontować siatki przy przełączaniu widoków. ✅ tekst bez składni bez react-markdown (`needsMarkdown`, testy zgodności), mozaika z `borderBoxSize` i odczytami paczką (`485deec`, pomiary układu 378 → 73, CLS 0). Zachowanie siatki przy zmianie widoku — nie.
- [x] 3.6 Paczka: `fuse.js` dynamicznie, `study/content.ts` poza głównym chunkiem, konfetti i samouczek leniwie, preload fontu Jakarta; precache SW 3,4 MB → ≤1,5 MB (PDF, html2canvas, Statystyki do `runtimeCaching`). Kompromis: PDF/Statystyki offline dopiero po pierwszym użyciu. ✅ częściowo 2026-10-11: główny chunk 237 → 219 KB gzip. `study/content.ts` trafiał do głównego przez `journalImageRefs` (odśmiecanie obrazów, kopia) → czyta teraz zapis `kaczy.study.v1` wprost, bez sklepu Nauki. `fuse.js` osobno: wczytywany w wolnej chwili po starcie (albo przy pierwszym wyszukiwaniu), do tego czasu dopasowanie dokładne bez ogonków; `useSearchReady` przelicza wyniki, liczniki zapisanych filtrów i paletę. Preload woff2 Jakarty (latin + latin-ext) wtyczką `preloadTextFont` w `vite.config.ts`. Konfetti i samouczek były już leniwe. Precache — czeka na decyzję.
- [x] 3.7 Budżety w CI (`e2e/bundle.spec.ts`): wejściowy JS ≤200 KB gzip (dziś ~376), DOM ≤3 000 przy 300 notatkach, FAB/kafel/widok ≤200 ms, klawisz ≤50/100 ms, precache ≤1,5 MB. ✅ częściowo 2026-10-11: w `e2e/bundle.spec.ts` progi zapadkowe na dzisiejszym poziomie z zapasem — wejściowy JS ≤375 KB gzip (jest 357), precache ≤4,3 MB (3,85), DOM przy 300 notatkach ≤10 500 na telefonie (9 763) i ≤20 500 na komputerze (19 220); fuse.js i materiał Nauki pilnowane jako leniwe. Cele z tego punktu czekają na decyzje o precache i wirtualizacji — po każdym zejściu obniżyć próg. Czasów (FAB, klawisz) nie ma: na współdzielonej maszynie skaczą.

### Faza 4 — „premium” (po fazie 2)
- [x] 4.1 Swipe: w prawo przypnij, w lewo archiwizuj (kosz w arkuszu akcji), podpowiedź przy pierwszych 3 razach. ✅ 2026-10-15 (decyzja użytkownika): podpisy w tle przy 3 pierwszych gestach (`lib/swipeHint.ts`), „Przypięto” z „Cofnij”, w Archiwum lewo = przywróć.
- [x] 4.2 Haptyka różnicowana (tap / success / warn / selection) + odhaczenie w kaflu, upuszczenie przeciągniętego kafla, wejście w zaznaczanie; quiz Nauki z haptyką i serią dni.
- [ ] 4.3 Przejście kafel → edytor jako shared element (dziś skok), nagłówek z cieniem dopiero po przewinięciu, zakładka koloru w nagłówku edytora.
- [ ] 4.4 Skróty PWA „Szukaj”, „Nowa lista”; Share Target dla pliku/obrazu (po decyzji).
- [x] 4.5 Nauka: nagłówek bez powtórki „Nauka”, etykiety przy 18 pigułkach, podpisy przycisków kart, cyfry tabelaryczne zamiast „1” jak „l”.

### Faza 5 — testy i QA mobilnego
- [ ] 5.1 Projekty Playwright: Pixel 7 + **WebKit/iPhone** (dziś tylko Desktop Chrome + `test.use` w `mobile.spec.ts`); smoke @mobile na obu.
- [ ] 5.2 e2e: pasek zbiorczy mieści się w 390 px, „wstecz” zamyka warstwy, brak overflow poziomego na każdej trasie (skrypt z audytu), cele dotyku ≥44 px (pomiar).
- [ ] 5.3 QA na prawdziwym telefonie (lista kontrolna): klawiatura w kompozytorze, haptyka, gesty, przewijanie z paskiem adresu, instalacja PWA.

### Do decyzji użytkownika
1. Wirtualizacja: wystarczy `content-visibility` + odchudzony kafel, czy robimy pełne okienkowanie (L, ryzyko z dnd-kit)?
2. Swipe: w prawo = przypnij, w lewo = archiwizuj (propozycja audytu) czy zostaje archiwum/kosz?
3. Precache: odchudzić do ~1,5 MB kosztem PDF/Statystyk offline dopiero po pierwszym użyciu?


## Plan rozbudowy Nauki i Dziennika budowy — 2026-10-15

Źródło: przegląd kodu działu (agent Plan). Dziennik pierwszy, potem Nauka. Każdy punkt = osobny commit.

**Decyzje (2026-10-15):** budowa jako pełna karta (nazwa, adres, inwestor, archiwum — D4b obowiązkowe); godziny pracy w raporcie z Grafiku; PDF przez widok do druku; start od D0. Domyślnie wg rekomendacji (do zmiany): wpisy w osobnej mapie Yjs + most „Do notatki”, synchronizacja ze sparowanymi urządzeniami, status problemu tak, GPS nie, 8 zdjęć na wpis, SM-2 z oceną automatyczną, własne materiały ręcznie (import PDF nie).

### D0 — szybkie naprawy (localStorage, bez zmiany modelu)
- [x] D0.1 Szkic wpisu w `kaczy.study.draft.v1` (`lib/study/draft.ts`): przeżywa zmianę zakładki, „Wpis z budowy” z karty (zmienia tylko temat) i odświeżenie; zdjęcia szkicu chronione przed odśmiecaniem (`journalImageRefs`).
- [x] D0.2 Zdjęcia w obróbce: kafelki z kółkiem, „Dodaj wpis” wyłączony do końca; limit liczony z góry.
- [x] D0.3 Rok w etykiecie dnia (inny rok), odmiana liczników (`lib/study/journalView.ts`), „Ctrl+Enter” schowane na dotyku.
- [x] D0.4 Limit dziennika 500 → 3000 + ostrzeżenie od 90% (usunięcie limitu w D1e).
- [x] D0.5 Zdjęcia dziennika pominięte w kopii trafiają do raportu (`BackupAttachmentReport.journalPhotos`).

### D1 — dane Nauki w Yjs (synchronizacja i kopia), migracja bez strat
- [x] D1a `lib/study/yStudy.ts` (bez importu `content.ts`): mapy `studyJournal`, `studyBoard`, `studyChecked`, `studyMissed`, `studyDays` (seria z dni), `studyRounds` (per urządzenie), `studyMeta`, `studyMigrations`; testy na dwóch `Y.Doc`. Wzór: `lib/shifts/yShifts.ts`.
- [x] D1b `store.ts` jako fasada (to samo API), migracja raz na urządzenie, stary klucz zostaje jako kopia.
- [x] D1c Zdjęcia dziennika w `referencedImages`/`syncableRefs` (`yjsStore.ts`) — odśmiecanie, P2P, plik sync.
- [x] D1d Sekcja `study` w pełnej kopii (`noteSchema.ts`), przywracanie do Yjs; stary format z `settings` czytany dalej.
- [x] D1e Bez limitu wpisów. ✅ 2026-10-15: instancja i migracja w `lib/study/data.ts` (przy starcie aplikacji, znacznik urządzenia w `studyMigrations`, seria → dni, rundy → licznik urządzenia), `StudyView` czeka na wczytanie (`useStudyReady`); kopia: sekcja `study` + Nauka w dawnym kształcie w `settings` dla starszych wersji, osobny przełącznik „Nauka i dziennik z budowy” przy przywracaniu, stara kopia czytana z `settings`. Testy: `yStudy.test.ts` (dwa dokumenty), `fullBackup.test.ts`, e2e migracji.

### D2 — szybki wpis z telefonu (zastępuje 2.10)
- [x] D2a Arkusz `JournalEntrySheet`: rodzaj (3 duże przyciski), pigułka budowy, tekst + mikrofon, „Aparat” (`capture`) i „Galeria”, zwinięty temat z listą, CTA „Zapisz wpis” nad klawiaturą; haptyka.
- [x] D2b Lista wpisów na górze; na komputerze „+ Wpis” w nagłówku.
- [x] D2c „+” w dolnym pasku na /nauka = „+ Wpis” (`/nauka?wpis=1`), skrót PWA „Wpis z budowy”.
- [x] D2d Dyktowanie offline: podpowiedź o mikrofonie klawiatury.
- [x] D2e Prośba o trwały zapis przy pierwszym zdjęciu. ✅ 2026-10-15: `JournalEntrySheet` (od dołu na telefonie, z boku na komputerze; zapis poza przewijaną treścią, nad klawiaturą dzięki `resizes-content`), stan otwarcia w `lib/study/entrySheet.ts`; temat zwinięty, rozwinięty przy wejściu z karty tematu; „Dokończ wpis” przy szkicu; pusty stan otwiera arkusz; „Aparat” tylko na dotyku; podpowiedź mikrofonu klawiatury bez Web Speech albo offline; skrót PWA drugi na liście. e2e `study.spec.ts` 12/12 (w tym telefon).

### D3 — edycja i problemy
- [x] D3a Edycja wpisu w arkuszu (data i godzina — wpis „za wczoraj”), „Usuń” w arkuszu zamiast kosza na liście.
- [x] D3b Problem otwarty/rozwiązany, licznik „Otwarte problemy: N”. ✅ 2026-10-15: ołówek na liście otwiera ten sam arkusz z osobnym formularzem edycji (`entrySheet.ts`, tylko w pamięci — szkic nowego wpisu nietknięty, zdjęcia edycji chronione przed odśmiecaniem); pigułka „Kiedy” (`datetime-local`, „Teraz”) w nowym wpisie i edycji, przyszłość przycięta do teraz; budowa w edycji zmienia tylko ten wpis; edycja na problem cofa temat z „Umiem”. Problem: pole `resolved` (moment rozwiązania), „Oznacz jako rozwiązany” / „Otwórz ponownie” na liście, „Problem rozwiązany” w arkuszu, licznik w nagłówku dziennika. Vitest 999/999, e2e `study.spec.ts` 13/13.

### D4 — budowy
- [x] D4a Pigułki ostatnich budów w arkuszu i filtrach. ✅ arkusz: 3 ostatnie przy pustej budowie, przy edycji do 6 pasujących (`suggestSites`); filtr budowy pigułkami zamiast listy.
- [x] D4b Karta budowy (nazwa, adres, inwestor, archiwum); wpis z `siteId` + kopią nazwy; migracja tekstowych nazw. ✅ mapa Yjs `studySites` (`lib/study/sites.ts`), karta z nagłówka budowy na osi czasu i z filtra (`SiteCardDialog`); stare nazwy → `siteKey(nazwa)` przy odczycie, bez przepisywania dokumentu; filtry, oś czasu i raport po `siteId`, adres i inwestor w raporcie; archiwum za pigułką „Archiwum (n)”.

### D5 — oś czasu i filtry
- [x] Dzień → budowa, przyklejone nagłówki dni; filtry rodzaju, budowy, tematu; szukanie bez ogonków; ostatnie 30 dni + „Pokaż starsze” (`journalView.ts`). ✅ 2026-10-15: czyste `filterJournal`, `groupJournal`, `journalSites`, `splitRecent` w `journalView.ts`; nagłówek dnia przyklejony pod nagłówkiem aplikacji z liczbą wpisów, budowa jako podtytuł grupy (zamiast na każdym wpisie); pigułki rodzaju (też „Otwarte”), listy budowy (z „Bez budowy”) i tematu; licznik „Otwarte problemy” przełącza filtr; każdy filtr szuka w całym dzienniku, bez filtra okno 30 dni. Vitest 1003/1003, e2e `study.spec.ts` 14/14.

### D6 — raport
- [x] D6a Raport dnia/zakresu dla budowy (markdown, czysta funkcja), godziny z Grafiku.
- [x] D6b „Udostępnij” (`navigator.share` z tekstem i zdjęciami; inaczej schowek).
- [x] D6c „Do notatki” (etykieta `budowa`, te same klucze zdjęć).
- [x] D6d PDF: widok do druku (`@media print`). ✅ 2026-10-15: `lib/study/report.ts` (`buildJournalReport`, `reportBody`/`reportText`, `workOn` — zmiana z Grafiku z odchyleniem, nieobecność jako „Grafik: Urlop”; godziny tylko z dni z wpisami), okno `JournalReport.tsx` („Raport” w nagłówku dziennika; budowa z filtra albo ostatnia, dzień jej ostatniego wpisu; Dziś/Wczoraj/7 dni/Ten miesiąc/Wybierz), podgląd jak kartka = układ wydruku; zdjęcia (do 10) wczytane z góry do `navigator.share`, bez share → „Kopiuj tekst”; `reportToNote` (etykieta `budowa`); wydruk w `#report-print` + `html.printing-report` (index.css). Vitest 1007/1007, e2e study 15/15.

### D7 — powiązania z nauką
- [ ] Problem z tematem → „Ćwicz teraz”; karta tematu pokazuje ostatni problem; pytania tematu należne dziś (po N3).

### N — Nauka
- [x] N1 (= 4.5) Nagłówek „Instalacje wod-kan”, pasek opanowania z modułami i podpisami na dotyk, podpisane przyciski kart, cyfry `tabular-nums` bez `font-display`, zakładka „Lista”. ✅ `MasteryStrip` w `StudyView.tsx`: odcinek na moduł z licznikiem, komórka jako przycisk (cel dotyku 26 px wysokości przy pasku 10 px) podpisuje temat pod paskiem; licznik w JetBrains Mono; karty tematu: „Wpis”, „Ćwicz”, „Do notatki” z podpisami, strzałki przeniesienia przy tytule.
- [ ] N2 Zapamiętana zakładka; na telefonie domyślnie Dziennik.
- [ ] N3 Powtórki SM-2 lite (`lib/study/srs.ts`, mapa `studyReview`), „Na dziś: N”.
- [ ] N4 Statystyki: trafność per temat, dni nauki, wpisy per budowa i miesiąc.
- [ ] N5 Własne pytania i punkty listy (`studyCustom`); import plików później.
- [ ] N6 Tablica i lista na telefonie: przełącznik kolumn, „Wyczyść odhaczenia” z „Cofnij”, pigułki ≥44 px.

Kolejność: D0 → D1 → D2 → D3 → D5 → D6 → D4 → N1 → N3 → reszta.

## Plan dopracowania UI: telefon i komputer — 2026-10-15

Źródło: przegląd kodu (agent Plan) + dokumentacja shadcn (context7), wersje z `npm view`. Kontrast to szacunki — zmierzyć axe. Nie powtarza zamkniętych punktów z planów UI, mobile i 2b. Kierunek „zeszyt” zostaje.

**Decyzje użytkownika (2026-10-15):**
- D1 „Tryb budowa” — osobny przełącznik w Ustawieniach, z wyborem (wyłączony / włączony / automatycznie przy `prefers-contrast: more`).
- D2 Na telefonie jako arkusz od dołu tylko formularze; pozostałe okna wyśrodkowane z marginesem (1.3).
- D3 Tak: podpisy dolnego paska 12 px i „Terminy” zamiast „Przypomnienia”.
- D4 Tailwind v4 + React 19 **teraz** — przed fazą 1, żeby nie poprawiać CSS dwa razy.
- D5 Zostaje własny `ui/sheet.tsx`, bez vaul.

### Faza 1 — szybkie wygrane (S)
- [x] 1.1 Dolny pasek chowa się przy klawiaturze na Androidzie (`html[data-typing]` z `focusin`/`visualViewport`; `keyboardInset.ts`, `BottomNav.tsx`, `index.css`). ✅ `data-typing` = fokus w polu tekstowym i klawiatura otwarta (iOS `--kb-inset` > 0, Android okno niższe o > 80 px od najwyższego przy tej szerokości); pasek zjeżdża przez `translate` + `invisible`.
- [x] 1.2 `vh` → `dvh`: `FocusMode.tsx:81`, `DrawingCanvas.tsx:230`, `ImportExternalDialog.tsx:81`, `ShortcutsDialog.tsx:87`, `StatsDialog.tsx:70`, `VersionHistory.tsx:39`, `ShiftSettingsDialog.tsx:33`, `YearSummaryDialog.tsx:33`.
- [x] 1.3 `ui/dialog.tsx`/`alert-dialog.tsx` na telefonie: margines, zaokrąglenie, `max-h-[calc(100dvh-2rem)]` z przewijaniem (zależy od D2). ✅ Margines `max-sm:max-w-[calc(100%-2rem)]`, `rounded-2xl`, przewijanie; `AlertDialog` wyśrodkowany zamiast arkusza (D2); pełnoekranowe okna wyłączają margines.
- [x] 1.4 Cele dotyku: zatwierdzenia i „⋯” w `SidebarFolderItem`/`SidebarLabelItem`/`SidebarFilterItem`, `ShiftsView.tsx:283,354`, nawigacja `ui/calendar.tsx:26` (`opacity-70`, `coarse:size-11`); e2e mierzący cele (5.2). ✅ ✓/✕ w pasku bocznym jako `IconButton size="sm"`, „⋯” i strzałka podfolderów z `::after` do 44 px, Grafik `coarse:h-11`, „Rozumiem” z `::after`; `e2e/touch-targets.spec.ts`.
- [x] 1.5 Jasny motyw: `--ring` ≥3:1 (jak `primary-ink`), osobny `--input` ~3:1 dla krawędzi pól; `--border` dekoracyjny zostaje. ✅ `--ring` 34 88% 39% (≥3,1:1 na wszystkich tłach), `--input` 220 14% 54% (≥3,1:1, także na `secondary`).
- [x] 1.6 `ViewSkeleton` zamiast `Suspense fallback={null}` (`Index.tsx:920,938,946`) + wstępne ładowanie widoku przy `pointerdown` w nawigacji.
- [x] 1.7 Haptyka niezależna od ograniczonego ruchu (`lib/haptics.ts`). ✅ Wyłącza ją tylko przełącznik „Wibracje na telefonie”, mysz i brak `navigator.vibrate`.
- [x] 1.8 Grafik: 9 px w `ShiftMonthGrid.tsx:151` → `text-2xs`/ikona; `AchievementStamp.tsx:49`. ✅ Strzałka nadgodzin i podpis pieczątki w `text-2xs` (11 px).
- [x] 1.9 (niski) Zapętlone animacje zatrzymane przy `document.hidden`. ✅ `lib/pageHidden.ts` → `html[data-hidden]`, jedna reguła CSS `animation-play-state: paused`.

### Faza 2 — średnie (M)
- [x] (poza planem, 2026-10-15) Style aplikacji: Plan, Neon, Zorza, Miedź obok Zeszytu (galeria w Wygląd, przejście kołem, własne kroje nagłówków) + mikrointerakcje framer-motion (przełączniki z `layoutId`, licznik w nagłówku, ikona motywu). Opis w `opis.md`.
- [x] 2.1 „Tryb budowa” (rękawice, słońce): `html[data-site]` — tekst 112,5%, cele 52–56 px (`--tap`), mocniejszy `muted-foreground`/krawędzie, bez kratki, toasty z „Cofnij” 8 s (D1). ✅ Wył./wł./auto (`prefers-contrast: more`) w Wygląd; `--tap` 54 px przez `.tap-target::after`; `site.css` nad każdym stylem.
- [x] 2.2 Dolny pasek: podpisy 12 px, wyraźniejsza aktywna pozycja (D3). ✅ „Terminy”, pigułka `primary/20`, pasek akcentu u góry (`layoutId`), pogrubiony podpis i kreska ikony; test 320 px.
- [x] 2.3 Komputer `xl`: Grafik i Kalendarz w dwóch kolumnach z przyklejonym panelem. ✅ `contents` + `order` trzyma kolejność na telefonie; panel Grafiku: Teraz, paleta, podsumowanie; Kalendarza: najbliższe terminy i wybrany dzień.
- [x] 2.4 Komputer: Dziennik ~48 rem + przyklejony panel filtrów i otwartych problemów. ✅ Panel „Filtry” (z chipem „Otwarte”) przyklejony obok wpisów; chipy się zawijają.
- [x] 2.5 `ui/responsive-dialog.tsx` (Dialog na `desk:`, arkusz na telefonie) i migracja ~8 okien (D2). ✅ Wariant `phone:` (przeciwieństwo `desk:`, też telefon w poziomie), 11 formularzy, przyklejony pasek przycisków.
- [x] 2.6 Jeden `StatusPanel` dla pustki, błędu, offline i „nic nie znaleziono”. ✅ `components/StatusPanel.tsx` (`page`/`inline`, rodzaj → kolor kreski i rola ARIA); `EmptyState`, `ViewErrorBoundary` (nowy stan „widok potrzebuje internetu”), Dziennik, raport, ostatnie akcje.
- [x] 2.7 `@axe-core/playwright` (`e2e/a11y.spec.ts`, oba motywy, 390/1440, wcag22aa, lista wyjątków zapadkowo). ✅ 5 widoków × 2 motywy × 2 rozmiary; naprawione tagline (`aria-label` na `<p>`), kontrast stopki, ⌘K i weekendów; jedyny wyjątek `target-size` paska opanowania Nauki na telefonie.
- [x] 2.8 Playwright: projekty iPhone 14 (webkit) i Pixel 7 dla `@smoke`/`@mobile`. ✅ Tylko `@mobile` (smoke z komputera nie pasuje do telefonu); cały `mobile.spec.ts` oznaczony; SW zablokowany w tych projektach; `npm run test:e2e:mobile`.

### Faza 3 — duże (L)
- [ ] 3.1 Kafel → edytor i swipe (= 4.1, 4.3) — po teście charakteryzującym i konwersji `NoteCard.tsx` do UTF-8 LF.
- [ ] 3.2 Wirtualizacja siatki dopiero przy >500 notatek (decyzja z planu mobile).
- [x] 3.3 Tailwind v4 + React 19 (D4). ✅ React 19 + react-day-picker 9, Tailwind 4 (`@tailwindcss/postcss`, `@config`), `tw-animate-css`, `tailwind-merge` 3; wygląd bez zmian (zrzuty v3/v4 ≤ 0,02%). Tokeny w `@theme` — osobno, jeśli trzeba.
- [x] 3.4 Paczka: `LazyMotion` + `m` (~−25–35 KB gzip), `y-webrtc` tylko przy synchronizacji, progi w `bundle.spec.ts` w dół. ✅ `LazyMotion strict` + `domMax` w osobnej paczce, bez `vendor-motion`; wejściowy JS 400,3 → 372,4 KB, próg 376 KB. `y-webrtc` już był dynamiczny.

### Biblioteki
- [x] Radix w obrębie major (`npm update`) + pełne e2e; `lucide-react` 0.462 → 1.x (sprawdzić zmienione nazwy). ✅ 12 paczek `@radix-ui/*` na najnowsze w swoim majorze; `lucide-react` 1.57 — importy na nazwy kanoniczne (15 aliasów, m.in. `Trash2`→`Trash`, `Loader2`→`LoaderCircle`, `Filter`→`Funnel`); ikony bez `aria-*` dostają `aria-hidden`.
- [x] `sonner` 1.7 → 2 po fazie 1 (własne nadpisania w `index.css:681-695`; sprawdzić changelog). ✅ 2.0.8 bez zmian w kodzie — używane API i atrybuty `data-sonner-*` zostały; e2e i zrzuty dymków zielone.
- Nie teraz: `react-day-picker` 10, vite 8 (Tailwind 4, `tailwind-merge` 3 i React 19 zrobione w 3.3). `recharts` 3 + shadcn Chart tylko przy N4.
- [x] Input OTP: kod parowania w Ustawienia → Sync (12 kratek 4-4-4, wklejanie linku, stary 8-znakowy kod); przy okazji naprawiony link `?pair=` z QR. PIN skarbca — nie dotyczy (skarbiec ma hasło).
- [x] Toggle Group: `ui/toggle-group.tsx` (Radix, `single`) w Segmented Ustawień, arkuszu Widoku, rodzaju zmiany i rodzaju wpisu — strzałki, jeden Tab, bez odznaczania. Pędzle Grafiku i galerie stylu zostają przy swoich.
- Komponenty shadcn: tak — Input OTP (parowanie, PIN skarbca), Toggle Group (grupy segmentowe), Breadcrumb (podstrony), Chart (N4); nie — Sidebar, Carousel; Drawer/vaul zależnie od D5; Command już jest.

Kolejność (po decyzjach): 3.3 Tailwind v4 + React 19 + shadcn (osobne commity: React 19 → Tailwind v4 → `tailwind-merge` 3 / `tw-animate-css`) → 1.5 → 1.1 → 1.4 → 1.2/1.3 → 1.6 → 1.7/1.8 → 2.7/2.8 → Radix + lucide → 2.1 → 2.2 → 2.3/2.4 → 2.5/2.6 → sonner, LazyMotion, Input OTP, Toggle Group → faza 3. Każdy krok: typecheck, lint, Vitest, build, e2e smoke, zrzuty 390/1440 w obu motywach, wpis w `opis.md`.

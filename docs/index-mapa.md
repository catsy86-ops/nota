# Mapa odpowiedzialności `src/pages/Index.tsx`

A2.1 planu `docs/plan-architektura-2026-11-15.md`. Stan na 2026-11-23 (1000 linii, ok. 60 wywołań hooków). Mapa jest podstawą
A2.2–A2.4: mówi, co można wynieść bez zmiany zachowania i co komu podaje dane. Numery linii są orientacyjne.

## 1. Grupy

| Grupa | Co jest w `Index` | Skąd bierze | Komu daje | Dokąd w A2 |
|---|---|---|---|---|
| **Dane** | `useNotesContext` (notatki, archiwum, kosz, etykiety, foldery, pola, wszystkie mutacje), `useNoteVersions`, `reminderNotes`, `debtReminders`, `notesRef`/`archivedRef`/`trashedRef`, `deleteNoteForever` | `NotesProvider`, `useNoteVersions` | wszystkim niżej | zostaje (źródło) |
| **Trasa i powłoka** | `useViewRoute` (`view`, `activeLabel`, `activeFolder`, `go`), `useViewShell` (`setView`, `search`, `deferredSearch`, `navigate`, `keptViews`, `mainRef`), `useViewScroll`, `sidebarOpen` + efekt telefon/komputer, `useIsMobile` | adres URL | nagłówek, pasek boczny, dolny pasek, lista | A2.3 (kontroler) |
| **Filtr i widok** | `useViewPrefs`, `deferredPrefs`, `useFilteredNotes` → `displayNotes`/`pinned`/`others`/`elsewhere`; `groupNotes` → `groups`, `visibleNotes`; tryby `listView`/`boardMode`/`tableMode`/`galleryMode`, `groupBy`, przypięte zwinięte | Dane, Trasa, `viewPrefs` | lista, tablica, tabela, galeria, zaznaczenie, czytnik, DnD | A2.3: `useNotesScreen().view`/`filtered` |
| **Terminy** | `useNextBoundary`, `reminderGroups`, `archivedRows`, `reminderRowCount`, `createReminderNote`, `attachReminder`, `effectiveRemindersLayout`; wywołania `onCreateNote`/`onSetReminder` Kalendarza (duplikat `createReminderNote`) | Filtr, Dane | `RemindersView`, `ReminderCalendarView`, `EmptyState` | A2.3; duplikat z Kalendarzem do jednej funkcji |
| **Zaznaczenie** | `useSelection`, `useSelectionGestures`, `useNoteActions` (pojedyncze i grupowe), `useBulkNoteOps`, `useNoteExport`, `confirmDeleteIds` | Filtr (`visibleNotes`), Dane | `NoteGrid`, `BulkActionBar`, `DeleteForeverDialog` | A2.3: `selection` + `actions` |
| **Tworzenie** | `addNoteRef`, `expandAddNote` (ponawianie do 3 s), `canCompose`, `composeDestination`, `useNoteGlowActions`, `useInboxCapture`, `findDuplicate`, szablon folderu | Trasa, Dane | `AddNoteBar`, `QuickTemplates`, `FolderTemplateActions`, skróty, paleta, dolny pasek | A2.3: `actions.compose` |
| **Nawigacja do notatek** | `useNoteNavigation` (`openNote`, `openDailyNote`, `openPeriodNote`, `goFilter`, `openSavedView`), `openNoteRef`, `useWikiLinkIndex`, `handleWikiClick`, `useLaunchIntents`, `useResumeView` | Dane, Trasa | lista, czytnik, paleta, pasek boczny | A2.3 |
| **Czytnik** | `useReaderNav`, `presentingNoteId`, `openPreviewFromCard`/`closeReaderToCard` (View Transitions), rejestracja w `gridKeyboardNav`, `markNoteOpened`, Alt+←/→ po `noteHistory`, `handleRestoreVersion` | Filtr, Nawigacja | `NoteReader`, `NoteGrid`, galeria, tabela | A2.4 (nakładki) + A2.2 (Alt+←/→) |
| **Nakładki i dialogi** | `useAppDialogs` (paleta, ustawienia, statystyki, skróty, skrzynka, pola, tryb skupienia, akcje), `useConfirmAction`, `CommandPalette`, `IndexDialogs`, `InboxTriage` (`triageOpen`/`triageMounted`), `EmptyTrashDialog`, `DeleteForeverDialog`, `NoteReader` | wszystko powyżej | — | A2.4: `IndexOverlays.tsx`, jeden reduktor |
| **Skróty** | `useGlobalShortcuts` (nowa notatka, widoki, cofnij/ponów z Grafikiem przez `shiftsStore`, Konami, Esc, paleta) | Tworzenie, Nakładki, Zaznaczenie | — | A2.2 (cofnij/ponów Grafiku do osobnego modułu), reszta zostaje |
| **Efekty bez widoku** | `useWhatsNew`; rozgrzewka czytnika i presetów Grafiku w bezczynności; `useReminderNotifications`; `useAchievementToasts`; `useBackupReminders`; `useDailyWeeklyNudges`; `setSearchTerms`; `registerUndoHandlers`; `useDayDoneReward`; `useOverdueBadge` (licznik też dla paska); ładowanie `shiftsStore` | Dane, Trasa | nikt (skutki uboczne) | A2.2: komponenty „bez widoku” |
| **Drobne** | `handleLogoClick` (trzy kliknięcia → fajerwerki), `useTheme`, `useHiddenViews`, `useTodayCards`, `navItems`, `inboxBadge`/`inboxCount` | — | pasek boczny, dolny pasek, Dziś | zostaje albo do kontrolera |
| **Przeciąganie** | `useNoteDnd` (+ tryb tablicy: `columnOfNote`, `moveToColumn`), `DndContext` | Filtr, Zaznaczenie | całe drzewo | zostaje (owija całość) |

## 2. Render (kolejność w JSX)

1. `DndContext` → `PaperBackdrop`, `AppSidebar`, `AppHeader`.
2. `main`: pięć pasków stanu danych (`RestoreInterrupted`, `DocFormat`, `DocReplaceNotice`, `DataLoss`, `OlderDevice`, na Dziś `NewCode`) — każdy dostaje tylko `requestSettingsTab(...) + setSettingsOpen(true)`.
3. `ViewTitle` (okruszki folderu/etykiety), `FolderTemplateActions`, wyszukiwarka na telefonie, `InstallBanner`, Skrzynka (`InboxCapture`, `InboxBar`, `InboxTriage`).
4. Widoki: `TodayCards`, `WidgetPanel`, `AddNoteBar`, nagłówek kosza, przypięte, `RemindersView`, grupy siatki, `NoteBoard`, `NoteGallery`, `NoteTable`, `ReminderCalendarView`, `StudyView` (Activity), `CwiczeniaView`, `DebtsView`, `ShiftsView` (Activity).
5. Komunikat liczby wyników, `EmptyState`, `DailyQuote`, pieczątka.
6. Poza `main`: synchronizatory bez widoku (`DailyReportNudge`, `ShiftEveningNudge`, `SiteArrivalPrompt`, `PushScheduleSync`, `StudyOverdueSync`), `CommandPalette`, `AchievementStamp`, `IndexDialogs`, `NoteReader`, `BottomNav`, `BulkActionBar`, `OnboardingTour`, `AppearanceLinkImport`, `QuickPresetsHost`, `confirmDialog`, `VaultHost`.

## 3. Obserwacje dla A2.2–A2.5

- **Każda zmiana notatki renderuje całość:** `useNotesContext` zwraca jeden obiekt, więc `AppSidebar`, `AppHeader`, `BottomNav` i `BulkActionBar` dostają nowe funkcje strzałkowe (`onGoView`, `onOpenSync` …) przy każdym renderze. Cel A2.5 (zmiana notatki nie renderuje nagłówka ani paska) wymaga stabilnych wywołań z kontrolera i `memo` na tych czterech komponentach.
- **Powtórzony kod:** `createReminderNote` (Terminy) i `onCreateNote` Kalendarza to ta sama funkcja; `onSetReminder` i `attachReminder` różnią się tylko `reminderDay`. Pięć pasków stanu powtarza `requestSettingsTab(x); setSettingsOpen(true)` — wystarczy `openSettingsTab(x)`.
- **`[...notes, ...archivedNotes, ...trashedNotes].find`** w `debtReminders` i w `onToggleChecklist` czytnika — liniowe przeszukiwanie przy każdym wywołaniu; przy A2.3 jedna mapa `byId` w kontrolerze.
- **Efekty bez interfejsu do wyniesienia w A2.2 (osobno, z testem):** rozgrzewka w bezczynności (172–180), Alt+←/→ po historii (430–444), `registerUndoHandlers` (447–452), `setSearchTerms` (386), cofnij/ponów Grafiku (`shiftsStore`, 215–218 i część `useGlobalShortcuts`), `markNoteOpened` (427).
- **Nakładki (A2.4):** stan otwarcia jest w trzech miejscach — `useAppDialogs`, lokalne `useState` (`triageOpen`, `confirmEmptyTrash`, `confirmDeleteIds`, `presentingNoteId`) i `useReaderNav`. `overlayHistory` (przycisk wstecz) zna tylko część z nich.
- **Kolejność nawigacji klawiaturą** zależy od `navOrder` podawanego do `renderGrid` (0 = przypięte, potem grupy); przy przenoszeniu list do kontrolera trzeba ją zachować.

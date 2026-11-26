import { countRender } from "@/lib/renderProbe";
import { canViewTransition } from "@/lib/viewTransition";
import { isAppView } from "@/lib/viewMeta";
import { Activity, useState, useCallback, useDeferredValue, useEffect, useMemo, useRef, Suspense } from "react";
import { flushSync } from "react-dom";
import { isMotionReduced } from "@/hooks/useMotionPref";
import { m as motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWhatsNew } from "@/hooks/useWhatsNew";
import { effectiveRemindersLayout, useRemindersLayoutChoice } from "@/lib/remindersLayout";
import { ViewErrorBoundary } from "@/components/ViewErrorBoundary";
import { InboxCapture } from "@/components/InboxCapture";
import { InboxBar } from "@/components/InboxBar";
import { useReaderNav } from "@/hooks/useReaderNav";
import { isInboxNote } from "@/lib/inbox";
import { useNotesContext } from "@/hooks/NotesProvider";
import { useNoteVersions } from "@/hooks/useNoteVersions";
import type { NoteVersion } from "@/hooks/useNoteVersions";
import { useReminderNotifications } from "@/components/useReminderNotifications";
import { useOverdueBadge } from "@/hooks/useOverdueBadge";
import { useTheme } from "@/hooks/useTheme";
import { useViewPrefs, toggleGroupCollapsed } from "@/lib/viewPrefs";
import { useViewRoute } from "@/hooks/useViewRoute";
import { useStudyOverdueCount } from "@/lib/studyOverdueCount";
import { splitWikiTarget } from "@/lib/wikiLinks";
import { requestHeading } from "@/lib/wikiHeading";
import { useLatestRef, useStableByKey, useStableFn } from "@/hooks/useLatestRef";
import { useWikiLinkIndex } from "@/hooks/useWikiLinkIndex";
import { useLaunchIntents } from "@/hooks/useLaunchIntents";
import { useResumeView } from "@/hooks/useResumeView";
import { setGridNavPreview, setGridNavPreviewTransitions } from "@/lib/gridKeyboardNav";
import { tween } from "@/lib/motion";
import { useNoteDnd } from "@/hooks/useNoteDnd";
import { useImportExport, useExternalImport } from "@/hooks/useImportExport";
import { useAchievementToasts } from "@/hooks/useAchievementToasts";
import { useSelection } from "@/hooks/useSelection";
import { useSelectionGestures } from "@/hooks/useSelectionGestures";
import { useBackupReminders } from "@/hooks/useBackupReminders";
import { useReminderSinkOn } from "@/lib/reminders/sink";
import { useDailyWeeklyNudges } from "@/components/useDailyWeeklyNudges";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { AddNoteBar } from "@/components/AddNoteBar";
import { InstallBanner } from "@/components/InstallBanner";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { ViewTitle } from "@/components/ViewTitle";
import { PageActionsProvider } from "@/components/PageActions";
import { NoteGrid } from "@/components/NoteGrid";
import { BoardColumn } from "@/components/BoardColumn";
import { NoteBoard } from "@/components/NoteBoard";
import { NoteTable } from "@/components/NoteTable";
import { NoteGallery } from "@/components/NoteGallery";
import { columnOfNote, NONE_COLUMN, PINNED_COLUMN } from "@/lib/boardColumns";
import { NoteGroupSection } from "@/components/NoteGroupSection";
import { folderCrumbs, labelCrumbs } from "@/lib/breadcrumbs";
import { FolderTemplateActions } from "@/components/FolderTemplateActions";
import { EmptyState } from "@/components/EmptyState";
import { sidebarItems } from "@/components/sidebar/sidebarItems";
import { useHiddenViews, isViewShown } from "@/lib/hiddenViews";
import { useTodayCards } from "@/lib/todayCards";
import { toast } from "sonner";
import { toastWithUndo } from "@/lib/undoToast";
import { useInboxCapture } from "@/hooks/useInboxCapture";
import { useNoteNavigation } from "@/hooks/useNoteNavigation";
import { useAppDialogs } from "@/hooks/useAppDialogs";
import { findTitleDuplicate } from "@/lib/noteDuplicate";
import { useNoteGlowActions } from "@/hooks/useNoteGlowActions";
import { useViewShell } from "@/hooks/useViewShell";
import { pluralPl } from "@/lib/plural";
import { DndContext, pointerWithin } from "@dnd-kit/core";
import { fireworks, megaCelebrate } from "@/lib/celebrate";
import { SearchBar } from "@/components/SearchBar";
import { useViewScroll } from "@/hooks/useViewScroll";
import { useDayDoneReward } from "@/hooks/useDayDoneReward";
import { AchievementStamp } from "@/components/AchievementStamp";
import { DailyQuote } from "@/components/DailyQuote";
import { PaperBackdrop } from "@/components/PaperBackdrop";
import { QuickTemplates } from "@/components/QuickTemplates";
import { useConfirmAction } from "@/components/ConfirmActionDialog";
import { BulkActionBar } from "@/components/BulkActionBar";
import { undoLastAction } from "@/lib/actionHistory";
import { BottomNav } from "@/components/BottomNav";
import { VaultHost } from "@/components/vault/VaultHost";
import { TodayCards } from "@/components/review/TodayCards";
import { OlderDeviceBanner } from "@/components/sync/OlderDeviceBanner";
import { NewCodeBanner } from "@/components/sync/NewCodeBanner";
import { RestoreInterruptedBanner } from "@/components/RestoreInterruptedBanner";
import { DocFormatBanner } from "@/components/DocFormatBanner";
import { DataLossBanner, DocReplaceNotice } from "@/components/DocReplaceBanners";
import { RemindersView } from "@/components/reminders/RemindersView";
import { AppearanceLinkImport } from "@/components/settings/AppearanceLinkImport";
import { QuickPresetsHost } from "@/components/settings/QuickPresets";
// Nasłuch „O aplikacji” od startu — leniwy host gubiłby kliknięcie sprzed doładowania; samo okno jest leniwe.
import { AboutHost } from "@/components/about/AboutHost";
import { SiteArrivalPrompt, WidgetPanel, OnboardingTour, StudyView, DebtsView, CwiczeniaView, ShiftsView, ReminderCalendarView, DailyReportNudge, PushScheduleSync, ShiftEveningNudge, StudyOverdueSync } from "./indexViews";
import { IdleWarmup, MarkOpenedSync, ReaderHistoryKeys, SearchTermsSync, UndoHandlersSync } from "./IndexEffects";
import { useShiftsUndo, useSidebarOpen } from "./indexHooks";
import { IndexOverlays } from "./IndexOverlays";
import { reminderWriters, useComposer, useNoteScreenActions, useNotesScreen } from "./useNotesScreen";

// Dialogs that aren't part of the initial view (opened via keyboard shortcut,
// note action or explicit toggle) — kept out of the eager main bundle so
// first load only pays for the code the note grid itself needs.
import { CardSkeleton, ViewSkeleton } from "@/components/ViewSkeleton";
import { Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestSettingsTab } from "@/lib/settingsDeepLink";
import type { DebtReminderApi } from "@/components/debts/DebtsView";

const Index = () => {
  countRender("Index");
  const {
    notes, archivedNotes, trashedNotes, allLabels, folders, propDefs,
    addNote, updateNote, deleteNote, trashNote, restoreFromTrash, togglePin, duplicateNote,
    archiveNote, unarchiveNote, addLabel, importNotes, reorderNotes, moveNoteToFolder, updateFolder,
    bulkRestore,
  } = useNotesContext();
  const { addVersion, getVersions, deleteVersions } = useNoteVersions();
  const { confirmAction, confirmDialog } = useConfirmAction();
  const { dark, toggle: toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  useWhatsNew();
  const remindersLayout = effectiveRemindersLayout(useRemindersLayoutChoice(), isMobile);
  const prefs = useViewPrefs();
  // Widok, folder, etykieta i zapytanie żyją w adresie (patrz `lib/viewRoute.ts`).
  const route = useViewRoute();
  const { view, label: activeLabel, folder: activeFolder, go } = route;
  const { setView, search, setSearch, deferredSearch, navigate, keptViews, mainRef } = useViewShell(route);

  const [sidebarOpen, setSidebarOpen] = useSidebarOpen(isMobile);
  const logoClicksRef = useRef<{ count: number; lastTs: number }>({ count: 0, lastTs: 0 });
  const dialogs = useAppDialogs();
  const { paletteOpen, setPaletteOpen, setActionsOpen, setSettingsOpen, setStatsOpen, setQuickInboxOpen, setShortcutsOpen, setPropDefsOpen, setFocusModeOpen, setTriageOpen, setConfirmEmptyTrash, setConfirmDeleteIds } = dialogs;
  const [presentingNoteId, setPresentingNoteId] = useState<string | null>(null);
  const { selectedIds, setSelectedIds, selectionMode, lastSelectedRef, clearSelection } = useSelection({ view, activeLabel, activeFolder });

  function handleLogoClick() {
    const now = Date.now();
    const state = logoClicksRef.current;
    if (now - state.lastTs > 600) state.count = 0;
    state.lastTs = now;
    state.count += 1;
    if (state.count >= 3) {
      state.count = 0;
      fireworks();
      toast.success("🎉 Niespodzianka!");
    }
  }

  const openNoteRef = useRef<(id: string) => void>(() => {});
  // Zmiana sortowania i układu (3.4): lista nadrabia, pasek ustawień reaguje od razu.
  const deferredPrefs = useDeferredValue(prefs);
  const {
    displayNotes, pinned, others, elsewhere, reminderNotes, reminderGroups, archivedRows, reminderRowCount,
    boardMode, tableMode, galleryMode, groupBy, showPinned, pinnedCollapsible, pinnedCollapsed, groups, visibleNotes, visibleNotesRef,
  } = useNotesScreen({ notes, archivedNotes, trashedNotes, folders, propDefs, view, activeLabel, activeFolder, deferredSearch, deferredPrefs, prefs });
  const groupCollapsedKey = (key: string) => `${groupBy}:${key}`;
  const { createReminderNote, setReminder, attachReminder } = reminderWriters(addNote, updateNote, prefs.defaultNoteColor);
  const openSettingsTab = (tab: Parameters<typeof requestSettingsTab>[0]) => { requestSettingsTab(tab); setSettingsOpen(true); };
  // Jedna mapa zamiast liniowego `find` po trzech listach przy każdym wywołaniu (mapa Index, A2.3).
  const byId = useMemo(() => new Map([...notes, ...archivedNotes, ...trashedNotes].map((n) => [n.id, n] as const)), [notes, archivedNotes, trashedNotes]);
  // Długi (1.1): rozliczenie zdejmuje termin notatki zwrotu; „Cofnij” oddaje poprzedni.
  const debtReminders = useMemo<DebtReminderApi>(() => ({
    clear: (id) => {
      const n = byId.get(id);
      if (!n || n.reminder === null) return null;
      updateNote(id, { reminder: null });
      return n.reminder;
    },
    restore: (id, at) => updateNote(id, { reminder: at }),
    get: (id) => byId.get(id)?.reminder ?? null,
    has: (id) => byId.has(id),
    remove: (id) => deleteNote(id),
  }), [byId, updateNote, deleteNote]);
  const pushEnabled = useReminderSinkOn();
  useReminderNotifications(
    reminderNotes,
    (id, nextReminder, reminderDay, reminderBase) => updateNote(id, { reminder: nextReminder, reminderDay, reminderBase }),
    (id) => openNoteRef.current(id),
    (id) => updateNote(id, { reminderRepeat: "none", reminderRepeatUntil: undefined }),
    trashedNotes,
    () => go("reminders"),
  );

  // Odznaki i pieczątki (logika w `useAchievementToasts`).
  useAchievementToasts({ notes, archivedNotes, allLabels, folders, onOpenStats: () => setStatsOpen(true) });

  useBackupReminders(prefs, notes, archivedNotes);
  useDailyWeeklyNudges(prefs, notes, setView);
  const openShifts = useCallback(() => setView("shifts"), [setView]);
  const shiftsUndo = useShiftsUndo(view);

  const { addNoteRef, canCompose, composeDestination, expandAddNote } = useComposer({ view, activeFolder, activeLabel, folders, setView });

  useGlobalShortcuts({
    onNewNote: expandAddNote,
    onOpenSettings: () => setSettingsOpen(true),
    onOpenStats: () => setStatsOpen(true),
    onQuickInbox: () => setQuickInboxOpen(true),
    onGoToday: () => go("today"),
    onGoWeek: () => go("week"),
    onGoView: (v) => go(v),
    onEasterEgg: () => { megaCelebrate(); toast.success("🎮 KONAMI! Pełen pokaz mocy!"); },
    hasSelection: () => selectedIds.size > 0,
    onEscapeSelection: clearSelection,
    onRedo: () => { shiftsUndo.redo(); },
    onUndo: () => {
      // Na widoku Grafiku Ctrl+Z cofa ostatnią zmianę w Grafiku (zanim sięgnie po kosz/archiwum).
      if (shiftsUndo.undo()) return;
      const done = undoLastAction();
      if (done) {
        toast.success(done.kind === "trash" ? "Cofnięto usunięcie" : "Cofnięto archiwizację", {
          description: done.label,
          icon: "↩️",
        });
      } else {
        toast("Nie ma czego cofać", { icon: "↩️" });
      }
    },
    onCloseSidebar: () => setSidebarOpen(false),
    isSidebarOpen: () => sidebarOpen,
    onOpenShortcuts: () => setShortcutsOpen(true),
    onTogglePalette: () => setPaletteOpen((o) => !o),
  });

  const { handleImport } = useImportExport(importNotes, addNote);
  const externalImport = useExternalImport();

  // Callbacki podawane kartom czytają notatki przez ref — patrz `useLatestRef`.
  const notesRef = useLatestRef(notes);
  const archivedRef = useLatestRef(archivedNotes);
  const trashedRef = useLatestRef(trashedNotes);

  const handleRestoreVersion = useCallback((noteId: string, version: NoteVersion) => {
    const current = notesRef.current.find((n) => n.id === noteId);
    if (current?.locked) return;
    const before = { title: current?.title || "", content: current?.content || "" };
    addVersion(noteId, before.title, before.content);
    updateNote(noteId, { title: version.title, content: version.content });
    // 5.10 (Notatki 1.2): bieżąca treść jest już w historii, a „Cofnij” wraca do niej od razu.
    toastWithUndo("Przywrócono wersję", () => updateNote(noteId, before), { id: `version-${noteId}` });
  }, [notesRef, updateNote, addVersion]);

  useDayDoneReward(view === "today" && !search ? displayNotes : null);
  // Przewinięcie per dział (3.6): wracając do działu, stoimy tam, gdzie z niego wyszliśmy.
  useViewScroll(view);
  const { allNotesForLinks, knownTitles, wikiIndex } = useWikiLinkIndex(notes, archivedNotes);
  const findDuplicate = useCallback((title: string) => findTitleDuplicate(title, allNotesForLinks), [allNotesForLinks]);
  const allNotesForLinksRef = useLatestRef(allNotesForLinks);
  const { openSavedView, goFilter, openNote, openDailyNote, openPeriodNote } = useNoteNavigation({
    route, folders, notes, archivedNotes, notesRef, archivedRef, trashedRef, openNoteRef,
    addNote, updateNote, addLabel, isMobile, setSearch, setSidebarOpen,
  });

  const handleWikiClick = useCallback((raw: string) => {
    const { title, heading } = splitWikiTarget(raw);
    const target = allNotesForLinksRef.current.find((n) => n.title.trim().toLowerCase() === title.toLowerCase());
    if (!target) { toast.info(`Notatka „${title}" nie istnieje`); return; }
    if (heading && !target.locked) {
      // Do nagłówka przewija czytnik, więc notatka otwiera się w podglądzie.
      requestHeading(heading);
      setPresentingNoteId(null);
      setGridNavPreview(target.id);
    } else openNote(target.id);
  }, [allNotesForLinksRef, openNote]);

  // Czytnik i prezentacja (logika w `useReaderNav`).
  const { previewId, readerId, readerNote, readerSteps, copyTarget, closeReader, showInReader, stepReader, editFromReader, splitNote, setSplit } = useReaderNav({
    notes, archivedNotes, trashedNotes, visibleNotes, presentingNoteId, setPresentingNoteId, paletteOpen, selectedIds, openNote,
  });
  const showPreview = useCallback((id: string) => showInReader(id, "preview"), [showInReader]);
  const { toggleSelect } = useSelectionGestures({ view, visibleNotesRef, previewId, presentingNoteId, setSelectedIds, lastSelectedRef });

  // Czytnik/prezentacja też liczy się jako „otwarcie” (sortowanie „Ostatnio otwierane”).
  // Kafel → podgląd (plan motywów 4.3): kafel i czytnik dzielą nazwę przejścia `note-shared`, więc kafel „wpływa”
  // w podgląd. Nazwa wisi na kaflu tylko przez przejście; bez wsparcia, przy ograniczonym ruchu albo bez kafla — od razu.
  const openPreviewFromCard = useCallback((id: string) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    const card = document.querySelector<HTMLElement>(`[data-note-id-wrap="${CSS.escape(id)}"]`);
    if (!canViewTransition() || isMotionReduced() || !card) { showInReader(id, "preview"); return; }
    card.style.viewTransitionName = "note-shared";
    const t = doc.startViewTransition(() => flushSync(() => showInReader(id, "preview")));
    void t.finished.finally(() => { card.style.viewTransitionName = ""; });
  }, [showInReader]);
  // M4.2: zamknięcie podglądu odwraca wejście — czytnik „wpływa” z powrotem w kafel. Wychodzący czytnik zostaje w DOM
  // na czas wyjścia (`AnimatePresence`), więc w nowej migawce zdejmujemy z niego nazwę i go chowamy, a nazwę dostaje
  // kafel — dwa elementy z tą samą nazwą przerwałyby przejście. Kafel poza ekranem albo prezentacja — zwykłe zamknięcie.
  const closeReaderToCard = useCallback(() => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    const card = previewId && !presentingNoteId ? document.querySelector<HTMLElement>(`[data-note-id-wrap="${CSS.escape(previewId)}"]`) : null;
    const r = card?.getBoundingClientRect();
    const onScreen = !!r && r.bottom > 0 && r.top < window.innerHeight;
    const reader = document.querySelector<HTMLElement>('[data-reader-mode="preview"]');
    if (!card || !onScreen || !reader || !canViewTransition() || isMotionReduced()) { closeReader(); return; }
    const t = doc.startViewTransition(() => {
      flushSync(closeReader);
      reader.style.viewTransitionName = "none";
      reader.style.visibility = "hidden";
      card.style.viewTransitionName = "note-shared";
    });
    void t.finished.finally(() => { card.style.viewTransitionName = ""; });
  }, [previewId, presentingNoteId, closeReader]);
  useEffect(() => {
    setGridNavPreviewTransitions({ open: openPreviewFromCard, close: closeReaderToCard });
    return () => setGridNavPreviewTransitions(null);
  }, [openPreviewFromCard, closeReaderToCard]);
  // Notatka tworzona w folderze albo w widoku etykiety ląduje tam, gdzie
  // użytkownik patrzy — inaczej znika mu z oczu i wymaga przeciągnięcia.
  const activeFolderObj = view === "folder" && activeFolder ? folders.find((f) => f.id === activeFolder) ?? null : null;
  const { handleAddNoteGlow, handleComposerAdd, composerParents, handleMoveToFolderGlow } = useNoteGlowActions({ notes, view, activeLabel, activeFolder, addNote, updateNote, deleteNote, moveNoteToFolder });

  const {
    handleTrashSingle, handleArchiveSingle, handleBulkTrash, handleBulkArchive, handleBulkColor, handleSelectAll,
    exportSelectedAs, exportSelectedZip, deleteNoteForever, handleDelete,
    restoreSelected, pinSelected, moveSelectedToFolder, labelSelected, moveToColumn, mergeSelected, favoriteSelected, prioritySelected,
  } = useNoteScreenActions({
    view, groupBy, selection: { selectedIds, setSelectedIds, clearSelection }, confirmAction, visibleNotes, notesRef,
    moveToFolder: handleMoveToFolderGlow, deleteVersions,
  });

  useLaunchIntents({ navigate, addNote: handleAddNoteGlow, openNote, expandComposer: expandAddNote, openQuickInbox: () => setQuickInboxOpen(true) });
  useResumeView(navigate);

  // Licznik w pasku bocznym tylko przy tym, co wymaga uwagi: zaległe przypomnienia i Kosz.
  // Ta sama liczba ląduje w tytule karty i na ikonie aplikacji (useOverdueBadge).
  // Zaległości: aktywne notatki plus terminy Pracy (D1); archiwum nie liczy się (D4).
  // Skrzynka 5.3: nieposortowane notatki — liczone tylko dla znaczka, gdy użytkownik to włączył.
  const inboxBadge = useMemo(() => notes.reduce((n, note) => n + (isInboxNote(note) ? 1 : 0), 0), [notes]);
  const overdueCount = useOverdueBadge(notes, useStudyOverdueCount(), inboxBadge);
  const { sensors, setDraggingNoteId, handleDragStart, handleDragEnd } = useNoteDnd({
    displayNoteIds: displayNotes.map((n) => n.id),
    folders,
    moveNoteToFolder: handleMoveToFolderGlow,
    reorderNotes,
    selectedIds,
    clearSelection,
    folderOf: (id) => notesRef.current.find((n) => n.id === id)?.folderId ?? null,
    board: boardMode
      ? {
          columnOf: (id) => {
            const n = notesRef.current.find((x) => x.id === id);
            return n ? columnOfNote(n, groupBy) : undefined;
          },
          onMove: (ids, key) => moveToColumn(ids, key),
        }
      : undefined,
  });


  const renderGrid = (gridNotes: typeof displayNotes, navOrder: number) => (
    <NoteGrid
      navOrder={navOrder}
      notes={gridNotes}
      onUpdate={view === "trash" ? undefined : updateNote}
      onDelete={handleDelete}
      onTogglePin={view === "trash" ? undefined : togglePin}
      onDuplicate={view === "trash" ? undefined : duplicateNote}
      onArchive={view === "archive" ? undefined : view === "trash" ? undefined : handleArchiveSingle}
      onUnarchive={view === "archive" ? unarchiveNote : view === "trash" ? restoreFromTrash : undefined}
      isArchived={view === "archive" || view === "trash"}
      reminderActions={view === "reminders"}
      inboxAge={view === "inbox"}
      onMoveToFolder={view === "trash" ? undefined : handleMoveToFolderGlow}
      getVersions={getVersions}
      onSaveVersion={addVersion}
      onRestoreVersion={handleRestoreVersion}
      onPresent={setPresentingNoteId}
      knownTitles={knownTitles}
      onWikiClick={handleWikiClick}
      wikiIndex={wikiIndex}
      onOpenNote={openNote}
      selectedIds={selectedIds}
      selectionMode={selectionMode}
      onToggleSelect={toggleSelect}
    />
  );

  // Skrzynka: notatki do posortowania (bez folderu i etykiet); licznik w pasku bocznym.
  // Plan-nowy 3.6: jedno liczenie Skrzynki (wcześniej osobno `inboxBadge` i `inboxCount` z tym samym wzorem).
  const inboxCount = inboxBadge;
  const { captureToInbox, captureFilesToInbox } = useInboxCapture({ addNote: handleAddNoteGlow, deleteNote, addLabel, folders });

  const hiddenViews = useHiddenViews();
  const todayCards = useTodayCards();
  const navItemsFresh = sidebarItems({ inbox: inboxCount, overdue: overdueCount, trash: trashedNotes.length }).filter((i) => isViewShown(hiddenViews, i.view));
  // Nowa tablica przy każdym renderze unieważniałaby `memo` paska — odświeżamy ją tylko, gdy zmienią się działy lub liczniki.
  const navItems = useStableByKey(navItemsFresh, navItemsFresh.map((i) => `${i.view}:${i.count ?? ""}`).join("|"));

  // Nagłówek i pasek boczny są w `memo`: handlery mają stałą tożsamość (`useStableFn`), więc zmiana notatki ich nie renderuje (A2.5).
  const closeSidebar = useStableFn(() => setSidebarOpen(false));
  const toggleSidebar = useStableFn(() => setSidebarOpen(!sidebarOpen));
  const openPalette = useStableFn(() => setPaletteOpen(true));
  const openActions = useStableFn(() => setActionsOpen(true));
  const openStats = useStableFn(() => setStatsOpen(true));
  const openFocusMode = useStableFn(() => setFocusModeOpen(true));
  const openSyncSettings = useStableFn(() => openSettingsTab("sync"));
  const sidebarGoView = useStableFn((v: Parameters<typeof setView>[0]) => { setView(v); if (isMobile) setSidebarOpen(false); });
  const sidebarOpenNote = useStableFn((id: string) => { openNote(id); if (isMobile) setSidebarOpen(false); });
  const sidebarGoLabel = useStableFn((label: string) => { go("label", { label }); if (isMobile) setSidebarOpen(false); });
  const sidebarGoFolder = useStableFn((id: string) => { go("folder", { folder: id }); if (isMobile) setSidebarOpen(false); });
  const stableGoFilter = useStableFn(goFilter);
  const stableOpenSavedView = useStableFn(openSavedView);
  const stableToggleTheme = useStableFn(toggleTheme);
  const stableSetSearch = useStableFn(setSearch);
  const stableImport = useStableFn(handleImport);
  const stableLogoClick = useStableFn(handleLogoClick);

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDraggingNoteId(null)}>
    <PaperBackdrop />
    <div className="min-h-screen flex relative">
      <AppSidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        view={view}
        activeLabel={activeLabel}
        activeFolder={activeFolder}
        onGoView={sidebarGoView}
        onOpenNote={sidebarOpenNote}
        onGoLabel={sidebarGoLabel}
        onGoFolder={sidebarGoFolder}
        onGoFilter={stableGoFilter}
        onOpenView={stableOpenSavedView}
        search={search}
        sidebarItems={navItems}
        onLogoClick={stableLogoClick}
        dark={dark}
        onToggleTheme={stableToggleTheme}
        onOpenPalette={openPalette}
        onOpenActions={openActions}
        onOpenStats={openStats}
        onOpenFocusMode={openFocusMode}
        onSettingsOpenChange={setSettingsOpen}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader
          onOpenSync={openSyncSettings}
          onOpenPalette={openPalette}
          selectionMode={selectionMode}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          dark={dark}
          onToggleTheme={stableToggleTheme}
          view={view}
          activeFolder={activeFolder}
          activeLabel={activeLabel}
          search={search}
          onSearchChange={stableSetSearch}
          onImport={stableImport}
        />

        {/* `flex gap`, nie `space-y`: ukryta na sm+ wyszukiwarka nie dokłada marginesu nad treścią. */}
        {/* Dziś na telefonie: ciaśniejsze odstępy między kartami, mniej przewijania na 390 px. */}
        {/* Akcje widoków trafiają do główki przez portal (nowy plan 1.1). */}
        <PageActionsProvider>
        <main ref={mainRef} className={`flex-1 max-w-[calc(var(--page-wide)+3rem)] mx-auto w-full px-page py-6 sm:py-8 flex flex-col pb-safe ${view === "today" ? "gap-4 sm:gap-stack" : "gap-stack"}`}>
          <RestoreInterruptedBanner onOpenBackup={() => openSettingsTab("backup")} />
          <DocFormatBanner />
          <DocReplaceNotice onOpenSync={() => openSettingsTab("sync")} />
          <DataLossBanner onOpenBackup={() => openSettingsTab("backup")} />
          <OlderDeviceBanner onOpenSync={() => openSettingsTab("sync")} />
          {view === "today" && <NewCodeBanner onOpenSync={() => openSettingsTab("sync")} />}
          {/* Główka kartki w każdym dziale (plan wyglądu, Faza 1); lewa krawędź wspólna z treścią (nowy plan 1.2). */}
          {view !== "widget" && (
            <ViewTitle
              view={view}
              title={view === "folder" ? folders.find((f) => f.id === activeFolder)?.name || "Folder" : view === "label" ? `#${activeLabel?.split("/").pop() ?? ""}` : undefined}
              crumbs={(view === "folder" ? folderCrumbs(folders, activeFolder) : view === "label" ? labelCrumbs(activeLabel) : []).map((c) => ({
                label: c.label,
                onClick: () => (c.target.kind === "folder" ? go("folder", { folder: c.target.id }) : go("label", { label: c.target.label })),
              }))}
              count={isAppView(view) || view === "reminders" ? undefined : displayNotes.length}
            />
          )}
          {view === "folder" && activeFolderObj && (
            <FolderTemplateActions
              folder={activeFolderObj}
              onSetTemplate={(templateId) => updateFolder(activeFolderObj.id, { templateId })}
              onCreate={(t) => {
                const data = t.build();
                data.labels.forEach(addLabel);
                const id = handleAddNoteGlow(data.title, data.content, data.color, data.labels, null, [], data.checklist);
                // Zostajemy w folderze (revealNote przełączyłby na Notatki): kafel pojawia się tu i otwiera do edycji.
                setTimeout(() => document.querySelector<HTMLElement>(`[data-note-id-wrap="${window.CSS.escape(id)}"] .cursor-pointer`)?.click(), 150);
              }}
            />
          )}
          {!isAppView(view) && (
            <div data-view-static className="sm:hidden">
              <SearchBar value={search} onChange={setSearch} />
            </div>
          )}
          {view === "notes" && <InstallBanner ready={notes.length >= 3} />}
          {view === "inbox" && !deferredSearch && <InboxCapture onCapture={captureToInbox} onFiles={captureFilesToInbox} labels={allLabels} folders={folders} />}
          {view === "inbox" && !deferredSearch && <InboxBar count={inboxCount} onTriage={() => setTriageOpen(true)} />}


          {view === "today" && (
            <TodayCards searching={!!deferredSearch} go={go} notes={notes} folders={folders} reminderNotes={reminderNotes} todayCards={todayCards}
              openNote={openNote} openDailyNote={openDailyNote} addNote={addNote} updateNote={updateNote} togglePin={togglePin}
              archiveNote={archiveNote} unarchiveNote={unarchiveNote} trashNote={trashNote} restoreFromTrash={restoreFromTrash}
              handleArchiveSingle={handleArchiveSingle} handleMoveToFolderGlow={handleMoveToFolderGlow} inboxCount={inboxCount} />
          )}

          {view === "widget" && (
            <ViewErrorBoundary name="Widżet">
              <Suspense fallback={<CardSkeleton />}>
                <WidgetPanel notes={reminderNotes} onOpen={openNote} onOpenToday={() => go("today")} onNew={() => expandAddNote()} onUpdate={updateNote} />
              </Suspense>
            </ViewErrorBoundary>
          )}
          {canCompose && (
            <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={tween.enter}
              // Zwinięty pasek jest pod `md` schowany — pusty pojemnik dokładał drugi odstęp `gap` nad notatkami (~50 px).
              className="space-y-3 max-md:[&:not(:has([data-composer-open]))]:hidden">
              <div data-add-note-bar>
                <AddNoteBar ref={addNoteRef} onAdd={handleComposerAdd} findDuplicate={findDuplicate} onOpenDuplicate={openNote} wikiTitles={wikiIndex.titles} parentOptions={composerParents} folders={folders} allLabels={allLabels} onCreateLabel={addLabel} destination={composeDestination}
                  templates={(done) => (
                    <QuickTemplates
                      onPick={(...args) => { done(); handleAddNoteGlow(...args); }}
                      onCreateLabel={addLabel}
                      onDailyNote={() => { done(); openDailyNote(); }}
                      onPeriodNote={(kind) => { done(); openPeriodNote(kind); }}
                    />
                  )}
                />
              </div>
            </motion.div>
          )}

          {view === "trash" && trashedNotes.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-4 px-1">
              <p className="ui-hint">Notatki w koszu są automatycznie usuwane po 30 dniach</p>
              <Button variant="ghost" size="sm" onClick={() => setConfirmEmptyTrash(true)}
                className="shrink-0 text-destructive-ink hover:bg-destructive/10 hover:text-destructive-ink coarse:min-h-11">
                Opróżnij kosz
              </Button>
            </motion.div>
          )}

          {showPinned && !boardMode && !tableMode && !galleryMode && (
            <NoteGroupSection
              groupKey="pinned"
              label="Przypięte"
              icon={Pin}
              count={pinned.length}
              collapsible={pinnedCollapsible}
              collapsed={pinnedCollapsed}
              onToggle={() => toggleGroupCollapsed("pinned")}
            >
              {renderGrid(pinned, 0)}
            </NoteGroupSection>
          )}

          {view === "reminders" && (
            <RemindersView go={go} reminderNotes={reminderNotes} reminderGroups={reminderGroups} archivedRows={archivedRows} remindersLayout={remindersLayout}
              openNote={openNote} updateNote={updateNote} createReminderNote={createReminderNote} attachReminder={attachReminder} renderGrid={renderGrid} />
          )}
          {view !== "reminders" && !boardMode && !tableMode && !galleryMode && groups.map((group, gi) => {
            const grid = (navOrder: number) => renderGrid(group.notes, navOrder);
            // Bez podziału: jedna sekcja jak dotąd („Inne” tylko pod przypiętymi).
            if (groupBy === "none") {
              return showPinned ? (
                <NoteGroupSection key="others" groupKey="others" label="Inne" count={group.notes.length}>
                  {grid(1)}
                </NoteGroupSection>
              ) : (
                <section key="others">{grid(1)}</section>
              );
            }
            // Kolejność sekcji = kolejność nawigacji klawiaturą; zwinięta nie renderuje siatki, więc jest pomijana.
            return (
              <NoteGroupSection
                key={`${groupBy}:${group.key}`}
                groupKey={`${groupBy}-${group.key}`}
                label={group.label}
                count={group.notes.length}
                collapsible
                collapsed={prefs.collapsedGroups.includes(groupCollapsedKey(group.key))}
                onToggle={() => toggleGroupCollapsed(groupCollapsedKey(group.key))}
              >
                {grid(gi + 1)}
              </NoteGroupSection>
            );
          })}

          {boardMode && (
            <NoteBoard
              headers={[
                ...(showPinned ? [{ key: PINNED_COLUMN, label: "Przypięte", icon: Pin, count: pinned.length }] : []),
                ...groups.map((group) => ({ key: group.key || NONE_COLUMN, label: group.label, count: group.notes.length })),
              ]}
            >
              {showPinned && (
                <BoardColumn columnKey={PINNED_COLUMN} label="Przypięte" icon={Pin} count={pinned.length}>
                  {renderGrid(pinned, 0)}
                </BoardColumn>
              )}
              {groups.map((group, gi) => (
                <BoardColumn key={`${groupBy}:${group.key}`} columnKey={group.key || NONE_COLUMN} label={group.label} count={group.notes.length} droppable={groupBy !== "date"}>
                  {renderGrid(group.notes, gi + 1)}
                </BoardColumn>
              ))}
            </NoteBoard>
          )}

          {galleryMode && (
            <>
              <div className="mb-2 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setPropDefsOpen(true)}>
                  Pola{propDefs.length ? ` (${propDefs.length})` : ""}
                </Button>
              </div>
              <NoteGallery
                notes={[...(showPinned ? pinned : []), ...others]}
                selectedIds={selectedIds}
                onOpen={(id) => openPreviewFromCard(id)}
                propDefs={propDefs}
              />
            </>
          )}

          {tableMode && (
            <>
              <div className="mb-2 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setPropDefsOpen(true)}>
                  Pola{propDefs.length ? ` (${propDefs.length})` : ""}
                </Button>
              </div>
              <NoteTable
                notes={[...(showPinned ? pinned : []), ...others]}
                folders={folders}
                sortKey={prefs.sortKey}
                sortDir={prefs.sortDir}
                selectedIds={selectedIds}
                onOpen={(id) => openPreviewFromCard(id)}
                propDefs={propDefs}
                onUpdate={updateNote}
              />
            </>
          )}

          {view === "calendar" && (
            <ViewErrorBoundary name="Kalendarz">
              <Suspense fallback={<ViewSkeleton view="calendar" />}>
                <ReminderCalendarView
                  notes={reminderNotes}
                  onCreateNote={createReminderNote}
                  onOpenNote={(id) => openNote(id)}
                  onSetReminder={setReminder}
                />
              </Suspense>
            </ViewErrorBoundary>
          )}

          <Activity mode={view === "study" ? "visible" : "hidden"}>
            {(view === "study" || keptViews.includes("study")) && (
              <ViewErrorBoundary name="Praca">
                <Suspense fallback={<ViewSkeleton view="study" />}>
                  <StudyView />
                </Suspense>
              </ViewErrorBoundary>
            )}
          </Activity>

          {view === "cwiczenia" && (
            <ViewErrorBoundary name="Ćwiczenia">
              <Suspense fallback={<ViewSkeleton view="cwiczenia" />}>
                <CwiczeniaView />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {view === "debts" && (
            <ViewErrorBoundary name="Długi">
              <Suspense fallback={<ViewSkeleton view="debts" />}>
                <DebtsView addReminderNote={(title, content, at, labels) => addNote(title, content, prefs.defaultNoteColor, labels, at)} reminders={debtReminders} />
              </Suspense>
            </ViewErrorBoundary>
          )}

          <Activity mode={view === "shifts" ? "visible" : "hidden"}>
            {(view === "shifts" || keptViews.includes("shifts")) && (
              <ViewErrorBoundary name="Grafik">
                <Suspense fallback={<ViewSkeleton view="shifts" />}>
                  <ShiftsView notes={reminderNotes} />
                </Suspense>
              </ViewErrorBoundary>
            )}
          </Activity>

          {/* Liczba wyników dla czytnika ekranu — lista zmienia się bez żadnego komunikatu. */}
          <p role="status" aria-live="polite" className="sr-only">
            {deferredSearch && !isAppView(view) ? `${displayNotes.length} ${pluralPl(displayNotes.length, ["wynik", "wyniki", "wyników"])}` : ""}
          </p>
          <AnimatePresence>
            {!isAppView(view) && view !== "widget" && displayNotes.length === 0 && reminderRowCount === 0 && <EmptyState key="empty" view={view} search={deferredSearch} elsewhere={elsewhere} onGo={setView} onNew={view === "inbox" ? undefined : () => expandAddNote(view === "reminders" ? "reminder" : undefined)} onClearSearch={() => setSearch("")} />}
          </AnimatePresence>
          {view === "notes" && displayNotes.length > 0 && !deferredSearch && <DailyQuote />}
          {/* Tabliczka rysunkowa na końcu kartki (nowy plan 1.4, NP-3): po ostatniej sekcji, a przy krótkiej treści
              na dole ekranu (`margin-top: auto`). Napis wybiera `html[data-view]`, styl w `index.css`. */}
          <span aria-hidden className="paper-stamp" />
        </main>
        </PageActionsProvider>
      </div>
    </div>

    <IdleWarmup />
    <SearchTermsSync search={search} />
    <UndoHandlersSync restore={bulkRestore} unarchive={unarchiveNote} />
    <MarkOpenedSync noteId={readerId} />
    <ReaderHistoryKeys notesRef={notesRef} archivedRef={archivedRef} show={showPreview} />
    <Suspense fallback={null}>
      <DailyReportNudge onOpenWork={() => setView("study")} />
      <ShiftEveningNudge onOpenShifts={openShifts} />
      <SiteArrivalPrompt />
      {pushEnabled && <PushScheduleSync notes={reminderNotes} />}
      <Suspense fallback={null}>
        <StudyOverdueSync />
      </Suspense>
    </Suspense>

    <AchievementStamp />
    <IndexOverlays
      dialogs={dialogs} view={view} search={search} byId={byId} reminderNotes={reminderNotes}
      allNotesForLinks={allNotesForLinks} knownTitles={knownTitles} wikiIndex={wikiIndex}
      reader={{ readerNote, readerSteps, copyTarget, stepReader, editFromReader, showInReader, splitNote, setSplit }}
      presenting={!!presentingNoteId} closeReader={closeReaderToCard}
      openNote={openNote} openDailyNote={openDailyNote} openPeriodNote={openPeriodNote} goFilter={goFilter} setView={setView}
      expandAddNote={expandAddNote} toggleTheme={toggleTheme}
      noteActions={{ archive: handleArchiveSingle, trash: handleTrashSingle, moveToFolder: handleMoveToFolderGlow, deleteForever: deleteNoteForever, deleteVersions }}
      clearSelection={clearSelection} externalImport={externalImport} captureToInbox={captureToInbox} captureFilesToInbox={captureFilesToInbox}
    />
    <BottomNav
      view={view}
      onGo={setView}
      onOpenPalette={() => setPaletteOpen(true)}
      onNew={(action) => expandAddNote(action)}
      onImport={handleImport}
      onGoFilter={goFilter}
      search={search}
      onOpenSettings={() => setSettingsOpen(true)}
      onOpenActions={() => setActionsOpen(true)}
      trashCount={trashedNotes.length}
      inboxCount={inboxCount}
      dark={dark}
      onToggleTheme={toggleTheme}
    />
    <BulkActionBar
      count={selectedIds.size}
      totalVisible={visibleNotes.length}
      onSelectAll={handleSelectAll}
      onClear={clearSelection}
      onArchive={handleBulkArchive}
      onTrash={handleBulkTrash}
      onColor={handleBulkColor}
      folders={folders}
      allLabels={allLabels}
      onPin={pinSelected}
      onMoveToFolder={moveSelectedToFolder}
      onAddLabel={labelSelected}
      onMerge={mergeSelected}
      onFavorite={favoriteSelected}
      onExportHtml={() => void exportSelectedAs("html")}
      onExportPdf={() => void exportSelectedAs("pdf")}
      onPriority={prioritySelected}
      view={view === "trash" ? "trash" : view === "archive" ? "archive" : "other"}
      onRestore={restoreSelected}
      onDeleteForever={() => setConfirmDeleteIds(Array.from(selectedIds))}
      onExport={exportSelectedZip}
    />
    {/* Poza Suspense: leniwe sąsiedztwo (samouczek) odkładałoby montaż i gubiło kliknięcie „O aplikacji”. */}
    <AboutHost />
    <Suspense fallback={null}>
      <OnboardingTour />
      <AppearanceLinkImport />
      <QuickPresetsHost />
    </Suspense>
    {confirmDialog}
    <VaultHost />
    </DndContext>
  );
};

export default Index;

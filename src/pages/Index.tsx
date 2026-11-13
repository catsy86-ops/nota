import { canViewTransition } from "@/lib/viewTransition";
import { loadShiftPresets } from "@/hooks/useShiftPresets";
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
import { setSearchTerms } from "@/lib/searchTerms";
import { highlightTokens } from "@/lib/searchQuery";
import { isInboxNote } from "@/lib/inbox";
import { useNotesContext } from "@/hooks/NotesProvider";
import { useNoteVersions } from "@/hooks/useNoteVersions";
import type { NoteVersion } from "@/hooks/useNoteVersions";
import { useReminderNotifications } from "@/hooks/useReminderNotifications";
import { useOverdueBadge } from "@/hooks/useOverdueBadge";
import { useTheme } from "@/hooks/useTheme";
import { useViewPrefs, toggleGroupCollapsed } from "@/lib/viewPrefs";
import { useFilteredNotes } from "@/hooks/useFilteredNotes";
import { useViewRoute } from "@/hooks/useViewRoute";
import { countDueToday, groupReminders, sortArchivedByReminder } from "@/lib/reminderAgenda";
import { useStudyOverdueCount } from "@/lib/studyOverdueCount";
import { searchNotes, useSearchVersion } from "@/lib/searchNotes";
import { resolveWikiTarget, splitWikiTarget } from "@/lib/wikiLinks";
import { requestHeading } from "@/lib/wikiHeading";
import { useLatestRef } from "@/hooks/useLatestRef";
import { useWikiLinkIndex } from "@/hooks/useWikiLinkIndex";
import { useLaunchIntents } from "@/hooks/useLaunchIntents";
import { useBulkNoteOps } from "@/hooks/useBulkNoteOps";
import { setGridNavPreview } from "@/lib/gridKeyboardNav";
import { copyNoteToClipboard } from "@/lib/noteMarkdown";
import { tween } from "@/lib/motion";
import { useNoteActions } from "@/hooks/useNoteActions";
import { useNoteDnd } from "@/hooks/useNoteDnd";
import { useImportExport, useExternalImport } from "@/hooks/useImportExport";
import { useAchievementToasts } from "@/hooks/useAchievementToasts";
import { useSelection } from "@/hooks/useSelection";
import { useSelectionGestures } from "@/hooks/useSelectionGestures";
import { useBackupReminders } from "@/hooks/useBackupReminders";
import { pushPrefs } from "@/lib/push/prefs";
import { useDailyWeeklyNudges } from "@/hooks/useDailyWeeklyNudges";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { AddNoteBar, type ComposerAction } from "@/components/AddNoteBar";
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
import { groupNotes, type GroupBy } from "@/lib/groupNotes";
import { markNoteOpened } from "@/lib/lastOpened";
import { noteHistory } from "@/lib/noteHistory";
import { folderCrumbs, labelCrumbs } from "@/lib/breadcrumbs";
import { FolderTemplateActions } from "@/components/FolderTemplateActions";
import { EmptyState } from "@/components/EmptyState";
import { DeleteForeverDialog, EmptyTrashDialog } from "@/components/TrashConfirmDialogs";
import { sidebarItems } from "@/components/sidebar/sidebarItems";
import { useHiddenViews, isViewShown } from "@/lib/hiddenViews";
import { useTodayCards } from "@/lib/todayCards";
import { useNextBoundary } from "@/hooks/useNextBoundary";
import { toast } from "sonner";
import { toastWithUndo } from "@/lib/undoToast";
import { useInboxCapture } from "@/hooks/useInboxCapture";
import { useNoteNavigation } from "@/hooks/useNoteNavigation";
import { useAppDialogs } from "@/hooks/useAppDialogs";
import { toggleChecklistItem } from "@/lib/checklistTree";
import { findTitleDuplicate } from "@/lib/noteDuplicate";
import { IndexDialogs } from "@/components/IndexDialogs";
import { useNoteGlowActions } from "@/hooks/useNoteGlowActions";
import { useViewShell } from "@/hooks/useViewShell";
import { useNoteExport } from "@/hooks/useNoteExport";
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
import { registerUndoHandlers, undoLastAction } from "@/lib/actionHistory";
import { BottomNav } from "@/components/BottomNav";
import { VaultHost } from "@/components/vault/VaultHost";
import { TodayCards } from "@/components/review/TodayCards";
import { OlderDeviceBanner } from "@/components/sync/OlderDeviceBanner";
import { RemindersView } from "@/components/reminders/RemindersView";
import { AppearanceLinkImport } from "@/components/settings/AppearanceLinkImport";
import { QuickPresetsHost } from "@/components/settings/QuickPresets";
import { SiteArrivalPrompt, WidgetPanel, OnboardingTour, CommandPalette, StudyView, DebtsView, CwiczeniaView, InboxTriage, ShiftsView, ReminderCalendarView, DailyReportNudge, PushScheduleSync, ShiftEveningNudge, loadShiftsStore, StudyOverdueSync, loadNoteReader, NoteReader } from "./indexViews";

// Dialogs that aren't part of the initial view (opened via keyboard shortcut,
// note action or explicit toggle) — kept out of the eager main bundle so
// first load only pays for the code the note grid itself needs.
import { CardSkeleton, ViewSkeleton } from "@/components/ViewSkeleton";
import { Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestSettingsTab } from "@/lib/settingsDeepLink";
import type { DebtReminderApi } from "@/components/debts/DebtsView";
import { repeatUpdate, toRule, type RepeatInput } from "@/lib/reminderRepeat";

const Index = () => {
  const {
    notes, archivedNotes, trashedNotes, allLabels, folders, propDefs, addPropDef, updatePropDef, deletePropDef,
    addNote, updateNote, deleteNote, trashNote, restoreFromTrash, emptyTrash, togglePin, duplicateNote,
    archiveNote, unarchiveNote, addLabel, importNotes, reorderNotes, moveNoteToFolder, updateFolder,
    bulkTrash, bulkArchive, bulkSetColor, bulkRestore,
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

  // Start zgodny z efektem poniżej (desktop: otwarty), żeby pasek nie wjeżdżał od zera po montażu
  // i nie przesuwał całej treści przy każdym wczytaniu strony.
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [triageOpen, setTriageOpen] = useState(false);
  const [triageMounted, setTriageMounted] = useState(false);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const addNoteRef = useRef<{ expand: (action?: ComposerAction, prefill?: string) => void }>(null);
  const logoClicksRef = useRef<{ count: number; lastTs: number }>({ count: 0, lastTs: 0 });
  const dialogs = useAppDialogs();
  const { paletteOpen, setPaletteOpen, setActionsOpen, setSettingsOpen, setStatsOpen, setQuickInboxOpen, setShortcutsOpen, setPropDefsOpen, setFocusModeOpen } = dialogs;
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

  // Auto-close sidebar on mobile, auto-open on desktop
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  // Czytnik w tle po starcie — kliknięcie notatki go nie czeka.
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    // Też presety Grafiku w pickerze terminu (Plan-nowy 1.5) — chipy „po zmianie” są od razu przy pierwszym otwarciu.
    const warm = () => { void loadNoteReader(); void loadShiftPresets(); };
    if (!w.requestIdleCallback) { const t = window.setTimeout(warm, 1500); return () => window.clearTimeout(t); }
    const id = w.requestIdleCallback(warm, { timeout: 4000 });
    return () => w.cancelIdleCallback?.(id);
  }, []);

  const openNoteRef = useRef<(id: string) => void>(() => {});
  // Stabilna tablica: nowa w każdym renderze restartowałaby sprawdzanie przy każdym znaku w wyszukiwarce.
  const reminderNotes = useMemo(() => [...notes, ...archivedNotes], [notes, archivedNotes]);
  // Długi (1.1): rozliczenie zdejmuje termin notatki zwrotu; „Cofnij” oddaje poprzedni.
  const debtReminders = useMemo<DebtReminderApi>(() => ({
    clear: (id) => {
      const n = [...notes, ...archivedNotes, ...trashedNotes].find((x) => x.id === id);
      if (!n || n.reminder === null) return null;
      updateNote(id, { reminder: null });
      return n.reminder;
    },
    restore: (id, at) => updateNote(id, { reminder: at }),
    get: (id) => [...notes, ...archivedNotes, ...trashedNotes].find((x) => x.id === id)?.reminder ?? null,
    has: (id) => [...notes, ...archivedNotes, ...trashedNotes].some((x) => x.id === id),
    remove: (id) => deleteNote(id),
  }), [notes, archivedNotes, trashedNotes, updateNote, deleteNote]);
  const pushEnabled = pushPrefs.use().enabled;
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
  // Store Grafiku dla Ctrl+Z / Ctrl+Shift+Z — na widoku Grafiku jest już załadowany (ShiftsView), skrót sprawdza synchronicznie.
  const shiftsStore = useRef<Awaited<ReturnType<typeof loadShiftsStore>> | null>(null);
  useEffect(() => {
    if (view === "shifts" && !shiftsStore.current) void loadShiftsStore().then((m) => { shiftsStore.current = m; });
  }, [view]);

  // Pasek dodawania jest też w folderze i etykiecie — nowa notatka dziedziczy
  // ten kontekst (`handleAddNoteGlow`), zamiast lądować poza widokiem.
  // Dziś 2.5: także w Dziś — nowa notatka jest „dzisiejsza”, więc zostaje na ekranie, a „+” nie przenosi do Notatek.
  const canCompose = view === "notes" || view === "today" || (view === "folder" && !!activeFolder) || (view === "label" && !!activeLabel);
  const composeDestination = view === "folder"
    ? folders.find((f) => f.id === activeFolder)?.name ?? null
    : view === "label" ? `#${activeLabel}` : null;

  function expandAddNote(action?: ComposerAction, prefill?: string) {
    // W Skrzynce nie ma kompozytora: „+” ustawia kursor w polu przechwycenia, bez zmiany działu.
    if (view === "inbox") { document.querySelector<HTMLTextAreaElement>("[data-inbox-capture]")?.focus(); return; }
    if (!canCompose) setView("notes");
    // Kompozytor montuje się po zmianie widoku (i pod obciążeniem bywa później niż po 100 ms) — ponawiamy,
    // zamiast po cichu zgubić skrót („+”, „?new=list”, „N”). Najwyżej ok. 3 s.
    const tryExpand = (left: number) => {
      if (addNoteRef.current) { addNoteRef.current.expand(action, prefill); return; }
      if (left > 0) window.setTimeout(() => tryExpand(left - 1), 100);
    };
    window.setTimeout(() => tryExpand(30), 100);
  }

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
    onRedo: () => {
      const s = shiftsStore.current;
      if (view === "shifts" && s?.canRedoShifts()) {
        s.redoShifts();
        toast("Ponowiono zmianę w Grafiku", { icon: "↪️" });
      }
    },
    onUndo: () => {
      // Na widoku Grafiku Ctrl+Z cofa ostatnią zmianę w Grafiku (zanim sięgnie po kosz/archiwum).
      const s = shiftsStore.current;
      if (view === "shifts" && s?.canUndoShifts()) {
        s.undoShifts();
        toast("Cofnięto zmianę w Grafiku", { icon: "↩️" });
        return;
      }
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

  // Zmiana sortowania i układu (3.4): lista nadrabia, pasek ustawień reaguje od razu.
  const deferredPrefs = useDeferredValue(prefs);
  const { displayNotes, pinned, others, elsewhere } = useFilteredNotes({
    notes, archivedNotes, trashedNotes, folders, view, activeLabel, activeFolder, search: deferredSearch, prefs: deferredPrefs, propDefs,
  });

  useDayDoneReward(view === "today" && !search ? displayNotes : null);
  // Przewinięcie per dział (3.6): wracając do działu, stoimy tam, gdzie z niego wyszliśmy.
  useViewScroll(view);
  // W Terminach archiwum zostaje w liście (dzwoni), więc „Brak przypomnień” nie może mówić prawdy tylko o `displayNotes` (1d planu).
  // Archiwum nie wchodzi do grup „Zaległe”/„Nadchodzące” (D4): ma własną sekcję na dole, z wyszukiwaniem.
  // T 1.1: grupy przeliczają się na granicy terminu i o północy, nie tylko przy zmianie notatek.
  const boundaryTick = useNextBoundary(others);
  const reminderGroups = useMemo(() => (view === "reminders" ? groupReminders(others) : []), [view, others, boundaryTick]);
  // Zapis terminu z dialogu „Nowy termin” (Terminy). Kalendarz ma własne, równoważne wywołania w `ReminderCalendarView`.
  const createReminderNote = (title: string, reminder: number, repeat: RepeatInput, allDay: boolean, until?: number) => {
    const id = addNote(title, "", prefs.defaultNoteColor, [], reminder);
    // `addNote` nie przyjmuje powtarzania, więc serię dostawiamy patchem po utworzeniu.
    if (toRule(repeat).kind !== "none" || allDay) updateNote(id, { ...repeatUpdate(repeat), ...(toRule(repeat).kind !== "none" && until !== undefined ? { reminderRepeatUntil: until } : {}), ...(allDay ? { reminderAllDay: true } : {}) });
  };
  const attachReminder = (id: string, reminder: number, repeat: RepeatInput, allDay: boolean, base: number | undefined, until?: number) =>
    updateNote(id, { reminder, ...repeatUpdate(repeat), reminderRepeatUntil: toRule(repeat).kind === "none" ? undefined : until, reminderBase: base, reminderAllDay: allDay ? true : undefined });
  const searchVersion = useSearchVersion();
  const archivedRows = useMemo(
    // T 1.6: archiwum po terminie jak grupy — z terminem rosnąco, bez terminu na końcu.
    () => (view === "reminders" ? (deferredSearch ? searchNotes(archivedNotes, deferredSearch) : sortArchivedByReminder(archivedNotes)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `searchVersion`: przeliczenie po odpowiedzi Workera wyszukiwania
    [view, deferredSearch, archivedNotes, searchVersion],
  );
  // Na „Dziś” liczą się zaległe i dzisiejsze przypomnienia, żeby „Brak notatek z dzisiaj” nie stał obok ich listy.
  // Bez `useMemo`: Index i tak renderuje się po północy (useOverdueBadge → useDayClock).
  const reminderRowCount = view === "reminders"
    ? reminderGroups.reduce((n, g) => n + g.notes.length, 0) + archivedRows.length
    : view === "today" ? countDueToday(reminderNotes) : 0;

  // Sekcje widoku: „Przypięte” (zwijane od 4 notatek) i reszta, opcjonalnie podzielona na grupy.
  // `visibleNotes` = to, co faktycznie jest na ekranie (bez zwiniętych) w kolejności widoku.
  // Tablica / tabela mają sens tylko w widokach z listą notatek (nie w agendzie, koszu, kalendarzu, grafiku).
  const listView = view !== "reminders" && view !== "trash" && !isAppView(view) && view !== "widget";
  const boardMode = prefs.layout === "board" && listView;
  const tableMode = prefs.layout === "table" && listView;
  const galleryMode = prefs.layout === "gallery" && listView;
  // Kolumny tablicy potrzebują podziału: bez wybranego domyślnie idą po etykiecie.
  const groupBy: GroupBy = view === "reminders" || view === "trash" ? "none" : boardMode && prefs.groupBy === "none" ? "label" : prefs.groupBy;
  const showPinned = pinned.length > 0 && view !== "archive" && view !== "trash";
  const pinnedCollapsible = pinned.length > 3;
  const pinnedCollapsed = pinnedCollapsible && prefs.collapsedGroups.includes("pinned");
  const groups = useMemo(
    () => groupNotes(others, groupBy, { now: Date.now(), dateField: prefs.sortKey === "created" ? "createdAt" : "updatedAt", folders }),
    [others, groupBy, prefs.sortKey, folders],
  );
  const groupCollapsedKey = (key: string) => `${groupBy}:${key}`;
  const visibleNotes = useMemo(() => {
    const out = showPinned && !pinnedCollapsed ? [...pinned] : [];
    if (view === "reminders") return [...out, ...others];
    for (const g of groups) {
      if (groupBy === "none" || !prefs.collapsedGroups.includes(`${groupBy}:${g.key}`)) out.push(...g.notes);
    }
    return out;
  }, [showPinned, pinnedCollapsed, pinned, others, groups, groupBy, view, prefs.collapsedGroups]);
  const visibleNotesRef = useLatestRef(visibleNotes);

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

  // Frazy wyszukiwania dla wyróżniania w kaflach (magazyn `searchTerms`, bez przerysowania całej listy).
  useEffect(() => { setSearchTerms(highlightTokens(search)); }, [search]);

  // Czytnik i prezentacja (logika w `useReaderNav`).
  const { previewId, readerId, readerNote, readerSteps, copyTarget, closeReader, showInReader, stepReader, editFromReader, splitNote, setSplit } = useReaderNav({
    notes, archivedNotes, trashedNotes, visibleNotes, presentingNoteId, setPresentingNoteId, paletteOpen, selectedIds, openNote,
  });
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
  useEffect(() => { if (readerId) markNoteOpened(readerId); }, [readerId]);
  // 5.1: Alt+← / Alt+→ po historii otwieranych notatek (czytnik). Tylko gdy historia ma dokąd iść —
  // inaczej skrót zostaje przeglądarce (wstecz). Nie w polu tekstowym i nie nad innym oknem niż czytnik.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      const known = new Set([...notesRef.current, ...archivedRef.current].filter((n) => !n.locked).map((n) => n.id));
      const id = noteHistory.step(e.key === "ArrowLeft" ? -1 : 1, (x) => known.has(x));
      if (!id) return;
      e.preventDefault();
      showInReader(id, "preview");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notesRef, archivedRef, showInReader]);

  // Undo fallbacks so history restored from localStorage stays actionable after reload
  useEffect(() => {
    registerUndoHandlers({
      trash: (ids) => bulkRestore(ids),
      archive: (ids) => ids.forEach(unarchiveNote),
    });
  }, [bulkRestore, unarchiveNote]);

  const {
    handleTrashSingle, handleArchiveSingle, handleBulkTrash, handleBulkArchive, handleBulkColor, handleSelectAll,
  } = useNoteActions({
    notes, archivedNotes, selectedIds, confirmAction, clearSelection,
    trashNote, restoreFromTrash, archiveNote, unarchiveNote,
    bulkTrash, bulkArchive, bulkSetColor, bulkRestore, setSelectedIds, displayNotes: visibleNotes,
  });

  // Notatka tworzona w folderze albo w widoku etykiety ląduje tam, gdzie
  // użytkownik patrzy — inaczej znika mu z oczu i wymaga przeciągnięcia.
  const activeFolderObj = view === "folder" && activeFolder ? folders.find((f) => f.id === activeFolder) ?? null : null;
  const { handleAddNoteGlow, handleComposerAdd, composerParents, handleMoveToFolderGlow } = useNoteGlowActions({ notes, view, activeLabel, activeFolder, addNote, updateNote, deleteNote, moveNoteToFolder });

  useLaunchIntents({ navigate, addNote: handleAddNoteGlow, openNote, expandComposer: expandAddNote, openQuickInbox: () => setQuickInboxOpen(true) });

  // Licznik w pasku bocznym tylko przy tym, co wymaga uwagi: zaległe przypomnienia i Kosz.
  // Ta sama liczba ląduje w tytule karty i na ikonie aplikacji (useOverdueBadge).
  // Zaległości: aktywne notatki plus terminy Pracy (D1); archiwum nie liczy się (D4).
  // Skrzynka 5.3: nieposortowane notatki — liczone tylko dla znaczka, gdy użytkownik to włączył.
  const inboxBadge = useMemo(() => notes.reduce((n, note) => n + (isInboxNote(note) ? 1 : 0), 0), [notes]);
  const overdueCount = useOverdueBadge(notes, useStudyOverdueCount(), inboxBadge);
  // Trwałe usunięcie zabiera ze sobą historię wersji — inaczej zostawałaby
  // w `localStorage` na zawsze i zjadała limit.
  const deleteNoteForever = useCallback((id: string) => { deleteNote(id); deleteVersions(id); }, [deleteNote, deleteVersions]);
  const handleDelete = view === "trash" ? deleteNoteForever : handleTrashSingle;

  const { exportSelectedAs, exportSelectedZip } = useNoteExport({ notes, archivedNotes, trashedNotes, selectedIds, folders, propDefs });

  const { restoreSelected, pinSelected, moveSelectedToFolder, labelSelected, moveToColumn, mergeSelected, favoriteSelected, prioritySelected } = useBulkNoteOps({
    view, groupBy, folders, notesRef, selectedIds, clearSelection, togglePin, updateNote, addLabel,
    unarchiveNote, bulkRestore, bulkTrash, bulkArchive, moveToFolder: handleMoveToFolderGlow,
  });

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
  const navItems = sidebarItems({ inbox: inboxCount, overdue: overdueCount, trash: trashedNotes.length }).filter((i) => isViewShown(hiddenViews, i.view));

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setDraggingNoteId(null)}>
    <PaperBackdrop />
    <div className="min-h-screen flex relative">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        view={view}
        activeLabel={activeLabel}
        activeFolder={activeFolder}
        onGoView={(v) => { go(v); if (isMobile) setSidebarOpen(false); }}
        onOpenNote={(id) => { openNote(id); if (isMobile) setSidebarOpen(false); }}
        onGoLabel={(label) => { go("label", { label }); if (isMobile) setSidebarOpen(false); }}
        onGoFolder={(id) => { go("folder", { folder: id }); if (isMobile) setSidebarOpen(false); }}
        onGoFilter={goFilter}
        onOpenView={openSavedView}
        search={search}
        sidebarItems={navItems}
        onLogoClick={handleLogoClick}
        dark={dark}
        onToggleTheme={toggleTheme}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenActions={() => setActionsOpen(true)}
        onOpenStats={() => setStatsOpen(true)}
        onOpenFocusMode={() => setFocusModeOpen(true)}
        onSettingsOpenChange={setSettingsOpen}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader
          onOpenSync={() => { requestSettingsTab("sync"); setSettingsOpen(true); }}
          onOpenPalette={() => setPaletteOpen(true)}
          selectionMode={selectionMode}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          dark={dark}
          onToggleTheme={toggleTheme}
          view={view}
          activeFolder={activeFolder}
          activeLabel={activeLabel}
          search={search}
          onSearchChange={setSearch}
          onImport={handleImport}
        />

        {/* `flex gap`, nie `space-y`: ukryta na sm+ wyszukiwarka nie dokłada marginesu nad treścią. */}
        {/* Dziś na telefonie: ciaśniejsze odstępy między kartami, mniej przewijania na 390 px. */}
        {/* Akcje widoków trafiają do główki przez portal (nowy plan 1.1). */}
        <PageActionsProvider>
        <main ref={mainRef} className={`flex-1 max-w-[calc(var(--page-wide)+3rem)] mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex flex-col pb-safe ${view === "today" ? "gap-4 sm:gap-10" : "gap-8 sm:gap-10"}`}>
          <OlderDeviceBanner onOpenSync={() => { requestSettingsTab("sync"); setSettingsOpen(true); }} />
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
          {view === "inbox" && !deferredSearch && <InboxBar count={inboxCount} onTriage={() => { setTriageMounted(true); setTriageOpen(true); }} />}
          {triageMounted && (
            <Suspense fallback={null}>
              <InboxTriage open={triageOpen} onOpenChange={setTriageOpen} onOpenNote={(id) => openNote(id, false, true)} />
            </Suspense>
          )}

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

          <DeleteForeverDialog
            ids={confirmDeleteIds}
            onCancel={() => setConfirmDeleteIds(null)}
            onConfirm={(ids) => {
              ids.forEach(deleteNoteForever);
              clearSelection();
              toast.success(`Usunięto trwale: ${ids.length}`);
              setConfirmDeleteIds(null);
            }}
          />

          <EmptyTrashDialog
            open={confirmEmptyTrash}
            onOpenChange={setConfirmEmptyTrash}
            count={trashedNotes.length}
            onConfirm={() => { deleteVersions(trashedNotes.map((n) => n.id)); emptyTrash(); toast.success("Kosz opróżniony"); setConfirmEmptyTrash(false); }}
          />

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
                  onCreateNote={(title, reminder, repeat, allDay, until) => {
                    const id = addNote(title, "", prefs.defaultNoteColor, [], reminder);
                    // `addNote` nie przyjmuje powtarzania, więc serię dostawiamy
                    // patchem po utworzeniu — stąd id zwracane przez `addNote`.
                    if (toRule(repeat).kind !== "none" || allDay) updateNote(id, { ...repeatUpdate(repeat), ...(toRule(repeat).kind !== "none" && until !== undefined ? { reminderRepeatUntil: until } : {}), ...(allDay ? { reminderAllDay: true } : {}) });
                  }}
                  onOpenNote={(id) => openNote(id)}
                  onSetReminder={(id, reminder, repeat, reminderDay, reminderBase, reminderAllDay, until) =>
                    // Koniec serii idzie z wywołania (K0.4). Bez powtarzania czyścimy go, żeby nie wrócił przy następnej serii.
                    updateNote(id, { reminder, ...repeatUpdate(repeat), reminderRepeatUntil: toRule(repeat).kind === "none" ? undefined : until, ...(reminderDay === undefined ? {} : { reminderDay }), reminderBase, reminderAllDay: reminderAllDay === true ? true : undefined })}
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
            {!isAppView(view) && view !== "widget" && displayNotes.length === 0 && reminderRowCount === 0 && <EmptyState key="empty" view={view} search={deferredSearch} elsewhere={elsewhere} onGo={(v) => go(v)} onNew={view === "inbox" ? undefined : () => expandAddNote(view === "reminders" ? "reminder" : undefined)} onClearSearch={() => setSearch("")} />}
          </AnimatePresence>
          {view === "notes" && displayNotes.length > 0 && !deferredSearch && <DailyQuote />}
          {/* Tabliczka rysunkowa na końcu kartki (nowy plan 1.4, NP-3): po ostatniej sekcji, a przy krótkiej treści
              na dole ekranu (`margin-top: auto`). Napis wybiera `html[data-view]`, styl w `index.css`. */}
          <span aria-hidden className="paper-stamp" />
        </main>
        </PageActionsProvider>
      </div>
    </div>

    <Suspense fallback={null}>
      <DailyReportNudge onOpenWork={() => setView("study")} />
      <ShiftEveningNudge onOpenShifts={openShifts} />
      <SiteArrivalPrompt />
      {pushEnabled && <PushScheduleSync notes={reminderNotes} />}
      <Suspense fallback={null}>
        <StudyOverdueSync />
      </Suspense>
    </Suspense>

    {paletteOpen && (
      <Suspense fallback={null}>
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          notes={reminderNotes}
          onOpenNote={openNote}
          onNewNote={(title) => expandAddNote(undefined, title)}
          onDailyNote={openDailyNote}
          onPeriodNote={openPeriodNote}
          onGo={(v) => go(v)}
          onGoFilter={goFilter}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenStats={() => setStatsOpen(true)}
          onQuickInbox={() => setQuickInboxOpen(true)}
          onOpenFocusMode={() => setFocusModeOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onCopyNote={copyTarget ? (fmt) => { void copyNoteToClipboard(copyTarget, fmt); } : undefined}
          currentNote={copyTarget}
          onTogglePin={(id) => togglePin(id)}
          onArchive={handleArchiveSingle}
          onTrash={handleTrashSingle}
          onDuplicate={duplicateNote}
          onToggleFavorite={(id, favorite) => updateNote(id, { favorite })}
          onMoveToFolder={handleMoveToFolderGlow}
          view={view}
        />
      </Suspense>
    )}
    <AchievementStamp />
    <IndexDialogs
      dialogs={dialogs}
      notes={notes} archivedNotes={archivedNotes} trashedNotes={trashedNotes} allLabels={allLabels} folders={folders}
      propDefs={propDefs} addPropDef={addPropDef} updatePropDef={updatePropDef} deletePropDef={deletePropDef}
      addNote={addNote} externalImport={externalImport} captureToInbox={captureToInbox} captureFilesToInbox={captureFilesToInbox} openNote={openNote}
    />
    <AnimatePresence>
      {readerNote && (
        <Suspense key="reader" fallback={null}>
        <NoteReader
          note={readerNote}
          mode={presentingNoteId ? "present" : "preview"}
          searchQuery={search}
          knownTitles={knownTitles}
          wikiIndex={wikiIndex}
          onClose={closeReader}
          onStep={stepReader}
          canPrev={!!readerSteps.prev}
          canNext={!!readerSteps.next}
          onEdit={editFromReader}
          onShow={showInReader}
          splitNote={splitNote}
          onSplit={setSplit}
          resolveTitle={(title) => resolveWikiTarget(title, allNotesForLinks)?.id}
          propDefs={propDefs}
          onUpdateProps={updateNote}
          onToggleChecklist={(noteId, itemId) => {
            const n = [...notes, ...archivedNotes].find((x) => x.id === noteId);
            if (!n) return;
            updateNote(noteId, { checklist: toggleChecklistItem(n.checklist, itemId).items });
          }}
        />
        </Suspense>
      )}
    </AnimatePresence>
    <BottomNav
      view={view}
      onGo={(v) => go(v)}
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

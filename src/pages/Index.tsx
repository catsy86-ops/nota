import { pulseSkinSignal } from "@/lib/skinSignal";
import { useState, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, lazy, Suspense } from "react";
import { flushSync } from "react-dom";
import { isMotionReduced } from "@/hooks/useMotionPref";
import { m as motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { ViewErrorBoundary } from "@/components/ViewErrorBoundary";
import { InboxCapture } from "@/components/InboxCapture";
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
import { useFilteredNotes, type View } from "@/hooks/useFilteredNotes";
import { useViewRoute } from "@/hooks/useViewRoute";
import { parseViewRoute } from "@/lib/viewRoute";
import { countDueToday, groupReminders } from "@/lib/reminderAgenda";
import { useStudyOverdueCount } from "@/lib/studyOverdueCount";
import { searchNotes } from "@/lib/searchNotes";
import { resolveWikiTarget, splitWikiTarget } from "@/lib/wikiLinks";
import { requestHeading } from "@/lib/wikiHeading";
import { useLatestRef } from "@/hooks/useLatestRef";
import { useWikiLinkIndex } from "@/hooks/useWikiLinkIndex";
import { useLaunchIntents } from "@/hooks/useLaunchIntents";
import { useBulkNoteOps } from "@/hooks/useBulkNoteOps";
import { setGridNavPreview, setGridNavFocus } from "@/lib/gridKeyboardNav";
import { copyNoteToClipboard } from "@/lib/noteMarkdown";
import { playEnter, tween } from "@/lib/motion";
import { useNavigate, useNavigationType } from "react-router-dom";
import { whenNotesReady, isNoteTextEditOpen } from "@/hooks/useNotes";
import { DAILY_LABEL, DAILY_TEMPLATE, appendTimestamp, dailyKey, dailyTitle, findDailyNote } from "@/lib/dailyNote";
import { PERIOD_LABEL, PERIOD_TEMPLATE, findPeriodNote, periodKey, periodTitle, type PeriodKind } from "@/lib/periodNote";
import { useNoteActions } from "@/hooks/useNoteActions";
import { useNoteDnd } from "@/hooks/useNoteDnd";
import { useImportExport, useExternalImport } from "@/hooks/useImportExport";
import { useAchievementToasts } from "@/hooks/useAchievementToasts";
import { useSelection } from "@/hooks/useSelection";
import { useSelectionGestures } from "@/hooks/useSelectionGestures";
import { useBackupReminders } from "@/hooks/useBackupReminders";
import { useShiftEveningNudge } from "@/hooks/useShiftEveningNudge";
import { pushPrefs } from "@/lib/push/prefs";
import { useDailyWeeklyNudges } from "@/hooks/useDailyWeeklyNudges";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { AddNoteBar, type ComposerAction, type ComposerExtras } from "@/components/AddNoteBar";
import { InstallBanner } from "@/components/InstallBanner";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { ViewTitle, isTitleBlockView } from "@/components/ViewTitle";
import { NoteGrid } from "@/components/NoteGrid";
import { BoardColumn } from "@/components/BoardColumn";
import { NoteBoard } from "@/components/NoteBoard";
import { NoteTable } from "@/components/NoteTable";
import { columnOfNote, NONE_COLUMN, PINNED_COLUMN } from "@/lib/boardColumns";
import { NoteGroupSection } from "@/components/NoteGroupSection";
import { groupNotes, type GroupBy } from "@/lib/groupNotes";
import { markNoteOpened } from "@/lib/lastOpened";
import { EmptyState } from "@/components/EmptyState";
import { DeleteForeverDialog, EmptyTrashDialog } from "@/components/TrashConfirmDialogs";
import { sidebarItems } from "@/components/sidebar/sidebarItems";
import { toast } from "sonner";
import { toastWithUndo } from "@/lib/undoToast";
import { downloadNotesZip } from "@/lib/exportZip";
import { pluralPl } from "@/lib/plural";
import { DndContext, pointerWithin } from "@dnd-kit/core";
import { fireworks, megaCelebrate } from "@/lib/celebrate";
import { glowPulse, glowStreak, centerOf, pointOfNote } from "@/lib/glowTrail";
import { SearchBar } from "@/components/SearchBar";
import { useDayDoneReward } from "@/hooks/useDayDoneReward";
import { AchievementStamp } from "@/components/AchievementStamp";
import { DailyQuote } from "@/components/DailyQuote";
import { PaperBackdrop } from "@/components/PaperBackdrop";
import { QuickTemplates } from "@/components/QuickTemplates";
import { useConfirmAction } from "@/components/ConfirmActionDialog";
import { BulkActionBar } from "@/components/BulkActionBar";
import { registerUndoHandlers, undoLastAction } from "@/lib/actionHistory";
import { canUndoShifts, undoShifts } from "@/lib/shifts/store";
import { BottomNav } from "@/components/BottomNav";
import { VaultHost } from "@/components/vault/VaultHost";

// Dialogs that aren't part of the initial view (opened via keyboard shortcut,
// note action or explicit toggle) — kept out of the eager main bundle so
// first load only pays for the code the note grid itself needs.
import { CardSkeleton, ViewSkeleton } from "@/components/ViewSkeleton";
import { loadCalendarView, loadShiftsView, loadStudyView } from "@/lib/viewPreload";
import { settingsTabFromParam, SETTINGS_PARAM } from "@/lib/settingsDeepLink";
const ShortcutsDialog = lazy(() => import("@/components/ShortcutsDialog").then((m) => ({ default: m.ShortcutsDialog })));
const PropDefsDialog = lazy(() => import("@/components/PropDefsDialog").then((m) => ({ default: m.PropDefsDialog })));
const TodayDueList = lazy(() => import("@/components/review/TodayDueList").then((m) => ({ default: m.TodayDueList })));
const StudyDueRows = lazy(() => import("@/components/review/StudyDueRows"));
const TodaySiteCard = lazy(() => import("@/components/review/TodaySiteCard").then((m) => ({ default: m.TodaySiteCard })));
const SeriesForecastSection = lazy(() => import("@/components/calendar/SeriesForecastSection"));
const TodayShiftCard = lazy(() => import("@/components/review/TodayShiftCard").then((m) => ({ default: m.TodayShiftCard })));
const TodayStudyCard = lazy(() => import("@/components/review/TodayStudyCard").then((m) => ({ default: m.TodayStudyCard })));
const BrainTrainingCard = lazy(() => import("@/components/review/BrainTrainingCard").then((m) => ({ default: m.BrainTrainingCard })));
const WeeklyReviewCard = lazy(() => import("@/components/review/WeeklyReviewCard").then((m) => ({ default: m.WeeklyReviewCard })));
const RecentActionsPanel = lazy(() => import("@/components/RecentActionsPanel").then((m) => ({ default: m.RecentActionsPanel })));
const OnboardingTour = lazy(() => import("@/components/OnboardingTour").then((m) => ({ default: m.OnboardingTour })));
const CommandPalette = lazy(() => import("@/components/CommandPalette").then((m) => ({ default: m.CommandPalette })));
const ImportExternalDialog = lazy(() => import("@/components/ImportExternalDialog").then((m) => ({ default: m.ImportExternalDialog })));
const SettingsDialog = lazy(() => import("@/components/SettingsDialog").then((m) => ({ default: m.SettingsDialog })));
const StatsDialog = lazy(() => import("@/components/StatsDialog").then((m) => ({ default: m.StatsDialog })));
const FocusMode = lazy(() => import("@/components/FocusMode").then((m) => ({ default: m.FocusMode })));
// Kalendarz wchodzi tylko po wejściu w swój widok — siatka notatek go nie potrzebuje.
// Grafik zmian — osobny dział, ładowany dopiero po wejściu.
// Loadery wspólne z nawigacją (`preloadView` przy `pointerdown`), patrz lib/viewPreload.ts.
const StudyView = lazy(loadStudyView);
const DebtsView = lazy(() => import("@/components/debts/DebtsView").then((m) => ({ default: m.DebtsView })));
const CwiczeniaView = lazy(() => import("@/components/cwiczenia/CwiczeniaView").then((m) => ({ default: m.CwiczeniaView })));
// Porządkowanie Skrzynki — okno ładuje się przy pierwszym otwarciu.
const InboxTriage = lazy(() => import("@/components/InboxTriage").then((m) => ({ default: m.InboxTriage })));
const ShiftsView = lazy(() => loadShiftsView().then((m) => ({ default: m.ShiftsView })));
const ReminderCalendarView = lazy(() => loadCalendarView().then((m) => ({ default: m.ReminderCalendarView })));
// Przypomnienie „Raport dnia gotowy” (dział Praca) — leniwie, żeby dziennik nie wchodził do głównej paczki.
const DailyReportNudge = lazy(() => import("@/components/study/DailyReportNudge"));
// Harmonogram dla serwera push — tylko przy włączonych powiadomieniach przy zamkniętej aplikacji.
const PushScheduleSync = lazy(() => import("@/components/PushScheduleSync"));
const StudyOverdueSync = lazy(() => import("@/components/review/StudyOverdueSync"));
// Czytnik notatek poza paczką startową; doczytywany w tle, gdy przeglądarka odpocznie (patrz efekt w `Index`),
// więc pierwsze otwarcie notatki nie czeka.
const loadNoteReader = () => import("@/components/NoteReader");
const NoteReader = lazy(() => loadNoteReader().then((m) => ({ default: m.NoteReader })));

const Index = () => {
  const {
    notes, archivedNotes, trashedNotes, allLabels, folders, propDefs, addPropDef, updatePropDef, deletePropDef,
    addNote, updateNote, deleteNote, trashNote, restoreFromTrash, emptyTrash, togglePin, duplicateNote,
    archiveNote, unarchiveNote, addLabel, importNotes, reorderNotes, moveNoteToFolder,
    bulkTrash, bulkArchive, bulkSetColor, bulkRestore,
  } = useNotesContext();
  const { addVersion, getVersions, deleteVersions } = useNoteVersions();
  const { confirmAction, confirmDialog } = useConfirmAction();
  const { dark, toggle: toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const prefs = useViewPrefs();
  // Widok, folder, etykieta i zapytanie żyją w adresie (patrz `lib/viewRoute.ts`).
  const route = useViewRoute();
  const { view, label: activeLabel, folder: activeFolder, go, replaceWith } = route;
  // Zmiana widoku przenika się ze starym (View Transitions); bez wsparcia albo przy ograniczonym ruchu — od razu.
  const setView = useCallback((v: View) => {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (typeof doc.startViewTransition === "function" && !isMotionReduced()) {
      doc.startViewTransition(() => flushSync(() => go(v)));
    } else {
      go(v);
    }
  }, [go]);
  // Tabliczka rysunkowa w tle zmienia napis według widoku (CSS: `html[data-view]`).
  // Zmiana widoku odpala sygnał stylu (Zeszyt przewraca kartkę, Matryca spływa kaskadą); pierwsze wejście bez sygnału.
  const firstViewRef = useRef(true);
  useEffect(() => {
    document.documentElement.dataset.view = view;
    if (firstViewRef.current) { firstViewRef.current = false; return; }
    pulseSkinSignal("view");
  }, [view]);
  // Pole wyszukiwania ma własny stan (karetka nie może czekać na router);
  // adres dostaje go z opóźnieniem zerowym, a „wstecz/dalej” wlewa z powrotem.
  const [search, setSearch] = useState(route.search);
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  useEffect(() => {
    if (navigationType === "POP") setSearch(route.search);
  }, [route.search, navigationType]);
  // Pole dostaje każdy znak od razu; filtrowanie kart i adres idą odroczonym
  // renderem, który React przerywa przy kolejnym znaku — pisanie nie czeka na 150 kart.
  const deferredSearch = useDeferredValue(search);
  const setRouteSearch = route.setSearch;
  useEffect(() => {
    if (deferredSearch !== parseViewRoute(window.location.pathname, window.location.search).search) setRouteSearch(deferredSearch);
  }, [deferredSearch, setRouteSearch]);
  // Zmiana widoku (także folderu i etykiety): treść osiada fade'em z 6 px,
  // zamiast podmienić się skokiem. Bez przemontowania — szkic w pasku nowej
  // notatki i stan siatek przetrwają; pole wyszukiwania (data-view-static) stoi.
  const mainRef = useRef<HTMLElement>(null);
  const viewKey = `${view}|${activeFolder ?? ""}|${activeLabel ?? ""}`;
  const prevViewKey = useRef(viewKey);
  useLayoutEffect(() => {
    if (prevViewKey.current === viewKey) return;
    prevViewKey.current = viewKey;
    for (const el of mainRef.current?.children ?? []) {
      if (!el.hasAttribute("data-view-static")) playEnter(el, { opacity: 0, transform: "translateY(6px)" });
    }
  }, [viewKey]);
  // Start zgodny z efektem poniżej (desktop: otwarty), żeby pasek nie wjeżdżał od zera po montażu
  // i nie przesuwał całej treści przy każdym wczytaniu strony.
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [triageOpen, setTriageOpen] = useState(false);
  const [triageMounted, setTriageMounted] = useState(false);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const addNoteRef = useRef<{ expand: (action?: ComposerAction) => void }>(null);
  const logoClicksRef = useRef<{ count: number; lastTs: number }>({ count: 0, lastTs: 0 });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  // Link z kodu QR (`?pair=…`) otwiera Ustawienia → Sync; kod odczytuje i usuwa z adresu
  // `SettingsDialog`, który montuje się dopiero po otwarciu.
  // Link `?settings=<karta>` (faza 3c) otwiera Ustawienia od razu na tej karcie.
  const [settingsOpen, setSettingsOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has("pair") || settingsTabFromParam(params.get(SETTINGS_PARAM)) !== null;
  });
  const [statsOpen, setStatsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [propDefsOpen, setPropDefsOpen] = useState(false);
  const [presentingNoteId, setPresentingNoteId] = useState<string | null>(null);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
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
    if (!w.requestIdleCallback) { const t = window.setTimeout(() => void loadNoteReader(), 1500); return () => window.clearTimeout(t); }
    const id = w.requestIdleCallback(() => void loadNoteReader(), { timeout: 4000 });
    return () => w.cancelIdleCallback?.(id);
  }, []);

  const openNoteRef = useRef<(id: string) => void>(() => {});
  // Stabilna tablica: nowa w każdym renderze restartowałaby sprawdzanie przy każdym znaku w wyszukiwarce.
  const reminderNotes = useMemo(() => [...notes, ...archivedNotes], [notes, archivedNotes]);
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
  useShiftEveningNudge(useCallback(() => setView("shifts"), [setView]));

  // Pasek dodawania jest też w folderze i etykiecie — nowa notatka dziedziczy
  // ten kontekst (`handleAddNoteGlow`), zamiast lądować poza widokiem.
  const canCompose = view === "notes" || (view === "folder" && !!activeFolder) || (view === "label" && !!activeLabel);
  const composeDestination = view === "folder"
    ? folders.find((f) => f.id === activeFolder)?.name ?? null
    : view === "label" ? `#${activeLabel}` : null;

  function expandAddNote(action?: ComposerAction) {
    // W Skrzynce nie ma kompozytora: „+” ustawia kursor w polu przechwycenia, bez zmiany działu.
    if (view === "inbox") { document.querySelector<HTMLTextAreaElement>("[data-inbox-capture]")?.focus(); return; }
    if (!canCompose) setView("notes");
    setTimeout(() => addNoteRef.current?.expand(action), 100);
  }

  useGlobalShortcuts({
    onNewNote: expandAddNote,
    onGoToday: () => go("today"),
    onGoWeek: () => go("week"),
    onGoView: (v) => go(v),
    onEasterEgg: () => { megaCelebrate(); toast.success("🎮 KONAMI! Pełen pokaz mocy!"); },
    hasSelection: () => selectedIds.size > 0,
    onEscapeSelection: clearSelection,
    onUndo: () => {
      // Na widoku Grafiku Ctrl+Z cofa ostatnią zmianę w Grafiku (zanim sięgnie po kosz/archiwum).
      if (view === "shifts" && canUndoShifts()) {
        undoShifts();
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
    addVersion(noteId, current?.title || "", current?.content || "");
    updateNote(noteId, { title: version.title, content: version.content });
    toast.success("Przywrócono wersję");
  }, [notesRef, updateNote, addVersion]);

  const { displayNotes, pinned, others, elsewhere } = useFilteredNotes({
    notes, archivedNotes, trashedNotes, folders, view, activeLabel, activeFolder, search: deferredSearch, prefs, propDefs,
  });

  useDayDoneReward(view === "today" && !search ? displayNotes : null);
  // W Terminach archiwum zostaje w liście (dzwoni), więc „Brak przypomnień” nie może mówić prawdy tylko o `displayNotes` (1d planu).
  // Archiwum nie wchodzi do grup „Zaległe”/„Nadchodzące” (D4): ma własną sekcję na dole, z wyszukiwaniem.
  const reminderGroups = useMemo(() => (view === "reminders" ? groupReminders(others) : []), [view, others]);
  const archivedRows = useMemo(
    () => (view === "reminders" ? (deferredSearch ? searchNotes(archivedNotes, deferredSearch) : archivedNotes) : []),
    [view, deferredSearch, archivedNotes],
  );
  // Na „Dziś” liczą się zaległe i dzisiejsze przypomnienia, żeby „Brak notatek z dzisiaj” nie stał obok ich listy.
  // Bez `useMemo`: Index i tak renderuje się po północy (useOverdueBadge → useDayClock).
  const reminderRowCount = view === "reminders"
    ? reminderGroups.reduce((n, g) => n + g.notes.length, 0) + archivedRows.length
    : view === "today" ? countDueToday(reminderNotes) : 0;

  // Sekcje widoku: „Przypięte” (zwijane od 4 notatek) i reszta, opcjonalnie podzielona na grupy.
  // `visibleNotes` = to, co faktycznie jest na ekranie (bez zwiniętych) w kolejności widoku.
  // Tablica / tabela mają sens tylko w widokach z listą notatek (nie w agendzie, koszu, kalendarzu, grafiku).
  const listView = view !== "reminders" && view !== "trash" && view !== "calendar" && view !== "shifts" && view !== "study" && view !== "debts" && view !== "cwiczenia";
  const boardMode = prefs.layout === "board" && listView;
  const tableMode = prefs.layout === "table" && listView;
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
  const allNotesForLinksRef = useLatestRef(allNotesForLinks);
  /**
   * Jedno miejsce „pokaż tę notatkę”: przełącza na widok, w którym notatka
   * faktycznie jest (Notatki / Archiwum / Kosz), zdejmuje filtry, które mogłyby
   * ją ukryć, przewija do karty i na chwilę ją podświetla.
   */
  const revealNote = useCallback((id: string, target: View, viaLink: boolean, edit: boolean) => {
    setSearch("");
    if (viaLink) replaceWith(target); else go(target, { search: "" });
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-note-id="${id}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Pierścień fokusu idzie za notatką — inaczej zostaje na kaflu z linkiem i świecą dwa naraz.
      setGridNavFocus(id);
      el.classList.add("note-flash");
      setTimeout(() => el.classList.remove("note-flash"), 1600);
      // Ta sama ścieżka co klik w kartę (patrz `NoteGrid` → `openNote`).
      if (edit) document.querySelector<HTMLElement>(`[data-note-id-wrap="${id}"] .cursor-pointer`)?.click();
    }, 150);
  }, [go, replaceWith]);
  /** Zapisany filtr: widok Notatki z jego zapytaniem w polu wyszukiwania. */
  const goFilter = useCallback((query: string) => {
    setSearch(query);
    go("notes", { search: query });
    if (isMobile) setSidebarOpen(false);
  }, [go, isMobile]);
  const openNote = useCallback((id: string, viaLink = false, edit = false) => {
    const note = [...notesRef.current, ...archivedRef.current, ...trashedRef.current].find((n) => n.id === id);
    if (!note) {
      toast.info("Tej notatki już nie ma");
      if (viaLink) replaceWith("notes");
      return;
    }
    const target: View = note.trashed ? "trash" : note.archived ? "archive" : "notes";
    if (target !== "notes") toast.info(target === "trash" ? "Notatka jest w Koszu" : "Notatka jest w Archiwum");
    revealNote(id, target, viaLink, edit && target !== "trash");
  }, [notesRef, archivedRef, trashedRef, replaceWith, revealNote]);
  // Hooki wołane wyżej w komponencie (powiadomienia) sięgają po najnowsze `openNote` przez ref.
  openNoteRef.current = openNote;

  /**
   * Notatka dnia: jest → otwórz ją w edytorze ze znacznikiem godziny na końcu;
   * nie ma → utwórz z szablonem dziennika. Rozpoznanie po `dailyDate`, nie tytule.
   */
  const openDailyNote = useCallback(() => {
    const now = Date.now();
    const key = dailyKey(now);
    const existing = findDailyNote([...notes, ...archivedNotes], key);
    if (existing) {
      // Przy otwartym edytorze szkic ma pierwszeństwo — nie dopisujemy mu pod ręką.
      // Notatka dnia zablokowana: nie dopisujemy do niej z jawnej (pustej) projekcji.
      if (!existing.locked && !isNoteTextEditOpen(existing.id)) updateNote(existing.id, { content: appendTimestamp(existing.content, now) });
      openNote(existing.id, false, true);
      return;
    }
    addLabel(DAILY_LABEL);
    const id = addNote(dailyTitle(now), DAILY_TEMPLATE, "lavender", [DAILY_LABEL]);
    updateNote(id, { dailyDate: key });
    revealNote(id, "notes", false, true);
  }, [notes, archivedNotes, updateNote, openNote, addLabel, addNote, revealNote]);

  /**
   * Notatka tygodnia / miesiąca: jest → otwórz; nie ma → utwórz z szablonem.
   * Rozpoznanie po `periodKey`, nie tytule (patrz `lib/periodNote.ts`).
   */
  const openPeriodNote = useCallback((kind: PeriodKind) => {
    const now = Date.now();
    const key = periodKey(kind, now);
    const existing = findPeriodNote([...notes, ...archivedNotes], key);
    if (existing) {
      openNote(existing.id, false, true);
      return;
    }
    addLabel(PERIOD_LABEL[kind]);
    const id = addNote(periodTitle(kind, now), PERIOD_TEMPLATE[kind], "lavender", [PERIOD_LABEL[kind]]);
    updateNote(id, { periodKey: key });
    revealNote(id, "notes", false, true);
  }, [notes, archivedNotes, updateNote, openNote, addLabel, addNote, revealNote]);

  // `/notatka/:id` (link, klik w powiadomienie): otwieramy dopiero po
  // wczytaniu bazy — wcześniej każda notatka wyglądałaby na usuniętą.
  const [notesLoaded, setNotesLoaded] = useState(false);
  useEffect(() => { whenNotesReady().then(() => setNotesLoaded(true)); }, []);
  useEffect(() => {
    if (route.noteId && notesLoaded) openNote(route.noteId, true);
  }, [route.noteId, notesLoaded, openNote]);

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
  useEffect(() => { if (readerId) markNoteOpened(readerId); }, [readerId]);

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
  const handleAddNoteGlow = useCallback((...args: Parameters<typeof addNote>) => {
    const p = centerOf(document.querySelector("[data-add-note-bar]"));
    if (p) glowPulse(p, "create", 260);
    const [title, content, color, labels = [], reminder, images, checklist, priority, folderId, attachments] = args;
    const withLabel = activeLabel && !labels.includes(activeLabel) ? [...labels, activeLabel] : labels;
    const inFolder = folderId ?? (view === "folder" ? activeFolder : null);
    return addNote(title, content, color, withLabel, reminder, images, checklist, priority, inFolder, attachments);
  }, [addNote, activeLabel, activeFolder, view]);

  /** Dodanie z paska: potwierdzenie z „Cofnij” (tylko tu — szablony i udostępnianie mają swoje komunikaty). */
  const handleComposerAdd = useCallback((...args: [...Parameters<typeof addNote>, extras?: ComposerExtras]) => {
    const extras = args.length > 10 ? (args[10] as ComposerExtras | undefined) : undefined;
    const id = handleAddNoteGlow(...(args.slice(0, 10) as Parameters<typeof addNote>));
    // Seria przypomnienia i rodzic nie mieszczą się w `addNote` — dopisujemy je zaraz po utworzeniu.
    if (extras?.reminderRepeat || extras?.parentId) {
      updateNote(id, {
        ...(extras.reminderRepeat ? { reminderRepeat: extras.reminderRepeat } : {}),
        ...(extras.reminderRepeatUntil !== undefined ? { reminderRepeatUntil: extras.reminderRepeatUntil } : {}),
        ...(extras.parentId ? { parentId: extras.parentId } : {}),
      });
    }
    toastWithUndo("Dodano notatkę", () => deleteNote(id), { icon: "📝", duration: 4000, id: "composer-added" });
    return id;
  }, [handleAddNoteGlow, updateNote, deleteNote]);

  /** Kandydaci na rodzica w pasku nowej notatki: jawne, żywe notatki, od ostatnio edytowanych. */
  const composerParents = useMemo(
    () => [...notes].filter((n) => !n.locked && !n.archived && !n.trashed).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 200).map((n) => ({ id: n.id, title: n.title })),
    [notes],
  );

  const handleMoveToFolderGlow = useCallback((id: string, folderId: string | null) => {
    const from = pointOfNote(id);
    const target = folderId
      ? document.querySelector(`[data-folder-drop="${folderId}"]`)
      : document.querySelector("[data-folder-drop-root]");
    const to = centerOf(target);
    if (from && to) glowStreak(from, to, "move");
    else if (from) glowPulse(from, "move");
    moveNoteToFolder(id, folderId);
  }, [moveNoteToFolder]);

  useLaunchIntents({ navigate, addNote: handleAddNoteGlow, openNote, expandComposer: expandAddNote });

  // Licznik w pasku bocznym tylko przy tym, co wymaga uwagi: zaległe przypomnienia i Kosz.
  // Ta sama liczba ląduje w tytule karty i na ikonie aplikacji (useOverdueBadge).
  // Zaległości: aktywne notatki plus terminy Pracy (D1); archiwum nie liczy się (D4).
  const overdueCount = useOverdueBadge(notes, useStudyOverdueCount());
  // Trwałe usunięcie zabiera ze sobą historię wersji — inaczej zostawałaby
  // w `localStorage` na zawsze i zjadała limit.
  const deleteNoteForever = useCallback((id: string) => { deleteNote(id); deleteVersions(id); }, [deleteNote, deleteVersions]);
  const handleDelete = view === "trash" ? deleteNoteForever : handleTrashSingle;

  const { restoreSelected, pinSelected, moveSelectedToFolder, labelSelected, moveToColumn, mergeSelected } = useBulkNoteOps({
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
  const inboxCount = useMemo(() => notes.reduce((n, note) => n + (isInboxNote(note) ? 1 : 0), 0), [notes]);
  // Pole Skrzynki: Enter zapisuje od razu, bez pytań; „Cofnij” w dymku kasuje świeżą notatkę.
  const captureToInbox = useCallback((title: string, content: string) => {
    const id = handleAddNoteGlow(title, content);
    toastWithUndo("Zapisano w skrzynce", () => deleteNote(id), { icon: "📥", duration: 4000, id: "inbox-capture" });
  }, [handleAddNoteGlow, deleteNote]);

  const navItems = sidebarItems({ inbox: inboxCount, overdue: overdueCount, trash: trashedNotes.length });

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
          selectionMode={selectionMode}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          dark={dark}
          onToggleTheme={toggleTheme}
          view={view}
          activeFolder={activeFolder}
          activeLabel={activeLabel}
          displayCount={displayNotes.length}
          search={search}
          onSearchChange={setSearch}
          onImport={handleImport}
        />

        {/* `flex gap`, nie `space-y`: ukryta na sm+ wyszukiwarka nie dokłada marginesu nad treścią. */}
        {/* Dziś na telefonie: ciaśniejsze odstępy między kartami, mniej przewijania na 390 px. */}
        <main ref={mainRef} className={`flex-1 max-w-352 mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex flex-col pb-safe ${view === "today" ? "gap-4 sm:gap-10" : "gap-8 sm:gap-10"}`}>
          {isTitleBlockView(view) && <ViewTitle view={view} count={view === "today" ? displayNotes.length : undefined} />}
          {view !== "shifts" && view !== "calendar" && view !== "study" && view !== "debts" && view !== "cwiczenia" && (
            <div data-view-static className="sm:hidden">
              <SearchBar value={search} onChange={setSearch} />
            </div>
          )}
          {view === "notes" && <InstallBanner ready={notes.length >= 3} />}
          {view === "inbox" && !deferredSearch && <InboxCapture onCapture={captureToInbox} />}
          {view === "inbox" && !deferredSearch && inboxCount > 0 && (
            <button type="button" onClick={() => { setTriageMounted(true); setTriageOpen(true); }}
              className="self-start inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-primary-ink hover:bg-primary/10 coarse:min-h-11 outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
              Porządkuj skrzynkę ({inboxCount})
            </button>
          )}
          {triageMounted && (
            <Suspense fallback={null}>
              <InboxTriage open={triageOpen} onOpenChange={setTriageOpen} />
            </Suspense>
          )}

          {/* Każda karta Dziś ma własną granicę: błąd w danych Pracy nie kładzie całego widoku, który jest punktem wejścia. */}
          {view === "today" && !deferredSearch && (
            <ViewErrorBoundary name="Grafik">
              <Suspense fallback={<CardSkeleton />}>
                <TodayShiftCard onOpenShifts={() => go("shifts")} onDailyNote={openDailyNote} />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {view === "today" && !deferredSearch && (
            <ViewErrorBoundary name="Przypomnienia">
              <Suspense fallback={<CardSkeleton />}>
                <TodayDueList notes={reminderNotes} onOpen={openNote} onOpenReminders={() => go("reminders")} onUpdate={updateNote} />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {view === "today" && !deferredSearch && (
            <ViewErrorBoundary name="Praca">
              <Suspense fallback={null}>
                <StudyDueRows onOpenStudy={(siteId) => go("study", siteId ? { site: siteId } : {})} />
                <TodaySiteCard />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {view === "today" && !deferredSearch && (
            <ViewErrorBoundary name="Powtórki">
              <Suspense fallback={<CardSkeleton />}>
                <TodayStudyCard onPractice={() => navigate("/praca?powtorka=1")} />
              </Suspense>
              <Suspense fallback={null}>
                <BrainTrainingCard onRemind={(at, title) => addNote(title, "", "default", [], at)} />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {view === "today" && !deferredSearch && (
            <ViewErrorBoundary name="Przegląd tygodnia">
              <Suspense fallback={<CardSkeleton />}>
                <WeeklyReviewCard
                  notes={notes} folders={folders} onOpen={openNote} onTogglePin={togglePin}
                  onArchive={handleArchiveSingle} onMoveToFolder={handleMoveToFolderGlow}
                  archiveNote={archiveNote} unarchiveNote={unarchiveNote} trashNote={trashNote} restoreFromTrash={restoreFromTrash}
                />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {canCompose && (
            <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={tween.enter}
              // Zwinięty pasek jest pod `md` schowany — pusty pojemnik dokładał drugi odstęp `gap` nad notatkami (~50 px).
              className="space-y-3 max-md:[&:not(:has([data-composer-open]))]:hidden">
              <div data-add-note-bar>
                <AddNoteBar ref={addNoteRef} onAdd={handleComposerAdd} wikiTitles={wikiIndex.titles} parentOptions={composerParents} folders={folders} allLabels={allLabels} onCreateLabel={addLabel} destination={composeDestination}
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
              <p className="text-xs text-muted-foreground">Notatki w koszu są automatycznie usuwane po 30 dniach</p>
              <button
                onClick={() => setConfirmEmptyTrash(true)}
                className="pressable text-xs font-medium text-destructive-ink hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                Opróżnij kosz
              </button>
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

          {showPinned && !boardMode && !tableMode && (
            <NoteGroupSection
              groupKey="pinned"
              label="📌 Przypięte"
              count={pinned.length}
              collapsible={pinnedCollapsible}
              collapsed={pinnedCollapsed}
              onToggle={() => toggleGroupCollapsed("pinned")}
            >
              {renderGrid(pinned, 0)}
            </NoteGroupSection>
          )}

          {view === "reminders" && (
            <Suspense fallback={null}>
              <StudyDueRows onOpenStudy={(siteId) => go("study", siteId ? { site: siteId } : {})} />
            </Suspense>
          )}
          {view === "reminders" && reminderGroups.map((group, i) => (
            <NoteGroupSection key={group.key} groupKey={`reminders-${group.key}`} label={group.label} count={group.notes.length} tone={group.key === "overdue" || group.key === "missed" ? "alert" : "default"}>
              {renderGrid(group.notes, i)}
            </NoteGroupSection>
          ))}
          {view === "reminders" && archivedRows.length > 0 && (
            <NoteGroupSection groupKey="reminders-archive" label="W archiwum" count={archivedRows.length}>
              {renderGrid(archivedRows, reminderGroups.length)}
            </NoteGroupSection>
          )}
          {view === "reminders" && (
            <Suspense fallback={null}>
              <SeriesForecastSection notes={reminderNotes} />
            </Suspense>
          )}

          {view !== "reminders" && !boardMode && !tableMode && groups.map((group, gi) => {
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
                ...(showPinned ? [{ key: PINNED_COLUMN, label: "📌 Przypięte", count: pinned.length }] : []),
                ...groups.map((group) => ({ key: group.key || NONE_COLUMN, label: group.label, count: group.notes.length })),
              ]}
            >
              {showPinned && (
                <BoardColumn columnKey={PINNED_COLUMN} label="📌 Przypięte" count={pinned.length}>
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

          {tableMode && (
            <>
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPropDefsOpen(true)}
                  className="inline-flex h-9 items-center rounded-lg border border-input bg-background px-3 text-sm hover:bg-muted"
                >
                  Pola{propDefs.length ? ` (${propDefs.length})` : ""}
                </button>
              </div>
              <NoteTable
                notes={[...(showPinned ? pinned : []), ...others]}
                folders={folders}
                sortKey={prefs.sortKey}
                sortDir={prefs.sortDir}
                selectedIds={selectedIds}
                onOpen={(id) => showInReader(id, "preview")}
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
                  onCreateNote={(title, reminder, repeat, allDay) => {
                    const id = addNote(title, "", prefs.defaultNoteColor, [], reminder);
                    // `addNote` nie przyjmuje powtarzania, więc serię dostawiamy
                    // patchem po utworzeniu — stąd id zwracane przez `addNote`.
                    if (repeat !== "none" || allDay) updateNote(id, { reminderRepeat: repeat, ...(allDay ? { reminderAllDay: true } : {}) });
                  }}
                  onSetReminder={(id, reminder, repeat, reminderDay, reminderBase, reminderAllDay) =>
                    updateNote(id, { reminder, reminderRepeat: repeat, ...(reminderDay === undefined ? {} : { reminderDay }), reminderBase, reminderAllDay: reminderAllDay === true ? true : undefined })}
                />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {view === "study" && (
            <ViewErrorBoundary name="Praca">
              <Suspense fallback={<ViewSkeleton view="study" />}>
                <StudyView />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {view === "cwiczenia" && (
            <ViewErrorBoundary name="Ćwiczenia">
              <Suspense fallback={<div className="min-h-[60dvh]" aria-hidden />}>
                <CwiczeniaView />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {view === "debts" && (
            <ViewErrorBoundary name="Długi">
              <Suspense fallback={<div className="min-h-[60dvh]" aria-hidden />}>
                <DebtsView addReminderNote={(title, content, at) => addNote(title, content, prefs.defaultNoteColor, [], at)} />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {view === "shifts" && (
            <ViewErrorBoundary name="Grafik">
              <Suspense fallback={<ViewSkeleton view="shifts" />}>
                <ShiftsView notes={[...notes, ...archivedNotes]} />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {/* Liczba wyników dla czytnika ekranu — lista zmienia się bez żadnego komunikatu. */}
          <p role="status" aria-live="polite" className="sr-only">
            {deferredSearch && view !== "calendar" && view !== "shifts" && view !== "study" && view !== "debts" && view !== "cwiczenia" ? `${displayNotes.length} ${pluralPl(displayNotes.length, ["wynik", "wyniki", "wyników"])}` : ""}
          </p>
          <AnimatePresence>
            {view !== "calendar" && view !== "shifts" && view !== "study" && view !== "debts" && view !== "cwiczenia" && displayNotes.length === 0 && reminderRowCount === 0 && <EmptyState key="empty" view={view} search={deferredSearch} elsewhere={elsewhere} onGo={(v) => go(v)} onNew={() => expandAddNote()} onClearSearch={() => setSearch("")} />}
          </AnimatePresence>
          {view === "notes" && displayNotes.length > 0 && !deferredSearch && <DailyQuote />}
        </main>
      </div>
    </div>

    <Suspense fallback={null}>
      <DailyReportNudge onOpenWork={() => setView("study")} />
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
          notes={[...notes, ...archivedNotes]}
          onOpenNote={openNote}
          onNewNote={expandAddNote}
          onDailyNote={openDailyNote}
          onPeriodNote={openPeriodNote}
          onGo={(v) => go(v)}
          onGoFilter={goFilter}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenStats={() => setStatsOpen(true)}
          onOpenFocusMode={() => setFocusModeOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
          onCopyNote={copyTarget ? (fmt) => { void copyNoteToClipboard(copyTarget, fmt); } : undefined}
        />
      </Suspense>
    )}
    <AchievementStamp />
    {statsOpen && (
      <Suspense fallback={null}>
        <StatsDialog
          open={statsOpen}
          onOpenChange={setStatsOpen}
          notes={notes}
          archivedNotes={archivedNotes}
          allLabels={allLabels}
          folders={folders}
        />
      </Suspense>
    )}
    {/* Tu, nie w pasku bocznym: pasek istnieje tylko gdy jest otwarty (na telefonie
        domyślnie zamknięty), a Ustawienia otwiera też „Więcej” i paleta poleceń. */}
    {settingsOpen && (
      <Suspense fallback={null}>
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </Suspense>
    )}
    {externalImport.open && (
      <Suspense fallback={null}>
        <ImportExternalDialog
          open={externalImport.open}
          stage={externalImport.stage}
          plan={externalImport.plan}
          error={externalImport.error}
          onPickFiles={externalImport.pickFiles}
          onConfirm={externalImport.confirm}
          onBack={externalImport.backToPick}
          onClose={externalImport.close}
        />
      </Suspense>
    )}
    {shortcutsOpen && (
      <Suspense fallback={null}>
        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      </Suspense>
    )}
    {propDefsOpen && (
      <Suspense fallback={null}>
        <PropDefsDialog
          open={propDefsOpen}
          onOpenChange={setPropDefsOpen}
          defs={propDefs}
          onAdd={addPropDef}
          onUpdate={updatePropDef}
          onDelete={deletePropDef}
        />
      </Suspense>
    )}
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
            updateNote(noteId, { checklist: n.checklist.map((c) => (c.id === itemId ? { ...c, checked: !c.checked } : c)) });
          }}
        />
        </Suspense>
      )}
    </AnimatePresence>
    {focusModeOpen && (
      <Suspense fallback={null}>
        <FocusMode
          open={focusModeOpen}
          onOpenChange={setFocusModeOpen}
          onSave={(title, content) => { addNote(title, content); toast.success("Zapisano notatkę 🧠"); }}
        />
      </Suspense>
    )}
    <BottomNav
      view={view}
      onGo={(v) => go(v)}
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
      view={view === "trash" ? "trash" : view === "archive" ? "archive" : "other"}
      onRestore={restoreSelected}
      onDeleteForever={() => setConfirmDeleteIds(Array.from(selectedIds))}
      onExport={() => {
        const ids = selectedIds;
        const chosen = [...notes, ...archivedNotes, ...trashedNotes].filter((n) => ids.has(n.id));
        const zip = downloadNotesZip(chosen, folders, `notatki-${new Date().toISOString().slice(0, 10)}.zip`, propDefs);
        toast.success(`Pobrano ${zip.count} ${zip.count === 1 ? "notatkę" : "notatek"} (ZIP z plikami .md)`, {
          description: zip.skippedPrivate ? `Pominięto ${zip.skippedPrivate} prywatnych — ich treść jest zaszyfrowana.` : "Bez obrazów i załączników. Da się je wczytać z powrotem przez Importuj → Markdown.",
        });
      }}
    />
    <Suspense fallback={null}>
      <OnboardingTour />
    </Suspense>
    {actionsOpen && (
      <Suspense fallback={null}>
        <RecentActionsPanel
          open={actionsOpen}
          onOpenChange={setActionsOpen}
          onOpenNote={(ids) => {
            const existing = [...notes, ...archivedNotes, ...trashedNotes].find((n) => ids.includes(n.id));
            openNote(existing?.id ?? ids[0]);
          }}
        />
      </Suspense>
    )}
    {confirmDialog}
    <VaultHost />
    </DndContext>
  );
};

export default Index;

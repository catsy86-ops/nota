import { useState, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { ViewErrorBoundary } from "@/components/ViewErrorBoundary";
import { StickyNote, Archive, Bell, Trash, Calendar, CalendarRange, BriefcaseBusiness } from "lucide-react";
import { useNotesContext } from "@/hooks/NotesProvider";
import { useNoteVersions } from "@/hooks/useNoteVersions";
import type { NoteVersion } from "@/hooks/useNoteVersions";
import { useReminderNotifications } from "@/hooks/useReminderNotifications";
import { useTheme } from "@/hooks/useTheme";
import { useViewPrefs } from "@/lib/viewPrefs";
import { useFilteredNotes, type View } from "@/hooks/useFilteredNotes";
import { useViewRoute } from "@/hooks/useViewRoute";
import { parseViewRoute } from "@/lib/viewRoute";
import { groupReminders } from "@/lib/reminderAgenda";
import { buildWikiIndex, resolveWikiTarget, wikiIndexKey } from "@/lib/wikiLinks";
import { useLatestRef, useStableByKey } from "@/hooks/useLatestRef";
import { useGridNavPreviewId, setGridNavPreview, setGridNavFocus } from "@/lib/gridKeyboardNav";
import { NoteReader, type ReaderMode } from "@/components/NoteReader";
import { cn } from "@/lib/utils";
import { playEnter, tween } from "@/lib/motion";
import { useNavigationType } from "react-router-dom";
import { whenNotesReady, isNoteTextEditOpen } from "@/hooks/useNotes";
import { DAILY_LABEL, DAILY_TEMPLATE, appendTimestamp, dailyKey, dailyTitle, findDailyNote } from "@/lib/dailyNote";
import { useNoteActions } from "@/hooks/useNoteActions";
import { useNoteDnd } from "@/hooks/useNoteDnd";
import { useImportExport, useExternalImport } from "@/hooks/useImportExport";
import { useBackupReminders } from "@/hooks/useBackupReminders";
import { useShiftEveningNudge } from "@/hooks/useShiftEveningNudge";
import { useDailyWeeklyNudges } from "@/hooks/useDailyWeeklyNudges";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { AddNoteBar } from "@/components/AddNoteBar";
import { InstallBanner } from "@/components/InstallBanner";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { NoteGrid } from "@/components/NoteGrid";
import { EmptyState } from "@/components/EmptyState";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { DndContext, pointerWithin } from "@dnd-kit/core";
import { fireworks, megaCelebrate } from "@/lib/celebrate";
import { glowPulse, glowStreak, centerOf, pointOfNote } from "@/lib/glowTrail";
import { SearchBar } from "@/components/SearchBar";
import { useAchievementTracker } from "@/lib/achievements";
import { useDayDoneReward } from "@/hooks/useDayDoneReward";
import { showAchievementStamp } from "@/lib/achievementStamp";
import { AchievementStamp } from "@/components/AchievementStamp";
import { ShortcutsDialog } from "@/components/ShortcutsDialog";
import { DailyQuote } from "@/components/DailyQuote";
import { WeeklyReviewCard } from "@/components/review/WeeklyReviewCard";
import { PaperBackdrop } from "@/components/PaperBackdrop";
import { QuickTemplates } from "@/components/QuickTemplates";
import { useConfirmAction } from "@/components/ConfirmActionDialog";
import { BulkActionBar } from "@/components/BulkActionBar";
import { registerUndoHandlers, undoLastAction } from "@/lib/actionHistory";
import { BottomNav } from "@/components/BottomNav";
import { RecentActionsPanel } from "@/components/RecentActionsPanel";
import { OnboardingTour } from "@/components/OnboardingTour";

// Dialogs that aren't part of the initial view (opened via keyboard shortcut,
// note action or explicit toggle) — kept out of the eager main bundle so
// first load only pays for the code the note grid itself needs.
const CommandPalette = lazy(() => import("@/components/CommandPalette").then((m) => ({ default: m.CommandPalette })));
const ImportExternalDialog = lazy(() => import("@/components/ImportExternalDialog").then((m) => ({ default: m.ImportExternalDialog })));
const SettingsDialog = lazy(() => import("@/components/SettingsDialog").then((m) => ({ default: m.SettingsDialog })));
const StatsDialog = lazy(() => import("@/components/StatsDialog").then((m) => ({ default: m.StatsDialog })));
const FocusMode = lazy(() => import("@/components/FocusMode").then((m) => ({ default: m.FocusMode })));
// Kalendarz wchodzi tylko po wejściu w swój widok — siatka notatek go nie potrzebuje.
// Grafik zmian — osobny dział, ładowany dopiero po wejściu.
const ShiftsView = lazy(() => import("@/components/shifts/ShiftsView").then((m) => ({ default: m.ShiftsView })));
const ReminderCalendarView = lazy(() => import("@/components/calendar/ReminderCalendarView").then((m) => ({ default: m.ReminderCalendarView })));

const Index = () => {
  const {
    notes, archivedNotes, trashedNotes, allLabels, folders,
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
  const setView = useCallback((v: View) => go(v), [go]);
  // Pole wyszukiwania ma własny stan (karetka nie może czekać na router);
  // adres dostaje go z opóźnieniem zerowym, a „wstecz/dalej” wlewa z powrotem.
  const [search, setSearch] = useState(route.search);
  const navigationType = useNavigationType();
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
  const addNoteRef = useRef<{ expand: () => void }>(null);
  const logoClicksRef = useRef<{ count: number; lastTs: number }>({ count: 0, lastTs: 0 });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [presentingNoteId, setPresentingNoteId] = useState<string | null>(null);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastSelectedRef = useRef<string | null>(null);
  const selectionMode = selectedIds.size > 0;

  // Reset selection whenever the view or active label/folder changes.
  useEffect(() => { setSelectedIds(new Set()); lastSelectedRef.current = null; }, [view, activeLabel, activeFolder]);

  function handleLogoClick() {
    const now = Date.now();
    const state = logoClicksRef.current;
    if (now - state.lastTs > 600) state.count = 0;
    state.lastTs = now;
    state.count += 1;
    if (state.count >= 3) {
      state.count = 0;
      fireworks();
      toast.success("🍺 Na zdrowie! Niespodzianka!");
    }
  }

  // Auto-close sidebar on mobile, auto-open on desktop
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const openNoteRef = useRef<(id: string) => void>(() => {});
  useReminderNotifications(
    [...notes, ...archivedNotes],
    (id, nextReminder, reminderDay) => updateNote(id, { reminder: nextReminder, reminderDay }),
    (id) => openNoteRef.current(id),
    (id) => updateNote(id, { reminderRepeat: "none", reminderRepeatUntil: undefined }),
  );

  // Odznaki w głównym widoku: jeden cichy toast na paczkę (import potrafi odblokować
  // kilka naraz), stałe `id` podmienia go zamiast piętrzyć. Szczegóły są w Statystykach.
  // Nad otwartym oknem (edytor nowej notatki) odznaka by go zasłaniała — czeka, aż okno się zamknie.
  const unlockedBatchRef = useRef<{ titles: string[]; description: string }>({ titles: [], description: "" });
  const badgeTimerRef = useRef<number | null>(null);
  const showBadgeToast = useCallback(() => {
    if (document.querySelector('[role="dialog"][data-state="open"]')) {
      badgeTimerRef.current = window.setTimeout(showBadgeToast, 1000);
      return;
    }
    badgeTimerRef.current = null;
    const { titles, description } = unlockedBatchRef.current;
    const reset = () => { unlockedBatchRef.current = { titles: [], description: "" }; };
    toast(titles.length === 1 ? `Nowa odznaka: ${titles[0]}` : `Nowe odznaki: ${titles.length}`, {
      id: "achievements",
      description: titles.length === 1 ? description : titles.join(", "),
      duration: 4000,
      action: { label: "Zobacz", onClick: () => setStatsOpen(true) },
      onAutoClose: reset,
      onDismiss: reset,
    });
  }, []);
  useEffect(() => () => { if (badgeTimerRef.current !== null) clearTimeout(badgeTimerRef.current); }, []);
  useAchievementTracker(notes, archivedNotes, allLabels, folders, (a) => {
    // Pieczątka zastępuje dymek (przy wyłączonym efekcie / reduced motion zostaje dymek).
    if (showAchievementStamp(a)) return;
    unlockedBatchRef.current.titles.push(a.title);
    unlockedBatchRef.current.description = a.description;
    if (badgeTimerRef.current === null) showBadgeToast();
  });

  useBackupReminders(prefs, notes, archivedNotes);
  useDailyWeeklyNudges(prefs, notes, setView);
  useShiftEveningNudge(useCallback(() => setView("shifts"), [setView]));

  // Pasek dodawania jest też w folderze i etykiecie — nowa notatka dziedziczy
  // ten kontekst (`handleAddNoteGlow`), zamiast lądować poza widokiem.
  const canCompose = view === "notes" || (view === "folder" && !!activeFolder) || (view === "label" && !!activeLabel);
  const composeDestination = view === "folder"
    ? folders.find((f) => f.id === activeFolder)?.name ?? null
    : view === "label" ? `#${activeLabel}` : null;

  function expandAddNote() {
    if (!canCompose) setView("notes");
    setTimeout(() => addNoteRef.current?.expand(), 100);
  }

  const clearSelection = useCallback(() => { setSelectedIds(new Set()); lastSelectedRef.current = null; }, []);

  useGlobalShortcuts({
    onNewNote: expandAddNote,
    onGoToday: () => go("today"),
    onGoWeek: () => go("week"),
    onGoView: (v) => go(v),
    onEasterEgg: () => { megaCelebrate(); toast.success("🍺 KONAMI! Pełen pokaz mocy!"); },
    hasSelection: () => selectedIds.size > 0,
    onEscapeSelection: clearSelection,
    onUndo: () => {
      const done = undoLastAction();
      if (done) {
        toast.success(done.kind === "trash" ? "Cofnięto usunięcie" : "Cofnięto archiwizację", {
          description: done.label,
          icon: "↩️",
        });
      } else {
        toast("Nie ma czego cofać", { icon: "🍺" });
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
    addVersion(noteId, current?.title || "", current?.content || "");
    updateNote(noteId, { title: version.title, content: version.content });
    toast.success("Przywrócono wersję");
  }, [notesRef, updateNote, addVersion]);

  const { displayNotes, pinned, others, elsewhere } = useFilteredNotes({
    notes, archivedNotes, trashedNotes, folders, view, activeLabel, activeFolder, search: deferredSearch, prefs,
  });

  useDayDoneReward(view === "today" && !search ? displayNotes : null);

  const allNotesForLinks = useMemo(() => [...notes, ...archivedNotes], [notes, archivedNotes]);
  // `knownTitles` i `wikiIndex` idą do każdej karty: zostawiamy ten sam obiekt,
  // dopóki tytuły i linki się nie zmienią (np. odhaczenie checklisty ich nie rusza).
  const titlesList = useMemo(
    () => [...new Set(allNotesForLinks.map((n) => n.title.trim().toLowerCase()).filter(Boolean))].sort(),
    [allNotesForLinks],
  );
  const freshKnownTitles = useMemo(() => new Set(titlesList), [titlesList]);
  const knownTitles = useStableByKey(freshKnownTitles, titlesList.join("\n"));
  const freshWikiIndex = useMemo(() => buildWikiIndex(allNotesForLinks), [allNotesForLinks]);
  const wikiIndex = useStableByKey(freshWikiIndex, wikiIndexKey(freshWikiIndex));
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
      if (!isNoteTextEditOpen(existing.id)) updateNote(existing.id, { content: appendTimestamp(existing.content, now) });
      openNote(existing.id, false, true);
      return;
    }
    addLabel(DAILY_LABEL);
    const id = addNote(dailyTitle(now), DAILY_TEMPLATE, "lavender", [DAILY_LABEL]);
    updateNote(id, { dailyDate: key });
    revealNote(id, "notes", false, true);
  }, [notes, archivedNotes, updateNote, openNote, addLabel, addNote, revealNote]);

  // `/notatka/:id` (link, klik w powiadomienie): otwieramy dopiero po
  // wczytaniu bazy — wcześniej każda notatka wyglądałaby na usuniętą.
  const [notesLoaded, setNotesLoaded] = useState(false);
  useEffect(() => { whenNotesReady().then(() => setNotesLoaded(true)); }, []);
  useEffect(() => {
    if (route.noteId && notesLoaded) openNote(route.noteId, true);
  }, [route.noteId, notesLoaded, openNote]);

  const handleWikiClick = useCallback((title: string) => {
    const target = allNotesForLinksRef.current.find((n) => n.title.trim().toLowerCase() === title.trim().toLowerCase());
    if (target) openNote(target.id);
    else toast.info(`Notatka „${title}" nie istnieje`);
  }, [allNotesForLinksRef, openNote]);

  // Czytnik: podgląd (Spacja na kaflu, stan w `gridKeyboardNav`) albo prezentacja.
  const previewId = useGridNavPreviewId();
  const readerId = presentingNoteId ?? previewId;
  const readerNote = useMemo(
    () => (readerId ? [...notes, ...archivedNotes, ...trashedNotes].find((n) => n.id === readerId) ?? null : null),
    [readerId, notes, archivedNotes, trashedNotes],
  );
  const closeReader = useCallback(() => { setPresentingNoteId(null); setGridNavPreview(null); }, []);
  const showInReader = useCallback((id: string, mode: ReaderMode) => {
    if (mode === "present") { setGridNavPreview(null); setPresentingNoteId(id); }
    else { setPresentingNoteId(null); setGridNavPreview(id); }
  }, []);
  const editFromReader = useCallback((id: string) => {
    closeReader();
    // Kafel musi najpierw wrócić na wierzch po zamknięciu czytnika.
    setTimeout(() => openNote(id, false, true), 50);
  }, [closeReader, openNote]);

  const displayNotesRef = useLatestRef(displayNotes);
  const toggleSelect = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedRef.current && lastSelectedRef.current !== id) {
        const ids = displayNotesRef.current.map((n) => n.id);
        const a = ids.indexOf(lastSelectedRef.current);
        const b = ids.indexOf(id);
        if (a !== -1 && b !== -1) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(ids[i]);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      lastSelectedRef.current = id;
      return next;
    });
  }, [displayNotesRef]);

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
    bulkTrash, bulkArchive, bulkSetColor, bulkRestore, setSelectedIds, displayNotes,
  });

  // Notatka tworzona w folderze albo w widoku etykiety ląduje tam, gdzie
  // użytkownik patrzy — inaczej znika mu z oczu i wymaga przeciągnięcia.
  const handleAddNoteGlow = useCallback((...args: Parameters<typeof addNote>) => {
    const p = centerOf(document.querySelector("[data-add-note-bar]"));
    if (p) glowPulse(p, "create", 260);
    const [title, content, color, labels = [], reminder, images, checklist, priority, folderId] = args;
    const withLabel = activeLabel && !labels.includes(activeLabel) ? [...labels, activeLabel] : labels;
    const inFolder = folderId ?? (view === "folder" ? activeFolder : null);
    return addNote(title, content, color, withLabel, reminder, images, checklist, priority, inFolder);
  }, [addNote, activeLabel, activeFolder, view]);

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

  // Entry points from manifest.webmanifest: home-screen "Nowa notatka" shortcut
  // (?new=1) and Web Share Target (?share-title/-text/-url=, from "Share" on
  // another app once the app is installed).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareTitle = params.get("share-title");
    const shareText = params.get("share-text");
    const shareUrl = params.get("share-url");
    if (shareTitle || shareText || shareUrl) {
      const content = [shareText, shareUrl].filter(Boolean).join("\n");
      handleAddNoteGlow(shareTitle ?? "", content);
      toast.success("Notatka utworzona z udostępnionej treści");
      window.history.replaceState(null, "", window.location.pathname);
    } else if (params.get("new")) {
      expandAddNote();
      window.history.replaceState(null, "", window.location.pathname);
    }
    // Intentionally once on mount: reads the URL this load started with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Licznik w pasku bocznym tylko przy tym, co wymaga uwagi: zaległe przypomnienia i Kosz.
  const overdueCount = notes.filter((n) => n.reminder && n.reminder < Date.now()).length;
  // Trwałe usunięcie zabiera ze sobą historię wersji — inaczej zostawałaby
  // w `localStorage` na zawsze i zjadała limit.
  const deleteNoteForever = useCallback((id: string) => { deleteNote(id); deleteVersions(id); }, [deleteNote, deleteVersions]);
  const handleDelete = view === "trash" ? deleteNoteForever : handleTrashSingle;

  const { sensors, setDraggingNoteId, handleDragEnd } = useNoteDnd({
    displayNoteIds: displayNotes.map((n) => n.id),
    folders,
    moveNoteToFolder: handleMoveToFolderGlow,
    reorderNotes,
  });

  const sidebarItems: { icon: React.ElementType; label: string; view: View; count?: number; alert?: boolean; emoji: string }[] = [
    { icon: StickyNote, label: "Notatki", view: "notes", emoji: "📝" },
    { icon: Calendar, label: "Dziś", view: "today", emoji: "📅" },
    { icon: Bell, label: "Przypomnienia", view: "reminders", count: overdueCount, alert: true, emoji: "🔔" },
    { icon: CalendarRange, label: "Kalendarz", view: "calendar", emoji: "🗓️" },
    { icon: BriefcaseBusiness, label: "Grafik", view: "shifts", emoji: "🗂️" },
    { icon: Archive, label: "Archiwum", view: "archive", emoji: "📦" },
    { icon: Trash, label: "Kosz", view: "trash", count: trashedNotes.length, emoji: "🗑️" },
  ];

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={(e) => setDraggingNoteId(e.active.id as string)} onDragEnd={handleDragEnd}>
    <PaperBackdrop />
    <div className="min-h-screen flex relative">
      <AppSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        view={view}
        activeLabel={activeLabel}
        activeFolder={activeFolder}
        onGoView={(v) => { go(v); if (isMobile) setSidebarOpen(false); }}
        onGoLabel={(label) => { go("label", { label }); if (isMobile) setSidebarOpen(false); }}
        onGoFolder={(id) => { go("folder", { folder: id }); if (isMobile) setSidebarOpen(false); }}
        sidebarItems={sidebarItems}
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
        <main ref={mainRef} className="flex-1 max-w-[88rem] mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8 pb-safe">
          {view !== "shifts" && view !== "calendar" && (
            <div data-view-static className="sm:hidden">
              <SearchBar value={search} onChange={setSearch} />
            </div>
          )}
          {view === "notes" && <InstallBanner ready={notes.length >= 3} />}
          {view === "today" && !deferredSearch && (
            <WeeklyReviewCard
              notes={notes} folders={folders} onOpen={openNote} onTogglePin={togglePin}
              onArchive={handleArchiveSingle} onMoveToFolder={handleMoveToFolderGlow}
              archiveNote={archiveNote} unarchiveNote={unarchiveNote} trashNote={trashNote} restoreFromTrash={restoreFromTrash}
            />
          )}

          {canCompose && (
            <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={tween.enter} className="space-y-3">
              <div data-add-note-bar>
                <AddNoteBar ref={addNoteRef} onAdd={handleAddNoteGlow} allLabels={allLabels} onCreateLabel={addLabel} destination={composeDestination}
                  templates={(done) => (
                    <QuickTemplates
                      onPick={(...args) => { done(); handleAddNoteGlow(...args); }}
                      onCreateLabel={addLabel}
                      onDailyNote={() => { done(); openDailyNote(); }}
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
                className="pressable text-xs font-medium text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                Opróżnij kosz
              </button>
            </motion.div>
          )}

          <AlertDialog open={confirmEmptyTrash} onOpenChange={setConfirmEmptyTrash}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">Opróżnić kosz?</AlertDialogTitle>
                <AlertDialogDescription>
                  Wszystkie {trashedNotes.length} {trashedNotes.length === 1 ? "notatka zostanie" : "notatki zostaną"} trwale usunięte. Tej operacji nie można cofnąć.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => { deleteVersions(trashedNotes.map((n) => n.id)); emptyTrash(); toast.success("Kosz opróżniony"); setConfirmEmptyTrash(false); }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Opróżnij
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {pinned.length > 0 && view !== "archive" && view !== "trash" && (
            <section>
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1 flex items-center gap-1.5"
              >
                📌 Przypięte
                <span className="bg-primary/10 text-primary text-2xs px-1.5 rounded-full">{pinned.length}</span>
              </motion.p>
              <NoteGrid navOrder={0} notes={pinned} onUpdate={updateNote} onDelete={handleDelete} onTogglePin={togglePin} onDuplicate={duplicateNote} onArchive={handleArchiveSingle} onMoveToFolder={handleMoveToFolderGlow} getVersions={getVersions} onSaveVersion={addVersion} onRestoreVersion={handleRestoreVersion} onPresent={setPresentingNoteId} knownTitles={knownTitles} onWikiClick={handleWikiClick} wikiIndex={wikiIndex} onOpenNote={openNote} selectedIds={selectedIds} selectionMode={selectionMode} onToggleSelect={toggleSelect} />
            </section>
          )}

          {view === "reminders" && groupReminders(others).map((group, i) => (
            <section key={group.key} aria-label={group.label}>
              <p className={cn(
                "text-xs font-semibold uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5",
                group.key === "overdue" ? "text-destructive" : "text-muted-foreground",
              )}>
                {group.label}
                <span className="bg-muted text-foreground/80 text-2xs px-1.5 rounded-full">{group.notes.length}</span>
              </p>
              <NoteGrid navOrder={i} notes={group.notes} onUpdate={updateNote} onDelete={handleDelete} onTogglePin={togglePin} onDuplicate={duplicateNote} onArchive={handleArchiveSingle} onMoveToFolder={handleMoveToFolderGlow} getVersions={getVersions} onSaveVersion={addVersion} onRestoreVersion={handleRestoreVersion} onPresent={setPresentingNoteId} knownTitles={knownTitles} onWikiClick={handleWikiClick} wikiIndex={wikiIndex} onOpenNote={openNote} selectedIds={selectedIds} selectionMode={selectionMode} onToggleSelect={toggleSelect} />
            </section>
          ))}

          {view !== "reminders" && others.length > 0 && (
            <section>
              {pinned.length > 0 && view !== "archive" && view !== "trash" && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1"
                >
                  Inne
                </motion.p>
              )}
              <NoteGrid
                navOrder={1}
                notes={others}
                onUpdate={view === "trash" ? undefined : updateNote}
                onDelete={handleDelete}
                onTogglePin={view === "trash" ? undefined : togglePin}
                onDuplicate={view === "trash" ? undefined : duplicateNote}
                onArchive={view === "archive" ? undefined : view === "trash" ? undefined : handleArchiveSingle}
                onUnarchive={view === "archive" ? unarchiveNote : view === "trash" ? restoreFromTrash : undefined}
                isArchived={view === "archive" || view === "trash"}
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
            </section>
          )}

          {view === "calendar" && (
            <ViewErrorBoundary name="Kalendarz">
              <Suspense fallback={null}>
                <ReminderCalendarView
                  notes={[...notes, ...archivedNotes]}
                  onCreateNote={(title, reminder, repeat) => {
                    const id = addNote(title, "", prefs.defaultNoteColor, [], reminder);
                    // `addNote` nie przyjmuje powtarzania, więc serię dostawiamy
                    // patchem po utworzeniu — stąd id zwracane przez `addNote`.
                    if (repeat !== "none") updateNote(id, { reminderRepeat: repeat });
                  }}
                  onSetReminder={(id, reminder, repeat, reminderDay) =>
                    updateNote(id, reminderDay === undefined ? { reminder, reminderRepeat: repeat } : { reminder, reminderRepeat: repeat, reminderDay })}
                />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {view === "shifts" && (
            <ViewErrorBoundary name="Grafik">
              <Suspense fallback={null}>
                <ShiftsView notes={[...notes, ...archivedNotes]} />
              </Suspense>
            </ViewErrorBoundary>
          )}

          {view !== "calendar" && view !== "shifts" && displayNotes.length === 0 && <EmptyState view={view} search={deferredSearch} elsewhere={elsewhere} onGo={(v) => go(v)} />}
          {view === "notes" && displayNotes.length > 0 && !deferredSearch && <DailyQuote />}
        </main>
      </div>
    </div>

    {paletteOpen && (
      <Suspense fallback={null}>
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          notes={[...notes, ...archivedNotes]}
          onOpenNote={openNote}
          onNewNote={expandAddNote}
          onDailyNote={openDailyNote}
          onGo={(v) => go(v)}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenStats={() => setStatsOpen(true)}
          onOpenFocusMode={() => setFocusModeOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
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
    <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    <AnimatePresence>
      {readerNote && (
        <NoteReader
          key="reader"
          note={readerNote}
          mode={presentingNoteId ? "present" : "preview"}
          searchQuery={search}
          knownTitles={knownTitles}
          wikiIndex={wikiIndex}
          onClose={closeReader}
          onEdit={editFromReader}
          onShow={showInReader}
          resolveTitle={(title) => resolveWikiTarget(title, allNotesForLinks)?.id}
        />
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
      onNew={expandAddNote}
      onImport={handleImport}
      onOpenSettings={() => setSettingsOpen(true)}
      onOpenActions={() => setActionsOpen(true)}
      trashCount={trashedNotes.length}
      dark={dark}
      onToggleTheme={toggleTheme}
    />
    <BulkActionBar
      count={selectedIds.size}
      totalVisible={displayNotes.length}
      onSelectAll={handleSelectAll}
      onClear={clearSelection}
      onArchive={handleBulkArchive}
      onTrash={handleBulkTrash}
      onColor={handleBulkColor}
    />
    <OnboardingTour />
    <RecentActionsPanel
      open={actionsOpen}
      onOpenChange={setActionsOpen}
      onOpenNote={(ids) => {
        const existing = [...notes, ...archivedNotes, ...trashedNotes].find((n) => ids.includes(n.id));
        openNote(existing?.id ?? ids[0]);
      }}
    />
    {confirmDialog}
    </DndContext>
  );
};

export default Index;

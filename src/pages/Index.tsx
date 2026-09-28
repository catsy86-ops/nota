import { useState, useCallback, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { StickyNote, Archive, Bell, Trash, Calendar, CalendarRange } from "lucide-react";
import { useNotesContext } from "@/hooks/NotesProvider";
import { useNoteVersions } from "@/hooks/useNoteVersions";
import type { NoteVersion } from "@/hooks/useNoteVersions";
import { useReminderNotifications } from "@/hooks/useReminderNotifications";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import { useTheme } from "@/hooks/useTheme";
import { useViewPrefs } from "@/lib/viewPrefs";
import { useFilteredNotes, type View } from "@/hooks/useFilteredNotes";
import { useViewRoute } from "@/hooks/useViewRoute";
import { parseViewRoute } from "@/lib/viewRoute";
import { useNavigationType } from "react-router-dom";
import { whenNotesReady } from "@/hooks/useNotes";
import { useNoteActions } from "@/hooks/useNoteActions";
import { useNoteDnd } from "@/hooks/useNoteDnd";
import { useImportExport } from "@/hooks/useImportExport";
import { useBackupReminders } from "@/hooks/useBackupReminders";
import { useDailyWeeklyNudges } from "@/hooks/useDailyWeeklyNudges";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { getTodayRange } from "@/lib/dateRanges";
import { AddNoteBar } from "@/components/AddNoteBar";
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
import { ShortcutsDialog } from "@/components/ShortcutsDialog";
import { DailyQuote } from "@/components/DailyQuote";
import { AnimatedBackdrop } from "@/components/AnimatedBackdrop";
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
const StatsDialog = lazy(() => import("@/components/StatsDialog").then((m) => ({ default: m.StatsDialog })));
const NotePresentation = lazy(() => import("@/components/NotePresentation").then((m) => ({ default: m.NotePresentation })));
const FocusMode = lazy(() => import("@/components/FocusMode").then((m) => ({ default: m.FocusMode })));
// Kalendarz wchodzi tylko po wejściu w swój widok — siatka notatek go nie potrzebuje.
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
  const setRouteSearch = route.setSearch;
  useEffect(() => {
    if (search !== parseViewRoute(window.location.pathname, window.location.search).search) setRouteSearch(search);
  }, [search, setRouteSearch]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const hideHeader = useHideOnScroll(96);

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
      toast.success("🦆 Kwa kwa! Niespodzianka!");
    }
  }

  // Auto-close sidebar on mobile, auto-open on desktop
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  useReminderNotifications([...notes, ...archivedNotes], (id, nextReminder) => updateNote(id, { reminder: nextReminder }));

  useAchievementTracker(notes, archivedNotes, allLabels, folders, (a) => {
    // Quiet in the main view: a plain toast; badges and celebrations live in Statystyki.
    toast(`Odznaka odblokowana: ${a.title}`, { description: a.description });
  });

  useBackupReminders(prefs, notes, archivedNotes);
  useDailyWeeklyNudges(prefs, notes, setView);

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
    onEasterEgg: () => { megaCelebrate(); toast.success("🦆 KONAMI! Pełen pokaz mocy!"); },
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
        toast("Nie ma czego cofać", { icon: "🦆" });
      }
    },
    onCloseSidebar: () => setSidebarOpen(false),
    isSidebarOpen: () => sidebarOpen,
    onOpenShortcuts: () => setShortcutsOpen(true),
    onTogglePalette: () => setPaletteOpen((o) => !o),
  });

  const { handleImport } = useImportExport(importNotes, addNote);

  const handleRestoreVersion = useCallback((noteId: string, version: NoteVersion) => {
    addVersion(noteId, notes.find(n => n.id === noteId)?.title || "", notes.find(n => n.id === noteId)?.content || "");
    updateNote(noteId, { title: version.title, content: version.content });
    toast.success("Przywrócono wersję");
  }, [notes, updateNote, addVersion]);

  const { displayNotes, pinned, others, elsewhere } = useFilteredNotes({
    notes, archivedNotes, trashedNotes, folders, view, activeLabel, activeFolder, search, prefs,
  });

  const allNotesForLinks = useMemo(() => [...notes, ...archivedNotes], [notes, archivedNotes]);
  const knownTitles = useMemo(
    () => new Set(allNotesForLinks.filter((n) => n.title.trim()).map((n) => n.title.trim().toLowerCase())),
    [allNotesForLinks],
  );
  /**
   * Jedno miejsce „pokaż tę notatkę”: przełącza na widok, w którym notatka
   * faktycznie jest (Notatki / Archiwum / Kosz), zdejmuje filtry, które mogłyby
   * ją ukryć, przewija do karty i na chwilę ją podświetla.
   */
  const openNote = useCallback((id: string, viaLink = false) => {
    const note = [...notes, ...archivedNotes, ...trashedNotes].find((n) => n.id === id);
    if (!note) {
      toast.info("Tej notatki już nie ma");
      if (viaLink) replaceWith("notes");
      return;
    }
    const target: View = note.trashed ? "trash" : note.archived ? "archive" : "notes";
    setSearch("");
    if (viaLink) replaceWith(target); else go(target, { search: "" });
    if (target !== "notes") toast.info(target === "trash" ? "Notatka jest w Koszu" : "Notatka jest w Archiwum");
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-note-id="${id}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("note-flash");
      setTimeout(() => el.classList.remove("note-flash"), 1600);
    }, 150);
  }, [notes, archivedNotes, trashedNotes, go, replaceWith]);

  // `/notatka/:id` (link, klik w powiadomienie): otwieramy dopiero po
  // wczytaniu bazy — wcześniej każda notatka wyglądałaby na usuniętą.
  const [notesLoaded, setNotesLoaded] = useState(false);
  useEffect(() => { whenNotesReady().then(() => setNotesLoaded(true)); }, []);
  useEffect(() => {
    if (route.noteId && notesLoaded) openNote(route.noteId, true);
  }, [route.noteId, notesLoaded, openNote]);

  const handleWikiClick = useCallback((title: string) => {
    const target = allNotesForLinks.find((n) => n.title.trim().toLowerCase() === title.trim().toLowerCase());
    if (target) openNote(target.id);
    else toast.info(`Notatka „${title}" nie istnieje`);
  }, [allNotesForLinks, openNote]);

  const toggleSelect = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedRef.current && lastSelectedRef.current !== id) {
        const ids = displayNotes.map((n) => n.id);
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
  }, [displayNotes]);

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
  // another app once KACZY is installed).
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

  const remindersCount = notes.filter((n) => n.reminder).length;
  // Trwałe usunięcie zabiera ze sobą historię wersji — inaczej zostawałaby
  // w `localStorage` na zawsze i zjadała limit.
  const deleteNoteForever = (id: string) => { deleteNote(id); deleteVersions(id); };
  const handleDelete = view === "trash" ? deleteNoteForever : handleTrashSingle;

  const { sensors, setDraggingNoteId, handleDragEnd } = useNoteDnd({
    displayNoteIds: displayNotes.map((n) => n.id),
    folders,
    moveNoteToFolder: handleMoveToFolderGlow,
    reorderNotes,
  });

  const { start: todayStart, end: todayEnd } = getTodayRange();
  const todayNotesCount = notes.filter((n) => (n.createdAt >= todayStart && n.createdAt <= todayEnd) || (n.updatedAt >= todayStart && n.updatedAt <= todayEnd)).length;

  const sidebarItems: { icon: React.ElementType; label: string; view: View; count?: number; emoji: string }[] = [
    { icon: StickyNote, label: "Notatki", view: "notes", count: notes.length, emoji: "📝" },
    { icon: Calendar, label: "Dziś", view: "today", count: todayNotesCount, emoji: "📅" },
    { icon: Bell, label: "Przypomnienia", view: "reminders", count: remindersCount, emoji: "🔔" },
    { icon: CalendarRange, label: "Kalendarz", view: "calendar", count: remindersCount, emoji: "🗓️" },
    { icon: Archive, label: "Archiwum", view: "archive", count: archivedNotes.length, emoji: "📦" },
    { icon: Trash, label: "Kosz", view: "trash", count: trashedNotes.length, emoji: "🗑️" },
  ];

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={(e) => setDraggingNoteId(e.active.id as string)} onDragEnd={handleDragEnd}>
    <AnimatedBackdrop />
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
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <AppHeader
          hideHeader={hideHeader}
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

        <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-safe">
          <div className="sm:hidden">
            <SearchBar value={search} onChange={setSearch} />
          </div>

          {canCompose && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, duration: 0.4 }} className="space-y-3">
              <div data-add-note-bar>
                <AddNoteBar ref={addNoteRef} onAdd={handleAddNoteGlow} allLabels={allLabels} onCreateLabel={addLabel} destination={composeDestination} />
              </div>
              <QuickTemplates onPick={handleAddNoteGlow} onCreateLabel={addLabel} />
            </motion.div>
          )}

          {view === "trash" && trashedNotes.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between mb-4 px-1">
              <p className="text-xs text-muted-foreground">Notatki w koszu są automatycznie usuwane po 30 dniach</p>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setConfirmEmptyTrash(true)}
                className="text-xs font-medium text-destructive hover:bg-destructive/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                Opróżnij kosz
              </motion.button>
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
              <NoteGrid navOrder={0} notes={pinned} searchQuery={search} onUpdate={updateNote} onDelete={handleDelete} onTogglePin={togglePin} onDuplicate={duplicateNote} onArchive={handleArchiveSingle} onMoveToFolder={handleMoveToFolderGlow} getVersions={getVersions} onSaveVersion={addVersion} onRestoreVersion={handleRestoreVersion} onPresent={setPresentingNoteId} knownTitles={knownTitles} onWikiClick={handleWikiClick} selectedIds={selectedIds} selectionMode={selectionMode} onToggleSelect={toggleSelect} />
            </section>
          )}

          {others.length > 0 && (
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
                searchQuery={search}
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
                selectedIds={selectedIds}
                selectionMode={selectionMode}
                onToggleSelect={toggleSelect}
              />
            </section>
          )}

          {view === "calendar" && (
            <Suspense fallback={null}>
              <ReminderCalendarView
                notes={[...notes, ...archivedNotes]}
                onCreateNote={(title, reminder, repeat) => {
                  const id = addNote(title, "", prefs.defaultNoteColor, [], reminder);
                  // `addNote` nie przyjmuje powtarzania, więc serię dostawiamy
                  // patchem po utworzeniu — stąd id zwracane przez `addNote`.
                  if (repeat !== "none") updateNote(id, { reminderRepeat: repeat });
                }}
                onSetReminder={(id, reminder, repeat) => updateNote(id, { reminder, reminderRepeat: repeat })}
              />
            </Suspense>
          )}

          {view !== "calendar" && displayNotes.length === 0 && <EmptyState view={view} search={search} elsewhere={elsewhere} onGo={(v) => go(v)} />}
          {view === "notes" && displayNotes.length > 0 && !search && <DailyQuote />}
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
          onGo={(v) => go(v)}
          onToggleTheme={toggleTheme}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenStats={() => setStatsOpen(true)}
          onOpenFocusMode={() => setFocusModeOpen(true)}
          onOpenShortcuts={() => setShortcutsOpen(true)}
        />
      </Suspense>
    )}
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
    <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    {presentingNoteId && (
      <Suspense fallback={null}>
        <NotePresentation
          noteId={presentingNoteId}
          notes={allNotesForLinks}
          onOpenChange={(v) => { if (!v) setPresentingNoteId(null); }}
          onNavigate={setPresentingNoteId}
        />
      </Suspense>
    )}
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
      onOpenSettings={() => setSettingsOpen(true)}
      onOpenActions={() => setActionsOpen(true)}
      trashCount={trashedNotes.length}
      archiveCount={archivedNotes.length}
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
      getNote={(ids) => [...notes, ...archivedNotes, ...trashedNotes].find((n) => ids.includes(n.id))}
      onSaveNote={(id, title, content) => updateNote(id, { title, content })}
    />
    {confirmDialog}
    </DndContext>
  );
};

export default Index;

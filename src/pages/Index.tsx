import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { StickyNote, Archive, Bell, Trash, Calendar } from "lucide-react";
import { useNotesContext } from "@/hooks/NotesProvider";
import { useNoteVersions } from "@/hooks/useNoteVersions";
import type { NoteVersion } from "@/hooks/useNoteVersions";
import { useReminderNotifications } from "@/hooks/useReminderNotifications";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import { useTheme } from "@/hooks/useTheme";
import { useViewPrefs } from "@/lib/viewPrefs";
import { useFilteredNotes, type View } from "@/hooks/useFilteredNotes";
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
import { fireworks, megaCelebrate, celebrate } from "@/lib/celebrate";
import { glowPulse, glowStreak, centerOf, pointOfNote } from "@/lib/glowTrail";
import { SearchBar } from "@/components/SearchBar";
import { useAchievementTracker } from "@/lib/achievements";
import { CommandPalette } from "@/components/CommandPalette";
import { DailyQuote } from "@/components/DailyQuote";
import { AnimatedBackdrop } from "@/components/AnimatedBackdrop";
import { QuickTemplates } from "@/components/QuickTemplates";
import { useConfirmAction } from "@/components/ConfirmActionDialog";
import { BulkActionBar } from "@/components/BulkActionBar";
import { registerUndoHandlers, undoLastAction } from "@/lib/actionHistory";
import { BottomNav } from "@/components/BottomNav";
import { RecentActionsPanel } from "@/components/RecentActionsPanel";
import { OnboardingTour } from "@/components/OnboardingTour";

const Index = () => {
  const {
    notes, archivedNotes, trashedNotes, allLabels, folders,
    addNote, updateNote, deleteNote, trashNote, restoreFromTrash, emptyTrash, togglePin, duplicateNote,
    archiveNote, unarchiveNote, addLabel, importNotes, reorderNotes, moveNoteToFolder,
    bulkTrash, bulkArchive, bulkSetColor, bulkRestore,
  } = useNotesContext();
  const { addVersion, getVersions } = useNoteVersions();
  const { confirmAction, confirmDialog } = useConfirmAction();
  const { dark, toggle: toggleTheme } = useTheme();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const prefs = useViewPrefs();
  const [view, setView] = useState<View>("notes");
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const addNoteRef = useRef<{ expand: () => void }>(null);
  const logoClicksRef = useRef<{ count: number; lastTs: number }>({ count: 0, lastTs: 0 });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    toast.success(`${a.emoji} Odznaka odblokowana: ${a.title}`, { description: a.description });
    try {
      celebrate(window.innerWidth / 2, window.innerHeight / 3);
    } catch { /* noop */ }
  });

  useBackupReminders(prefs, notes, archivedNotes);
  useDailyWeeklyNudges(prefs, notes, setView);

  function expandAddNote() {
    setView("notes");
    setTimeout(() => addNoteRef.current?.expand(), 100);
  }

  const clearSelection = useCallback(() => { setSelectedIds(new Set()); lastSelectedRef.current = null; }, []);

  useGlobalShortcuts({
    onNewNote: expandAddNote,
    onGoToday: () => { setView("today"); setActiveLabel(null); },
    onGoWeek: () => { setView("week"); setActiveLabel(null); },
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
  });

  const { handleImport } = useImportExport(importNotes, addNote);

  const handleRestoreVersion = useCallback((noteId: string, version: NoteVersion) => {
    addVersion(noteId, notes.find(n => n.id === noteId)?.title || "", notes.find(n => n.id === noteId)?.content || "");
    updateNote(noteId, { title: version.title, content: version.content });
    toast.success("Przywrócono wersję");
  }, [notes, updateNote, addVersion]);

  const { displayNotes, pinned, others } = useFilteredNotes({
    notes, archivedNotes, trashedNotes, folders, view, activeLabel, activeFolder, search, prefs,
  });

  const allNotesForLinks = [...notes, ...archivedNotes];
  const knownTitles = new Set(allNotesForLinks.filter((n) => n.title.trim()).map((n) => n.title.trim().toLowerCase()));
  const handleWikiClick = useCallback((title: string) => {
    const target = allNotesForLinks.find((n) => n.title.trim().toLowerCase() === title.trim().toLowerCase());
    if (target) {
      setView("notes");
      setTimeout(() => document.querySelector(`[data-note-id="${target.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    }
    else toast.info(`Notatka „${title}" nie istnieje`);
  }, [allNotesForLinks]);

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

  const handleAddNoteGlow = useCallback((...args: Parameters<typeof addNote>) => {
    const p = centerOf(document.querySelector("[data-add-note-bar]"));
    if (p) glowPulse(p, "create", 260);
    return addNote(...args);
  }, [addNote]);

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

  const totalNotes = notes.length + archivedNotes.length;
  const remindersCount = notes.filter((n) => n.reminder).length;
  const handleDelete = view === "trash" ? deleteNote : handleTrashSingle;

  const { sensors, draggingNoteId, setDraggingNoteId, handleDragEnd } = useNoteDnd({
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
        onGoView={(v) => { setView(v); setActiveLabel(null); if (isMobile) setSidebarOpen(false); }}
        onGoLabel={(label) => { setView("label"); setActiveLabel(label); if (isMobile) setSidebarOpen(false); }}
        onGoFolder={(id) => { setView("folder"); setActiveFolder(id); if (isMobile) setSidebarOpen(false); }}
        sidebarItems={sidebarItems}
        totalNotes={totalNotes}
        remindersCount={remindersCount}
        onLogoClick={handleLogoClick}
        dark={dark}
        onToggleTheme={toggleTheme}
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenActions={() => setActionsOpen(true)}
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
          {view === "notes" && <DailyQuote />}
          <div className="sm:hidden">
            <SearchBar value={search} onChange={setSearch} />
          </div>

          {view === "notes" && (
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, duration: 0.4 }} className="space-y-3">
              <div data-add-note-bar>
                <AddNoteBar ref={addNoteRef} onAdd={handleAddNoteGlow} allLabels={allLabels} onCreateLabel={addLabel} />
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
                  onClick={() => { emptyTrash(); toast.success("Kosz opróżniony"); setConfirmEmptyTrash(false); }}
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
                <span className="bg-primary/10 text-primary text-[10px] px-1.5 rounded-full">{pinned.length}</span>
              </motion.p>
              <NoteGrid notes={pinned} searchQuery={search} onUpdate={updateNote} onDelete={handleDelete} onTogglePin={togglePin} onDuplicate={duplicateNote} onArchive={handleArchiveSingle} onMoveToFolder={handleMoveToFolderGlow} getVersions={getVersions} onSaveVersion={addVersion} onRestoreVersion={handleRestoreVersion} knownTitles={knownTitles} onWikiClick={handleWikiClick} selectedIds={selectedIds} selectionMode={selectionMode} onToggleSelect={toggleSelect} />
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
                knownTitles={knownTitles}
                onWikiClick={handleWikiClick}
                selectedIds={selectedIds}
                selectionMode={selectionMode}
                onToggleSelect={toggleSelect}
              />
            </section>
          )}

          {displayNotes.length === 0 && <EmptyState view={view} search={search} />}
        </main>
      </div>
    </div>

    <CommandPalette
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      notes={[...notes, ...archivedNotes]}
      onOpenNote={() => { setView("notes"); }}
      onNewNote={expandAddNote}
      onGo={(v) => { setView(v); setActiveLabel(null); }}
      onToggleTheme={toggleTheme}
      onOpenSettings={() => setSettingsOpen(true)}
    />
    <BottomNav
      view={view}
      onGo={(v) => { setView(v); setActiveLabel(null); }}
      onNew={expandAddNote}
      onOpenSettings={() => setSettingsOpen(true)}
      onOpenActions={() => setActionsOpen(true)}
      trashCount={trashedNotes.length}
      archiveCount={archivedNotes.length}
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

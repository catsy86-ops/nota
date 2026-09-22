import { useState, useCallback, useEffect, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import { Settings as SettingsIcon, HelpCircle, StickyNote, LayoutGrid, List, Archive, Tag, Bell, ChevronLeft, Pencil, Trash2, Check, X, Download, Upload, FileJson, FileText, Moon, Sun, Sparkles, Keyboard, FolderOpen, FolderPlus, ChevronRight, Palette, Smile, LayoutDashboard, Trash, Trophy, Target, Command, Calendar, History } from "lucide-react";
import { useNotes, getDescendantFolderIds } from "@/hooks/useNotes";
import { useNoteVersions } from "@/hooks/useNoteVersions";
import type { NoteVersion } from "@/hooks/useNoteVersions";
import type { Folder, FolderColor } from "@/hooks/useNotes";
import { folderColorDot } from "@/components/FolderPicker";
import { useReminderNotifications } from "@/hooks/useReminderNotifications";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";

import { useTheme } from "@/hooks/useTheme";
import { AddNoteBar } from "@/components/AddNoteBar";
import { NoteCard } from "@/components/NoteCard";
import { SearchBar } from "@/components/SearchBar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { exportToJSON, exportToPDF, exportToMarkdown, exportToHTML, importFromJSON } from "@/lib/exportNotes";
import { colorClasses } from "@/components/ColorPicker";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { toast } from "sonner";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import duckLogo from "@/assets/duck-logo.png";
import { useRef } from "react";
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent, DragOverlay, useDroppable, pointerWithin, rectIntersection } from "@dnd-kit/core";
import { SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { fireworks, megaCelebrate, celebrate } from "@/lib/celebrate";
import { glowPulse, glowStreak, glowAtNote, centerOf, pointOfNote } from "@/lib/glowTrail";
import { useAchievementTracker } from "@/lib/achievements";
import { SettingsDialog } from "@/components/SettingsDialog";
import { CommandPalette } from "@/components/CommandPalette";
import { SeasonalBackdrop } from "@/components/SeasonalBackdrop";
import { DailyQuote } from "@/components/DailyQuote";
import { AnimatedBackdrop } from "@/components/AnimatedBackdrop";
import { QuickTemplates } from "@/components/QuickTemplates";
import { ViewControls } from "@/components/ViewControls";
import { useViewPrefs } from "@/lib/viewPrefs";
import { searchNotes } from "@/lib/searchNotes";
import { toastWithUndo } from "@/lib/undoToast";
import { useConfirmAction } from "@/components/ConfirmActionDialog";
import { isBackupOverdue, markBackup, daysSinceBackup } from "@/lib/backupReminder";
import { BulkActionBar } from "@/components/BulkActionBar";
import { pushAction, registerUndoHandlers, undoLastAction } from "@/lib/actionHistory";
import { BottomNav } from "@/components/BottomNav";
import { RecentActionsPanel } from "@/components/RecentActionsPanel";
import { InstallAppButton } from "@/components/InstallAppButton";
import { OnboardingTour } from "@/components/OnboardingTour";
import { ReminderToast } from "@/components/ReminderToast";
import type { NoteColor } from "@/hooks/useNotes";
// exportToJSON imported above

type View = "notes" | "today" | "week" | "archive" | "label" | "reminders" | "folder" | "widget" | "trash";

function DroppableNavItem({ droppableId, children }: { droppableId?: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId || "noop", disabled: !droppableId });
  if (!droppableId) return <>{children}</>;
  return (
    <div ref={setNodeRef} data-folder-drop-root={droppableId === "notes-drop-root" ? "" : undefined} className={cn("rounded-xl transition-all duration-200", isOver && "ring-2 ring-primary/50 bg-primary/5 scale-[1.02]")}>
      {children}
    </div>
  );
}

const Index = () => {
  const { notes, archivedNotes, trashedNotes, allLabels, folders, addNote, updateNote, deleteNote, trashNote, restoreFromTrash, emptyTrash, togglePin, duplicateNote, archiveNote, unarchiveNote, addLabel, removeLabel, renameLabel, importNotes, reorderNotes, addFolder, updateFolder, deleteFolder, moveNoteToFolder, bulkTrash, bulkArchive, bulkSetColor, bulkRestore } = useNotes();
  const { addVersion, getVersions, deleteVersions } = useNoteVersions();
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

  useReminderNotifications([...notes, ...archivedNotes], (id) => updateNote(id, { reminder: null }));

  // Persist achievement progress; toast when a new badge is unlocked.
  useAchievementTracker(notes, archivedNotes, allLabels, folders, (a) => {
    toast.success(`${a.emoji} Odznaka odblokowana: ${a.title}`, { description: a.description });
    try {
      celebrate(window.innerWidth / 2, window.innerHeight / 3);
    } catch { /* noop */ }
  });

  // Keyboard shortcut: Ctrl+N to create note
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        setView("notes");
        setTimeout(() => addNoteRef.current?.expand(), 100);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Alt-based shortcuts: Alt+S search, Alt+T today, Alt+W week, Alt+N new note
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      const inField = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        const el = document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="zukaj" i], input[placeholder*="earch" i]');
        if (el) el.focus();
        return;
      }
      if (inField) return;
      if (key === "t") { e.preventDefault(); setView("today"); setActiveLabel(null); }
      else if (key === "w") { e.preventDefault(); setView("week"); setActiveLabel(null); }
      else if (key === "n") { e.preventDefault(); setView("notes"); setTimeout(() => addNoteRef.current?.expand(), 100); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Auto-backup: trigger JSON download in background if interval has passed
  useEffect(() => {
    if (!prefs.autoExportDays || prefs.autoExportDays <= 0) return;
    if (notes.length === 0 && archivedNotes.length === 0) return;
    const last = Number(localStorage.getItem("kaczy.lastAutoExport") || 0);
    const due = Date.now() - last > prefs.autoExportDays * 24 * 60 * 60 * 1000;
    if (!due) return;
    // Only one auto-backup per session
    if (sessionStorage.getItem("kaczy.autoBackupDone") === "1") return;
    sessionStorage.setItem("kaczy.autoBackupDone", "1");
    const t = setTimeout(() => {
      try {
        const { filename, size } = exportToJSON([...notes, ...archivedNotes]);
        markBackup();
        const kb = Math.max(1, Math.round(size / 1024));
        toast.success("📦 Auto-backup pobrany w tle", {
          description: `${filename} • ${kb} KB • ${notes.length + archivedNotes.length} notatek`,
          duration: 8000,
        });
      } catch {
        toast.error("Auto-backup nie powiódł się");
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [prefs.autoExportDays, notes, archivedNotes]);

  // Backup reminder: nudge if last backup is older than reminderDays
  useEffect(() => {
    if (!prefs.backupReminderDays || prefs.backupReminderDays <= 0) return;
    if (!isBackupOverdue(prefs.backupReminderDays)) return;
    // Only nudge once per session
    if (sessionStorage.getItem("kaczy.backupNudge") === "1") return;
    sessionStorage.setItem("kaczy.backupNudge", "1");
    const t = setTimeout(() => {
      const days = daysSinceBackup();
      const desc = days === null
        ? "Nie masz jeszcze żadnej kopii zapasowej."
        : `Ostatni backup: ${days === 0 ? "dziś" : `${days} dni temu`}.`;
      toast("💾 Czas na backup", {
        description: desc,
        duration: 12000,
        action: {
          label: "Pobierz JSON",
          onClick: () => {
            try {
              exportToJSON([...notes, ...archivedNotes]);
              markBackup();
              toast.success("Backup pobrany 💾");
            } catch {
              toast.error("Nie udało się wygenerować backupu");
            }
          },
        },
      });
    }, 3500);
    return () => clearTimeout(t);
  }, [prefs.backupReminderDays, notes, archivedNotes]);

  // Today reminder: either at a fixed daily time ("HH:mm") or every X hours.
  // The fixed time, when set, takes priority.
  useEffect(() => {
    const intervalHours = prefs.todayReminderHours;
    const fixedTime = prefs.todayReminderTime; // "HH:mm" or ""
    if ((!intervalHours || intervalHours <= 0) && !fixedTime) return;

    const NUDGE_KEY = "kaczy.todayNudgeAt";
    const SNOOZE_KEY = "kaczy.todaySnoozeUntil";

    function getTodayCount() {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const s = start.getTime(), e = end.getTime();
      return notes.filter((n) => (n.createdAt >= s && n.createdAt <= e) || (n.updatedAt >= s && n.updatedAt <= e)).length;
    }

    function fire() {
      const count = getTodayCount();
      if (count === 0) return;
      try { localStorage.setItem(NUDGE_KEY, String(Date.now())); } catch { /* ignore */ }
      const title = `📅 Masz ${count} ${count === 1 ? "notatkę" : count < 5 ? "notatki" : "notatek"} z dzisiaj`;
      toast.custom((id) => (
        <ReminderToast
          toastId={id}
          title={title}
          description="Wejdź w widok „Dziś”, aby je przejrzeć."
          onShow={() => setView("today")}
          onSnooze={() => {
            try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + 10 * 60 * 1000)); } catch { /* ignore */ }
            toast("💤 Drzemka 10 min", { description: "Przypomnę o notatkach z „Dziś” za 10 minut." });
          }}
        />
      ), { duration: 10000 });
    }

    function check() {
      const snoozeUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      const now = Date.now();
      if (snoozeUntil && now < snoozeUntil) return;
      const lastNudge = Number(localStorage.getItem(NUDGE_KEY) || 0);
      if (fixedTime && /^\d{1,2}:\d{2}$/.test(fixedTime)) {
        const [h, m] = fixedTime.split(":").map(Number);
        const target = new Date(); target.setHours(h, m, 0, 0);
        const targetMs = target.getTime();
        if (now < targetMs) return; // not yet
        if (lastNudge >= targetMs) return;
        fire();
      } else if (intervalHours > 0) {
        const dueAfterMs = intervalHours * 60 * 60 * 1000;
        if (lastNudge && now - lastNudge < dueAfterMs) return;
        fire();
      }
    }

    const initial = setTimeout(check, 5000);
    const poll = setInterval(check, 60_000);
    return () => { clearTimeout(initial); clearInterval(poll); };
  }, [notes, prefs.todayReminderHours, prefs.todayReminderTime]);

  // Weekly reminder for "Ten tydzień" — fires at a fixed time on a chosen weekday.
  useEffect(() => {
    const fixedTime = prefs.weekReminderTime;
    if (!fixedTime || !/^\d{1,2}:\d{2}$/.test(fixedTime)) return;

    const NUDGE_KEY = "kaczy.weekNudgeAt";
    const SNOOZE_KEY = "kaczy.weekSnoozeUntil";

    function getWeekCount() {
      const end = new Date(); end.setHours(23, 59, 59, 999);
      const start = new Date(); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
      const s = start.getTime(), e = end.getTime();
      return notes.filter((n) => (n.createdAt >= s && n.createdAt <= e) || (n.updatedAt >= s && n.updatedAt <= e)).length;
    }

    function check() {
      const snoozeUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      const now = new Date();
      if (snoozeUntil && now.getTime() < snoozeUntil) return;
      if (now.getDay() !== prefs.weekReminderDay) return;
      const [h, m] = fixedTime.split(":").map(Number);
      const target = new Date(); target.setHours(h, m, 0, 0);
      const targetMs = target.getTime();
      if (now.getTime() < targetMs) return;
      const lastNudge = Number(localStorage.getItem(NUDGE_KEY) || 0);
      if (lastNudge >= targetMs) return;
      const count = getWeekCount();
      if (count === 0) return;
      try { localStorage.setItem(NUDGE_KEY, String(Date.now())); } catch { /* ignore */ }
      const title = `🗓️ ${count} ${count === 1 ? "notatka" : count < 5 ? "notatki" : "notatek"} z tego tygodnia`;
      toast.custom((id) => (
        <ReminderToast
          toastId={id}
          title={title}
          description="Zerknij na podsumowanie ostatnich 7 dni."
          onShow={() => setView("week")}
          onSnooze={() => {
            try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + 10 * 60 * 1000)); } catch { /* ignore */ }
            toast("💤 Drzemka 10 min", { description: "Przypomnę o notatkach z tygodnia za 10 minut." });
          }}
        />
      ), { duration: 12000 });
    }

    const initial = setTimeout(check, 6000);
    const poll = setInterval(check, 60_000);
    return () => { clearTimeout(initial); clearInterval(poll); };
  }, [notes, prefs.weekReminderTime, prefs.weekReminderDay]);




  // "/" focuses search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        const el = document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="zukaj" i], input[placeholder*="earch" i]');
        if (el) { e.preventDefault(); el.focus(); }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Konami code easter egg ↑↑↓↓←→←→BA
  useEffect(() => {
    const sequence = ["ArrowUp","ArrowUp","ArrowDown","ArrowDown","ArrowLeft","ArrowRight","ArrowLeft","ArrowRight","b","a"];
    let buf: string[] = [];
    function onKey(e: KeyboardEvent) {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      buf.push(k);
      if (buf.length > sequence.length) buf = buf.slice(-sequence.length);
      if (buf.length === sequence.length && buf.every((v, i) => v === sequence[i])) {
        buf = [];
        megaCelebrate();
        toast.success("🦆 KONAMI! Pełen pokaz mocy!");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleImport = useCallback(async () => {
    try {
      const imported = await importFromJSON();
      importNotes(imported);
      toast.success(`Zaimportowano ${imported.length} notatek`);
    } catch (err: any) {
      if (err?.message !== "Nie wybrano pliku") {
        toast.error("Błąd importu: " + (err?.message || "Nieznany błąd"));
      }
    }
  }, [importNotes]);

  // Restore a version
  const handleRestoreVersion = useCallback((noteId: string, version: NoteVersion) => {
    addVersion(noteId, notes.find(n => n.id === noteId)?.title || "", notes.find(n => n.id === noteId)?.content || "");
    updateNote(noteId, { title: version.title, content: version.content });
    toast.success("Przywrócono wersję");
  }, [notes, updateNote, addVersion]);

  // Handle share URL import
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareData = params.get("share");
    if (shareData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(atob(shareData)));
        addNote(decoded.t || "", decoded.c || "", decoded.co || "default", decoded.l || [], null, [], decoded.cl || []);
        toast.success("Zaimportowano udostępnioną notatkę!");
        window.history.replaceState({}, "", window.location.pathname);
      } catch {
        toast.error("Nieprawidłowy link udostępniania");
      }
    }
  }, [addNote]);

  function filterNotes(list: typeof notes) {
    let filtered = list;
    if (activeLabel && view === "label") {
      filtered = filtered.filter((n) => n.labels.includes(activeLabel));
    }
    if (view === "reminders") {
      filtered = filtered.filter((n) => n.reminder !== null);
    }
    if (view === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const startMs = start.getTime();
      const endMs = end.getTime();
      filtered = filtered.filter((n) => (n.createdAt >= startMs && n.createdAt <= endMs) || (n.updatedAt >= startMs && n.updatedAt <= endMs));
    }
    if (view === "week") {
      // Last 7 days (rolling window), including today
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const startMs = start.getTime();
      const endMs = end.getTime();
      filtered = filtered.filter((n) => (n.createdAt >= startMs && n.createdAt <= endMs) || (n.updatedAt >= startMs && n.updatedAt <= endMs));
    }
    if (view === "folder" && activeFolder) {
      const descendantIds = getDescendantFolderIds(activeFolder, folders);
      const folderIds = new Set([activeFolder, ...descendantIds]);
      filtered = filtered.filter((n) => n.folderId && folderIds.has(n.folderId));
    }
    if (search) {
      filtered = searchNotes(filtered, search);
    }
    return filtered;
  }

  const baseNotes = view === "archive" ? filterNotes(archivedNotes) : view === "trash" ? trashedNotes : filterNotes(notes);

  // Apply view-pref filters (color/label/reminder) — skip on trash so user can always see deleted items
  const filteredByPrefs = view === "trash" ? baseNotes : baseNotes.filter((n) => {
    if (prefs.filterColor !== "all" && n.color !== prefs.filterColor) return false;
    if (prefs.filterLabel !== "all" && !n.labels.includes(prefs.filterLabel)) return false;
    if (prefs.filterHasReminder && !n.reminder) return false;
    return true;
  });

  // Apply sort (preserve pinned-first by handling pinned separately later)
  function sortFn(a: typeof notes[0], b: typeof notes[0]) {
    const dir = prefs.sortDir === "asc" ? 1 : -1;
    switch (prefs.sortKey) {
      case "title": return a.title.localeCompare(b.title) * dir;
      case "created": return (a.createdAt - b.createdAt) * dir;
      case "color": return a.color.localeCompare(b.color) * dir;
      case "updated":
      default: return (a.updatedAt - b.updatedAt) * dir;
    }
  }

  const displayNotes = [...filteredByPrefs].sort(sortFn);
  const pinned = view === "trash" ? [] : displayNotes.filter((n) => n.pinned);
  const others = view === "trash" ? displayNotes : displayNotes.filter((n) => !n.pinned);

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

  // Selection helpers
  const toggleSelect = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastSelectedRef.current && lastSelectedRef.current !== id) {
        // Range select within current displayNotes
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

  const clearSelection = useCallback(() => { setSelectedIds(new Set()); lastSelectedRef.current = null; }, []);

  // Escape clears selection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && selectedIds.size > 0) { e.preventDefault(); clearSelection(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, clearSelection]);

  // Ctrl/Cmd+Z — undo the last trash/archive move
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t?.isContentEditable) return;
      e.preventDefault();
      const done = undoLastAction();
      if (done) {
        toast.success(done.kind === "trash" ? "Cofnięto usunięcie" : "Cofnięto archiwizację", {
          description: done.label,
          icon: "↩️",
        });
      } else {
        toast("Nie ma czego cofać", { icon: "🦆" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Esc — close the topmost open overlay (panels that are not Radix dialogs)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (sidebarOpen) { e.preventDefault(); setSidebarOpen(false); return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  // Undo fallbacks so history restored from localStorage stays actionable after reload
  useEffect(() => {
    registerUndoHandlers({
      trash: (ids) => bulkRestore(ids),
      archive: (ids) => ids.forEach(unarchiveNote),
    });
  }, [bulkRestore, unarchiveNote]);

  const bulkPreview = useCallback((ids: string[]) => {
    const all = [...notes, ...archivedNotes];
    return ids
      .map((i) => {
        const n = all.find((x) => x.id === i);
        return (n?.title?.trim() || n?.content?.trim() || "").replace(/\s+/g, " ").slice(0, 40);
      })
      .filter(Boolean)
      .slice(0, 4)
      .join(" • ");
  }, [notes, archivedNotes]);

  // Undo-aware destructive actions (with friendly confirmation)
  const handleTrashSingle = useCallback((id: string) => {
    const note = notes.find((n) => n.id === id) || archivedNotes.find((n) => n.id === id);
    const title = note?.title?.trim() || note?.content?.trim().slice(0, 60) || "Bez tytułu";
    const preview = note?.content?.trim().replace(/\s+/g, " ").slice(0, 140) || "";
    confirmAction({
      kind: "trash",
      title,
      description: `„${title}” trafi do kosza i zostanie automatycznie usunięta po 30 dniach.`,
      run: () => {
        glowAtNote(id, "trash");
        trashNote(id);
        const undo = () => restoreFromTrash(id);
        pushAction({ kind: "trash", label: title, count: 1, noteIds: [id], preview, undo });
        toastWithUndo("Przeniesiono do kosza", undo, {
          description: title,
          icon: "🗑️",
        });
      },
    });
  }, [trashNote, restoreFromTrash, notes, archivedNotes, confirmAction]);

  const handleArchiveSingle = useCallback((id: string) => {
    const note = notes.find((n) => n.id === id);
    const title = note?.title?.trim() || note?.content?.trim().slice(0, 60) || "Bez tytułu";
    const preview = note?.content?.trim().replace(/\s+/g, " ").slice(0, 140) || "";
    confirmAction({
      kind: "archive",
      title,
      description: `„${title}” zniknie z listy notatek i znajdziesz ją w Archiwum.`,
      run: () => {
        glowAtNote(id, "archive");
        archiveNote(id);
        const undo = () => unarchiveNote(id);
        pushAction({ kind: "archive", label: title, count: 1, noteIds: [id], preview, undo });
        toastWithUndo("Zarchiwizowano", undo, {
          description: title,
          icon: "📦",
        });
      },
    });
  }, [archiveNote, unarchiveNote, notes, confirmAction]);

  // Glow micro-interaction: bloom where the note is born.
  const handleAddNoteGlow = useCallback((...args: Parameters<typeof addNote>) => {
    const p = centerOf(document.querySelector("[data-add-note-bar]"));
    if (p) glowPulse(p, "create", 260);
    return addNote(...args);
  }, [addNote]);

  // Glow micro-interaction: streak from the card to the target folder.
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



  const handleBulkTrash = useCallback(() => {
    const ids = Array.from(selectedIds);
    const preview = bulkPreview(ids);
    confirmAction({
      kind: "trash",
      title: `${ids.length} notatek`,
      description: `Przeniesiesz ${ids.length} notatek do kosza.`,
      run: () => {
        ids.slice(0, 6).map((nid) => pointOfNote(nid))
          .forEach((p, i) => { if (p) window.setTimeout(() => glowPulse(p, "trash"), i * 55); });
        bulkTrash(ids);
        clearSelection();
        const undo = () => bulkRestore(ids);
        pushAction({ kind: "trash", label: `${ids.length} notatek`, count: ids.length, noteIds: ids, preview, undo });
        toastWithUndo(`Przeniesiono ${ids.length} do kosza`, undo, {
          description: "Kliknij Cofnij, aby przywrócić",
          icon: "🗑️",
        });
      },
    });
  }, [selectedIds, bulkTrash, bulkRestore, clearSelection, confirmAction, bulkPreview]);

  const handleBulkArchive = useCallback(() => {
    const ids = Array.from(selectedIds);
    const preview = bulkPreview(ids);
    confirmAction({
      kind: "archive",
      title: `${ids.length} notatek`,
      description: `Zarchiwizujesz ${ids.length} notatek.`,
      run: () => {
        ids.slice(0, 6).map((nid) => pointOfNote(nid))
          .forEach((p, i) => { if (p) window.setTimeout(() => glowPulse(p, "archive"), i * 55); });
        bulkArchive(ids);
        clearSelection();
        const undo = () => { ids.forEach(unarchiveNote); };
        pushAction({ kind: "archive", label: `${ids.length} notatek`, count: ids.length, noteIds: ids, preview, undo });
        toastWithUndo(`Zarchiwizowano ${ids.length}`, undo, {
          description: "Kliknij Cofnij, aby przywrócić",
          icon: "📦",
        });
      },
    });
  }, [selectedIds, bulkArchive, unarchiveNote, clearSelection, confirmAction, bulkPreview]);


  const handleBulkColor = useCallback((c: NoteColor) => {
    const ids = Array.from(selectedIds);
    bulkSetColor(ids, c);
    clearSelection();
    toast.success(`Zmieniono kolor ${ids.length} notatek`);
  }, [selectedIds, bulkSetColor, clearSelection]);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(displayNotes.map((n) => n.id)));
  }, [displayNotes]);

  const totalNotes = notes.length + archivedNotes.length;
  const remindersCount = notes.filter((n) => n.reminder).length;

  const handleDelete = view === "trash" ? deleteNote : handleTrashSingle;

  // Top-level DnD sensors & handler for reordering + folder drops
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);

  function handleDragEnd(event: DragEndEvent) {
    setDraggingNoteId(null);
    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;

    const dragFrom = active.rect.current.translated
      ? {
          x: active.rect.current.translated.left + active.rect.current.translated.width / 2,
          y: active.rect.current.translated.top + active.rect.current.translated.height / 2,
        }
      : pointOfNote(active.id as string);
    const dropTo = { x: over.rect.left + over.rect.width / 2, y: over.rect.top + over.rect.height / 2 };
    const trail = () => { if (dragFrom) glowStreak(dragFrom, dropTo, "move"); else glowPulse(dropTo, "move"); };

    // Dropped on "Notatki" — remove from folder
    if (overId === "notes-drop-root") {
      trail();
      moveNoteToFolder(active.id as string, null);
      toast.success("Usunięto z folderu");
      return;
    }

    // Dropped on a folder droppable (prefixed with "folder-drop-")
    if (overId.startsWith("folder-drop-")) {
      const folderId = overId.replace("folder-drop-", "");
      trail();
      moveNoteToFolder(active.id as string, folderId);
      const folder = folders.find((f) => f.id === folderId);
      toast.success(`Przeniesiono do „${folder?.name || "folder"}"`);
      return;
    }


    // Otherwise it's a note reorder
    if (active.id !== over.id) {
      const ids = displayNotes.map((n) => n.id);
      const oldIndex = ids.indexOf(active.id as string);
      const newIndex = ids.indexOf(overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newIds = [...ids];
        newIds.splice(oldIndex, 1);
        newIds.splice(newIndex, 0, active.id as string);
        reorderNotes(newIds);
      }
    }
  }

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const todayNotesCount = notes.filter((n) => (n.createdAt >= todayStart.getTime() && n.createdAt <= todayEnd.getTime()) || (n.updatedAt >= todayStart.getTime() && n.updatedAt <= todayEnd.getTime())).length;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
  const weekNotesCount = notes.filter((n) => (n.createdAt >= weekStart.getTime() && n.createdAt <= todayEnd.getTime()) || (n.updatedAt >= weekStart.getTime() && n.updatedAt <= todayEnd.getTime())).length;

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
    <SeasonalBackdrop />
    <div className="min-h-screen flex relative">
      {/* Sidebar */}
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, width: 280, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="shrink-0 border-r border-border/50 sidebar-gradient overflow-hidden fixed left-0 top-0 bottom-0 z-50 shadow-2xl md:relative md:shadow-none"
          >
            <div className="p-5 space-y-1 w-[280px] h-full flex flex-col scrollbar-thin overflow-y-auto">
              {/* Duck Logo */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3 px-3 pb-6"
              >
                <motion.img
                  src={duckLogo}
                  alt="KACZY"
                  className="w-11 h-11 drop-shadow-lg cursor-pointer"
                  whileHover={{ rotate: [0, -12, 12, -6, 0], transition: { duration: 0.5 } }}
                  onClick={handleLogoClick}
                />
                <div>
                  <h1 className="text-xl font-display font-extrabold gradient-text leading-tight tracking-tight">KACZY</h1>
                  <p className="text-[10px] text-muted-foreground font-medium">Twoje notatki, Twój styl 🦆</p>
                </div>
              </motion.div>

              {/* Stats strip */}
              <div className="grid grid-cols-3 gap-2 px-1 pb-4">
                {[
                  { value: totalNotes, label: "Notatek", color: "" },
                  { value: allLabels.length, label: "Etykiet", color: "" },
                  { value: remindersCount, label: "Przyp.", color: "text-primary" },
                ].map((stat) => (
                  <motion.div
                    key={stat.label}
                    whileHover={{ scale: 1.03 }}
                    className="stats-card text-center"
                  >
                    <p className={cn("text-lg font-display font-bold", stat.color || "text-foreground")}>{stat.value}</p>
                    <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Nav items */}
              <div className="space-y-0.5">
                {sidebarItems.map((item, i) => {
                  const isNotesItem = item.view === "notes";
                  const active = view === item.view && view !== "label";
                  return (
                    <DroppableNavItem key={item.view} droppableId={isNotesItem ? "notes-drop-root" : undefined}>
                      <motion.button
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.15 + i * 0.05 }}
                        whileHover={{ x: 3 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setView(item.view); setActiveLabel(null); if (isMobile) setSidebarOpen(false); }}
                        className={cn(
                          "relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200",
                          active ? "text-primary" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        )}
                      >
                        {active && (
                          <>
                            <motion.span
                              layoutId="sidebar-active-pill"
                              className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/15 shadow-sm"
                              transition={{ type: "spring", stiffness: 500, damping: 38 }}
                            />
                            <motion.span
                              layoutId="sidebar-active-bar"
                              className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-primary"
                              transition={{ type: "spring", stiffness: 500, damping: 38 }}
                            />
                          </>
                        )}
                        <item.icon className="w-[18px] h-[18px] relative z-10" />
                        <span className="flex-1 text-left relative z-10">{item.label}</span>
                        {item.count !== undefined && item.count > 0 && (
                          <motion.span
                            key={item.count}
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            className={cn(
                              "relative z-10 text-[10px] font-semibold px-2 py-0.5 rounded-full min-w-[22px] text-center",
                              active ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {item.count}
                          </motion.span>
                        )}
                      </motion.button>
                    </DroppableNavItem>
                  );
                })}

              </div>

              {/* Labels section */}
              {allLabels.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="pt-5"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-2 flex items-center gap-1.5">
                    <Tag className="w-3 h-3" />
                    Etykiety
                  </p>
                  <div className="space-y-0.5">
                    {allLabels.map((label) => (
                      <SidebarLabelItem
                        key={label}
                        label={label}
                        isActive={view === "label" && activeLabel === label}
                        onSelect={() => { setView("label"); setActiveLabel(label); if (isMobile) setSidebarOpen(false); }}
                        onRename={(newName) => {
                          renameLabel(label, newName);
                          if (activeLabel === label) setActiveLabel(newName.trim());
                        }}
                        onDelete={() => {
                          removeLabel(label);
                          if (activeLabel === label) { setView("notes"); setActiveLabel(null); }
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Folders section */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="pt-5"
              >
                <div className="flex items-center justify-between px-3 mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FolderOpen className="w-3 h-3" />
                    Foldery
                  </p>
                  <SidebarAddFolderButton onAdd={(name) => addFolder(name)} />
                </div>
                <div className="space-y-0.5">
                  {folders.filter((f) => !f.parentId).map((folder) => (
                    <SidebarFolderItem
                      key={folder.id}
                      folder={folder}
                      folders={folders}
                      isActive={view === "folder" && activeFolder === folder.id}
                      activeFolderId={activeFolder}
                      view={view}
                      onSelect={(id) => { setView("folder"); setActiveFolder(id); if (isMobile) setSidebarOpen(false); }}
                      onRename={(id, name) => updateFolder(id, { name })}
                      onDelete={(id) => { deleteFolder(id); if (activeFolder === id) { setView("notes"); setActiveFolder(null); } }}
                      onSetColor={(id, color) => updateFolder(id, { color })}
                      onSetEmoji={(id, emoji) => updateFolder(id, { emoji })}
                      onAddSubfolder={(parentId, name) => addFolder(name, parentId)}
                    />
                  ))}
                </div>
              </motion.div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Bottom section */}
              <div className="px-1 pb-2 pt-4 border-t border-border/50 space-y-2">
                {/* Keyboard shortcut hint */}
                <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-muted-foreground/50">
                  <Keyboard className="w-3 h-3" />
                  <span>Ctrl+N • Ctrl+K — paleta</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setPaletteOpen(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all"
                >
                  <Command className="w-[18px] h-[18px]" />
                  <span>Paleta poleceń</span>
                  <span className="ml-auto text-[10px] opacity-60">⌘K</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActionsOpen(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all"
                >
                  <History className="w-[18px] h-[18px]" />
                  <span>Ostatnie akcje</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={toggleTheme}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all"
                >
                  <AnimatePresence mode="wait">
                    {dark ? (
                      <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                        <Sun className="w-[18px] h-[18px]" />
                      </motion.div>
                    ) : (
                      <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
                        <Moon className="w-[18px] h-[18px]" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <span>{dark ? "Tryb jasny" : "Tryb ciemny"}</span>
                </motion.button>
                <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSettingsOpen(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all"
                >
                  <SettingsIcon className="w-[18px] h-[18px]" />
                  <span>Ustawienia</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => window.dispatchEvent(new CustomEvent("kaczy:tour"))}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all"
                >
                  <HelpCircle className="w-[18px] h-[18px]" />
                  <span>Samouczek</span>
                </motion.button>
                <InstallAppButton />
                <p className="text-[10px] text-muted-foreground/40 text-center font-medium">KACZY v1.0 • Made with 🦆</p>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header
          className={cn(
            "sticky top-0 z-30 glass header-glow border-b border-border/50 transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none",
            hideHeader && !selectionMode ? "-translate-y-full" : "translate-y-0"
          )}
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <ChevronLeft className={cn("w-5 h-5 transition-transform duration-300", !sidebarOpen && "rotate-180")} />
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {sidebarOpen ? "Schowaj panel" : "Pokaż panel"}
                </TooltipContent>
              </Tooltip>
              {!sidebarOpen && (
                <motion.img
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={duckLogo}
                  alt="KACZY"
                  className="w-7 h-7"
                />
              )}
              <div>
                <h1 className="text-lg font-display font-extrabold leading-tight tracking-tight bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
                  {view === "notes" && "Notatki"}
                  {view === "today" && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-primary" />
                      Dziś
                    </span>
                  )}
                  {view === "week" && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-primary" />
                      Ten tydzień
                    </span>
                  )}
                  {view === "archive" && "Archiwum"}
                  {view === "reminders" && "Przypomnienia"}
                  {view === "folder" && (
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="w-4 h-4 text-primary" />
                      {folders.find((f) => f.id === activeFolder)?.name || "Folder"}
                    </span>
                  )}
                  {view === "label" && (
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-4 h-4 text-primary" />
                      {activeLabel}
                    </span>
                  )}
                </h1>
                <p className="text-[11px] text-muted-foreground hidden sm:block">
                  {displayNotes.length} {displayNotes.length === 1 ? "notatka" : displayNotes.length < 5 ? "notatki" : "notatek"}
                </p>
              </div>
            </div>

            <SearchBar value={search} onChange={setSearch} className="hidden sm:block" />

            <div className="flex items-center gap-1">
              {!sidebarOpen && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleTheme}
                  className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                >
                  {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </motion.button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                    title="Import / Eksport"
                  >
                    <Download className="w-5 h-5" />
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={() => { exportToJSON([...notes, ...archivedNotes]); markBackup(); }}>
                    <FileJson className="w-4 h-4 mr-2" />
                    Eksportuj jako JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToPDF(notes)}>
                    <FileText className="w-4 h-4 mr-2" />
                    Eksportuj jako PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToMarkdown([...notes, ...archivedNotes])}>
                    <FileText className="w-4 h-4 mr-2" />
                    Eksportuj jako Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToHTML([...notes, ...archivedNotes])}>
                    <FileText className="w-4 h-4 mr-2" />
                    Eksportuj jako HTML
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleImport}>
                    <Upload className="w-4 h-4 mr-2" />
                    Importuj z JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <ViewControls allLabels={allLabels} />
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 pb-safe">
          {view === "notes" && <DailyQuote />}
          {/* Mobile search */}
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

          {/* Trash view header with empty trash button */}
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
              <NoteGrid notes={pinned} searchQuery={search} onUpdate={updateNote} onDelete={handleDelete} onTogglePin={togglePin} onDuplicate={duplicateNote} onArchive={handleArchiveSingle} allLabels={allLabels} onCreateLabel={addLabel} folders={folders} onMoveToFolder={handleMoveToFolderGlow} getVersions={getVersions} onSaveVersion={addVersion} onRestoreVersion={handleRestoreVersion} knownTitles={knownTitles} onWikiClick={handleWikiClick} selectedIds={selectedIds} selectionMode={selectionMode} onToggleSelect={toggleSelect} />
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
                allLabels={allLabels}
                onCreateLabel={addLabel}
                isArchived={view === "archive" || view === "trash"}
                folders={folders}
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

          {displayNotes.length === 0 && !search && (
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-center py-20 sm:py-24">
              <motion.div
                className="relative w-32 h-32 mx-auto mb-6"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 blur-2xl" />
                <img src={duckLogo} alt="" className="relative w-32 h-32 mx-auto drop-shadow-xl" />
              </motion.div>
              <h2 className="text-3xl font-display font-extrabold gradient-text mb-2">
                {view === "archive" ? "Archiwum puste" : view === "trash" ? "Kosz jest pusty" : view === "reminders" ? "Brak przypomnień" : view === "today" ? "Brak notatek z dzisiaj" : view === "week" ? "Brak notatek z tego tygodnia" : view === "label" ? "Brak notatek z tą etykietą" : "Zacznij tworzyć ✨"}
              </h2>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                {view === "notes" ? "Stuknij w pasek powyżej, użyj szablonu lub naciśnij Ctrl+N" :
                 view === "archive" ? "Zarchiwizowane notatki pojawią się tutaj" :
                 view === "trash" ? "Usunięte notatki pojawią się tutaj" :
                 view === "reminders" ? "Notatki z przypomnieniami pojawią się tutaj" :
                 view === "today" ? "Notatki utworzone lub edytowane dzisiaj pojawią się tutaj" :
                 view === "week" ? "Notatki z ostatnich 7 dni pojawią się tutaj" :
                 "Dodaj etykietę do notatki, aby zobaczyć ją tutaj"}
              </p>
              {view === "notes" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto"
                >
                  {[
                    { k: "⌘K", l: "paleta poleceń" },
                    { k: "Ctrl+N", l: "nowa notatka" },
                    { k: "↑↑↓↓←→←→BA", l: "niespodzianka" },
                  ].map((s) => (
                    <span key={s.k} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/60 border border-border/40 rounded-full px-2.5 py-1">
                      <kbd className="font-mono font-semibold text-foreground/80">{s.k}</kbd>
                      <span>— {s.l}</span>
                    </span>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}

          {displayNotes.length === 0 && search && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <p className="text-lg font-display font-semibold text-foreground mb-1">Brak wyników</p>
              <p className="text-muted-foreground">Nic nie znaleziono dla „{search}"</p>
            </motion.div>
          )}
        </main>
      </div>
    </div>

    <CommandPalette
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      notes={[...notes, ...archivedNotes]}
      onOpenNote={() => { setView("notes"); }}
      onNewNote={() => { setView("notes"); setTimeout(() => addNoteRef.current?.expand(), 100); }}
      onGo={(v) => { setView(v); setActiveLabel(null); }}
      onToggleTheme={toggleTheme}
      onOpenSettings={() => setSettingsOpen(true)}
    />
    <BottomNav
      view={view}
      onGo={(v) => { setView(v); setActiveLabel(null); }}
      onNew={() => { setView("notes"); setTimeout(() => addNoteRef.current?.expand(), 100); }}
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

function SidebarLabelItem({ label, isActive, onSelect, onRename, onDelete }: {
  label: string; isActive: boolean; onSelect: () => void; onRename: (n: string) => void; onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  function save() {
    if (name.trim() && name.trim() !== label) onRename(name);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setName(label); setEditing(false); } }}
          className="flex-1 text-sm bg-muted/60 border border-border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/30 text-foreground min-w-0" />
        <motion.button whileTap={{ scale: 0.9 }} onClick={save} className="p-1 rounded-lg text-primary hover:bg-primary/10"><Check className="w-3.5 h-3.5" /></motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setName(label); setEditing(false); }} className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-3.5 h-3.5" /></motion.button>
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{ x: 3 }}
      className={cn(
        "group flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all duration-200 cursor-pointer",
        isActive ? "bg-primary/10 text-primary shadow-sm border border-primary/10" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      )}
      onClick={onSelect}
    >
      <Tag className="w-3.5 h-3.5 shrink-0" />
      <span className="flex-1 text-left truncate">{label}</span>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
        <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="p-1 rounded-lg hover:bg-foreground/10"><Pencil className="w-3 h-3" /></motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive"><Trash2 className="w-3 h-3" /></motion.button>
      </div>
    </motion.div>
  );
}

function SortableNoteCard({ layout, ...props }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.note.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={layout === "masonry" ? "break-inside-avoid mb-4" : layout === "grid" ? "h-full" : ""}>
      <NoteCard {...props} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  );
}

function NoteGrid({
  notes, searchQuery, onUpdate, onDelete, onTogglePin, onDuplicate, onArchive, onUnarchive, allLabels, onCreateLabel, isArchived, folders, onMoveToFolder, getVersions, onSaveVersion, onRestoreVersion, knownTitles, onWikiClick, selectedIds, selectionMode, onToggleSelect,
}: {
  notes: ReturnType<typeof useNotes>["notes"];
  searchQuery?: string;
  onUpdate?: ReturnType<typeof useNotes>["updateNote"];
  onDelete: ReturnType<typeof useNotes>["deleteNote"];
  onTogglePin?: ReturnType<typeof useNotes>["togglePin"];
  onDuplicate?: ReturnType<typeof useNotes>["duplicateNote"];
  onArchive?: (id: string) => void;
  onUnarchive?: ReturnType<typeof useNotes>["unarchiveNote"];
  allLabels: string[];
  onCreateLabel: (label: string) => void;
  isArchived?: boolean;
  folders?: Folder[];
  onMoveToFolder?: (noteId: string, folderId: string | null) => void;
  getVersions?: (noteId: string) => NoteVersion[];
  onSaveVersion?: (noteId: string, title: string, content: string) => void;
  onRestoreVersion?: (noteId: string, version: NoteVersion) => void;
  knownTitles?: Set<string>;
  onWikiClick?: (title: string) => void;
  selectedIds?: Set<string>;
  selectionMode?: boolean;
  onToggleSelect?: (id: string, shiftKey: boolean) => void;
}) {
  const prefs = useViewPrefs();
  const noteIds = notes.map((n) => n.id);
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const [quickPreviewId, setQuickPreviewId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation: arrows move focus, Space opens quick preview, Esc closes
  useEffect(() => {
    function isTyping() {
      const a = document.activeElement as HTMLElement | null;
      if (!a) return false;
      const tag = a.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || a.isContentEditable;
    }
    function anyDialogOpen() {
      return !!document.querySelector('[role="dialog"][data-state="open"]');
    }
    function onKey(e: KeyboardEvent) {
      // "/" focuses quick search even when nothing focused
      if (e.key === "/" && !isTyping() && !anyDialogOpen()) {
        const input = document.querySelector<HTMLInputElement>('input[placeholder="Szukaj notatek..."]');
        if (input) { e.preventDefault(); input.focus(); input.select(); return; }
      }
      if (notes.length === 0) return;
      if (isTyping()) return;
      // If quick preview open: Esc/Space closes, Enter opens editor, arrows/pgup/pgdn scroll content
      if (quickPreviewId) {
        if (e.key === "Escape" || e.key === " ") { e.preventDefault(); setQuickPreviewId(null); return; }
        if (e.key === "Enter") {
          e.preventDefault();
          const id = quickPreviewId;
          setQuickPreviewId(null);
          setTimeout(() => {
            const target = gridRef.current?.querySelector(`[data-note-idx="${notes.findIndex(n => n.id === id)}"] .cursor-pointer`) as HTMLElement | null;
            target?.click();
          }, 50);
          return;
        }
        const sc = previewScrollRef.current;
        if (sc) {
          const step = 80;
          if (e.key === "ArrowDown" || e.key === "j") { e.preventDefault(); sc.scrollBy({ top: step, behavior: "smooth" }); return; }
          if (e.key === "ArrowUp" || e.key === "k") { e.preventDefault(); sc.scrollBy({ top: -step, behavior: "smooth" }); return; }
          if (e.key === "PageDown") { e.preventDefault(); sc.scrollBy({ top: sc.clientHeight * 0.9, behavior: "smooth" }); return; }
          if (e.key === "PageUp") { e.preventDefault(); sc.scrollBy({ top: -sc.clientHeight * 0.9, behavior: "smooth" }); return; }
          if (e.key === "Home") { e.preventDefault(); sc.scrollTo({ top: 0, behavior: "smooth" }); return; }
          if (e.key === "End") { e.preventDefault(); sc.scrollTo({ top: sc.scrollHeight, behavior: "smooth" }); return; }
        }
        return;
      }
      if (anyDialogOpen()) return;
      const cols = (() => {
        if (prefs.layout === "list") return 1;
        if (!gridRef.current) return 1;
        const w = gridRef.current.clientWidth;
        if (prefs.autoColumns) {
          if (w >= 1280) return 4;
          if (w >= 1024) return 3;
          if (w >= 640) return 2;
          return 1;
        }
        return Math.max(1, Math.min(prefs.columns || 1, 4));
      })();
      const cur = focusedIdx < 0 ? 0 : focusedIdx;
      let next = cur;
      switch (e.key) {
        case "ArrowRight": next = Math.min(notes.length - 1, cur + 1); break;
        case "ArrowLeft": next = Math.max(0, cur - 1); break;
        case "ArrowDown": next = Math.min(notes.length - 1, cur + cols); break;
        case "ArrowUp": next = Math.max(0, cur - cols); break;
        case "Home": next = 0; break;
        case "End": next = notes.length - 1; break;
        case " ":
          if (focusedIdx >= 0 && notes[focusedIdx]) {
            e.preventDefault();
            setQuickPreviewId(notes[focusedIdx].id);
          }
          return;
        case "Enter":
          if (focusedIdx >= 0 && notes[focusedIdx]) {
            e.preventDefault();
            const target = gridRef.current?.querySelector(`[data-note-idx="${focusedIdx}"] .cursor-pointer`) as HTMLElement | null;
            target?.click();
          }
          return;
        case "Delete":
        case "Backspace":
          if (focusedIdx >= 0 && notes[focusedIdx]) {
            e.preventDefault();
            onDelete(notes[focusedIdx].id);
          }
          return;
        case "a":
        case "A":
          if (focusedIdx >= 0 && notes[focusedIdx] && !isArchived && onArchive) {
            e.preventDefault();
            onArchive(notes[focusedIdx].id);
          }
          return;
        case "p":
        case "P":
          if (focusedIdx >= 0 && notes[focusedIdx] && onTogglePin) {
            e.preventDefault();
            onTogglePin(notes[focusedIdx].id);
          }
          return;
        case "d":
        case "D":
          if (focusedIdx >= 0 && notes[focusedIdx] && onDuplicate) {
            e.preventDefault();
            onDuplicate(notes[focusedIdx].id);
          }
          return;
        default: return;
      }
      e.preventDefault();
      setFocusedIdx(next);
      const el = gridRef.current?.querySelector(`[data-note-idx="${next}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notes, focusedIdx, quickPreviewId, prefs.layout, prefs.autoColumns, prefs.columns, onDelete, onArchive, onTogglePin, onDuplicate, isArchived]);

  // Clamp focus when notes change
  useEffect(() => {
    if (focusedIdx >= notes.length) setFocusedIdx(notes.length - 1);
  }, [notes.length, focusedIdx]);

  const gap = prefs.density === "compact" ? "gap-2 space-y-2" : prefs.density === "comfy" ? "gap-6 space-y-6" : "gap-4 space-y-4";

  let containerClass: string;
  if (prefs.layout === "list") {
    containerClass = `max-w-2xl mx-auto ${gap.split(" ")[1]}`;
  } else if (prefs.layout === "grid") {
    const cols = prefs.autoColumns
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      : prefs.columns === 1 ? "grid-cols-1"
      : prefs.columns === 2 ? "grid-cols-1 sm:grid-cols-2"
      : prefs.columns === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
    containerClass = `grid ${cols} ${gap.split(" ")[0]} auto-rows-fr`;
  } else {
    const cols = prefs.autoColumns
      ? "columns-1 sm:columns-2 lg:columns-3 xl:columns-4"
      : prefs.columns === 1 ? "columns-1"
      : prefs.columns === 2 ? "columns-1 sm:columns-2"
      : prefs.columns === 3 ? "columns-1 sm:columns-2 lg:columns-3"
      : "columns-1 sm:columns-2 lg:columns-3 xl:columns-4";
    containerClass = `${cols} ${gap}`;
  }

  const previewNote = quickPreviewId ? notes.find((n) => n.id === quickPreviewId) : null;

  // Extract free-text tokens (drop operators) from search for highlighting
  const highlightTokens = (() => {
    const q = (searchQuery || "").trim();
    if (!q) return [] as string[];
    const out: string[] = [];
    for (const tok of q.split(/\s+/)) {
      if (/^(label|color|has):/i.test(tok)) continue;
      if (tok.length >= 2) out.push(tok);
    }
    return out;
  })();

  function escRx(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function highlight(text: string) {
    if (!highlightTokens.length || !text) return text as any;
    const rx = new RegExp(`(${highlightTokens.map(escRx).join("|")})`, "gi");
    const parts = text.split(rx);
    return parts.map((p, i) =>
      rx.test(p) && highlightTokens.some((t) => t.toLowerCase() === p.toLowerCase())
        ? <mark key={i} className="bg-primary/30 text-foreground rounded px-0.5">{p}</mark>
        : <Fragment key={i}>{p}</Fragment>
    );
  }

  function buildSnippets(text: string, max = 3): { before: string; match: string; after: string }[] {
    if (!highlightTokens.length || !text) return [];
    const rx = new RegExp(highlightTokens.map(escRx).join("|"), "gi");
    const out: { before: string; match: string; after: string }[] = [];
    let m: RegExpExecArray | null;
    const seen = new Set<number>();
    while ((m = rx.exec(text)) && out.length < max) {
      const start = Math.max(0, m.index - 40);
      if (seen.has(start)) continue;
      seen.add(start);
      out.push({
        before: (start > 0 ? "…" : "") + text.slice(start, m.index),
        match: m[0],
        after: text.slice(m.index + m[0].length, m.index + m[0].length + 60) + (m.index + m[0].length + 60 < text.length ? "…" : ""),
      });
    }
    return out;
  }

  const snippets = previewNote ? buildSnippets(previewNote.content || "") : [];
  const titleMatches = previewNote && highlightTokens.length ? highlightTokens.some((t) => previewNote.title.toLowerCase().includes(t.toLowerCase())) : false;

  return (
    <SortableContext items={noteIds} strategy={rectSortingStrategy}>
      <div ref={gridRef} className={containerClass}>
        <AnimatePresence mode="popLayout">
          {notes.map((note, i) => (
            <div
              key={note.id}
              data-note-idx={i}
              onClickCapture={() => setFocusedIdx(i)}
              className={cn(
                "rounded-2xl transition-shadow",
                prefs.layout === "masonry" ? "break-inside-avoid mb-4" : prefs.layout === "grid" ? "h-full" : "",
                focusedIdx === i && "ring-2 ring-primary/60 ring-offset-2 ring-offset-background"
              )}
            >
              <SortableNoteCard
                note={note}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onTogglePin={onTogglePin}
                onDuplicate={onDuplicate}
                onArchive={onArchive}
                onUnarchive={onUnarchive}
                allLabels={allLabels}
                onCreateLabel={onCreateLabel}
                index={i}
                isArchived={isArchived}
                folders={folders}
                onMoveToFolder={onMoveToFolder}
                noteVersions={getVersions ? getVersions(note.id) : undefined}
                onSaveVersion={onSaveVersion}
                onRestoreVersion={onRestoreVersion}
                knownTitles={knownTitles}
                onWikiClick={onWikiClick}
                layout={prefs.layout}
                selected={selectedIds?.has(note.id) ?? false}
                selectionMode={selectionMode}
                onToggleSelect={onToggleSelect}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence onExitComplete={() => { /* noop */ }}>
        {previewNote && (
          <>
            {/* Light transparent backdrop — keeps notes visible behind */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-background/20 backdrop-blur-[2px]"
              onClick={() => setQuickPreviewId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              role="dialog"
              aria-label="Szybki podgląd notatki"
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(42rem,calc(100vw-2rem))] max-h-[80vh] flex flex-col rounded-2xl border border-border/60 bg-card/95 backdrop-blur-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onWheelCapture={(e) => e.stopPropagation()}
            >
              <div className="px-6 pt-5 pb-3 border-b border-border/40">
                <h2 className="font-display text-lg font-semibold leading-tight">
                  {previewNote.title ? highlight(previewNote.title) : "Bez tytułu"}
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Szybki podgląd · ↑/↓ PgUp/PgDn — przewiń · Enter — edytuj · Spacja/Esc — zamknij
                </p>
                {highlightTokens.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pasuje do:</span>
                    {highlightTokens.map((t) => (
                      <span key={t} className="text-[11px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">{t}</span>
                    ))}
                    <span className="text-[10px] text-muted-foreground ml-1">
                      {snippets.length + (titleMatches ? 1 : 0)} trafień{snippets.length >= 3 ? "+" : ""}
                    </span>
                  </div>
                )}
              </div>
              <div ref={previewScrollRef} className="overflow-y-auto px-6 py-4 overscroll-contain">
                {snippets.length > 0 && (
                  <div className="mb-4 space-y-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dopasowania w treści</p>
                    {snippets.map((s, i) => (
                      <div key={i} className="text-xs text-foreground/80 bg-muted/40 rounded-lg px-2.5 py-1.5 leading-relaxed">
                        {s.before}
                        <mark className="bg-primary/30 text-foreground rounded px-0.5">{s.match}</mark>
                        {s.after}
                      </div>
                    ))}
                  </div>
                )}
                {previewNote.content && (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <MarkdownRenderer content={previewNote.content} knownTitles={knownTitles} onWikiClick={onWikiClick} />
                  </div>
                )}
                {previewNote.checklist && previewNote.checklist.length > 0 && (
                  <ul className="text-sm space-y-1 mt-2">
                    {previewNote.checklist.map((c) => (
                      <li key={c.id} className={cn("flex gap-2", c.checked && "line-through text-muted-foreground")}>
                        <span>{c.checked ? "☑" : "☐"}</span><span>{highlight(c.text)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {previewNote.images && previewNote.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {previewNote.images.map((img, i) => (
                      <img key={i} src={img} alt="" className="w-full rounded-lg" loading="lazy" />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </SortableContext>
  );
}

const FOLDER_COLORS: { value: FolderColor; label: string }[] = [
  { value: "default", label: "Domyślny" },
  { value: "coral", label: "Koral" },
  { value: "peach", label: "Brzoskwinia" },
  { value: "sand", label: "Piasek" },
  { value: "mint", label: "Mięta" },
  { value: "sage", label: "Szałwia" },
  { value: "sky", label: "Niebo" },
  { value: "lavender", label: "Lawenda" },
  { value: "rose", label: "Róża" },
];

const FOLDER_EMOJIS = ["📁", "📂", "📝", "📌", "⭐", "💡", "🎯", "🔥", "💼", "🏠", "🎓", "🎨", "🎵", "📷", "✈️", "🍕", "🌱", "💰", "❤️", "🚀", "📚", "🛒", "💻", "🧪", "🏋️", "🎮", "🐾", "🌍"];

function SidebarAddFolderButton({ onAdd }: { onAdd: (name: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding && inputRef.current) inputRef.current.focus(); }, [adding]);

  function submit() {
    if (name.trim()) { onAdd(name.trim()); setName(""); setAdding(false); }
  }

  if (adding) {
    return (
      <div className="flex items-center gap-1">
        <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setName(""); setAdding(false); } }}
          className="text-xs bg-muted/60 border border-border rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary/30 text-foreground w-24" placeholder="Nazwa..." />
        <motion.button whileTap={{ scale: 0.9 }} onClick={submit} className="p-0.5 rounded text-primary hover:bg-primary/10"><Check className="w-3 h-3" /></motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setName(""); setAdding(false); }} className="p-0.5 rounded text-muted-foreground hover:bg-muted"><X className="w-3 h-3" /></motion.button>
      </div>
    );
  }

  return (
    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setAdding(true)} className="p-0.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Nowy folder">
      <FolderPlus className="w-3.5 h-3.5" />
    </motion.button>
  );
}

function SidebarFolderItem({ folder, folders, isActive, activeFolderId, view, onSelect, onRename, onDelete, onSetColor, onSetEmoji, onAddSubfolder }: {
  folder: Folder; folders: Folder[]; isActive: boolean; activeFolderId: string | null; view: string;
  onSelect: (id: string) => void; onRename: (id: string, name: string) => void; onDelete: (id: string) => void;
  onSetColor: (id: string, color: FolderColor) => void; onSetEmoji: (id: string, emoji: string | null) => void; onAddSubfolder: (parentId: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [expanded, setExpanded] = useState(true);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [subName, setSubName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const subInputRef = useRef<HTMLInputElement>(null);
  const children = folders.filter((f) => f.parentId === folder.id);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);
  useEffect(() => { if (addingSub && subInputRef.current) subInputRef.current.focus(); }, [addingSub]);

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `folder-drop-${folder.id}` });

  function save() {
    if (name.trim() && name.trim() !== folder.name) onRename(folder.id, name.trim());
    setEditing(false);
  }

  function submitSub() {
    if (subName.trim()) { onAddSubfolder(folder.id, subName.trim()); setSubName(""); setAddingSub(false); }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 px-2 py-1">
        <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setName(folder.name); setEditing(false); } }}
          className="flex-1 text-sm bg-muted/60 border border-border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/30 text-foreground min-w-0" />
        <motion.button whileTap={{ scale: 0.9 }} onClick={save} className="p-1 rounded-lg text-primary hover:bg-primary/10"><Check className="w-3.5 h-3.5" /></motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setName(folder.name); setEditing(false); }} className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-3.5 h-3.5" /></motion.button>
      </div>
    );
  }

  return (
    <div ref={setDropRef} data-folder-drop={folder.id}>
      <motion.div
        whileHover={{ x: 3 }}
        className={cn(
          "group flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all duration-200 cursor-pointer",
          isActive ? "bg-primary/10 text-primary shadow-sm border border-primary/10" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
          isOver && "bg-primary/20 ring-2 ring-primary/40 scale-[1.02]"
        )}
        onClick={() => onSelect(folder.id)}
      >
        {children.length > 0 ? (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5"
          >
            <ChevronRight className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")} />
          </motion.button>
        ) : (
          <span className="w-4" />
        )}
        {folder.emoji ? (
          <span className="text-sm shrink-0">{folder.emoji}</span>
        ) : (
          <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", folderColorDot[folder.color] || folderColorDot.default)} />
        )}
        <span className="flex-1 text-left truncate">{folder.name}</span>
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
          <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); setShowEmojiPicker(false); }} className="p-1 rounded-lg hover:bg-foreground/10"><Palette className="w-3 h-3" /></motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setShowEmojiPicker(!showEmojiPicker); setShowColorPicker(false); }} className="p-1 rounded-lg hover:bg-foreground/10"><Smile className="w-3 h-3" /></motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setAddingSub(true); }} className="p-1 rounded-lg hover:bg-foreground/10"><FolderPlus className="w-3 h-3" /></motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="p-1 rounded-lg hover:bg-foreground/10"><Pencil className="w-3 h-3" /></motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); onDelete(folder.id); }} className="p-1 rounded-lg hover:bg-destructive/10 hover:text-destructive"><Trash2 className="w-3 h-3" /></motion.button>
        </div>
      </motion.div>

      {/* Color picker */}
      <AnimatePresence>
        {showColorPicker && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-6 py-1.5">
            <div className="flex flex-wrap gap-1.5">
              {FOLDER_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={(e) => { e.stopPropagation(); onSetColor(folder.id, c.value); setShowColorPicker(false); }}
                  className={cn("w-5 h-5 rounded-full border-2 transition-all", folderColorDot[c.value], folder.color === c.value ? "border-primary scale-110" : "border-transparent hover:scale-110")}
                  title={c.label}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Emoji picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="px-6 py-1.5">
            <div className="flex flex-wrap gap-1">
              {folder.emoji && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSetEmoji(folder.id, null); setShowEmojiPicker(false); }}
                  className="w-6 h-6 rounded text-xs flex items-center justify-center border border-dashed border-muted-foreground/30 hover:bg-muted/80 text-muted-foreground"
                  title="Usuń emoji"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              {FOLDER_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={(e) => { e.stopPropagation(); onSetEmoji(folder.id, emoji); setShowEmojiPicker(false); }}
                  className={cn("w-6 h-6 rounded text-sm flex items-center justify-center hover:bg-muted/80 transition-all", folder.emoji === emoji ? "bg-primary/10 ring-1 ring-primary scale-110" : "hover:scale-110")}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add subfolder input */}
      {addingSub && (
        <div className="flex items-center gap-1 px-6 py-1">
          <input ref={subInputRef} value={subName} onChange={(e) => setSubName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitSub(); if (e.key === "Escape") { setSubName(""); setAddingSub(false); } }}
            className="flex-1 text-xs bg-muted/60 border border-border rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary/30 text-foreground min-w-0" placeholder="Subfolder..." />
          <motion.button whileTap={{ scale: 0.9 }} onClick={submitSub} className="p-0.5 rounded text-primary hover:bg-primary/10"><Check className="w-3 h-3" /></motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setSubName(""); setAddingSub(false); }} className="p-0.5 rounded text-muted-foreground hover:bg-muted"><X className="w-3 h-3" /></motion.button>
        </div>
      )}

      {/* Children */}
      {expanded && children.length > 0 && (
        <div className="pl-4">
          {children.map((child) => (
            <SidebarFolderItem
              key={child.id}
              folder={child}
              folders={folders}
              isActive={view === "folder" && activeFolderId === child.id}
              activeFolderId={activeFolderId}
              view={view}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onSetColor={onSetColor}
              onSetEmoji={onSetEmoji}
              onAddSubfolder={onAddSubfolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Index;
